// paper-routes.ts — Paper trading endpoints
// Agents can execute simulated trades with virtual balance
// Real market prices from CoinGecko, no actual blockchain transactions

import { FastifyInstance } from "fastify";
import { requireAgent }    from "../middleware/auth";
import { requireOperator } from "../middleware/auth";
import * as db from "../db";
import * as priceFeed from "../services/price-feed";

export async function paperRoutes(app: FastifyInstance) {

  // ── Execute a paper trade ───────────────────────────────────────────────
  // Agent calls this instead of /agent/wallet/request when in paper mode
  app.post("/agent/paper/trade", { preHandler: requireAgent }, async (req, reply) => {
    const agent = req.agent!;

    // Must be in paper mode
    if (!(agent as any).paperMode) {
      return reply.status(400).send({
        error: "Agent is not in paper trading mode",
        hint:  "Enable paper mode in the dashboard: Agents → Policy → Paper Trading",
      });
    }

    const { tokenSymbol, side, amountSol, memo } = req.body as {
      tokenSymbol: string;
      side:        "buy" | "sell";
      amountSol:   number;
      memo?:       string;
    };

    if (!tokenSymbol) return reply.status(400).send({ error: "tokenSymbol is required (e.g. SOL, JUP, BONK)" });
    if (!side)        return reply.status(400).send({ error: "side is required: buy or sell" });
    if (!amountSol)   return reply.status(400).send({ error: "amountSol is required" });

    // Get token CoinGecko ID
    const tokenId = priceFeed.getTokenId(tokenSymbol);
    if (!tokenId) {
      return reply.status(400).send({
        error:    `Unknown token: ${tokenSymbol}`,
        known:    Object.keys(priceFeed.KNOWN_TOKENS),
        hint:     "Use a known token symbol or add it to the KNOWN_TOKENS list",
      });
    }

    // Fetch real market price
    const priceData = await priceFeed.getTokenPrice(tokenId);
    if (!priceData) {
      return reply.status(503).send({ error: "Could not fetch price from CoinGecko. Try again." });
    }

    // Get SOL price to calculate token amount
    const solPrice     = await priceFeed.getSolPrice();
    const solValueUsd  = amountSol * solPrice;
    const amountToken  = solValueUsd / priceData.usd;

    // Check virtual balance
    const currentBalance = (agent as any).paperBalance ?? 100;
    if (side === "buy" && currentBalance < amountSol) {
      return reply.status(400).send({
        error:           `Insufficient paper balance: ${currentBalance.toFixed(4)} SOL available, need ${amountSol} SOL`,
        paperBalance:    currentBalance,
      });
    }

    // Run policy check (limits still apply in paper mode)
    const { evaluatePolicy } = await import("../services/policy-engine");
    const decision = await evaluatePolicy({
      agentId:   agent.id,
      toAddress: "paper-trade", // no real address
      amount:    amountSol,
      token:     "SOL",
      chain:     agent.chain,
      memo:      memo || `Paper trade: ${side} ${amountToken.toFixed(4)} ${tokenSymbol}`,
    });

    if (decision.result === "REJECTED") {
      return reply.status(403).send({ error: "Policy rejected", reason: (decision as any).reason });
    }

    // Create paper trade record
    const trade = await db.createPaperTrade({
      agentId:     agent.id,
      tokenSymbol: tokenSymbol.toUpperCase(),
      tokenId,
      side,
      amountToken,
      amountSol,
      priceUsd:    priceData.usd,
      priceSol:    priceData.usd / solPrice,
      memo:        memo || `Paper ${side}: ${amountToken.toFixed(4)} ${tokenSymbol} @ $${priceData.usd}`,
    });

    // Deduct/add from virtual balance
    const newBalance = side === "buy"
      ? currentBalance - amountSol
      : currentBalance + amountSol;
    await db.updateAgentPaperMode(agent.id, true, newBalance);

    console.log(`[Paper] ${agent.name} ${side} ${amountToken.toFixed(4)} ${tokenSymbol} @ $${priceData.usd} | Balance: ${newBalance.toFixed(4)} SOL`);

    return reply.send({
      trade,
      execution: {
        tokenSymbol:  tokenSymbol.toUpperCase(),
        side,
        amountToken:  amountToken.toFixed(6),
        amountSol,
        priceUsd:     priceData.usd,
        solPrice,
        paperBalance: newBalance,
      },
      message: `Paper ${side} executed: ${amountToken.toFixed(4)} ${tokenSymbol} @ $${priceData.usd.toFixed(4)}`,
    });
  });

  // ── Close a paper trade ─────────────────────────────────────────────────
  app.post("/agent/paper/trade/:id/close", { preHandler: requireAgent }, async (req, reply) => {
    const { id }  = req.params as { id: string };
    const trade   = await db.getPaperTrade(id);
    if (!trade || trade.agentId !== req.agent!.id) return reply.status(404).send({ error: "Trade not found" });
    if (trade.status !== "open") return reply.status(400).send({ error: "Trade is already closed" });

    const priceData = await priceFeed.getTokenPrice(trade.tokenId);
    if (!priceData)  return reply.status(503).send({ error: "Could not fetch current price" });

    const solPrice  = await priceFeed.getSolPrice();
    const closed    = await db.closePaperTrade(id, priceData.usd, priceData.usd / solPrice);

    // Return SOL to virtual balance on close
    const agent      = req.agent!;
    const balance    = (agent as any).paperBalance ?? 100;
    const returnSol  = trade.amountSol + (closed?.pnlUsd || 0) / solPrice;
    await db.updateAgentPaperMode(agent.id, true, balance + returnSol);

    return reply.send({
      trade: closed,
      pnl: {
        usd:     closed?.pnlUsd?.toFixed(4),
        pct:     closed?.pnlPct?.toFixed(2),
        outcome: (closed?.pnlUsd || 0) >= 0 ? "profit" : "loss",
      },
    });
  });

  // ── Get agent paper portfolio ───────────────────────────────────────────
  app.get("/agent/paper/portfolio", { preHandler: requireAgent }, async (req, reply) => {
    const agent  = req.agent!;
    const trades = await db.getAgentPaperTrades(agent.id);

    const openTrades   = trades.filter(t => t.status === "open");
    const closedTrades = trades.filter(t => t.status === "closed");

    // Calculate live P&L for open trades
    const tokenIds = [...new Set(openTrades.map(t => t.tokenId))];
    const prices   = tokenIds.length > 0 ? await priceFeed.getMultiplePrices(tokenIds) : {};

    const openWithPnl = openTrades.map(t => {
      const currentPrice = prices[t.tokenId]?.usd || t.priceUsd;
      const unrealizedPnl = (currentPrice - t.priceUsd) * t.amountToken * (t.side === "buy" ? 1 : -1);
      const unrealizedPct = (unrealizedPnl / (t.priceUsd * t.amountToken)) * 100;
      return { ...t, currentPrice, unrealizedPnl, unrealizedPct };
    });

    // Overall stats
    const totalRealizedPnl   = closedTrades.reduce((s, t) => s + (t.pnlUsd || 0), 0);
    const totalUnrealizedPnl = openWithPnl.reduce((s, t) => s + t.unrealizedPnl, 0);
    const winCount   = closedTrades.filter(t => (t.pnlUsd || 0) > 0).length;
    const winRate    = closedTrades.length > 0 ? (winCount / closedTrades.length) * 100 : 0;

    return reply.send({
      paperMode:       (agent as any).paperMode || false,
      paperBalance:    (agent as any).paperBalance ?? 100,
      openTrades:      openWithPnl,
      closedTrades:    closedTrades.slice(0, 20),
      stats: {
        totalTrades:       trades.length,
        openTrades:        openTrades.length,
        closedTrades:      closedTrades.length,
        winCount,
        lossCount:         closedTrades.length - winCount,
        winRate:           winRate.toFixed(1),
        totalRealizedPnl:  totalRealizedPnl.toFixed(4),
        totalUnrealizedPnl: totalUnrealizedPnl.toFixed(4),
        totalPnl:          (totalRealizedPnl + totalUnrealizedPnl).toFixed(4),
      },
    });
  });

  // ── Get token price (for agents to check before trading) ───────────────
  app.get("/agent/paper/price/:symbol", { preHandler: requireAgent }, async (req, reply) => {
    const { symbol } = req.params as { symbol: string };
    const tokenId    = priceFeed.getTokenId(symbol);
    if (!tokenId) return reply.status(404).send({ error: `Unknown token: ${symbol}`, known: Object.keys(priceFeed.KNOWN_TOKENS) });
    const price = await priceFeed.getTokenPrice(tokenId);
    if (!price) return reply.status(503).send({ error: "Price unavailable" });
    const solPrice = await priceFeed.getSolPrice();
    return reply.send({ symbol: symbol.toUpperCase(), tokenId, priceUsd: price.usd, priceSol: price.usd / solPrice, change24h: price.usd_24h_change });
  });

  // ── Operator: toggle paper mode on agent ───────────────────────────────
  app.post("/operators/agents/:id/paper-mode", { preHandler: requireOperator }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { enabled, initialBalance = 100 } = req.body as { enabled: boolean; initialBalance?: number };
    const agent = await db.getAgentById(id);
    if (!agent) return reply.status(404).send({ error: "Agent not found" });
    if (agent.operatorId !== req.operator!.id) return reply.status(403).send({ error: "Not your agent" });
    await db.updateAgentPaperMode(id, enabled, enabled ? initialBalance : 0);
    console.log(`[Paper] Agent '${agent.name}' paper mode: ${enabled}`);
    return reply.send({ paperMode: enabled, paperBalance: enabled ? initialBalance : 0 });
  });

  // ── Operator: view all paper trades ────────────────────────────────────
  app.get("/operators/paper/trades", { preHandler: requireOperator }, async (req, reply) => {
    const trades = await db.getOperatorPaperTrades(req.operator!.id);
    const agents = await db.getOperatorAgents(req.operator!.id);
    const agentMap = Object.fromEntries(agents.map(a => [a.id, a.name]));
    return reply.send({
      trades: trades.map(t => ({ ...t, agentName: agentMap[t.agentId] || "unknown" })),
      total:  trades.length,
    });
  });

  // ── Public price endpoint (no auth) ────────────────────────────────────
  app.get("/prices", async (req, reply) => {
    const { symbols = "SOL,BTC,ETH,JUP,BONK" } = req.query as { symbols?: string };
    const symbolList = symbols.split(",").map(s => s.trim().toUpperCase());
    const tokenIds   = symbolList.map(s => priceFeed.getTokenId(s)).filter(Boolean) as string[];
    const prices     = await priceFeed.getMultiplePrices(tokenIds);
    const solPrice   = prices["solana"]?.usd || 0;
    const result: Record<string, any> = {};
    for (const symbol of symbolList) {
      const id = priceFeed.getTokenId(symbol);
      if (id && prices[id]) {
        result[symbol] = {
          usd:      prices[id].usd,
          sol:      solPrice > 0 ? prices[id].usd / solPrice : 0,
          change24h: prices[id].usd_24h_change,
        };
      }
    }
    return reply.send({ prices: result, updatedAt: new Date().toISOString() });
  });
}
