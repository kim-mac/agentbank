// register-routes.ts — Registration, claim flow, dynamic skill files

import { FastifyInstance } from "fastify";
import * as db from "../db";
import * as solana from "../services/solana";
import { buildGenericSkill, buildPersonalizedSkill } from "../services/skill-builder";

const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000";
const API_URL       = process.env.API_URL        || "http://localhost:3001/v1";
const SITE_URL      = process.env.SITE_URL       || "http://localhost:3000";

export async function registerRoutes(app: FastifyInstance) {

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
    const { operatorKey, email, orgName, walletAddress, name, description, chain, policy } = req.body as {
      operatorKey?:  string;
      email?:        string;
      orgName?:      string;
      walletAddress: string;
      name:          string;
      description?:  string;
      chain?:        string;
      policy?: { dailyLimit?: number; txLimit?: number; requireApprovalAbove?: number };
    };

    if (!walletAddress) return reply.status(400).send({ error: "walletAddress is required" });
    if (!name)          return reply.status(400).send({ error: "name is required" });

    const txChain = chain || "solana";
    if (txChain === "solana" && !solana.isValidSolanaAddress(walletAddress)) {
      return reply.status(400).send({ error: "Invalid Solana wallet address" });
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
    const agent = await db.createAgent({
      operatorId:   operator.id,
      name,
      description:  description || "",
      walletAddress,
      chain:        txChain,
      claimStatus:  "pending",
      policy: {
        dailyLimit:           policy?.dailyLimit           ?? 1.0,
        txLimit:              policy?.txLimit               ?? 0.1,
        requireApprovalAbove: policy?.requireApprovalAbove  ?? 0.5,
        whitelistedAddresses: [],
        allowedChains:        [txChain],
        killSwitch:           false,
      },
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
    return reply.send({
      agentId:      agent.id,
      name:         agent.name,
      walletAddress: agent.walletAddress,
      claimStatus,
      claimedAt:    (agent as any).claimedAt,
      canTransact:  claimStatus === "claimed",
      message:      claimStatus === "claimed"
        ? "Agent is claimed and active — you can now transact"
        : "Waiting for your human to claim this agent",
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
    if ((agent as any).claimStatus === "claimed") return reply.send({ message: "Agent already claimed", agentId: agent.id });
    await db.claimAgent(agent.id);
    console.log(`[Claim] Agent '${agent.name}' claimed by '${operator.orgName}'`);
    return reply.send({ message: "Agent successfully claimed and activated!", agentId: agent.id, agentName: agent.name, walletAddress: agent.walletAddress, claimStatus: "claimed" });
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
