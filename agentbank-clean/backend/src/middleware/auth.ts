import { FastifyRequest, FastifyReply } from "fastify";
import * as db from "../db";

declare module "fastify" {
  interface FastifyRequest {
    operator?: db.Operator;
    agent?: db.Agent;
  }
}

export async function requireOperator(req: FastifyRequest, reply: FastifyReply) {
  const apiKey = (req.headers["x-api-key"] as string) || req.headers.authorization?.replace("Bearer ", "");
  if (!apiKey) return reply.status(401).send({ error: "Missing API key" });
  const operator = await db.getOperatorByApiKey(apiKey);
  if (!operator) return reply.status(401).send({ error: "Invalid operator API key" });
  req.operator = operator;
}

export async function requireAgent(req: FastifyRequest, reply: FastifyReply) {
  const apiKey = (req.headers["x-agent-key"] as string) || req.headers.authorization?.replace("Bearer ", "");
  if (!apiKey) return reply.status(401).send({ error: "Missing agent API key" });
  const agent = await db.getAgentByApiKey(apiKey);
  if (!agent) return reply.status(401).send({ error: "Invalid agent API key" });
  req.agent = agent;
}
