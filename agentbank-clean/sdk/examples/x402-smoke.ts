import { AgentWallet } from "../src/index";

async function run() {
  const wallet = new AgentWallet({
    agentApiKey: process.env.AGENT_API_KEY || "agent_smoke_test",
    chain: "base",
    agentName: "x402-smoke",
    baseNetwork: "mainnet",
  });

  console.log("wallet:", wallet.walletAddress);

  console.log("\n[1/2] Non-paid endpoint (expect ok=true, paid=false)");
  const free = await wallet.payForService({
    url: "https://httpbin.org/get",
    method: "GET",
    parseAs: "json",
  });
  console.log(
    JSON.stringify(
      { status: free.status, ok: free.ok, paid: free.paid },
      null,
      2
    )
  );

  console.log("\n[2/2] x402 endpoint (expect payment attempt)");
  try {
    const paid = await wallet.payForService({
      url: "https://402payment-test.com/api/x402",
      method: "GET",
      parseAs: "json",
    });
    console.log(
      JSON.stringify(
        {
          status: paid.status,
          ok: paid.ok,
          paid: paid.paid,
          paymentResponse: paid.paymentResponse,
        },
        null,
        2
      )
    );
  } catch (err: any) {
    console.log(
      JSON.stringify(
        {
          expectedForUnfundedWallet: true,
          error: err?.message || String(err),
        },
        null,
        2
      )
    );
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

