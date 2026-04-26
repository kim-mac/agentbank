import { FastifyInstance } from "fastify";
import { isAddress } from "viem";
import { getPremiumPricing } from "../services/x402-config";
import * as db from "../db";
import { verifyWithFacilitator } from "../services/x402-settlement";

type PaymentRequired = {
  x402Version: number;
  error: string;
  resource: {
    url: string;
    description: string;
    mimeType: string;
  };
  accepts: Array<{
    scheme: "exact";
    network: string;
    amount: string;
    asset: string;
    payTo: string;
    maxTimeoutSeconds: number;
    extra?: Record<string, unknown>;
  }>;
};

type X402ErrorCode =
  | "PAYMENT_REQUIRED"
  | "INVALID_SIGNATURE_ENCODING"
  | "MALFORMED_SIGNATURE_PAYLOAD"
  | "UNSUPPORTED_PAYMENT_SCHEME"
  | "PAYMENT_NETWORK_MISMATCH"
  | "PAYMENT_AMOUNT_MISMATCH"
  | "PAYMENT_ASSET_MISMATCH"
  | "PAYMENT_DESTINATION_MISMATCH"
  | "INVALID_PAYER_ADDRESS"
  | "INVALID_PAYEE_ADDRESS"
  | "AUTHORIZATION_PAYEE_MISMATCH"
  | "AUTHORIZATION_VALUE_MISMATCH"
  | "MISSING_AUTHORIZATION_NONCE"
  | "INVALID_SIGNATURE_FORMAT"
  | "INVALID_AUTHORIZATION_WINDOW"
  | "AUTHORIZATION_OUTSIDE_WINDOW"
  | "REPLAY_NONCE_USED"
  | "FACILITATOR_VERIFICATION_FAILED";

function remediationFor(code: X402ErrorCode): string {
  switch (code) {
    case "PAYMENT_REQUIRED":
      return "Retry with PAYMENT-SIGNATURE using challenge details from PAYMENT-REQUIRED.";
    case "INVALID_SIGNATURE_ENCODING":
    case "MALFORMED_SIGNATURE_PAYLOAD":
      return "Encode PAYMENT-SIGNATURE as base64 JSON with accepted + payload.authorization fields.";
    case "UNSUPPORTED_PAYMENT_SCHEME":
      return "Use the exact payment scheme advertised in PAYMENT-REQUIRED accepts[0].";
    case "PAYMENT_NETWORK_MISMATCH":
    case "PAYMENT_AMOUNT_MISMATCH":
    case "PAYMENT_ASSET_MISMATCH":
    case "PAYMENT_DESTINATION_MISMATCH":
      return "Match network/amount/asset/payTo exactly to PAYMENT-REQUIRED accepts[0].";
    case "INVALID_PAYER_ADDRESS":
    case "INVALID_PAYEE_ADDRESS":
      return "Provide valid EVM addresses for authorization from/to fields.";
    case "AUTHORIZATION_PAYEE_MISMATCH":
    case "AUTHORIZATION_VALUE_MISMATCH":
      return "Set authorization to/value to match payTo and amount from the challenge.";
    case "MISSING_AUTHORIZATION_NONCE":
      return "Provide a unique nonce per payment attempt.";
    case "INVALID_SIGNATURE_FORMAT":
      return "Provide payload.signature as a 0x-prefixed hex string.";
    case "INVALID_AUTHORIZATION_WINDOW":
    case "AUTHORIZATION_OUTSIDE_WINDOW":
      return "Set validAfter/validBefore to a valid unix-second window that includes now.";
    case "REPLAY_NONCE_USED":
      return "Generate a new nonce and sign a fresh PAYMENT-SIGNATURE.";
    case "FACILITATOR_VERIFICATION_FAILED":
      return "Check facilitator availability/configuration or disable strict facilitator requirement.";
    default:
      return "Rebuild PAYMENT-SIGNATURE from the latest PAYMENT-REQUIRED challenge.";
  }
}

