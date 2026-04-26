export async function verifyWithFacilitator(params: {
  paymentSignature: string;
  paymentRequired: unknown;
  endpoint: string;
}): Promise<{ verified: boolean; txHash?: string; detail?: string }> {
  const url = process.env.X402_FACILITATOR_VERIFY_URL;
  if (!url) {
    return { verified: true, detail: "facilitator verification url not configured" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentSignature: params.paymentSignature,
        paymentRequired: params.paymentRequired,
        endpoint: params.endpoint,
      }),
    });

    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      return { verified: false, detail: data?.error || `facilitator status ${res.status}` };
    }
    return {
      verified: Boolean(data?.verified ?? true),
      txHash: data?.txHash,
      detail: data?.detail,
    };
  } catch (err: any) {
    return { verified: false, detail: err?.message || "facilitator verification request failed" };
  }
}

