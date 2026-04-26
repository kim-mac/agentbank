// register-routes.ts — Registration, claim flow, dynamic skill files

import { FastifyInstance } from "fastify";
import * as db from "../db";
import * as solana from "../services/solana";
import * as base from "../services/base";
import * as squads from "../services/squads";
import { buildGenericSkill, buildPersonalizedSkill } from "../services/skill-builder";
import { getPremiumPricing } from "../services/x402-config";

const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000";
const API_URL       = process.env.API_URL        || "http://localhost:3001/v1";
const SITE_URL      = process.env.SITE_URL       || "http://localhost:3000";

export async function registerRoutes(app: FastifyInstance) {
  type X402Readiness = {
    x402Mode: "not_enabled" | "proxy_enabled" | "native_enabled";
    modeReason: string;
    canUseProxyX402: boolean;
    canUseNativeX402: boolean;
    missingPrerequisites: string[];
    checks: {
      claimSatisfied: boolean;
      baseChainRequiredForNative: boolean;
      premiumEndpointConfigured: boolean;
      x402PricingConfigured: boolean;
      x402PayToConfigured: boolean;
    };
  };

  function computeX402Readiness(agent: db.Agent, claimStatus: string): X402Readiness {
    const premiumPricing = getPremiumPricing();
    const missingPrerequisites: string[] = [];
    const isClaimed = claimStatus === "claimed";
    const isBaseAgent = agent.chain === "base";
    const premiumEndpointConfigured = API_URL.length > 0;
    const x402PricingConfigured = Boolean(
      premiumPricing.network && premiumPricing.asset && premiumPricing.amountAtomic
    );
    const x402PayToConfigured = Boolean(
      premiumPricing.payTo && premiumPricing.payTo !== "0x1111111111111111111111111111111111111111"
    );

    if (!isClaimed) {
      missingPrerequisites.push("claim_agent");
    }
    if (!isBaseAgent) {
      missingPrerequisites.push("native_x402_requires_base_chain");
    }
    if (!premiumEndpointConfigured) {
      missingPrerequisites.push("configure_api_base_url");
    }
    if (!x402PricingConfigured) {
      missingPrerequisites.push("configure_x402_pricing");
    }
    if (!x402PayToConfigured) {
      missingPrerequisites.push("configure_x402_pay_to");
    }

    const canUseProxyX402 = isClaimed;
    const canUseNativeX402 = isClaimed && isBaseAgent && premiumEndpointConfigured && x402PricingConfigured && x402PayToConfigured;
    const x402Mode: X402Readiness["x402Mode"] = canUseNativeX402
      ? "native_enabled"
      : canUseProxyX402
        ? "proxy_enabled"
        : "not_enabled";
    const modeReason = canUseNativeX402
      ? "Agent is claimed on Base and x402 premium config is complete."
      : canUseProxyX402
        ? "Agent is claimed, but native x402 prerequisites are still missing."
        : "Agent must be claimed before any x402 flow can run.";

    return {
      x402Mode,
      modeReason,
      canUseProxyX402,
      canUseNativeX402,
      missingPrerequisites,
      checks: {
        claimSatisfied: isClaimed,
        baseChainRequiredForNative: isBaseAgent,
        premiumEndpointConfigured,
        x402PricingConfigured,
        x402PayToConfigured,
      },
    };
  }

  function buildNextActions(agentApiKey: string, readiness: X402Readiness) {
    const statusCurl = `curl -X GET "${API_URL}/register/status" -H "Authorization: Bearer ${agentApiKey}"`;
    const proxySmokeCurl = `curl -i -X GET "${API_URL}/premium/insights"`;
    const nativeSmokeCommand = `AGENT_API_KEY=${agentApiKey} AGENTBANK_PREMIUM_URL="${API_URL}/premium/insights" npx tsx "examples/x402-agentbank-premium-smoke.ts"`;

    if (!readiness.canUseProxyX402) {
      return {
        stage: "claim_required",
        title: "Claim agent before x402 usage",
        steps: [
          "Ask your operator to open the claim link and activate this agent.",
          "Re-run status check until claimStatus is 'claimed'.",
        ],
        commands: {
          statusCheck: statusCurl,
        },
      };
    }

    return {
      stage: readiness.canUseNativeX402 ? "native_ready" : "proxy_ready",
      title: readiness.canUseNativeX402
        ? "Native x402 is ready"
        : "Proxy x402 is ready (native upgrade optional)",
      steps: readiness.canUseNativeX402
        ? [
            "Run the native x402 smoke test from the SDK folder.",
            "Expect status=200 and paid=true in the output.",
          ]
        : [
            "You can use AgentBank-managed paid endpoints immediately.",
            "For native x402, register a Base-chain agent and clear missing prerequisites.",
          ],
      commands: {
        statusCheck: statusCurl,
        proxySmoke: proxySmokeCurl,
        nativeSmoke: nativeSmokeCommand,
      },
    };
  }


  // ── Dynamic skill files ─────────────────────────────────────────────────
  // GET /v1/skill.md                → generic, agent creates new operator
  // GET /v1/skill/:operatorKey.md   → personalized, agent joins existing operator

  app.get("/skill.md", async (_req, reply) => {
    const content = buildGenericSkill(SITE_URL, API_URL, DASHBOARD_URL);
    return reply.type("text/plain; charset=utf-8").send(content);
  });

  app.get("/skill/:operatorKey.md", async (req, reply) => {
    const { operatorKey } = req.params as { operatorKey: string };
    const operator = await db.getOperatorByApiKey(operatorKey);
    if (!operator) {
      return reply.status(404).type("text/plain").send(
        "Operator not found. Check your operator key or sign up at agentbank.xyz"
      );
    }
    const content = buildPersonalizedSkill(operator.orgName, operatorKey, SITE_URL, API_URL, DASHBOARD_URL);
    return reply.type("text/plain; charset=utf-8").send(content);
  });

  // ── Agent self-registration ─────────────────────────────────────────────
  // Two modes:
  //   1. operatorKey provided  → register under existing operator
  //   2. email provided        → create operator account first, then register
  app.post("/register", async (req, reply) => {
    const { operatorKey, email, orgName, walletAddress, name, description, chain, policy, squadsEnabled } = req.body as {
      operatorKey?:  string;
      email?:        string;
      orgName?:      string;
      walletAddress: string;
      name:          string;
      description?:  string;
      chain?:        string;
      squadsEnabled?: boolean;
      policy?: { dailyLimit?: number; txLimit?: number; requireApprovalAbove?: number };
    };

    if (!walletAddress) return reply.status(400).send({ error: "walletAddress is required" });
    if (!name)          return reply.status(400).send({ error: "name is required" });

    const txChain = chain || "solana";
    if (txChain === "solana" && !solana.isValidSolanaAddress(walletAddress)) {
      return reply.status(400).send({ error: "Invalid Solana wallet address" });
    }
    if (txChain === "base" && !base.isValidBaseAddress(walletAddress)) {
      return reply.status(400).send({ error: "Invalid Base wallet address" });
    }

    let operator: db.Operator;
    let operatorCreated = false;

    // Mode 1: existing operator
    if (operatorKey) {
      const found = await db.getOperatorByApiKey(operatorKey);
      if (!found) {
        return reply.status(401).send({
          error: "Invalid operator key",
          hint:  "Sign up at agentbank.xyz or ask your human for their operator key",
        });
      }
      operator = found;
    }
    // Mode 2: first agent — create operator from email
    else if (email) {
      operator = await db.createOperator(email, orgName || "My AI Lab");
      operatorCreated = true;
      console.log(`[Register] New operator created: ${operator.email} → ${operator.apiKey}`);
    }
    else {
      return reply.status(400).send({
        error: "Provide either operatorKey (existing account) or email (new account)",
        hint:  "First time? Provide your human's email to create an account automatically",
      });
    }

    // Create agent with pending claim status
    const basePolicy: db.Policy = {
      dailyLimit:           policy?.dailyLimit           ?? 1.0,
      txLimit:              policy?.txLimit               ?? 0.1,
      requireApprovalAbove: policy?.requireApprovalAbove  ?? 0.5,
      whitelistedAddresses: [],
      allowedChains:        [txChain],
      killSwitch:           false,
    };
    const useSquads = Boolean(squadsEnabled && txChain === "solana");
    let squadsMeta: any = {};
    if (useSquads) {
      const ms = await squads.createAgentMultisig(walletAddress);
      const sl = await squads.configureSpendingLimit({
        multisigPda: ms.multisigPda,
        policy: basePolicy,
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
      operatorId:   operator.id,
      name,
      description:  description || "",
      walletAddress,
      chain:        txChain,
      claimStatus:  "pending",
      policy: basePolicy,
      ...squadsMeta,
    });

    const claimUrl         = `${DASHBOARD_URL}/claim/${(agent as any).claimToken}`;
    const personalSkillUrl = `${SITE_URL}/skill/${operator.apiKey}.md`;

    // Build message for human
    const messageForHuman = operatorCreated
      ? [
          `Your AgentBank operator key: ${operator.apiKey}`,
          `Dashboard: ${DASHBOARD_URL}`,
          `Claim link to activate me: ${claimUrl}`,
          `To add more agents later, give them this URL: ${personalSkillUrl}`,
        ].join("\n")
      : `Claim link to activate me: ${claimUrl}`;

    console.log(`[Register] Agent '${name}' registered under '${operator.orgName}', pending claim`);

    return reply.send({
      message:        "Agent registered! Send your human the claim URL to activate.",
      agentId:        agent.id,
      agentApiKey:    agent.apiKey,
      walletAddress:  agent.walletAddress,
      claimStatus:    "pending",
      claimUrl,
      operator: {
        created:         operatorCreated,
        operatorKey:     operator.apiKey,
        orgName:         operator.orgName,
        dashboardUrl:    DASHBOARD_URL,
        personalSkillUrl,
      },
      messageForHuman,
      note: "Transactions are blocked until your human claims this agent.",
    });
  });

  // ── Check claim status ──────────────────────────────────────────────────
  app.get("/register/status", async (req, reply) => {
    const apiKey = req.headers.authorization?.replace("Bearer ", "") ||
                   req.headers["x-agent-key"] as string;
    if (!apiKey) return reply.status(401).send({ error: "Missing agent API key" });
    const agent = await db.getAgentByApiKey(apiKey);
    if (!agent)  return reply.status(401).send({ error: "Invalid agent API key" });
    const claimStatus = (agent as any).claimStatus || "claimed";
    const x402Readiness = computeX402Readiness(agent, claimStatus);
    const nextActions = buildNextActions(agent.apiKey, x402Readiness);
    return reply.send({
      agentId:      agent.id,
      name:         agent.name,
      walletAddress: agent.walletAddress,
      chain:        agent.chain,
      claimStatus,
      claimedAt:    (agent as any).claimedAt,
      canTransact:  claimStatus === "claimed",
      ...x402Readiness,
      nextActions,
      message:      claimStatus === "claimed"
        ? "Agent is claimed and active — you can now transact"
        : "Waiting for your human to claim this agent",
    });
  });

  // ── Detailed capability diagnostics for automation runtimes ──────────────
  app.get("/register/capabilities", async (req, reply) => {
    const apiKey = req.headers.authorization?.replace("Bearer ", "") ||
                   req.headers["x-agent-key"] as string;
    if (!apiKey) return reply.status(401).send({ error: "Missing agent API key" });

    const agent = await db.getAgentByApiKey(apiKey);
    if (!agent) return reply.status(401).send({ error: "Invalid agent API key" });

    const claimStatus = (agent as any).claimStatus || "claimed";
    const x402Readiness = computeX402Readiness(agent, claimStatus);
    const nextActions = buildNextActions(agent.apiKey, x402Readiness);
    const premiumEndpoint = `${API_URL}/premium/insights`;

    return reply.send({
      agent: {
        id: agent.id,
        name: agent.name,
        chain: agent.chain,
        walletAddress: agent.walletAddress,
        claimStatus,
        canTransact: claimStatus === "claimed",
      },
      x402: {
        mode: x402Readiness.x402Mode,
        modeReason: x402Readiness.modeReason,
        canUseProxyX402: x402Readiness.canUseProxyX402,
        canUseNativeX402: x402Readiness.canUseNativeX402,
        missingPrerequisites: x402Readiness.missingPrerequisites,
        checks: x402Readiness.checks,
        premiumEndpoint,
      },
      nextActions,
      recommendedPath: x402Readiness.canUseNativeX402 ? "native_upgrade" : "proxy_now",
    });
  });

  // ── Human claims an agent ───────────────────────────────────────────────
  app.post("/claim/:token", async (req, reply) => {
    const { token } = req.params as { token: string };
    const apiKey = req.headers.authorization?.replace("Bearer ", "") ||
                   req.headers["x-api-key"] as string;
    if (!apiKey) return reply.status(401).send({ error: "Missing operator API key" });
    const operator = await db.getOperatorByApiKey(apiKey);
    if (!operator) return reply.status(401).send({ error: "Invalid operator API key" });
    const agent = await db.getAgentByClaimToken(token);
    if (!agent) return reply.status(404).send({ error: "Invalid or expired claim token" });
    if (agent.operatorId !== operator.id) return reply.status(403).send({ error: "This agent belongs to a different operator" });
    if ((agent as any).claimStatus === "claimed") {
      const readiness = computeX402Readiness(agent, "claimed");
      return reply.send({
        message: "Agent already claimed",
        agentId: agent.id,
        claimStatus: "claimed",
        ...readiness,
        nextActions: buildNextActions(agent.apiKey, readiness),
      });
    }
    await db.claimAgent(agent.id);
    const claimedAgent = await db.getAgentById(agent.id);
    const readiness = computeX402Readiness(claimedAgent || agent, "claimed");
    console.log(`[Claim] Agent '${agent.name}' claimed by '${operator.orgName}'`);
    return reply.send({
      message: "Agent successfully claimed and activated!",
      agentId: agent.id,
      agentName: agent.name,
      walletAddress: agent.walletAddress,
      claimStatus: "claimed",
      ...readiness,
      nextActions: buildNextActions((claimedAgent || agent).apiKey, readiness),
    });
  });

  // ── Get claim info (for dashboard claim page) ───────────────────────────
  app.get("/claim/:token", async (req, reply) => {
    const { token } = req.params as { token: string };
    const agent = await db.getAgentByClaimToken(token);
    if (!agent) return reply.status(404).send({ error: "Invalid claim token" });
    const operator = await db.getOperatorById(agent.operatorId);
    return reply.send({
      agentId: agent.id, agentName: agent.name, description: agent.description,
      walletAddress: agent.walletAddress, chain: agent.chain,
      claimStatus: (agent as any).claimStatus || "claimed",
      createdAt: agent.createdAt, operatorOrg: operator?.orgName,
      policy: { dailyLimit: agent.policy.dailyLimit, txLimit: agent.policy.txLimit, requireApprovalAbove: agent.policy.requireApprovalAbove },
    });
  });

  // ── Pending claims + personalized skill URL for operator ────────────────
  app.get("/operators/pending-claims", async (req, reply) => {
    const apiKey = req.headers.authorization?.replace("Bearer ", "") ||
                   req.headers["x-api-key"] as string;
    if (!apiKey) return reply.status(401).send({ error: "Missing operator API key" });
    const operator = await db.getOperatorByApiKey(apiKey);
    if (!operator) return reply.status(401).send({ error: "Invalid operator API key" });
    const allAgents = await db.getOperatorAgents(operator.id);
    const pending   = allAgents.filter((a: any) => a.claimStatus === "pending");
    return reply.send({
      pendingClaims: pending.map((a: any) => ({
        agentId: a.id, agentName: a.name, walletAddress: a.walletAddress,
        chain: a.chain, claimToken: a.claimToken,
        claimUrl: `${DASHBOARD_URL}/claim/${a.claimToken}`,
        createdAt: a.createdAt,
      })),
      count:            pending.length,
      personalSkillUrl: `${SITE_URL}/skill/${operator.apiKey}.md`,
    });
  });
}