function send402(
  reply: any,
  paymentRequired: PaymentRequired,
  error: string,
  errorCode: X402ErrorCode
) {
  return reply
    .status(402)
    .header("Content-Type", "application/json")
    .header("PAYMENT-REQUIRED", toB64(paymentRequired))
    .send({
      error,
      errorCode,
      remediation: remediationFor(errorCode),
      x402Version: 2,
      accepts: paymentRequired.accepts,
    });
}

function toB64(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function fromB64<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as T;
}

function buildPaymentRequired(host: string): PaymentRequired {
  const cfg = getPremiumPricing();

  return {
    x402Version: 2,
    error: "PAYMENT-SIGNATURE header is required",
    resource: {
      url: `${host}/v1/premium/insights`,
      description: cfg.description,
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: "exact",
        network: cfg.network,
        amount: cfg.amountAtomic,
        asset: cfg.asset,
        payTo: cfg.payTo,
        maxTimeoutSeconds: cfg.maxTimeoutSeconds,
        extra: { name: "USDC", version: "2" },
      },
    ],
  };
}

type PaymentSignature = {
  x402Version?: number;
  accepted?: {
    scheme?: string;
    network?: string;
    amount?: string;
    asset?: string;
    payTo?: string;
    maxTimeoutSeconds?: number;
  };
  payload?: {
    signature?: string;
    authorization?: {
      from?: string;
      to?: string;
      value?: string;
      validAfter?: string;
      validBefore?: string;
      nonce?: string;
    };
  };
};

function validatePaymentSignature(
  raw: string,
  expected: PaymentRequired
): { error?: string; errorCode?: X402ErrorCode; decoded?: PaymentSignature } {
  let decoded: PaymentSignature;
  try {
    decoded = fromB64<PaymentSignature>(raw);
  } catch {
    return { error: "Invalid PAYMENT-SIGNATURE encoding", errorCode: "INVALID_SIGNATURE_ENCODING" };
  }

  const accepted = decoded.accepted;
  const auth = decoded.payload?.authorization;
  const sig = decoded.payload?.signature;
  const req = expected.accepts[0];

  if (!accepted || !auth || !sig) return { error: "Malformed PAYMENT-SIGNATURE payload", errorCode: "MALFORMED_SIGNATURE_PAYLOAD" };
  if (accepted.scheme !== req.scheme) return { error: "Unsupported payment scheme", errorCode: "UNSUPPORTED_PAYMENT_SCHEME" };
  if (accepted.network !== req.network) return { error: "Payment network mismatch", errorCode: "PAYMENT_NETWORK_MISMATCH" };
  if (accepted.amount !== req.amount) return { error: "Payment amount mismatch", errorCode: "PAYMENT_AMOUNT_MISMATCH" };
  if ((accepted.asset || "").toLowerCase() !== req.asset.toLowerCase()) return { error: "Payment asset mismatch", errorCode: "PAYMENT_ASSET_MISMATCH" };
  if ((accepted.payTo || "").toLowerCase() !== req.payTo.toLowerCase()) return { error: "Payment destination mismatch", errorCode: "PAYMENT_DESTINATION_MISMATCH" };

  if (!isAddress(auth.from || "")) return { error: "Invalid payer address", errorCode: "INVALID_PAYER_ADDRESS" };
  if (!isAddress(auth.to || "")) return { error: "Invalid payee address", errorCode: "INVALID_PAYEE_ADDRESS" };
  if ((auth.to || "").toLowerCase() !== req.payTo.toLowerCase()) return { error: "Authorization payee mismatch", errorCode: "AUTHORIZATION_PAYEE_MISMATCH" };
  if (auth.value !== req.amount) return { error: "Authorization value mismatch", errorCode: "AUTHORIZATION_VALUE_MISMATCH" };
  if (!auth.nonce || auth.nonce.length < 10) return { error: "Missing authorization nonce", errorCode: "MISSING_AUTHORIZATION_NONCE" };
  if (!/^0x[0-9a-fA-F]+$/.test(sig)) return { error: "Invalid payment signature format", errorCode: "INVALID_SIGNATURE_FORMAT" };

  const now = Math.floor(Date.now() / 1000);
  const validAfter = Number(auth.validAfter || "0");
  const validBefore = Number(auth.validBefore || "0");
  if (!Number.isFinite(validAfter) || !Number.isFinite(validBefore)) return { error: "Invalid authorization time window", errorCode: "INVALID_AUTHORIZATION_WINDOW" };
  if (now < validAfter || now > validBefore) return { error: "Payment authorization is outside validity window", errorCode: "AUTHORIZATION_OUTSIDE_WINDOW" };

  return { decoded };
}

