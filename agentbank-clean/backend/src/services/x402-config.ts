type PremiumPricing = {
  network: string;
  amountAtomic: string;
  asset: string;
  payTo: string;
  description: string;
  maxTimeoutSeconds: number;
  operatorId?: string;
};

const pricing: PremiumPricing = {
  network: process.env.X402_NETWORK || "eip155:84532",
  amountAtomic: process.env.X402_PREMIUM_AMOUNT_ATOMIC || "10000",
  asset: process.env.X402_PREMIUM_ASSET || "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  payTo: process.env.X402_PAY_TO || "0x1111111111111111111111111111111111111111",
  description: process.env.X402_PREMIUM_DESCRIPTION || "Premium AgentBank insights",
  maxTimeoutSeconds: Number(process.env.X402_MAX_TIMEOUT_SECONDS || 60),
};

export function getPremiumPricing(): PremiumPricing {
  return { ...pricing };
}

export function updatePremiumPricing(next: Partial<PremiumPricing>, operatorId?: string): PremiumPricing {
  if (next.network !== undefined) pricing.network = next.network;
  if (next.amountAtomic !== undefined) pricing.amountAtomic = next.amountAtomic;
  if (next.asset !== undefined) pricing.asset = next.asset;
  if (next.payTo !== undefined) pricing.payTo = next.payTo;
  if (next.description !== undefined) pricing.description = next.description;
  if (next.maxTimeoutSeconds !== undefined) pricing.maxTimeoutSeconds = next.maxTimeoutSeconds;
  if (operatorId) pricing.operatorId = operatorId;
  return getPremiumPricing();
}

