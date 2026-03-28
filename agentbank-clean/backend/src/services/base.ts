// base.ts — Base (Ethereum L2) read-only queries (backend never signs anything)

import { createPublicClient, http, formatEther, isAddress } from "viem";
import { base, baseSepolia } from "viem/chains";

const isMainnet = process.env.BASE_NETWORK === "mainnet";
const chain     = isMainnet ? base : baseSepolia;
const rpcUrl    = process.env.BASE_RPC_URL || (isMainnet ? "https://mainnet.base.org" : "https://sepolia.base.org");

export const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

export async function getBalance(address: string): Promise<{ eth: number; wei: bigint }> {
  try {
    const wei = await publicClient.getBalance({ address: address as `0x${string}` });
    return { eth: parseFloat(formatEther(wei)), wei };
  } catch {
    return { eth: 0, wei: BigInt(0) };
  }
}

export function isValidBaseAddress(address: string): boolean {
  return isAddress(address);
}

export function explorerUrl(txHash: string): string {
  return isMainnet ? `https://basescan.org/tx/${txHash}` : `https://sepolia.basescan.org/tx/${txHash}`;
}

// Verify a txHash is real before tracking spend
export async function verifyTransaction(txHash: string): Promise<{ verified: boolean; blockNumber?: bigint }> {
  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
    return { verified: receipt.status === "success", blockNumber: receipt.blockNumber };
  } catch {
    return { verified: false };
  }
}
