// price-feed.ts — CoinGecko price feed for paper trading
// Free tier: no API key needed, 30 calls/min, covers 30M+ tokens

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

// Cache prices for 30 seconds to avoid rate limits
const priceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_TTL  = 30_000;

export interface TokenPrice {
  usd:            number;
  usd_24h_change: number;
  sol?:           number;
}

// ── Get price by CoinGecko ID ───────────────────────────────────────────────
export async function getTokenPrice(coinGeckoId: string): Promise<TokenPrice | null> {
  const cached = priceCache.get(coinGeckoId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { usd: cached.price, usd_24h_change: 0 };
  }

  try {
    const res  = await fetch(
      `${COINGECKO_BASE}/simple/price?ids=${coinGeckoId}&vs_currencies=usd&include_24hr_change=true`,
      { headers: { "Accept": "application/json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const item = data[coinGeckoId];
    if (!item) return null;

    priceCache.set(coinGeckoId, { price: item.usd, timestamp: Date.now() });
    return { usd: item.usd, usd_24h_change: item.usd_24h_change || 0 };
  } catch {
    return null;
  }
}

// ── Get multiple prices at once ─────────────────────────────────────────────
export async function getMultiplePrices(coinGeckoIds: string[]): Promise<Record<string, TokenPrice>> {
  const ids = coinGeckoIds.join(",");
  try {
    const res  = await fetch(
      `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      { headers: { "Accept": "application/json" } }
    );
    if (!res.ok) return {};
    const data = await res.json();

    const result: Record<string, TokenPrice> = {};
    for (const id of coinGeckoIds) {
      if (data[id]) {
        priceCache.set(id, { price: data[id].usd, timestamp: Date.now() });
        result[id] = { usd: data[id].usd, usd_24h_change: data[id].usd_24h_change || 0 };
      }
    }
    return result;
  } catch {
    return {};
  }
}

// ── Token by Solana contract address ───────────────────────────────────────
export async function getTokenPriceByAddress(mintAddress: string): Promise<TokenPrice | null> {
  try {
    const res  = await fetch(
      `${COINGECKO_BASE}/simple/token_price/solana?contract_addresses=${mintAddress}&vs_currencies=usd&include_24hr_change=true`,
      { headers: { "Accept": "application/json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const item = data[mintAddress.toLowerCase()];
    if (!item) return null;
    return { usd: item.usd, usd_24h_change: item.usd_24h_change || 0 };
  } catch {
    return null;
  }
}

// ── Well-known token IDs ────────────────────────────────────────────────────
// Agents can use these symbols directly
export const KNOWN_TOKENS: Record<string, string> = {
  SOL:    "solana",
  BTC:    "bitcoin",
  ETH:    "ethereum",
  USDC:   "usd-coin",
  JUP:    "jupiter-exchange-solana",
  BONK:   "bonk",
  WIF:    "dogwifcoin",
  PYTH:   "pyth-network",
  RAY:    "raydium",
  ORCA:   "orca",
  DRIFT:  "drift-protocol",
  JITO:   "jito-governance-token",
  MSOL:   "msol",
  USDT:   "tether",
};

export function getTokenId(symbol: string): string | null {
  return KNOWN_TOKENS[symbol.toUpperCase()] || null;
}

// ── Get SOL price (most common) ─────────────────────────────────────────────
export async function getSolPrice(): Promise<number> {
  const price = await getTokenPrice("solana");
  return price?.usd || 0;
}
