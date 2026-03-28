import { FastifyInstance } from "fastify";
import { requireOperator } from "../middleware/auth";
import * as db from "../db";
import * as solana from "../services/solana";

export async function operatorRoutes(app: FastifyInstance) {

  app.post("/operators/register", async (req, reply) => {
    const { email, orgName } = req.body as { email: string; orgName: string };
    if (!email || !orgName) return reply.status(400).send({ error: "email and orgName required" });
    const operator = await db.createOperator(email, orgName);
    return reply.send({ message: "Operator registered", operatorId: operator.id, apiKey: operator.apiKey, note: "Save this API key" });
  });

  app.post("/operators/agents", { preHandler: requireOperator }, async (req, reply) => {
    const { name, description, walletAddress, chain, policy } = req.body as {
      name: string; description?: string; walletAddress: string; chain?: string; policy?: Partial<db.Policy>;
    };
    if (!name) return reply.status(400).send({ error: "name is required" });
    if (!walletAddress) return reply.status(400).send({ error: "walletAddress is required" });
    const txChain = chain || "solana";
    if (txChain === "solana" && !solana.isValidSolanaAddress(walletAddress)) return reply.status(400).send({ error: "Invalid Solana address" });
    const defaultPolicy: db.Policy = {
      dailyLimit:           policy?.dailyLimit           ?? 1.0,
      txLimit:              policy?.txLimit               ?? 0.1,
      whitelistedAddresses: policy?.whitelistedAddresses  ?? [],
      requireApprovalAbove: policy?.requireApprovalAbove  ?? 0.5,
      allowedChains:        policy?.allowedChains         ?? [txChain],
      killSwitch:           policy?.killSwitch            ?? false,
    };
    const agent = await db.createAgent({ operatorId: req.operator!.id, name, description: description || "", walletAddress, chain: txChain, policy: defaultPolicy });
    return reply.send({ message: "Agent registered", agentId: agent.id, agentApiKey: agent.apiKey, walletAddress: agent.walletAddress, chain: agent.chain, policy: agent.policy });
  });

  app.get("/operators/agents", { preHandler: requireOperator }, async (req, reply) => {
    const agents = await db.getOperatorAgents(req.operator!.id);
    const enriched = await Promise.all(agents.map(async (agent) => {
      const balance = agent.chain === "solana" ? await solana.getBalance(agent.walletAddress) : { sol: 0, lamports: 0 };
      return { id: agent.id, name: agent.name, description: agent.description, walletAddress: agent.walletAddress, chain: agent.chain, status: agent.status, roleName: agent.roleName, roleDocument: agent.roleDocument, inGroup: agent.inGroup || false, balance, todaySpend: await db.getTodaySpend(agent.id), dailyLimit: agent.policy.dailyLimit, policy: agent.policy, createdAt: agent.createdAt };
    }));
    return reply.send({ agents: enriched });
  });

  app.patch("/operators/agents/:agentId/policy", { preHandler: requireOperator }, async (req, reply) => {
    const { agentId } = req.params as { agentId: string };
    const updates = req.body as Partial<db.Policy>;
    const agent = await db.getAgentById(agentId);
    if (!agent || agent.operatorId !== req.operator!.id) return reply.status(404).send({ error: "Agent not found" });
    await db.updateAgentPolicy(agentId, updates);
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
