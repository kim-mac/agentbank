// setup.ts — Run once to register with AgentBank
// npx ts-node src/setup.ts
//
// What happens:
//   1. Generates Solana keypair ON THIS MACHINE (private key stays here)
//   2. Registers operator account with AgentBank
//   3. Registers PUBLIC wallet address with AgentBank (private key NEVER sent)
//   4. Writes .env with keys

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import * as fs from "fs";
import * as path from "path";

const API_URL  = "http://localhost:3001/v1";
const KEY_PATH = path.resolve(__dirname, "../.agent-key");
const ENV_PATH = path.resolve(__dirname, "../.env");

async function post(url: string, body: object, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<any>;
}

async function setup() {
  console.log("\n🏦 AgentBank Setup\n");
  console.log("Make sure the backend is running: cd backend && npm run dev\n");

  // ── Step 1: Generate keypair locally ────────────────────────────────────
  console.log("1️⃣  Generating wallet keypair on this machine...");
  let keypair: Keypair;
  if (fs.existsSync(KEY_PATH)) {
    keypair = Keypair.fromSecretKey(bs58.decode(fs.readFileSync(KEY_PATH, "utf-8").trim()));
    console.log("   ♻️  Existing keypair loaded");
  } else {
    keypair = Keypair.generate();
    fs.writeFileSync(KEY_PATH, bs58.encode(keypair.secretKey), { mode: 0o600 });
    console.log(`   ✅ New keypair generated → ${KEY_PATH}`);
  }
  const walletAddress = keypair.publicKey.toString();
  console.log(`   💳 Public address : ${walletAddress}`);
  console.log(`   🔒 Private key    : stays in ${KEY_PATH} — never sent to AgentBank\n`);

  // ── Step 2: Register operator ────────────────────────────────────────────
  console.log("2️⃣  Registering operator...");
  const op = await post(`${API_URL}/operators/register`, { email: "operator@example.com", orgName: "My AI Lab" });
  if (op.error) { console.error(`   ❌ ${op.error}`); process.exit(1); }
  console.log(`   ✅ Operator registered`);
  console.log(`   🔑 Operator API Key: ${op.apiKey}\n`);

  // ── Step 3: Register agent's PUBLIC address ──────────────────────────────
  console.log("3️⃣  Registering agent (public address only)...");
  const agent = await post(
    `${API_URL}/operators/agents`,
    {
      name:          "demo-agent-01",
      description:   "Demo AI agent with self-custodied wallet",
      walletAddress, // ← PUBLIC KEY ONLY
      chain:         "solana",
      policy: {
        dailyLimit:           2.0,
        txLimit:              0.5,
        requireApprovalAbove: 1.0,
        whitelistedAddresses: [],
        allowedChains:        ["solana"],
        killSwitch:           false,
      },
    },
    { "x-api-key": op.apiKey }
  );
  if (agent.error) { console.error(`   ❌ ${agent.error}`); process.exit(1); }
  console.log(`   ✅ Agent registered`);
  console.log(`   🔑 Agent API Key  : ${agent.agentApiKey}\n`);

  // ── Step 4: Write .env ───────────────────────────────────────────────────
  console.log("4️⃣  Writing .env...");
  fs.writeFileSync(ENV_PATH,
    `AGENTBANK_URL=http://localhost:3001/v1\n` +
    `AGENTBANK_API_KEY=${agent.agentApiKey}\n` +
    `OPERATOR_API_KEY=${op.apiKey}\n` +
    `AGENT_KEY_PATH=${KEY_PATH}\n`
  );
  console.log(`   ✅ Written to: ${ENV_PATH}\n`);

  console.log(`
╔══════════════════════════════════════════════════════════╗
║  Setup complete!                                         ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  ✅ Keypair generated on THIS machine                    ║
║  ✅ Private key saved locally (AgentBank never saw it)   ║
║  ✅ Public address registered with AgentBank             ║
║                                                          ║
║  Next:                                                   ║
║  1. Fund your wallet with devnet SOL:                    ║
║     https://faucet.solana.com/?addr=${walletAddress.slice(0,16)}... ║
║                                                          ║
║  2. Run the agent:                                       ║
║     npm run dev                                          ║
║                                                          ║
║  3. Open the operator dashboard:                         ║
║     dashboard/index.html                                 ║
╚══════════════════════════════════════════════════════════╝
`);
}

setup().catch(err => { console.error(err.message); process.exit(1); });
