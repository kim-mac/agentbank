
console.log("ENV:", {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_KEY ? "exists" : "missing"
});

import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { operatorRoutes } from "./routes/operator-routes";
import { agentRoutes }    from "./routes/agent-routes";
import { registerRoutes } from "./routes/register-routes";
import { messageRoutes }  from "./routes/message-routes";
import { paperRoutes }    from "./routes/paper-routes";
import { leaderboardRoutes } from "./routes/leaderboard-routes";

const app = Fastify({ logger: true });

async function start() {
  await app.register(cors, { origin: true, methods: ["GET","POST","PATCH","DELETE"] });

  app.get("/health", async () => ({
    status: "ok", service: "AgentBank API", version: "2.0.0",
    timestamp: new Date().toISOString(),
  }));

  await app.register(operatorRoutes, { prefix: "/v1" });
  await app.register(agentRoutes,    { prefix: "/v1" });
  await app.register(registerRoutes, { prefix: "/v1" });
  await app.register(messageRoutes,  { prefix: "/v1" });
  await app.register(paperRoutes,    { prefix: "/v1" });
  await app.register(leaderboardRoutes, { prefix: "/v1" });

  const PORT = Number(process.env.PORT) || 3001;
  await app.listen({ port: PORT, host: "0.0.0.0" });

  console.log(`
╔══════════════════════════════════════════════╗
║         AgentBank API v2.0                   ║
╠══════════════════════════════════════════════╣
║  API:         http://localhost:${PORT}           ║
║  Skill file:  http://localhost:${PORT}/v1/skill.md ║
║  Claim flow:  Phase 2 active ✅              ║
╚══════════════════════════════════════════════╝
  `);
}

start().catch(err => { console.error("Failed to start:", err); process.exit(1); });
