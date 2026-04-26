import { FastifyInstance } from "fastify";
import { requireAgent } from "../middleware/auth";
import * as db from "../db";
import * as solana from "../services/solana";
import * as base from "../services/base";
import { evaluatePolicy, getPolicySummary } from "../services/policy-engine";

export async function agentRoutes(app: FastifyInstance) {

  app.get("/agent/wallet", { preHandler: requireAgent }, async (req, reply) => {
    const agent = req.agent!;
    let balance: { native: number; unit: string };
    if (agent.chain === "base") {
      const bal = await base.getBalance(agent.walletAddress);
      balance = { native: bal.eth, unit: "ETH" };
    } else {
      const bal = await solana.getBalance(agent.walletAddress);
      balance = { native: bal.sol, unit: "SOL" };
    }
    return reply.send({
      agentId: agent.id, agentName: agent.name,
      walletAddress: agent.walletAddress, chain: agent.chain,
      balance, policy: await getPolicySummary(agent.id), status: agent.status,
      claimStatus: (agent as any).claimStatus || "claimed",
    });
  });

  app.post("/agent/wallet/check", { preHandler: requireAgent }, async (req, reply) => {
    const { toAddress, amount, token, chain, memo } = req.body as { toAddress: string; amount: number; token: string; chain?: string; memo?: string };
    const decision = await evaluatePolicy({ agentId: req.agent!.id, toAddress, amount, token, chain: chain || req.agent!.chain, memo });
    return reply.send({
      allowed: decision.result === "APPROVED", decision: decision.result,
      ...(decision.result === "REJECTED"         && { reason: decision.reason }),
      ...(decision.result === "PENDING_APPROVAL" && { message: "Requires operator approval", approvalRequestId: decision.approvalRequestId, transactionId: decision.transactionId }),
    });
  });

  app.post("/agent/wallet/request", { preHandler: requireAgent }, async (req, reply) => {
    const { toAddress, amount, token, chain, memo } = req.body as { toAddress: string; amount: number; token: string; chain?: string; memo?: string };
    const agent = req.agent!;

    // Block transactions for unclaimed agents
    if ((agent as any).claimStatus === "pending") {
      return reply.status(403).send({
        error:  "Agent is not yet claimed by a human operator",
        action: "Share your claim URL with your human and wait for them to activate you",
        hint:   "Poll GET /register/status to check when you have been claimed",
      });
    }

    const txChain = chain || agent.chain;
    if (!toAddress || !amount || !token) return reply.status(400).send({ error: "toAddress, amount, and token are required" });
    if (txChain === "solana" && !solana.isValidSolanaAddress(toAddress)) return reply.status(400).send({ error: "Invalid Solana address" });
    if (txChain === "base"   && !base.isValidBaseAddress(toAddress))     return reply.status(400).send({ error: "Invalid Base address" });

    const decision = await evaluatePolicy({ agentId: agent.id, toAddress, amount, token, chain: txChain, memo });

    if (decision.result === "REJECTED") {
      await db.createTransaction({ agentId: agent.id, chain: txChain, fromAddress: agent.walletAddress, toAddress, amount, token, status: "rejected", rejectReason: decision.reason, memo });
      return reply.status(403).send({ status: "rejected", reason: decision.reason, action: "Do not sign" });
    }
    if (decision.result === "PENDING_APPROVAL") {
      return reply.send({ status: "pending_approval", transactionId: decision.transactionId, approvalRequestId: decision.approvalRequestId, message: "Poll GET /agent/wallet/tx/:id — when approved, sign + broadcast + POST /agent/wallet/confirm", action: "Wait for approval" });
    }

    const tx = await db.createTransaction({ agentId: agent.id, chain: txChain, fromAddress: agent.walletAddress, toAddress, amount, token, status: "approved", memo });
    return reply.send({ status: "approved", transactionId: tx.id, message: "Policy approved. Sign + broadcast + POST /agent/wallet/confirm", action: "Sign and broadcast now", details: { from: agent.walletAddress, to: toAddress, amount, token, chain: txChain } });
  });

  app.post("/agent/wallet/confirm", { preHandler: requireAgent }, async (req, reply) => {
    const { transactionId, txHash } = req.body as { transactionId: string; txHash: string };
    const tx = await db.getTransaction(transactionId);
    if (!tx || tx.agentId !== req.agent!.id) return reply.status(404).send({ error: "Transaction not found" });
    if (tx.status !== "approved") return reply.status(400).send({ error: `Cannot confirm a '${tx.status}' transaction` });

    const verification = tx.chain === "solana"
      ? await solana.verifyTransaction(txHash)
      : await base.verifyTransaction(txHash);
    if (!verification.verified) return reply.status(400).send({ error: "Transaction not found on-chain", txHash });

    await db.updateTransaction(transactionId, { status: "confirmed", txHash, confirmedAt: new Date().toISOString() });
    await db.addToTodaySpend(req.agent!.id, tx.amount);

    const explorerUrl = tx.chain === "solana"
      ? `https://explorer.solana.com/tx/${txHash}?cluster=devnet`
      : base.explorerUrl(txHash);
    return reply.send({ status: "confirmed", transactionId, txHash, explorerUrl, verified: true });
  });

  app.get("/agent/wallet/tx/:txId", { preHandler: requireAgent }, async (req, reply) => {
    const { txId } = req.params as { txId: string };
    const tx = await db.getTransaction(txId);
    if (!tx || tx.agentId !== req.agent!.id) return reply.status(404).send({ error: "Not found" });
    return reply.send({
      transactionId: tx.id, status: tx.status, amount: tx.amount,
      token: tx.token, toAddress: tx.toAddress, fromAddress: tx.fromAddress,
      memo: tx.memo, txHash: tx.txHash, rejectReason: tx.rejectReason,
      createdAt: tx.createdAt, confirmedAt: tx.confirmedAt,
      ...(tx.status === "approved" && { action: "Sign and broadcast, then POST /agent/wallet/confirm" }),
      ...(tx.txHash && { explorerUrl: tx.chain === "solana"
        ? `https://explorer.solana.com/tx/${tx.txHash}?cluster=devnet`
        : base.explorerUrl(tx.txHash) }),
    });
  });

  app.get("/agent/wallet/history", { preHandler: requireAgent }, async (req, reply) => {
    return reply.send({ transactions: await db.getAgentTransactions(req.agent!.id) });
  });

  app.get("/agent/policy", { preHandler: requireAgent }, async (req, reply) => {
    return reply.send(await getPolicySummary(req.agent!.id));
  });
}
