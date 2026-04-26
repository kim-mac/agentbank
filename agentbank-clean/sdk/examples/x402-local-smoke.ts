import http from "http";
import { AgentWallet } from "../src/index";

const PORT = 4029;
const PATH = "/paid";

function b64(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

async function run() {
  let sawPaymentSignature = false;

  const server = http.createServer((req, res) => {
    if (req.url !== PATH) {
      res.statusCode = 404;
      res.end("not found");
      return;
    }

    const paymentSig = req.headers["payment-signature"];
    if (!paymentSig) {
      const required = {
        x402Version: 2,
        error: "PAYMENT-SIGNATURE header is required",
        resource: {
          url: `http://localhost:${PORT}${PATH}`,
          description: "Local smoke paid resource",
          mimeType: "application/json",
        },
        accepts: [
          {
            scheme: "exact",
            network: "eip155:8453",
            amount: "10000", // 0.01 USDC (6 decimals)
            asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
            payTo: "0x1111111111111111111111111111111111111111",
            maxTimeoutSeconds: 60,
            extra: { name: "USDC", version: "2" },
          },
        ],
      };

      res.statusCode = 402;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("PAYMENT-REQUIRED", b64(required));
      res.end(JSON.stringify({ error: "payment required" }));
      return;
    }

    sawPaymentSignature = true;
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        message: "paid access granted",
        sawPaymentSignature: true,
      })
    );
  });

  await new Promise<void>((resolve) => server.listen(PORT, "127.0.0.1", () => resolve()));

  try {
    const wallet = new AgentWallet({
      agentApiKey: process.env.AGENT_API_KEY || "agent_smoke_test",
      chain: "base",
      agentName: "x402-local-smoke",
      baseNetwork: "mainnet",
    });

    const result = await wallet.payForService<{ ok: boolean; message: string; sawPaymentSignature: boolean }>({
      url: `http://localhost:${PORT}${PATH}`,
      method: "GET",
      parseAs: "json",
      expectedStatuses: [200],
    });

    console.log(
      JSON.stringify(
        {
          status: result.status,
          ok: result.ok,
          paidFlagFromSdk: result.paid,
          serverSawPaymentSignature: sawPaymentSignature,
          body: result.data,
        },
        null,
        2
      )
    );
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

