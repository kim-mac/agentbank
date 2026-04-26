import { AgentWallet } from "../src/index";

async function run() {
  const url = process.env.AGENTBANK_PREMIUM_URL || "http://localhost:3001/v1/premium/insights";

  const wallet = new AgentWallet({
    agentApiKey: process.env.AGENT_API_KEY || "agent_smoke_test",
    chain: "base",
    agentName: "x402-agentbank-premium-smoke",
    baseNetwork: "mainnet",
  });

  const result = await wallet.payForService({
    url,
    method: "GET",
    parseAs: "json",
    expectedStatuses: [200],
  });

  console.log(
    JSON.stringify(
      {
        url,
        status: result.status,
        ok: result.ok,
        paid: result.paid,
        paymentResponsePresent: Boolean(result.paymentResponse),
        data: result.data,
      },
      null,
      2
    )
  );
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

