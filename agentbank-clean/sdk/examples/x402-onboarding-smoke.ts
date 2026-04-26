import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { AgentWallet } from "../src/index";

type RegisterResponse = {
  agentId: string;
  agentApiKey: string;
  claimUrl: string;
  claimStatus: string;
  operator: {
    created: boolean;
    operatorKey: string;
    orgName: string;
  };
};

type CliOptions = {
  json: boolean;
  strict: boolean;
  skipClaim: boolean;
};

const EXIT_CODES = {
  success: 0,
  registerFailure: 10,
  claimFailure: 11,
  statusFailure: 12,
  paymentFailure: 13,
  strictFailure: 14,
  unexpectedFailure: 20,
} as const;

function nowTag(): string {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

function uniqueSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

function parseClaimToken(claimUrl: string): string {
  const parts = claimUrl.split("/");
  const token = parts[parts.length - 1];
  if (!token) throw new Error(`Could not parse claim token from: ${claimUrl}`);
  return token;
}

async function asJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Expected JSON but got: ${text}`);
  }
}

function parseArgs(argv: string[]): CliOptions {
  const has = (flag: string) => argv.includes(flag);
  return {
    json: has("--json"),
    strict: has("--strict"),
    skipClaim: has("--skip-claim"),
  };
}

function printResult(result: unknown, opts: CliOptions) {
  if (!opts.json) {
    console.log("[x402-onboarding-smoke] Completed. Use --json for machine output.");
  }
  console.log(JSON.stringify(result, null, 2));
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  const apiBase = process.env.AGENTBANK_API_URL || "http://localhost:3011/v1";
  const premiumUrl = process.env.AGENTBANK_PREMIUM_URL || `${apiBase}/premium/insights`;
  const email = process.env.SMOKE_EMAIL || `smoke+${nowTag()}_${uniqueSuffix()}@example.com`;
  const orgName = process.env.SMOKE_ORG || "Smoke Lab";
  const agentName = process.env.SMOKE_AGENT_NAME || `x402-smoke-${nowTag()}`;

  const account = privateKeyToAccount(generatePrivateKey());
  const walletAddress = account.address;

  const registerBody = {
    email,
    orgName,
    walletAddress,
    name: agentName,
    chain: "base",
  };

  const registerRes = await fetch(`${apiBase}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(registerBody),
  });
  if (!registerRes.ok) {
    const error = `Register failed (${registerRes.status}): ${await registerRes.text()}`;
    printResult({ pass: false, phase: "register", error, exitCode: EXIT_CODES.registerFailure }, opts);
    process.exit(EXIT_CODES.registerFailure);
  }
  const registered = await asJson<RegisterResponse>(registerRes);
  const claimToken = parseClaimToken(registered.claimUrl);

  let claimData: Record<string, unknown> = { claimStatus: "skipped" };
  if (!opts.skipClaim) {
    const claimRes = await fetch(`${apiBase}/claim/${claimToken}`, {
      method: "POST",
      headers: {
        "x-api-key": registered.operator.operatorKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    if (!claimRes.ok) {
      const error = `Claim failed (${claimRes.status}): ${await claimRes.text()}`;
      printResult({ pass: false, phase: "claim", error, exitCode: EXIT_CODES.claimFailure }, opts);
      process.exit(EXIT_CODES.claimFailure);
    }
    claimData = await asJson<Record<string, unknown>>(claimRes);
  }

  const statusRes = await fetch(`${apiBase}/register/status`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${registered.agentApiKey}`,
    },
  });
  if (!statusRes.ok) {
    const error = `Status failed (${statusRes.status}): ${await statusRes.text()}`;
    printResult({ pass: false, phase: "status", error, exitCode: EXIT_CODES.statusFailure }, opts);
    process.exit(EXIT_CODES.statusFailure);
  }
  const statusData = await asJson<Record<string, unknown>>(statusRes);

  const wallet = new AgentWallet({
    agentApiKey: registered.agentApiKey,
    chain: "base",
    agentName,
    baseNetwork: "mainnet",
  });

  const paid = await wallet.payForService({
    url: premiumUrl,
    method: "GET",
    parseAs: "json",
    expectedStatuses: [200],
  });

  const checks = {
    registerOk: Boolean(registered.agentApiKey && registered.claimUrl),
    claimOk: opts.skipClaim ? true : claimData.claimStatus === "claimed",
    statusClaimed: statusData.claimStatus === "claimed",
    canTransact: statusData.canTransact === true,
    readinessShapeOk:
      typeof statusData.x402Mode === "string" &&
      typeof statusData.modeReason === "string" &&
      Array.isArray(statusData.missingPrerequisites) &&
      typeof statusData.canUseProxyX402 === "boolean" &&
      typeof statusData.canUseNativeX402 === "boolean" &&
      typeof statusData.checks === "object" &&
      statusData.checks !== null &&
      typeof statusData.nextActions === "object" &&
      statusData.nextActions !== null,
    paidOk: paid.ok === true && paid.paid === true && paid.status === 200,
  };

  const failed = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

  const remediation = {
    registerOk: "Check AGENTBANK_API_URL and backend health endpoint.",
    claimOk: "Verify operator key and ensure claim token belongs to that operator.",
    statusClaimed: "Poll /register/status until claimStatus='claimed'.",
    canTransact: "Agent is still pending or policy/status blocks execution.",
    readinessShapeOk: "Ensure /register/status includes readiness fields and nextActions contract.",
    paidOk: "Check premium endpoint pricing config and Base/x402 runtime setup.",
  };

  const strictChecks = {
    nativeReady: statusData.x402Mode === "native_enabled",
    noMissingPrerequisites:
      Array.isArray(statusData.missingPrerequisites) &&
      (statusData.missingPrerequisites as unknown[]).length === 0,
    nativeAllowed: statusData.canUseNativeX402 === true,
  };

  const strictFailed = Object.entries(strictChecks)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

  const strictRemediation = {
    nativeReady: "Set Base chain + claim agent + complete x402 backend config.",
    noMissingPrerequisites: "Resolve entries under missingPrerequisites from /register/status.",
    nativeAllowed: "Ensure canUseNativeX402=true before strict smoke runs.",
  };

  const standardPass = failed.length === 0;
  const strictPass = opts.strict ? strictFailed.length === 0 : true;
  const pass = standardPass && strictPass;

  let exitCode = EXIT_CODES.success;
  if (!checks.paidOk) {
    exitCode = EXIT_CODES.paymentFailure;
  } else if (!standardPass) {
    exitCode = EXIT_CODES.statusFailure;
  } else if (!strictPass) {
    exitCode = EXIT_CODES.strictFailure;
  }

  const result = {
    cli: {
      strict: opts.strict,
      skipClaim: opts.skipClaim,
      json: opts.json,
    },
    apiBase,
    premiumUrl,
    agent: {
      name: agentName,
      walletAddress,
      agentId: registered.agentId,
      agentApiKey: registered.agentApiKey,
      operatorKey: registered.operator.operatorKey,
      claimToken,
    },
    checks,
    strictChecks: opts.strict ? strictChecks : undefined,
    pass,
    failedChecks: failed,
    strictFailedChecks: opts.strict ? strictFailed : [],
    remediation: failed.map((k) => ({ check: k, hint: remediation[k as keyof typeof remediation] })),
    strictRemediation: opts.strict
      ? strictFailed.map((k) => ({ check: k, hint: strictRemediation[k as keyof typeof strictRemediation] }))
      : [],
    status: statusData,
    payment: {
      status: paid.status,
      ok: paid.ok,
      paid: paid.paid,
      paymentResponsePresent: Boolean(paid.paymentResponse),
    },
    exitCode,
  };

  printResult(result, opts);
  process.exit(exitCode);
}

run().catch((e) => {
  console.error("[x402-onboarding-smoke] FAILED:", e.message || e);
  process.exit(EXIT_CODES.unexpectedFailure);
});

