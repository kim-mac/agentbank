import { FastifyInstance } from "fastify";
import { requireOperator } from "../middleware/auth";
import * as db from "../db";
import * as solana from "../services/solana";
import * as base from "../services/base";
import * as squads from "../services/squads";
import { isAddress } from "viem";
import { getPremiumPricing, updatePremiumPricing } from "../services/x402-config";

export async function operatorRoutes(app: FastifyInstance) {
  function remediationForPrerequisite(code: string): string {
    switch (code) {
      case "claim_agent":
        return "Open the claim link and activate the agent.";
      case "native_x402_requires_base_chain":
        return "Register or migrate this agent to Base chain for native x402.";
      case "configure_api_base_url":
        return "Set API_URL in backend environment to a valid /v1 base URL.";
      case "configure_x402_pricing":
        return "Update x402 pricing (network, amountAtomic, asset) in operator pricing settings.";
      case "configure_x402_pay_to":
        return "Set a real settlement address in X402_PAY_TO or operator pricing payTo.";
      default:
        return "Review capability diagnostics and rerun strict smoke.";
    }
  }

  function computeAgentX402Readiness(agent: db.Agent) {
    const cfg = getPremiumPricing();
    const claimStatus = (agent as any).claimStatus || "claimed";
    const isClaimed = claimStatus === "claimed";
    const isBaseChain = agent.chain === "base";
    const premiumEndpointConfigured = Boolean(process.env.API_URL || "http://localhost:3001/v1");
    const x402PricingConfigured = Boolean(cfg.network && cfg.asset && cfg.amountAtomic);
    const x402PayToConfigured = Boolean(
      cfg.payTo && cfg.payTo !== "0x1111111111111111111111111111111111111111"
    );

    const missingPrerequisites: string[] = [];
    if (!isClaimed) missingPrerequisites.push("claim_agent");
    if (!isBaseChain) missingPrerequisites.push("native_x402_requires_base_chain");
    if (!premiumEndpointConfigured) missingPrerequisites.push("configure_api_base_url");
    if (!x402PricingConfigured) missingPrerequisites.push("configure_x402_pricing");
    if (!x402PayToConfigured) missingPrerequisites.push("configure_x402_pay_to");

    const canUseProxyX402 = isClaimed;
    const canUseNativeX402 = isClaimed && isBaseChain && premiumEndpointConfigured && x402PricingConfigured && x402PayToConfigured;
    const x402Mode = canUseNativeX402
      ? "native_enabled"
      : canUseProxyX402
        ? "proxy_enabled"
        : "not_enabled";

    return {
      claimStatus,
      x402Mode,
      canUseProxyX402,
      canUseNativeX402,
      missingPrerequisites,
      blockerHints: missingPrerequisites.map((code) => ({
        code,
        remediation: remediationForPrerequisite(code),
      })),
    };
  }


  app.post("/operators/register", async (req, reply) => {
    const { email, orgName } = req.body as { email: string; orgName: string };
    if (!email || !orgName) return reply.status(400).send({ error: "email and orgName required" });
    const operator = await db.createOperator(email, orgName);
    return reply.send({ message: "Operator registered", operatorId: operator.id, apiKey: operator.apiKey, note: "Save this API key" });
  });

  app.post("/operators/agents", { preHandler: requireOperator }, async (req, reply) => {
    const { name, description, walletAddress, chain, policy, squadsEnabled } = req.body as {
      name: string; description?: string; walletAddress: string; chain?: string; policy?: Partial<db.Policy>; squadsEnabled?: boolean;
    };
    if (!name) return reply.status(400).send({ error: "name is required" });
    if (!walletAddress) return reply.status(400).send({ error: "walletAddress is required" });
    const txChain = chain || "solana";
    if (txChain === "solana" && !solana.isValidSolanaAddress(walletAddress)) return reply.status(400).send({ error: "Invalid Solana address" });
    if (txChain === "base"   && !base.isValidBaseAddress(walletAddress))     return reply.status(400).send({ error: "Invalid Base address" });
    const defaultPolicy: db.Policy = {
      dailyLimit:           policy?.dailyLimit           ?? 1.0,
      txLimit:              policy?.txLimit               ?? 0.1,
      whitelistedAddresses: policy?.whitelistedAddresses  ?? [],
      requireApprovalAbove: policy?.requireApprovalAbove  ?? 0.5,
      allowedChains:        policy?.allowedChains         ?? [txChain],
      killSwitch:           policy?.killSwitch            ?? false,
    };
    const useSquads = Boolean(squadsEnabled && txChain === "solana");
    let squadsMeta: {
      squadsEnabled?: boolean;
      squadsMultisigPda?: string;
      squadsVaultPda?: string;
      squadsVaultIndex?: number;
      squadsSpendingLimitPda?: string;
      squadsCreateKey?: string;
    } = {};

    if (useSquads) {
      const ms = await squads.createAgentMultisig(walletAddress);
      const sl = await squads.configureSpendingLimit({
        multisigPda: ms.multisigPda,
        policy: defaultPolicy,
        vaultIndex: ms.vaultIndex,
        agentPublicKey: walletAddress,
      });
      squadsMeta = {
        squadsEnabled: true,
        squadsMultisigPda: ms.multisigPda,
        squadsVaultPda: ms.vaultPda,
        squadsVaultIndex: ms.vaultIndex,
        squadsSpendingLimitPda: sl.spendingLimitPda,
        squadsCreateKey: ms.createKey,
      };
    }

    const agent = await db.createAgent({
      operatorId: req.operator!.id,
      name,
      description: description || "",
      walletAddress,
      chain: txChain,
      policy: defaultPolicy,
      ...squadsMeta,
    });
    return reply.send({
      message: "Agent registered",
      agentId: agent.id,
      agentApiKey: agent.apiKey,
      walletAddress: agent.walletAddress,
      chain: agent.chain,
      policy: agent.policy,
      squadsEnabled: agent.squadsEnabled || false,
      squadsVaultPda: agent.squadsVaultPda,
      depositAddress: agent.squadsEnabled ? agent.squadsVaultPda : agent.walletAddress,
    });
  });

  app.get("/operators/agents", { preHandler: requireOperator }, async (req, reply) => {
    const agents = await db.getOperatorAgents(req.operator!.id);
    const enriched = await Promise.all(agents.map(async (agent) => {
      let balance: { native: number; unit: string };
      if (agent.chain === "base") {
        const bal = await base.getBalance(agent.walletAddress);
        balance = { native: bal.eth, unit: "ETH" };
      } else if (agent.squadsEnabled && agent.squadsVaultPda) {
        const bal = await squads.getVaultBalance(agent.squadsVaultPda);
        balance = { native: bal.sol, unit: "SOL" };
      } else {
        const bal = await solana.getBalance(agent.walletAddress);
        balance = { native: bal.sol, unit: "SOL" };
      }
      return {
        id: agent.id, name: agent.name, description: agent.description, walletAddress: agent.walletAddress, chain: agent.chain, status: agent.status,
        roleName: agent.roleName, roleDocument: agent.roleDocument, inGroup: agent.inGroup || false, balance, todaySpend: await db.getTodaySpend(agent.id),
        dailyLimit: agent.policy.dailyLimit, policy: agent.policy, createdAt: agent.createdAt, paperMode: (agent as any).paperMode, paperBalance: (agent as any).paperBalance,
        squadsEnabled: agent.squadsEnabled || false, squadsMultisigPda: agent.squadsMultisigPda, squadsVaultPda: agent.squadsVaultPda,
        squadsVaultIndex: agent.squadsVaultIndex ?? 0, squadsSpendingLimitPda: agent.squadsSpendingLimitPda,
      };
    }));
    return reply.send({ agents: enriched });
  });

  app.patch("/operators/agents/:agentId/policy", { preHandler: requireOperator }, async (req, reply) => {
    const { agentId } = req.params as { agentId: string };
    const updates = req.body as Partial<db.Policy>;
    const agent = await db.getAgentById(agentId);
    if (!agent || agent.operatorId !== req.operator!.id) return reply.status(404).send({ error: "Agent not found" });
    await db.updateAgentPolicy(agentId, updates);
    const nextAgent = await db.getAgentById(agentId);

    if (nextAgent?.squadsEnabled && nextAgent.chain === "solana" && nextAgent.squadsMultisigPda) {
      if (nextAgent.squadsSpendingLimitPda) {
        await squads.removeSpendingLimit(nextAgent.squadsMultisigPda, nextAgent.squadsSpendingLimitPda);
      }
      const sl = await squads.configureSpendingLimit({
        multisigPda: nextAgent.squadsMultisigPda,
        policy: nextAgent.policy,
        vaultIndex: nextAgent.squadsVaultIndex ?? 0,
        agentPublicKey: nextAgent.walletAddress,
      });
      await db.updateAgentSquads(agentId, { squadsSpendingLimitPda: sl.spendingLimitPda });
    }

    return reply.send({ message: "Policy updated", policy: (await db.getAgentById(agentId))?.policy });
  });

  app.post("/operators/agents/:agentId/freeze", { preHandler: requireOperator }, async (req, reply) => {
    const { agentId } = req.params as { agentId: string };
    const { action } = req.body as { action: "freeze" | "unfreeze" | "pause" };
    const agent = await db.getAgentById(agentId);
    if (!agent || agent.operatorId !== req.operator!.id) return reply.status(404).send({ error: "Agent not found" });
    const statusMap = { freeze: "frozen", unfreeze: "active", pause: "paused" } as const;
    await db.updateAgentStatus(agentId, statusMap[action]);
    if (action === "freeze")   await db.updateAgentPolicy(agentId, { killSwitch: true });
    if (action === "unfreeze") await db.updateAgentPolicy(agentId, { killSwitch: false });
    if (agent.squadsEnabled && agent.chain === "solana" && agent.squadsMultisigPda) {
      if (action === "freeze") {
        await squads.removeMember(agent.squadsMultisigPda, agent.walletAddress);
      }
      if (action === "unfreeze") {
        await squads.addMember(agent.squadsMultisigPda, agent.walletAddress);
      }
    }
    return reply.send({ message: `Agent ${action}d`, status: statusMap[action] });
  });

  app.get("/operators/approvals", { preHandler: requireOperator }, async (req, reply) => {
    const pending = await db.getPendingApprovals(req.operator!.id);
    const enriched = await Promise.all(pending.map(async (approval) => {
      const tx    = await db.getTransaction(approval.transactionId);
      const agent = await db.getAgentById(approval.agentId);
      return { approvalId: approval.id, transactionId: approval.transactionId, agentName: agent?.name, agentId: approval.agentId, amount: tx?.amount, token: tx?.token, toAddress: tx?.toAddress, memo: tx?.memo, chain: tx?.chain, createdAt: approval.createdAt };
    }));
    return reply.send({ pendingApprovals: enriched });
  });

  app.post("/operators/approvals/:approvalId", { preHandler: requireOperator }, async (req, reply) => {
    const { approvalId } = req.params as { approvalId: string };
    const { action } = req.body as { action: "approve" | "reject" };
    const approval = await db.getApprovalRequest(approvalId);
    if (!approval || approval.operatorId !== req.operator!.id) return reply.status(404).send({ error: "Not found" });
    if (approval.status !== "pending") return reply.status(400).send({ error: "Already resolved" });
    await db.updateApprovalRequest(approvalId, action === "approve" ? "approved" : "rejected");
    await db.updateTransaction(approval.transactionId, { status: action === "approve" ? "approved" : "rejected", ...(action === "reject" && { rejectReason: "Rejected by operator" }) });
    if (action === "approve") {
      const tx = await db.getTransaction(approval.transactionId);
      const agent = await db.getAgentById(approval.agentId);
      if (agent?.squadsEnabled && agent.squadsMultisigPda && tx?.memo?.startsWith("squads:txIndex:")) {
        const raw = tx.memo.split("squads:txIndex:")[1];
        if (raw) await squads.approveProposal(agent.squadsMultisigPda, BigInt(raw));
      }
    }
    return reply.send({ message: action === "approve" ? "Approved — agent will sign and broadcast" : "Rejected" });
  });

  // ── Update agent role ────────────────────────────────────────────────────
  app.patch("/operators/agents/:id/role", { preHandler: requireOperator }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { roleName, roleDocument, inGroup } = req.body as {
      roleName?:     string;
      roleDocument?: string;
      inGroup?:      boolean;
    };
    const agent = await db.getAgentById(id);
    if (!agent) return reply.status(404).send({ error: "Agent not found" });
    if (agent.operatorId !== req.operator!.id) return reply.status(403).send({ error: "Not your agent" });
    await db.updateAgentRole(id, roleName, roleDocument, inGroup ?? agent.inGroup ?? false);
    console.log(`[Role] Agent '${agent.name}' role set to '${roleName}'`);
    return reply.send({ updated: true, agentId: id, roleName, inGroup });
  });

  // ── Agent directory (who's in the group + their roles) ───────────────────
  app.get("/operators/agents/directory", { preHandler: requireOperator }, async (req, reply) => {
    const agents = await db.getOperatorAgents(req.operator!.id);
    return reply.send({
      directory: agents.map(a => ({
        agentId:      a.id,
        name:         a.name,
        roleName:     (a as any).roleName,
        roleDocument: (a as any).roleDocument,
        inGroup:      (a as any).inGroup || false,
        status:       a.status,
        walletAddress: a.walletAddress,
      })),
      groupChannelId: req.operator!.id,
      groupAgents:    agents.filter((a: any) => a.inGroup).length,
    });
  });

  // ── Send message on behalf of agent (operator action) ─────────────────
  app.post("/operators/messages/send", { preHandler: requireOperator }, async (req, reply) => {
    const { fromAgentId, toAgentId, content, messageType = "text" } = req.body as {
      fromAgentId:  string;
      toAgentId:    string;
      content:      string;
      messageType?: string;
    };

    if (!fromAgentId || !toAgentId || !content?.trim()) {
      return reply.status(400).send({ error: "fromAgentId, toAgentId, and content are required" });
    }

    const fromAgent = await db.getAgentById(fromAgentId);
    const toAgent   = await db.getAgentById(toAgentId);
    if (!fromAgent) return reply.status(404).send({ error: "Sender agent not found" });
    if (!toAgent)   return reply.status(404).send({ error: "Recipient agent not found" });
    if (fromAgent.operatorId !== req.operator!.id) return reply.status(403).send({ error: "Sender agent not yours" });

    const msg = await db.createMessage({
      senderAgentId:   fromAgentId,
      receiverAgentId: toAgentId,
      channelType:     "dm",
      content:         content.trim(),
      messageType:     (messageType as any) || "text",
    });

    console.log(`[Operator] Sent message: ${fromAgent.name} → ${toAgent.name}`);
    return reply.send({ message: msg, sent: true });
  });

  // ── Delete agent ───────────────────────────────────────────────────────
  app.delete("/operators/agents/:id", { preHandler: requireOperator }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const agent = await db.getAgentById(id);
    if (!agent) return reply.status(404).send({ error: "Agent not found" });
    if (agent.operatorId !== req.operator!.id) return reply.status(403).send({ error: "Not your agent" });
    await db.deleteAgent(id);
    console.log(`[Delete] Agent '${agent.name}' deleted by operator '${req.operator!.orgName}'`);
    return reply.send({ message: `Agent '${agent.name}' deleted`, agentId: id });
  });

  app.get("/operators/transactions", { preHandler: requireOperator }, async (req, reply) => {
    return reply.send({ transactions: await db.getOperatorTransactions(req.operator!.id) });
  });

  app.get("/operators/x402/pricing", { preHandler: requireOperator }, async (req, reply) => {
    return reply.send({ pricing: getPremiumPricing() });
  });

  app.patch("/operators/x402/pricing", { preHandler: requireOperator }, async (req, reply) => {
    const body = req.body as Partial<{
      network: string;
      amountAtomic: string;
      asset: string;
      payTo: string;
      description: string;
      maxTimeoutSeconds: number;
    }>;

    if (body.payTo !== undefined && !isAddress(body.payTo)) {
      return reply.status(400).send({ error: "payTo must be a valid EVM address" });
    }
    if (body.amountAtomic !== undefined && (!/^\d+$/.test(body.amountAtomic) || body.amountAtomic === "0")) {
      return reply.status(400).send({ error: "amountAtomic must be a positive integer string" });
    }
    if (body.maxTimeoutSeconds !== undefined && (!Number.isInteger(body.maxTimeoutSeconds) || body.maxTimeoutSeconds < 10)) {
      return reply.status(400).send({ error: "maxTimeoutSeconds must be an integer >= 10" });
    }

    const pricing = updatePremiumPricing(body, req.operator!.id);
    return reply.send({
      message: "x402 premium pricing updated",
      pricing,
      note: "This demo config is in-memory and resets on backend restart",
    });
  });

  app.get("/operators/x402/revenue", { preHandler: requireOperator }, async (req, reply) => {
    const revenue = await db.getX402RevenueStats(req.operator!.id);
    return reply.send({
      revenue,
      unit: "USDC atomic (6 decimals)",
      hint: "divide amountAtomic by 1,000,000 for USDC",
    });
  });

  app.get("/operators/x402/payments", { preHandler: requireOperator }, async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const page = Math.min(10_000, Math.max(1, parseInt(q.page || "1", 10) || 1));
    const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize || "20", 10) || 20));
    const network = q.network?.trim() || undefined;
    const fromDate = q.from?.trim() || undefined;
    const toDate = q.to?.trim() || undefined;
    let verified: boolean | undefined;
    if (q.verified === "true") verified = true;
    else if (q.verified === "false") verified = false;

    const { items, total } = await db.listX402Payments({
      operatorId: req.operator!.id,
      network,
      fromDate,
      toDate,
      verified,
      page,
      pageSize,
    });
    return reply.send({ payments: items, total, page, pageSize });
  });

  app.get("/operators/x402/readiness", { preHandler: requireOperator }, async (req, reply) => {
    const agents = await db.getOperatorAgents(req.operator!.id);
    const readiness = agents.map((agent) => {
      const x402 = computeAgentX402Readiness(agent);
      return {
        agentId: agent.id,
        agentName: agent.name,
        chain: agent.chain,
        status: agent.status,
        ...x402,
      };
    });

    const summary = {
      totalAgents: readiness.length,
      nativeReady: readiness.filter((a) => a.x402Mode === "native_enabled").length,
      proxyOnly: readiness.filter((a) => a.x402Mode === "proxy_enabled").length,
      notEnabled: readiness.filter((a) => a.x402Mode === "not_enabled").length,
      withBlockers: readiness.filter((a) => a.missingPrerequisites.length > 0).length,
    };

    return reply.send({ summary, readiness });
  });

  // ── Public feed endpoint (no auth required) ─────────────────────────────
  app.get("/feed", async (req, reply) => {
    const { limit = "30" } = req.query as { limit?: string }
    try {
      // Get all confirmed transactions, then enrich with agent names
      const { createClient } = await import("@supabase/supabase-js")
      const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

      // Fetch transactions
      const { data: txs, error: txErr } = await supabase
        .from("transactions")
        .select("*")
        .eq("status", "confirmed")
        .order("created_at", { ascending: false })
        .limit(+limit)

      if (txErr) throw txErr

      // Fetch agent names for these transactions
      const agentIds = [...new Set((txs || []).map((t: any) => t.agent_id))]
      const { data: agents } = await supabase
        .from("agents")
        .select("id, name, wallet_address, chain")
        .in("id", agentIds)

      const agentMap = Object.fromEntries((agents || []).map((a: any) => [a.id, a]))

      return reply.send({
        transactions: (txs || []).map((t: any) => {
          const agent = agentMap[t.agent_id] || {}
          return {
            id:            t.id,
            agentName:     agent.name     || "unknown",
            walletAddress: agent.wallet_address || t.from_address,
            chain:         t.chain,
            amount:        t.amount,
            token:         t.token,
            toAddress:     t.to_address,
            memo:          t.memo,
            txHash:        t.tx_hash,
            confirmedAt:   t.confirmed_at || t.created_at,
            createdAt:     t.created_at,
          }
        }),
      })
    } catch (err: any) {
      console.error("[Feed] Error:", err.message)
      return reply.status(500).send({ error: "Feed unavailable", detail: err.message })
    }
  })
}