export async function premiumRoutes(app: FastifyInstance) {
  app.get("/premium/insights", async (req, reply) => {
    const paymentSig = req.headers["payment-signature"];
    const host = `${req.protocol}://${req.headers.host || "localhost:3001"}`;
    const paymentRequired = buildPaymentRequired(host);

    if (!paymentSig || (Array.isArray(paymentSig) && paymentSig.length === 0)) {
      return send402(reply, paymentRequired, "payment required", "PAYMENT_REQUIRED");
    }

    const signatureValue = Array.isArray(paymentSig) ? paymentSig[0] : paymentSig;
    const validation = validatePaymentSignature(signatureValue, paymentRequired);
    if (validation.error || !validation.decoded?.payload?.authorization) {
      return send402(
        reply,
        paymentRequired,
        validation.error || "Invalid payment payload",
        validation.errorCode || "MALFORMED_SIGNATURE_PAYLOAD"
      );
    }

    const auth = validation.decoded.payload.authorization;
    const nonce = auth.nonce || "";
    const existing = await db.getX402PaymentByNonce(nonce);
    if (existing) {
      return send402(reply, paymentRequired, "Replay detected: payment nonce already used", "REPLAY_NONCE_USED");
    }

    const facilitator = await verifyWithFacilitator({
      paymentSignature: signatureValue,
      paymentRequired,
      endpoint: "/v1/premium/insights",
    });
    if (!facilitator.verified && process.env.X402_REQUIRE_FACILITATOR === "true") {
      return send402(
        reply,
        paymentRequired,
        `Facilitator verification failed: ${facilitator.detail || "unknown error"}`,
        "FACILITATOR_VERIFICATION_FAILED"
      );
    }

    const cfg = getPremiumPricing();
    const settlement = {
      x402Version: 2,
      success: true,
      network: cfg.network,
      amount: cfg.amountAtomic,
      settledAt: new Date().toISOString(),
      settlementId: facilitator.txHash || `demo_${Date.now()}`,
      facilitatorVerified: facilitator.verified,
      facilitatorDetail: facilitator.detail,
    };

    await db.createX402Payment({
      operatorId: cfg.operatorId,
      endpoint: "/v1/premium/insights",
      network: cfg.network,
      amountAtomic: cfg.amountAtomic,
      asset: cfg.asset,
      payTo: cfg.payTo,
      payerAddress: auth.from || "",
      nonce,
      authorizationValidAfter: auth.validAfter || "",
      authorizationValidBefore: auth.validBefore || "",
      paymentSignature: validation.decoded.payload.signature || "",
      facilitatorVerified: facilitator.verified,
      facilitatorTxHash: facilitator.txHash,
    });

    return reply
      .status(200)
      .header("Content-Type", "application/json")
      .header("PAYMENT-RESPONSE", toB64(settlement))
      .send({
        ok: true,
        premium: true,
        report: {
          txVelocity24h: "high",
          policyBreachRisk: "low",
          bestRoute: "base-sepolia",
          recommendation: "Increase premium API budget by 20% for higher autonomous throughput",
        },
      });
  });
}

