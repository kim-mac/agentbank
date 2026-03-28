import type { FastifyInstance } from "fastify";

export async function leaderboardRoutes(app: FastifyInstance) {
  // ── Public leaderboard endpoint (no auth required) ───────────────────────
  app.get("/leaderboard", async (req, reply) => {
    const { period = "all", sort = "pnl", limit = "50" } = req.query as {
      period?: "all" | "24h" | "7d" | "30d";
      sort?: "pnl" | "winrate" | "trades" | "volume";
      limit?: string;
    };

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      );

      // Calculate time filter
      const now = new Date();
      let timeFilter: string | null = null;
      let periodLabel = "All Time";

      if (period === "24h") {
        timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        periodLabel = "Last 24 Hours";
      } else if (period === "7d") {
        timeFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        periodLabel = "Last 7 Days";
      } else if (period === "30d") {
        timeFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        periodLabel = "Last 30 Days";
      }

      // Fetch closed paper trades
      let tradesQuery = supabase
        .from("paper_trades")
        .select("*")
        .eq("status", "closed");

      // Apply time filter if specified
      if (timeFilter) {
        tradesQuery = tradesQuery.gte("closed_at", timeFilter);
      }

      const { data: trades, error: tradesErr } = await tradesQuery;

      if (tradesErr) throw tradesErr;

      // Get unique agent IDs from trades
      const agentIds = [...new Set((trades || []).map((t: any) => t.agent_id))];

      if (agentIds.length === 0) {
        // No trades, return empty leaderboard
        return reply.send({
          leaderboard: [],
          summary: {
            totalAgents: 0,
            totalVolume: 0,
            avgWinRate: 0,
            periodLabel,
          },
          updatedAt: new Date().toISOString(),
        });
      }

      // Fetch agents separately
      const { data: agents, error: agentsErr } = await supabase
        .from("agents")
        .select("id, name, role_name, status")
        .in("id", agentIds)
        .neq("status", "frozen");

      if (agentsErr) throw agentsErr;

      // Create agent map for quick lookup
      const agentMap = new Map((agents || []).map((a: any) => [a.id, a]));

      // Group trades by agent and calculate metrics
      const agentStats = new Map<
        string,
        {
          agentId: string;
          agentName: string;
          roleName: string | null;
          trades: any[];
          totalPnl: number;
          totalVolume: number;
        }
      >();

      for (const trade of trades || []) {
        const agentId = trade.agent_id;
        const agent = agentMap.get(agentId);

        // Skip if agent is frozen or not found
        if (!agent) continue;

        if (!agentStats.has(agentId)) {
          agentStats.set(agentId, {
            agentId,
            agentName: agent.name,
            roleName: agent.role_name,
            trades: [],
            totalPnl: 0,
            totalVolume: 0,
          });
        }

        const stats = agentStats.get(agentId)!;
        stats.trades.push(trade);
        stats.totalPnl += Number(trade.pnl_usd || 0);
        stats.totalVolume += Number(trade.amount_sol || 0);
      }

      // Calculate final metrics for each agent
      const leaderboard = Array.from(agentStats.values()).map((stats) => {
        const totalTrades = stats.trades.length;
        const wins = stats.trades.filter((t) => Number(t.pnl_usd || 0) > 0).length;
        const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

        const avgReturnPct =
          totalTrades > 0
            ? stats.trades.reduce((sum, t) => sum + Number(t.pnl_pct || 0), 0) / totalTrades
            : 0;

        const pnls = stats.trades.map((t) => Number(t.pnl_usd || 0));
        const bestTrade = pnls.length > 0 ? Math.max(...pnls) : 0;
        const worstTrade = pnls.length > 0 ? Math.min(...pnls) : 0;

        return {
          agentId: stats.agentId,
          agentName: stats.agentName,
          roleName: stats.roleName,
          totalPnl: stats.totalPnl,
          returnPct: avgReturnPct,
          winRate,
          totalTrades,
          totalVolume: stats.totalVolume,
          bestTrade,
          worstTrade,
        };
      });

      // Sort by requested field
      leaderboard.sort((a, b) => {
        switch (sort) {
          case "winrate":
            return b.winRate - a.winRate;
          case "trades":
            return b.totalTrades - a.totalTrades;
          case "volume":
            return b.totalVolume - a.totalVolume;
          case "pnl":
          default:
            return b.totalPnl - a.totalPnl;
        }
      });

      // Add ranks and limit results
      const maxLimit = Math.min(Number(limit), 100);
      const rankedLeaderboard = leaderboard.slice(0, maxLimit).map((entry, index) => ({
        rank: index + 1,
        ...entry,
      }));

      // Calculate summary stats
      const summary = {
        totalAgents: agentStats.size,
        totalVolume: leaderboard.reduce((sum, a) => sum + a.totalVolume, 0),
        avgWinRate: leaderboard.length > 0
          ? leaderboard.reduce((sum, a) => sum + a.winRate, 0) / leaderboard.length
          : 0,
        periodLabel,
      };

      return reply.send({
        leaderboard: rankedLeaderboard,
        summary,
        updatedAt: new Date().toISOString(),
      });
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });
}
