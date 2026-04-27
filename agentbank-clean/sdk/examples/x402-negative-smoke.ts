type PaymentRequired = {
  x402Version: number;
  accepts: Array<{
    scheme: string;
    network: string;
    amount: string;
    asset: string;
    payTo: string;
    maxTimeoutSeconds: number;
  }>;
};

type TestResult = {
  name: string;
  pass: boolean;
  status: number;
  error?: string;
  errorCode?: string;
  remediation?: string;
};

function toB64(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function fromB64<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as T;
}

function uniqueNonce(): string {
  return `nonce_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function asJsonSafe(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function hasErrorContract(body: Record<string, unknown>): boolean {
  return typeof body.errorCode === "string" && typeof body.remediation === "string" && body.remediation.length > 0;
}

function buildValidPaymentSignature(challenge: PaymentRequired, nonce: string) {
  const req = challenge.accepts[0];
  const now = Math.floor(Date.now() / 1000);
  return {
    x402Version: 2,
    accepted: {
      scheme: req.scheme,
      network: req.network,
      amount: req.amount,
      asset: req.asset,
      payTo: req.payTo,
      maxTimeoutSeconds: req.maxTimeoutSeconds,
    },
    payload: {
      signature: "0x1234abcd",
      authorization: {
        from: "0x1111111111111111111111111111111111111111",
        to: req.payTo,
        value: req.amount,
        validAfter: String(now - 30),
        validBefore: String(now + 300),
        nonce,
      },
    },
  };
}

async function run() {
  const apiBase = process.env.AGENTBANK_API_URL || "http://localhost:3001/v1";
  const premiumUrl = process.env.AGENTBANK_PREMIUM_URL || `${apiBase}/premium/insights`;

  const initial = await fetch(premiumUrl, { method: "GET" });
  if (initial.status !== 402) {
    throw new Error(`Expected initial 402 challenge, got ${initial.status}`);
  }

  const paymentRequiredHeader = initial.headers.get("PAYMENT-REQUIRED");
  if (!paymentRequiredHeader) throw new Error("Missing PAYMENT-REQUIRED header");
  const challenge = fromB64<PaymentRequired>(paymentRequiredHeader);

  const results: TestResult[] = [];

  // 1) Malformed PAYMENT-SIGNATURE encoding
  {
    const res = await fetch(premiumUrl, {
      method: "GET",
      headers: { "PAYMENT-SIGNATURE": "not-base64" },
    });
    const body = await asJsonSafe(res);
    results.push({
      name: "malformed_signature_encoding",
      pass:
        res.status === 402 &&
        String(body.error || "").includes("Invalid PAYMENT-SIGNATURE encoding") &&
        body.errorCode === "INVALID_SIGNATURE_ENCODING" &&
        hasErrorContract(body),
      status: res.status,
      error: String(body.error || ""),
      errorCode: String(body.errorCode || ""),
      remediation: String(body.remediation || ""),
    });
  }

  // 2) Payment network mismatch
  {
    const payload = buildValidPaymentSignature(challenge, uniqueNonce());
    payload.accepted.network = `${payload.accepted.network}_wrong`;
    const res = await fetch(premiumUrl, {
      method: "GET",
      headers: { "PAYMENT-SIGNATURE": toB64(payload) },
    });
    const body = await asJsonSafe(res);
    results.push({
      name: "network_mismatch",
      pass:
        res.status === 402 &&
        String(body.error || "").includes("Payment network mismatch") &&
        body.errorCode === "PAYMENT_NETWORK_MISMATCH" &&
        hasErrorContract(body),
      status: res.status,
      error: String(body.error || ""),
      errorCode: String(body.errorCode || ""),
      remediation: String(body.remediation || ""),
    });
  }

  // 3) Payment amount mismatch
  {
    const payload = buildValidPaymentSignature(challenge, uniqueNonce());
    payload.accepted.amount = String(Number(payload.accepted.amount) + 1);
    const res = await fetch(premiumUrl, {
      method: "GET",
      headers: { "PAYMENT-SIGNATURE": toB64(payload) },
    });
    const body = await asJsonSafe(res);
    results.push({
      name: "amount_mismatch",
      pass:
        res.status === 402 &&
        String(body.error || "").includes("Payment amount mismatch") &&
        body.errorCode === "PAYMENT_AMOUNT_MISMATCH" &&
        hasErrorContract(body),
      status: res.status,
      error: String(body.error || ""),
      errorCode: String(body.errorCode || ""),
      remediation: String(body.remediation || ""),
    });
  }

  // 4) Payment asset mismatch
  {
    const payload = buildValidPaymentSignature(challenge, uniqueNonce());
    payload.accepted.asset = "0x0000000000000000000000000000000000000000";
    const res = await fetch(premiumUrl, {
      method: "GET",
      headers: { "PAYMENT-SIGNATURE": toB64(payload) },
    });
    const body = await asJsonSafe(res);
    results.push({
      name: "asset_mismatch",
      pass:
        res.status === 402 &&
        String(body.error || "").includes("Payment asset mismatch") &&
        body.errorCode === "PAYMENT_ASSET_MISMATCH" &&
        hasErrorContract(body),
      status: res.status,
      error: String(body.error || ""),
      errorCode: String(body.errorCode || ""),
      remediation: String(body.remediation || ""),
    });
  }

  // 5) Replay nonce detection: first succeeds, second fails with replay
  {
    const nonce = uniqueNonce();
    const payload = buildValidPaymentSignature(challenge, nonce);

    const first = await fetch(premiumUrl, {
      method: "GET",
      headers: { "PAYMENT-SIGNATURE": toB64(payload) },
    });
    const second = await fetch(premiumUrl, {
      method: "GET",
      headers: { "PAYMENT-SIGNATURE": toB64(payload) },
    });
    const secondBody = await asJsonSafe(second);
    results.push({
      name: "replay_nonce_detection",
      pass:
        first.status === 200 &&
        second.status === 402 &&
        String(secondBody.error || "").includes("Replay detected: payment nonce already used") &&
        secondBody.errorCode === "REPLAY_NONCE_USED" &&
        hasErrorContract(secondBody),
      status: second.status,
      error: String(secondBody.error || ""),
      errorCode: String(secondBody.errorCode || ""),
      remediation: String(secondBody.remediation || ""),
    });
  }

  const failed = results.filter((r) => !r.pass);
  console.log(
    JSON.stringify(
      {
        premiumUrl,
        pass: failed.length === 0,
        total: results.length,
        failed: failed.length,
        results,
      },
      null,
      2
    )
  );

  process.exit(failed.length === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error("[x402-negative-smoke] FAILED:", err?.message || String(err));
  process.exit(1);
});

