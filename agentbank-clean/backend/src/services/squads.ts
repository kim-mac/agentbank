import { Keypair, PublicKey, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import bs58 from "bs58";
import * as solana from "./solana";
import type * as db from "../db";

const PROGRAM_ID = new PublicKey("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf");
const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

function toPublicKey(value: string): PublicKey {
  return new PublicKey(value);
}

function toLamports(amountSol: number): bigint {
  return BigInt(Math.round(amountSol * LAMPORTS_PER_SOL));
}

async function ensureSystemFunding(connection: Connection, system: Keypair, minSol = 0.05): Promise<void> {
  const current = await connection.getBalance(system.publicKey);
  if (current >= Math.round(minSol * LAMPORTS_PER_SOL)) return;
  // Best-effort funding for local/devnet workflows. Production should pre-fund this key.
  try {
    const sig = await connection.requestAirdrop(system.publicKey, Math.round(0.5 * LAMPORTS_PER_SOL));
    await connection.confirmTransaction(sig, "confirmed");
  } catch {
    // Ignore faucet failure; downstream RPC errors will still surface.
  }
}

function normalizeSquadsError(err: unknown): Error {
  if (err instanceof Error && err.message.includes("Cannot set property logs of Error")) {
    return new Error(
      "Squads RPC failed before error translation (likely upstream Solana RPC/program error; check system key funding and RPC logs)."
    );
  }
  return err instanceof Error ? err : new Error(String(err));
}

async function sendVersionedTx(
  connection: Connection,
  tx: any,
  signers: Keypair[]
): Promise<string> {
  tx.sign(signers);
  const sig = await connection.sendTransaction(tx);
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}

export function getSystemKeypair(): Keypair {
  const raw = process.env.SQUADS_SYSTEM_KEY;
  if (!raw) throw new Error("Missing SQUADS_SYSTEM_KEY");
  return Keypair.fromSecretKey(bs58.decode(raw.trim()));
}

export function getSystemPublicKey(): string {
  return getSystemKeypair().publicKey.toBase58();
}

export async function createAgentMultisig(agentPublicKey: string): Promise<{
  multisigPda: string;
  vaultPda: string;
  createKey: string;
  vaultIndex: number;
}> {
  const connection: Connection = solana.connection;
  const system = getSystemKeypair();
  await ensureSystemFunding(connection, system);
  const createKey = Keypair.generate();
  const [multisigPda] = multisig.getMultisigPda({ createKey: createKey.publicKey });
  const [programConfigPda] = multisig.getProgramConfigPda({});
  const programConfig = await multisig.accounts.ProgramConfig.fromAccountAddress(connection, programConfigPda);
  const { Permission, Permissions } = multisig.types;

  try {
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const tx = multisig.transactions.multisigCreateV2({
      blockhash,
      treasury: programConfig.treasury,
      configAuthority: system.publicKey,
      createKey: createKey.publicKey,
      creator: system.publicKey,
      multisigPda,
      threshold: 2,
      members: [
        { key: toPublicKey(agentPublicKey), permissions: Permissions.all() },
        { key: system.publicKey, permissions: Permissions.fromPermissions([Permission.Vote, Permission.Execute]) },
      ],
      timeLock: 0,
      rentCollector: null,
      programId: PROGRAM_ID,
    });
    await sendVersionedTx(connection, tx, [system, createKey]);
  } catch (err) {
    throw normalizeSquadsError(err);
  }

  const vaultIndex = 0;
  const [vaultPda] = multisig.getVaultPda({ multisigPda, index: vaultIndex });

  return {
    multisigPda: multisigPda.toBase58(),
    vaultPda: vaultPda.toBase58(),
    createKey: createKey.publicKey.toBase58(),
    vaultIndex,
  };
}

export async function configureSpendingLimit(args: {
  multisigPda: string;
  policy: db.Policy;
  vaultIndex: number;
  agentPublicKey: string;
}): Promise<{ spendingLimitPda: string; createKey: string }> {
  const connection = solana.connection;
  const system = getSystemKeypair();
  const createKey = Keypair.generate().publicKey;
  const multisigPda = toPublicKey(args.multisigPda);
  const [spendingLimitPda] = multisig.getSpendingLimitPda({ multisigPda, createKey });

  try {
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const tx = multisig.transactions.multisigAddSpendingLimit({
      blockhash,
      feePayer: system.publicKey,
      multisigPda,
      spendingLimit: spendingLimitPda,
      createKey,
      rentPayer: system.publicKey,
      amount: toLamports(args.policy.dailyLimit),
      configAuthority: system.publicKey,
      period: multisig.generated.Period.Day,
      mint: SOL_MINT,
      destinations: (args.policy.whitelistedAddresses || []).map((addr) => toPublicKey(addr)),
      members: [toPublicKey(args.agentPublicKey)],
      vaultIndex: args.vaultIndex,
      programId: PROGRAM_ID,
    });
    await sendVersionedTx(connection, tx, [system]);
  } catch (err) {
    throw normalizeSquadsError(err);
  }

  return { spendingLimitPda: spendingLimitPda.toBase58(), createKey: createKey.toBase58() };
}

export async function removeSpendingLimit(multisigPdaStr: string, spendingLimitPdaStr: string): Promise<void> {
  const connection = solana.connection;
  const system = getSystemKeypair();
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const tx = multisig.transactions.multisigRemoveSpendingLimit({
    blockhash,
    feePayer: system.publicKey,
    multisigPda: toPublicKey(multisigPdaStr),
    spendingLimit: toPublicKey(spendingLimitPdaStr),
    configAuthority: system.publicKey,
    rentCollector: system.publicKey,
    programId: PROGRAM_ID,
  });
  await sendVersionedTx(connection, tx, [system]);
}

export async function approveProposal(multisigPdaStr: string, transactionIndex: bigint): Promise<void> {
  const connection = solana.connection;
  const system = getSystemKeypair();
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const tx = multisig.transactions.proposalApprove({
    blockhash,
    feePayer: system.publicKey,
    multisigPda: toPublicKey(multisigPdaStr),
    transactionIndex,
    member: system.publicKey,
    programId: PROGRAM_ID,
  });
  await sendVersionedTx(connection, tx, [system]);
}

export async function removeMember(multisigPdaStr: string, memberKey: string): Promise<void> {
  const connection = solana.connection;
  const system = getSystemKeypair();
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const tx = multisig.transactions.multisigRemoveMember({
    blockhash,
    feePayer: system.publicKey,
    multisigPda: toPublicKey(multisigPdaStr),
    oldMember: toPublicKey(memberKey),
    configAuthority: system.publicKey,
    programId: PROGRAM_ID,
  });
  await sendVersionedTx(connection, tx, [system]);
}

export async function addMember(multisigPdaStr: string, memberKey: string): Promise<void> {
  const connection = solana.connection;
  const system = getSystemKeypair();
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const tx = multisig.transactions.multisigAddMember({
    blockhash,
    feePayer: system.publicKey,
    multisigPda: toPublicKey(multisigPdaStr),
    newMember: { key: toPublicKey(memberKey), permissions: multisig.types.Permissions.all() },
    configAuthority: system.publicKey,
    rentPayer: system.publicKey,
    programId: PROGRAM_ID,
  });
  await sendVersionedTx(connection, tx, [system]);
}

export async function getVaultBalance(vaultAddress: string): Promise<{ sol: number; lamports: number }> {
  return solana.getBalance(vaultAddress);
}

