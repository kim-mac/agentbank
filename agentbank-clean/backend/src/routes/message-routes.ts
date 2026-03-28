// message-routes.ts — Agent-to-Agent Messaging
//
// Two channel types:
//   DM:             agent → agent (private)
//   operator_group: all agents under same operator (private group)
//   public:         any agent can join (cross-operator)
//
// Act on messages:
//   If policy.messagingRule.canActOnMessages = true
//   Agent can execute a transaction based on an action_request message
//   The message content becomes the transaction memo

import { FastifyInstance } from "fastify";
import { requireAgent }    from "../middleware/auth";
import { requireOperator } from "../middleware/auth";
import * as db from "../db";

export async function messageRoutes(app: FastifyInstance) {

  // ── Send a message (agent → agent or → channel) ─────────────────────────
  app.post("/agent/messages/send", { preHandler: requireAgent }, async (req, reply) => {
    const agent = req.agent!;
    const { toAgentId, channelId, content, messageType = "text" } = req.body as {
      toAgentId?:   string;
      channelId?:   string;
      content:      string;
      messageType?: "text" | "action_request" | "action_result";
    };

    if (!content?.trim()) return reply.status(400).send({ error: "content is required" });
    if (!toAgentId && !channelId) return reply.status(400).send({ error: "Provide toAgentId (DM) or channelId (channel)" });

    // Check receiver's messaging policy for DMs
    if (toAgentId) {
      const receiver = await db.getAgentById(toAgentId);
      if (!receiver) return reply.status(404).send({ error: "Recipient agent not found" });

      const receiverMessaging = (receiver.policy as any).messagingRule;
      if (receiverMessaging && !receiverMessaging.allowMessages) {
        return reply.status(403).send({ error: `Agent ${receiver.name} has messaging disabled` });
      }

      const msg = await db.createMessage({
        senderAgentId:    agent.id,
        receiverAgentId:  toAgentId,
        channelType:      "dm",
        content:          content.trim(),
        messageType,
      });

      console.log(`[Message] DM: ${agent.name} → ${receiver.name}: "${content.slice(0, 50)}"`);
      return reply.send({ message: msg, sent: true });
    }

    // Channel message
    const msg = await db.createMessage({
      senderAgentId: agent.id,
      channelId,
      channelType:   channelId === agent.id ? "operator_group" : "public",
      content:       content.trim(),
      messageType,
    });

    return reply.send({ message: msg, sent: true });
  });

  // ── Get agent's messages (inbox + sent) ────────────────────────────────
  app.get("/agent/messages", { preHandler: requireAgent }, async (req, reply) => {
    const messages = await db.getAgentMessages(req.agent!.id);
    const unread   = messages.filter(m => m.receiverAgentId === req.agent!.id && !m.readAt);

    // Enrich with sender/receiver names
    const agentCache: Record<string, any> = {};
    const enriched = await Promise.all(messages.map(async m => {
      if (!agentCache[m.senderAgentId]) {
        agentCache[m.senderAgentId] = await db.getAgentById(m.senderAgentId);
      }
      const senderName = agentCache[m.senderAgentId]?.name || "unknown";
      return { ...m, senderName };
    }));

    return reply.send({ messages: enriched, unreadCount: unread.length });
  });

  // ── Get unread messages ─────────────────────────────────────────────────
  app.get("/agent/messages/unread", { preHandler: requireAgent }, async (req, reply) => {
    const messages = await db.getUnreadMessages(req.agent!.id);
    return reply.send({ messages, count: messages.length });
  });

  // ── Mark message as read ────────────────────────────────────────────────
  app.post("/agent/messages/:id/read", { preHandler: requireAgent }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await db.markMessageRead(id);
    return reply.send({ read: true });
  });

  // ── Act on a message (execute transaction based on action_request) ──────
  app.post("/agent/messages/:id/act", { preHandler: requireAgent }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { toAddress, amount, token = "SOL" } = req.body as {
      toAddress: string; amount: number; token?: string;
    };

    const agent   = req.agent!;
    const message = await db.getMessage(id);
    if (!message) return reply.status(404).send({ error: "Message not found" });
    if (message.receiverAgentId !== agent.id) return reply.status(403).send({ error: "Not your message" });
    if (message.actedOn) return reply.status(400).send({ error: "Already acted on this message" });

    // Check canActOnMessages policy
    const messaging = (agent.policy as any).messagingRule;
    if (!messaging?.canActOnMessages) {
      return reply.status(403).send({
        error: "canActOnMessages is disabled for this agent",
        hint:  "Enable it in the agent's policy settings",
      });
    }

    // Check trusted senders
    if (messaging.trustedSenders?.length > 0 && !messaging.trustedSenders.includes(message.senderAgentId)) {
      return reply.status(403).send({
        error: "Sender is not in trustedSenders list",
        hint:  "Add this agent's ID to trustedSenders in messaging policy",
      });
    }

    // Import policy engine to check if transaction is allowed
    const { evaluatePolicy } = await import("../services/policy-engine");
    const memo = `Acting on message from agent: "${message.content.slice(0, 100)}"`;

    const decision = await evaluatePolicy({
      agentId: agent.id, toAddress, amount, token,
      chain: agent.chain, memo,
    });

    if (decision.result === "REJECTED") {
      return reply.status(403).send({
        error:  "Transaction rejected by policy",
        reason: decision.reason,
        note:   "Message was not acted on",
      });
    }

    // Create transaction record
    const tx = await db.createTransaction({
      agentId:     agent.id,
      chain:       agent.chain,
      fromAddress: agent.walletAddress,
      toAddress,
      amount,
      token,
      status:      decision.result === "APPROVED" ? "approved" : "pending_approval",
      memo,
    });

    // Link message to transaction
    await db.markMessageActedOn(id, tx.id);

    // Send confirmation message back to sender
    await db.createMessage({
      senderAgentId:   agent.id,
      receiverAgentId: message.senderAgentId,
      channelType:     "dm",
      content:         `Acting on your request: ${amount} ${token} → ${toAddress.slice(0,12)}... | Tx: ${tx.id}`,
      messageType:     "action_result",
    });

    console.log(`[Message] Agent ${agent.name} acting on message ${id}: ${amount} ${token} → ${toAddress}`);

    return reply.send({
      acted:         true,
      transactionId: tx.id,
      status:        decision.result === "APPROVED" ? "approved" : "pending_approval",
      memo,
      note:          decision.result === "APPROVED"
        ? "Transaction approved — sign and broadcast then POST /agent/wallet/confirm"
        : "Transaction requires operator approval",
    });
  });

  // ── Agent: get group directory (who are my teammates) ─────────────────
  app.get("/agent/group/directory", { preHandler: requireAgent }, async (req, reply) => {
    const agent    = req.agent!;
    const allAgents = await db.getOperatorAgents(agent.operatorId);
    const groupAgents = allAgents.filter((a: any) => a.inGroup);
    return reply.send({
      groupChannelId: agent.operatorId,
      teammates: groupAgents.map((a: any) => ({
        agentId:      a.id,
        name:         a.name,
        roleName:     a.roleName,
        roleDocument: a.roleDocument,
        status:       a.status,
        isSelf:       a.id === agent.id,
      })),
      myRole:         (agent as any).roleName,
      myRoleDocument: (agent as any).roleDocument,
      inGroup:        (agent as any).inGroup || false,
    });
  });

  // ── Get channel messages ────────────────────────────────────────────────
  app.get("/agent/messages/channel/:channelId", { preHandler: requireAgent }, async (req, reply) => {
    const { channelId } = req.params as { channelId: string };
    const messages = await db.getChannelMessages(channelId);

    const agentCache: Record<string, any> = {};
    const enriched = await Promise.all(messages.map(async m => {
      if (!agentCache[m.senderAgentId]) {
        agentCache[m.senderAgentId] = await db.getAgentById(m.senderAgentId);
      }
      return { ...m, senderName: agentCache[m.senderAgentId]?.name || "unknown" };
    }));

    return reply.send({ messages: enriched, channelId });
  });

  // ── Operator: view all messages across their agents ─────────────────────
  app.get("/operators/messages", { preHandler: requireOperator }, async (req, reply) => {
    const messages = await db.getOperatorMessages(req.operator!.id);
    const agents   = await db.getOperatorAgents(req.operator!.id);
    const agentMap = Object.fromEntries(agents.map(a => [a.id, a.name]));

    const enriched = messages.map(m => ({
      ...m,
      senderName:   agentMap[m.senderAgentId]   || "external",
      receiverName: m.receiverAgentId ? (agentMap[m.receiverAgentId] || "external") : null,
    }));

    return reply.send({ messages: enriched, total: enriched.length });
  });

  // ── Operator: get group channel for their agents ───────────────────────
  // The group channel ID is just the operator's ID
  app.get("/operators/messages/group", { preHandler: requireOperator }, async (req, reply) => {
    const channelId = req.operator!.id;
    const messages  = await db.getChannelMessages(channelId);
    const agents    = await db.getOperatorAgents(req.operator!.id);
    const agentMap  = Object.fromEntries(agents.map(a => [a.id, a.name]));

    const agentFull = await db.getOperatorAgents(req.operator!.id);
    const agentFullMap = Object.fromEntries(agentFull.map((a: any) => [a.id, a]));

    const enriched = messages.map(m => ({
      ...m,
      senderName: agentMap[m.senderAgentId] || "unknown",
      senderRole: (agentFullMap[m.senderAgentId] as any)?.roleName || null,
    }));

    return reply.send({
      messages:  enriched,
      channelId,
      agentCount: agents.length,
      groupAgents: agentFull.filter((a: any) => a.inGroup).map((a: any) => ({
        agentId:  a.id,
        name:     a.name,
        roleName: a.roleName,
        status:   a.status,
      })),
    });
  });
}
