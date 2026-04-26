# AgentStack: Complete Architecture Documentation

**Version:** 1.0  
**Date:** April 25, 2026  
**Project:** Colosseum Frontier Hackathon Submission  
**Built on:** AgentBank Infrastructure  

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Core Value Proposition](#core-value-proposition)
3. [System Architecture](#system-architecture)
4. [Technical Stack](#technical-stack)
5. [SDK Architecture](#sdk-architecture)
6. [x402 Integration](#x402-integration)
7. [Multi-Chain Support](#multi-chain-support)
8. [Policy Engine](#policy-engine)
9. [Developer Experience](#developer-experience)
10. [Database Schema](#database-schema)
11. [API Endpoints](#api-endpoints)
12. [Security Considerations](#security-considerations)
13. [Implementation Roadmap](#implementation-roadmap)

---

## Executive Summary

**AgentStack** is an Infrastructure-as-a-Service SDK that provides wallet, payment, and policy management for AI agents. Built as an npm package on top of AgentBank's existing infrastructure, it enables developers to integrate autonomous agent capabilities in minutes rather than weeks.

### Key Features

- ✅ **One-line integration** for AI agents to transact on Solana and Base
- ✅ **x402 protocol support** for micropayments to APIs and services
- ✅ **Built-in policy engine** with spending limits and approval workflows
- ✅ **Multi-chain routing** (Solana + Base with automatic cost optimization)
- ✅ **Session management** for reduced transaction overhead
- ✅ **Real-time dashboard** for monitoring agent activity
- ✅ **Payment batching** to reduce blockchain fees
- ✅ **Provider discovery** to find cheapest x402 endpoints

### Business Model

- **Transaction fees:** 0.3-0.5% on x402 payments
- **SaaS tiers:** Free (10K tx/mo), Pro ($99/mo), Enterprise (custom)
- **Premium features:** Advanced analytics, compliance reporting

---

## Core Value Proposition

### The Problem

Every AI agent developer faces the same infrastructure challenges:

1. **Wallet Management:** Creating/managing wallets for agents
2. **Payment Rails:** Integrating crypto payments (especially x402 micropayments)
3. **Policy Enforcement:** Setting spending limits, approval workflows
4. **Security:** Protecting agent wallets from exploits
5. **Multi-chain Support:** Supporting both Solana and EVM chains
6. **Monitoring:** Tracking agent spending and transactions

Current solutions require weeks of development. No standardized infrastructure exists.

### The Solution

**AgentStack = Stripe for AI Agents**

Just as Stripe abstracted payment complexity for web developers, AgentStack abstracts wallet/payment complexity for AI agent developers.

```typescript
// Install
npm install @agentbank/sdk

// Use
import { AgentStack } from '@agentbank/sdk';

const agent = new AgentStack({
  apiKey: process.env.AGENTBANK_API_KEY,
  chain: 'solana',
  policies: { dailyLimit: 100 }
});

// Agent can now transact autonomously
const data = await agent.payForAPI('https://api.example.com/data');
```

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Developer's AI Agent                         │
│                  (LangChain, AutoGPT, Custom)                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ npm install @agentbank/sdk
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AgentStack SDK Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ Wallet Mgmt  │  │ X402 Client  │  │ Policy Enforcement   │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ Multi-Chain  │  │ Session Mgr  │  │ Payment Batching     │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                 AgentBank Backend (Existing)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ Supabase DB  │  │ Wallet Store │  │ Transaction Logger   │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ Policy Rules │  │ Dashboard API│  │ Agent Messaging      │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                ┌───────────┼───────────┐
                ▼           ▼           ▼
         ┌──────────┐ ┌──────────┐ ┌──────────┐
         │ Solana   │ │   Base   │ │ x402 API │
         │ Network  │ │ Network  │ │ Providers│
         └──────────┘ └──────────┘ └──────────┘
```

### Component Breakdown

#### 1. SDK Layer (Public npm Package)
- **Purpose:** Developer-facing interface
- **Language:** TypeScript
- **Distribution:** npm (@agentbank/sdk)
- **Key Classes:** AgentStack, X402Client, PolicyEngine, WalletAdapter

#### 2. AgentBank Backend (Existing Infrastructure)
- **Purpose:** Centralized services for wallet management, logging, policies
- **Stack:** Node.js, Fastify, Supabase
- **Deployment:** Railway
- **Database:** PostgreSQL (via Supabase)

#### 3. Frontend Dashboard (Existing)
- **Purpose:** Monitor agent activity, set policies
- **Stack:** Next.js 14, React, Tailwind CSS
- **Deployment:** Vercel
- **Features:** Transaction history, budget alerts, policy configuration

---

## Technical Stack

### SDK Package (@agentbank/sdk)

```json
{
  "name": "@agentbank/sdk",
  "version": "0.1.0-beta",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "dependencies": {
    "@solana/web3.js": "^1.91.0",
    "@solana/spl-token": "^0.4.0",
    "viem": "^2.9.0",
    "ethers": "^6.11.0",
    "axios": "^1.6.0",
    "bs58": "^5.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.11.0",
    "tsup": "^8.0.0",
    "vitest": "^1.3.0"
  }
}
```

### Backend Services (Existing AgentBank)

```json
{
  "name": "agentbank-backend",
  "dependencies": {
    "fastify": "^4.26.0",
    "@supabase/supabase-js": "^2.39.0",
    "@solana/web3.js": "^1.91.0",
    "viem": "^2.9.0",
    "zod": "^3.22.0",
    "dotenv": "^16.4.0"
  }
}
```

### Blockchain Integrations

**Solana:**
- RPC: Helius or QuickNode
- USDC Mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- Jupiter for swaps
- Pyth for price feeds

**Base (EVM):**
- RPC: Alchemy or Infura
- USDC Contract: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Uniswap for swaps
- Chainlink for price feeds

---

## SDK Architecture

### File Structure

```
@agentbank/sdk/
├── src/
│   ├── index.ts                    # Main entry point
│   ├── core/
│   │   ├── AgentStack.ts           # Primary SDK class
│   │   ├── types.ts                # TypeScript interfaces
│   │   └── errors.ts               # Custom error classes
│   ├── wallet/
│   │   ├── WalletAdapter.ts        # Abstract wallet interface
│   │   ├── SolanaWallet.ts         # Solana implementation
│   │   ├── BaseWallet.ts           # Base/EVM implementation
│   │   └── KeyManagement.ts        # Key storage/encryption
│   ├── payments/
│   │   ├── X402Client.ts           # x402 protocol client
│   │   ├── SessionManager.ts       # Session token management
│   │   ├── PaymentBatcher.ts       # Batch payment processor
│   │   └── PricingIndex.ts         # Provider price discovery
│   ├── policy/
│   │   ├── PolicyEngine.ts         # Policy evaluation engine
│   │   ├── SpendingLimits.ts       # Daily/weekly limits
│   │   └── ApprovalWorkflow.ts     # Approval request handling
│   ├── chains/
│   │   ├── ChainRouter.ts          # Multi-chain routing logic
│   │   ├── SolanaAdapter.ts        # Solana-specific operations
│   │   └── BaseAdapter.ts          # Base-specific operations
│   └── utils/
│       ├── logger.ts               # Logging utilities
│       ├── retry.ts                # Retry logic for failed tx
│       └── constants.ts            # Network constants
├── examples/
│   ├── 01-basic-setup.ts
│   ├── 02-x402-payment.ts
│   ├── 03-trading-bot.ts
│   └── 04-multi-agent.ts
├── tests/
│   ├── unit/
│   └── integration/
├── package.json
├── tsconfig.json
└── README.md
```

### Core Class: AgentStack

```typescript
// src/core/AgentStack.ts

import { SolanaWallet } from '../wallet/SolanaWallet';
import { BaseWallet } from '../wallet/BaseWallet';
import { X402Client } from '../payments/X402Client';
import { PolicyEngine } from '../policy/PolicyEngine';
import { ChainRouter } from '../chains/ChainRouter';

export interface AgentStackConfig {
  apiKey: string;                    // AgentBank API key
  chain?: 'solana' | 'base';         // Primary chain
  agentId?: string;                  // Optional agent identifier
  policies?: PolicyConfig;           // Spending policies
  rpcUrl?: string;                   // Custom RPC endpoint
  environment?: 'mainnet' | 'devnet' | 'testnet';
}

export interface PolicyConfig {
  dailyLimit?: number;               // Max USD per day
  weeklyLimit?: number;              // Max USD per week
  transactionLimit?: number;         // Max USD per transaction
  allowedProtocols?: string[];       // Whitelist of protocols
  requireApproval?: {
    above?: number;                  // Require approval if tx > amount
    for?: string[];                  // Require approval for specific actions
  };
  alertThresholds?: {
    daily?: number;                  // Alert at X% of daily limit
    weekly?: number;                 // Alert at X% of weekly limit
  };
}

export interface SwapParams {
  from: string;                      // Token mint/address
  to: string;                        // Token mint/address
  amount: number;                    // Amount in base units
  slippage?: number;                 // Max slippage (default 0.5%)
  referrer?: string;                 // Referral address
}

export interface TransferParams {
  to: string;                        // Recipient address
  amount: number;                    // Amount to send
  token?: string;                    // Token mint/address (default: native)
  memo?: string;                     // Optional memo
}

export class AgentStack {
  private wallet: SolanaWallet | BaseWallet;
  private x402: X402Client;
  private policy: PolicyEngine;
  private router: ChainRouter;
  private config: AgentStackConfig;

  constructor(config: AgentStackConfig) {
    this.config = config;
    
    // Initialize wallet based on chain
    if (config.chain === 'base') {
      this.wallet = new BaseWallet(config);
    } else {
      this.wallet = new SolanaWallet(config); // Default to Solana
    }
    
    // Initialize services
    this.x402 = new X402Client(this.wallet, config);
    this.policy = new PolicyEngine(config.policies || {});
    this.router = new ChainRouter(config);
  }

  // ==================== Wallet Operations ====================

  /**
   * Get wallet address
   */
  public getAddress(): string {
    return this.wallet.getAddress();
  }

  /**
   * Get balance for a specific token
   * @param token - Token mint/address (optional, defaults to native)
   */
  public async getBalance(token?: string): Promise<number> {
    return this.wallet.getBalance(token);
  }

  /**
   * Transfer tokens to another address
   */
  public async transfer(params: TransferParams): Promise<Transaction> {
    // Check policy before executing
    const policyCheck = await this.policy.evaluate({
      type: 'transfer',
      amount: params.amount,
      recipient: params.to,
      token: params.token
    });
    
    if (!policyCheck.allowed) {
      throw new PolicyViolationError(policyCheck.reason);
    }
    
    return this.wallet.transfer(params);
  }

  /**
   * Swap tokens using DEX aggregators
   */
  public async swap(params: SwapParams): Promise<Transaction> {
    // Check policy
    const policyCheck = await this.policy.evaluate({
      type: 'swap',
      amount: params.amount,
      fromToken: params.from,
      toToken: params.to
    });
    
    if (!policyCheck.allowed) {
      throw new PolicyViolationError(policyCheck.reason);
    }
    
    return this.wallet.swap(params);
  }

  // ==================== x402 Payments ====================

  /**
   * Make an HTTP request with automatic x402 payment handling
   * @param endpoint - API endpoint URL
   * @param method - HTTP method (GET, POST, etc.)
   * @param body - Request body (for POST/PUT)
   * @returns HTTP Response
   */
  public async payForAPI(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<Response> {
    return this.x402.makePayment(endpoint, method, body);
  }

  /**
   * Create a payment session for frequent API usage
   * @param provider - API provider identifier
   * @param budget - Total budget for session (USD)
   * @param duration - Session duration in seconds (default 3600)
   */
  public async createPaymentSession(
    provider: string,
    budget: number,
    duration?: number
  ): Promise<SessionToken> {
    return this.x402.createSession(provider, budget, duration);
  }

  /**
   * Find cheapest x402 provider for a service
   * @param service - Service type (e.g., 'weather-api', 'price-feed')
   */
  public async findCheapestProvider(service: string): Promise<X402Provider> {
    return this.x402.pricing.findCheapest(service);
  }

  // ==================== Policy Management ====================

  /**
   * Check if an action is allowed under current policies
   */
  public async checkPolicy(action: PolicyAction): Promise<PolicyResult> {
    return this.policy.evaluate(action);
  }

  /**
   * Request approval for an action that requires it
   */
  public async requestApproval(action: PolicyAction): Promise<ApprovalToken> {
    return this.policy.requestApproval(action);
  }

  /**
   * Get current spending statistics
   */
  public async getSpendingStats(): Promise<SpendingStats> {
    return this.policy.getStats();
  }

  // ==================== Multi-Chain Operations ====================

  /**
   * Route a payment to the cheapest chain
   */
  public async routePayment(payment: PaymentRequest): Promise<Transaction> {
    return this.router.route(payment);
  }

  /**
   * Bridge assets between chains
   */
  public async bridge(params: BridgeParams): Promise<Transaction> {
    return this.router.bridge(params);
  }

  // ==================== Agent Messaging (AgentBank Feature) ====================

  /**
   * Send message to another agent
   */
  public async sendMessage(agentId: string, message: string): Promise<void> {
    await this.agentbankAPI.post('/messages', {
      from: this.config.agentId,
      to: agentId,
      content: message
    });
  }

  /**
   * Join a channel for group communication
   */
  public async joinChannel(channelId: string): Promise<void> {
    await this.agentbankAPI.post(`/channels/${channelId}/join`, {
      agentId: this.config.agentId
    });
  }
}
```

### Supporting Classes

```typescript
// src/core/types.ts

export interface Transaction {
  signature: string;
  chain: 'solana' | 'base';
  timestamp: number;
  type: 'transfer' | 'swap' | 'x402_payment';
  amount?: number;
  from?: string;
  to?: string;
  status: 'pending' | 'confirmed' | 'failed';
}

export interface SessionToken {
  id: string;
  provider: string;
  budget: number;
  spent: number;
  expiresAt: number;
  escrowAddress: string;
  signature: string;
}

export interface X402Provider {
  id: string;
  name: string;
  endpoint: string;
  pricePerRequest: number;
  currency: 'USDC' | 'SOL';
  avgLatency: number;
  uptime: number;
  rating: number;
}

export interface PolicyAction {
  type: 'transfer' | 'swap' | 'x402_payment' | 'bridge';
  amount: number;
  recipient?: string;
  token?: string;
  purpose?: string;
}

export interface PolicyResult {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
  approvalUrl?: string;
}

export interface SpendingStats {
  dailySpent: number;
  weeklySpent: number;
  monthlySpent: number;
  dailyLimit: number;
  weeklyLimit: number;
  topEndpoints: Array<{
    endpoint: string;
    totalSpent: number;
    callCount: number;
  }>;
  suggestions: string[];
}

export interface ApprovalToken {
  id: string;
  action: PolicyAction;
  requestedAt: number;
  expiresAt: number;
  approvalUrl: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface BridgeParams {
  fromChain: 'solana' | 'base';
  toChain: 'solana' | 'base';
  token: string;
  amount: number;
  recipient?: string;
}

export interface PaymentRequest {
  amount: number;
  currency: 'USDC' | 'SOL' | 'ETH';
  recipient: string;
  purpose?: string;
}
```

---

## x402 Integration

### x402 Protocol Overview

The x402 protocol enables AI agents to make micropayments for API access using the HTTP 402 status code. The flow:

1. **Request:** Agent requests resource from x402-enabled API
2. **402 Response:** Server returns 402 with payment instructions
3. **Payment:** Agent pays specified amount in USDC
4. **Retry:** Agent retries request with payment proof
5. **Fulfillment:** Server validates payment and returns resource

### Implementation

```typescript
// src/payments/X402Client.ts

import { WalletAdapter } from '../wallet/WalletAdapter';
import { SessionManager } from './SessionManager';
import { PaymentBatcher } from './PaymentBatcher';
import { PricingIndex } from './PricingIndex';

export interface X402PaymentInfo {
  price: string;                     // Price in USD
  currency: 'USDC' | 'SOL';          // Payment currency
  recipient: string;                 // Payment recipient address
  network: 'solana' | 'base';        // Settlement network
  paymentId: string;                 // Unique payment identifier
  description?: string;              // What you're paying for
}

export class X402Client {
  private wallet: WalletAdapter;
  private sessions: SessionManager;
  private batcher: PaymentBatcher;
  public pricing: PricingIndex;
  private config: any;

  constructor(wallet: WalletAdapter, config: any) {
    this.wallet = wallet;
    this.config = config;
    this.sessions = new SessionManager(wallet);
    this.batcher = new PaymentBatcher(wallet);
    this.pricing = new PricingIndex();
  }

  /**
   * Make an HTTP request with automatic x402 payment handling
   */
  public async makePayment(
    endpoint: string,
    method: string = 'GET',
    body?: any
  ): Promise<Response> {
    
    console.log(`[X402] Requesting: ${method} ${endpoint}`);
    
    // Step 1: Check if we have an active session for this provider
    const provider = this.extractProvider(endpoint);
    const session = await this.sessions.getActive(provider);
    
    if (session && session.budget - session.spent > 0) {
      return this.makePaymentWithSession(endpoint, method, body, session);
    }
    
    // Step 2: Make initial request (will likely fail with 402)
    const initialResponse = await fetch(endpoint, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AgentStack-SDK/0.1.0'
      }
    });
    
    // Step 3: Handle 402 response
    if (initialResponse.status === 402) {
      const paymentInfo: X402PaymentInfo = await initialResponse.json();
      
      console.log(`[X402] Payment required: $${paymentInfo.price} ${paymentInfo.currency}`);
      
      // Step 4: Validate payment info
      this.validatePaymentInfo(paymentInfo);
      
      // Step 5: Check policy before paying
      const policyCheck = await this.wallet.checkPolicy({
        type: 'x402_payment',
        amount: parseFloat(paymentInfo.price),
        recipient: paymentInfo.recipient,
        purpose: endpoint
      });
      
      if (!policyCheck.allowed) {
        throw new PolicyViolationError(
          `Payment blocked by policy: ${policyCheck.reason}`
        );
      }
      
      // Step 6: Execute payment on blockchain
      const paymentSignature = await this.executePayment(paymentInfo);
      
      console.log(`[X402] Payment executed: ${paymentSignature}`);
      
      // Step 7: Retry request with payment proof
      const paidResponse = await fetch(endpoint, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AgentStack-SDK/0.1.0',
          'X-Payment-Id': paymentInfo.paymentId,
          'X-Payment-Signature': paymentSignature,
          'X-Payment-Network': paymentInfo.network
        }
      });
      
      // Step 8: Log transaction to AgentBank dashboard
      await this.logTransaction({
        endpoint,
        provider,
        amount: parseFloat(paymentInfo.price),
        currency: paymentInfo.currency,
        signature: paymentSignature,
        network: paymentInfo.network,
        timestamp: Date.now(),
        status: paidResponse.ok ? 'success' : 'failed'
      });
      
      return paidResponse;
    }
    
    // If not 402, return original response
    return initialResponse;
  }

  /**
   * Execute payment on blockchain
   */
  private async executePayment(paymentInfo: X402PaymentInfo): Promise<string> {
    const { price, currency, recipient, network } = paymentInfo;
    
    // Convert price to base units (USDC has 6 decimals, SOL has 9)
    const decimals = currency === 'USDC' ? 6 : 9;
    const amount = parseFloat(price) * Math.pow(10, decimals);
    
    // Determine token mint/address based on network and currency
    let token: string;
    
    if (network === 'solana') {
      if (currency === 'USDC') {
        token = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC mint
      } else {
        token = 'native'; // SOL
      }
    } else {
      // Base network
      if (currency === 'USDC') {
        token = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC contract
      } else {
        token = 'native'; // ETH
      }
    }
    
    // Execute transfer
    const transaction = await this.wallet.transfer({
      to: recipient,
      amount,
      token,
      memo: `x402:${paymentInfo.paymentId}`
    });
    
    return transaction.signature;
  }

  /**
   * Make payment using an active session token
   */
  private async makePaymentWithSession(
    endpoint: string,
    method: string,
    body: any,
    session: SessionToken
  ): Promise<Response> {
    
    console.log(`[X402] Using session: ${session.id}`);
    
    return fetch(endpoint, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AgentStack-SDK/0.1.0',
        'X-Session-Token': session.id,
        'X-Session-Signature': await this.sessions.signSession(session)
      }
    });
  }

  /**
   * Create a payment session for frequent API usage
   */
  public async createSession(
    provider: string,
    budget: number,
    duration: number = 3600
  ): Promise<SessionToken> {
    
    console.log(`[X402] Creating session for ${provider}: $${budget} budget`);
    
    // Escrow USDC for session duration
    const escrowTx = await this.wallet.createEscrow({
      amount: budget * 1_000_000, // USDC decimals
      recipient: provider,
      releaseCondition: 'session-complete',
      timeout: duration
    });
    
    const session: SessionToken = {
      id: this.generateSessionId(),
      provider,
      budget,
      spent: 0,
      expiresAt: Date.now() + (duration * 1000),
      escrowAddress: escrowTx.address,
      signature: escrowTx.signature
    };
    
    await this.sessions.store(session);
    
    return session;
  }

  /**
   * Validate payment information from 402 response
   */
  private validatePaymentInfo(info: X402PaymentInfo): void {
    if (!info.price || isNaN(parseFloat(info.price))) {
      throw new Error('Invalid payment price');
    }
    
    if (!['USDC', 'SOL'].includes(info.currency)) {
      throw new Error(`Unsupported currency: ${info.currency}`);
    }
    
    if (!['solana', 'base'].includes(info.network)) {
      throw new Error(`Unsupported network: ${info.network}`);
    }
    
    if (!info.recipient) {
      throw new Error('Missing payment recipient');
    }
  }

  /**
   * Extract provider identifier from endpoint URL
   */
  private extractProvider(endpoint: string): string {
    try {
      const url = new URL(endpoint);
      return url.hostname;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Log transaction to AgentBank dashboard
   */
  private async logTransaction(tx: any): Promise<void> {
    const AGENTBANK_API = process.env.AGENTBANK_API_URL || 'https://api.agentbank.app';
    
    try {
      await fetch(`${AGENTBANK_API}/api/x402-transactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(tx)
      });
    } catch (error) {
      console.error('[X402] Failed to log transaction:', error);
      // Don't throw - logging failure shouldn't break payment flow
    }
  }
}
```

### Session Management

```typescript
// src/payments/SessionManager.ts

import { SessionToken } from '../core/types';
import { WalletAdapter } from '../wallet/WalletAdapter';

export class SessionManager {
  private sessions: Map<string, SessionToken> = new Map();
  private wallet: WalletAdapter;

  constructor(wallet: WalletAdapter) {
    this.wallet = wallet;
  }

  /**
   * Get active session for a provider
   */
  public async getActive(provider: string): Promise<SessionToken | null> {
    const session = this.sessions.get(provider);
    
    if (!session) return null;
    
    // Check if session is still valid
    if (session.expiresAt < Date.now()) {
      this.sessions.delete(provider);
      return null;
    }
    
    // Check if session has budget remaining
    if (session.spent >= session.budget) {
      this.sessions.delete(provider);
      return null;
    }
    
    return session;
  }

  /**
   * Store a session token
   */
  public async store(session: SessionToken): Promise<void> {
    this.sessions.set(session.provider, session);
  }

  /**
   * Sign a session for authentication
   */
  public async signSession(session: SessionToken): Promise<string> {
    const message = `${session.id}:${session.provider}:${session.expiresAt}`;
    return this.wallet.signMessage(message);
  }

  /**
   * Update session spend amount
   */
  public async updateSpend(provider: string, amount: number): Promise<void> {
    const session = this.sessions.get(provider);
    if (session) {
      session.spent += amount;
      this.sessions.set(provider, session);
    }
  }

  /**
   * Cleanup expired sessions
   */
  public cleanupExpired(): void {
    const now = Date.now();
    for (const [provider, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(provider);
      }
    }
  }
}
```

### Payment Batching

```typescript
// src/payments/PaymentBatcher.ts

import { WalletAdapter } from '../wallet/WalletAdapter';
import { Transaction } from '../core/types';

interface PendingPayment {
  recipient: string;
  amount: number;
  token: string;
  memo?: string;
  resolve: (signature: string) => void;
  reject: (error: Error) => void;
}

export class PaymentBatcher {
  private queue: PendingPayment[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private wallet: WalletAdapter;
  
  private readonly BATCH_SIZE = 10;      // Max payments per batch
  private readonly BATCH_DELAY = 5000;    // 5 seconds

  constructor(wallet: WalletAdapter) {
    this.wallet = wallet;
  }

  /**
   * Queue a payment for batching
   */
  public async queuePayment(
    recipient: string,
    amount: number,
    token: string,
    memo?: string
  ): Promise<string> {
    
    return new Promise((resolve, reject) => {
      this.queue.push({ recipient, amount, token, memo, resolve, reject });
      
      // Process immediately if queue is full
      if (this.queue.length >= this.BATCH_SIZE) {
        this.processBatch();
      } 
      // Otherwise set timer if not already set
      else if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => this.processBatch(), this.BATCH_DELAY);
      }
    });
  }

  /**
   * Process queued payments as a batch
   */
  private async processBatch(): Promise<void> {
    if (this.queue.length === 0) return;
    
    const batch = this.queue.splice(0, this.BATCH_SIZE);
    
    console.log(`[Batcher] Processing ${batch.length} payments`);
    
    try {
      // Group by token for efficiency
      const byToken = batch.reduce((acc, payment) => {
        if (!acc[payment.token]) acc[payment.token] = [];
        acc[payment.token].push(payment);
        return acc;
      }, {} as Record<string, PendingPayment[]>);
      
      // Execute batched transfers
      for (const [token, payments] of Object.entries(byToken)) {
        const signature = await this.wallet.batchTransfer({
          token,
          transfers: payments.map(p => ({
            to: p.recipient,
            amount: p.amount,
            memo: p.memo
          }))
        });
        
        // Resolve all promises with the batch signature
        payments.forEach(p => p.resolve(signature));
      }
      
    } catch (error) {
      console.error('[Batcher] Batch processing failed:', error);
      batch.forEach(p => p.reject(error as Error));
    }
    
    // Clear timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    // Process remaining queue if any
    if (this.queue.length > 0) {
      this.batchTimer = setTimeout(() => this.processBatch(), this.BATCH_DELAY);
    }
  }

  /**
   * Force process all queued payments immediately
   */
  public async flush(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    await this.processBatch();
  }
}
```

### Provider Discovery

```typescript
// src/payments/PricingIndex.ts

import { X402Provider } from '../core/types';

export interface ServiceRequirements {
  maxPrice?: number;        // Max price per request
  minLatency?: number;      // Max acceptable latency
  minReliability?: number;  // Min uptime percentage
}

export class PricingIndex {
  private providers: Map<string, X402Provider[]> = new Map();

  /**
   * Find cheapest provider for a service
   */
  public async findCheapest(
    service: string,
    requirements?: ServiceRequirements
  ): Promise<X402Provider> {
    
    let providers = this.providers.get(service) || [];
    
    // Fetch from AgentBank registry if not cached
    if (providers.length === 0) {
      providers = await this.fetchProviders(service);
      this.providers.set(service, providers);
    }
    
    // Filter by requirements
    if (requirements) {
      providers = providers.filter(p => {
        if (requirements.maxPrice && p.pricePerRequest > requirements.maxPrice) {
          return false;
        }
        if (requirements.minLatency && p.avgLatency > requirements.minLatency) {
          return false;
        }
        if (requirements.minReliability && p.uptime < requirements.minReliability) {
          return false;
        }
        return true;
      });
    }
    
    if (providers.length === 0) {
      throw new Error(`No providers found for service: ${service}`);
    }
    
    // Score providers
    const scored = providers.map(p => ({
      ...p,
      score: this.calculateScore(p, requirements)
    }));
    
    // Return highest scored
    scored.sort((a, b) => b.score - a.score);
    return scored[0];
  }

  /**
   * Calculate provider score
   */
  private calculateScore(
    provider: X402Provider,
    requirements?: ServiceRequirements
  ): number {
    let score = 0;
    
    // Price component (lower is better)
    score += (1 / provider.pricePerRequest) * 1000;
    
    // Latency component (lower is better)
    score += (1 / provider.avgLatency) * 100;
    
    // Reliability component (higher is better)
    score += provider.uptime * 10;
    
    // Rating component
    score += provider.rating * 5;
    
    return score;
  }

  /**
   * Fetch providers from AgentBank registry
   */
  private async fetchProviders(service: string): Promise<X402Provider[]> {
    const AGENTBANK_API = process.env.AGENTBANK_API_URL || 'https://api.agentbank.app';
    
    try {
      const response = await fetch(
        `${AGENTBANK_API}/api/x402-providers?service=${service}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch providers: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.providers || [];
      
    } catch (error) {
      console.error('[PricingIndex] Failed to fetch providers:', error);
      return [];
    }
  }

  /**
   * Register a new provider
   */
  public async registerProvider(provider: X402Provider): Promise<void> {
    const AGENTBANK_API = process.env.AGENTBANK_API_URL || 'https://api.agentbank.app';
    
    await fetch(`${AGENTBANK_API}/api/x402-providers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(provider)
    });
  }

  /**
   * Clear cached providers
   */
  public clearCache(): void {
    this.providers.clear();
  }
}
```

---

## Multi-Chain Support

### Chain Router

```typescript
// src/chains/ChainRouter.ts

import { SolanaAdapter } from './SolanaAdapter';
import { BaseAdapter } from './BaseAdapter';
import { PaymentRequest, Transaction } from '../core/types';

export class ChainRouter {
  private solana: SolanaAdapter;
  private base: BaseAdapter;
  private config: any;

  constructor(config: any) {
    this.config = config;
    this.solana = new SolanaAdapter(config);
    this.base = new BaseAdapter(config);
  }

  /**
   * Route payment to optimal chain
   */
  public async route(payment: PaymentRequest): Promise<Transaction> {
    // Get current fees for both chains
    const solanaFee = await this.solana.estimateFee(payment);
    const baseFee = await this.base.estimateFee(payment);
    
    console.log(`[Router] Solana fee: $${solanaFee}, Base fee: $${baseFee}`);
    
    // Choose cheaper option
    if (solanaFee <= baseFee) {
      console.log('[Router] Routing to Solana');
      return this.solana.executePayment(payment);
    } else {
      console.log('[Router] Routing to Base');
      return this.base.executePayment(payment);
    }
  }

  /**
   * Bridge assets between chains
   */
  public async bridge(params: BridgeParams): Promise<Transaction> {
    // Placeholder - would integrate with Wormhole, Circle CCTP, or similar
    throw new Error('Bridge not implemented yet');
  }
}
```

### Solana Adapter

```typescript
// src/chains/SolanaAdapter.ts

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  Keypair
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';

export class SolanaAdapter {
  private connection: Connection;
  private keypair: Keypair;

  constructor(config: any) {
    const rpcUrl = config.rpcUrl || 'https://api.mainnet-beta.solana.com';
    this.connection = new Connection(rpcUrl, 'confirmed');
    
    // Load keypair from config (encrypted in production)
    this.keypair = Keypair.fromSecretKey(/* ... */);
  }

  /**
   * Estimate transaction fee
   */
  public async estimateFee(payment: PaymentRequest): Promise<number> {
    // Solana fees are ~$0.00025 per transaction
    return 0.00025;
  }

  /**
   * Execute payment on Solana
   */
  public async executePayment(payment: PaymentRequest): Promise<Transaction> {
    const { recipient, amount, currency } = payment;
    
    if (currency === 'SOL') {
      return this.transferSOL(recipient, amount);
    } else if (currency === 'USDC') {
      return this.transferUSDC(recipient, amount);
    } else {
      throw new Error(`Unsupported currency: ${currency}`);
    }
  }

  /**
   * Transfer SOL
   */
  private async transferSOL(to: string, amount: number): Promise<Transaction> {
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.keypair.publicKey,
        toPubkey: new PublicKey(to),
        lamports: amount // Already in lamports
      })
    );
    
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.keypair]
    );
    
    return {
      signature,
      chain: 'solana',
      timestamp: Date.now(),
      type: 'transfer',
      amount,
      to,
      status: 'confirmed'
    };
  }

  /**
   * Transfer USDC (SPL token)
   */
  private async transferUSDC(to: string, amount: number): Promise<Transaction> {
    const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    
    // Get associated token accounts
    const fromATA = await getAssociatedTokenAddress(
      USDC_MINT,
      this.keypair.publicKey
    );
    
    const toATA = await getAssociatedTokenAddress(
      USDC_MINT,
      new PublicKey(to)
    );
    
    const transaction = new Transaction().add(
      createTransferInstruction(
        fromATA,
        toATA,
        this.keypair.publicKey,
        amount, // Already in base units (6 decimals)
        [],
        TOKEN_PROGRAM_ID
      )
    );
    
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.keypair]
    );
    
    return {
      signature,
      chain: 'solana',
      timestamp: Date.now(),
      type: 'transfer',
      amount,
      to,
      status: 'confirmed'
    };
  }

  /**
   * Batch transfer multiple payments
   */
  public async batchTransfer(params: any): Promise<string> {
    const transaction = new Transaction();
    
    for (const transfer of params.transfers) {
      if (params.token === 'native') {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: this.keypair.publicKey,
            toPubkey: new PublicKey(transfer.to),
            lamports: transfer.amount
          })
        );
      } else {
        // SPL token transfer
        const mint = new PublicKey(params.token);
        const fromATA = await getAssociatedTokenAddress(mint, this.keypair.publicKey);
        const toATA = await getAssociatedTokenAddress(mint, new PublicKey(transfer.to));
        
        transaction.add(
          createTransferInstruction(
            fromATA,
            toATA,
            this.keypair.publicKey,
            transfer.amount,
            [],
            TOKEN_PROGRAM_ID
          )
        );
      }
    }
    
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.keypair]
    );
    
    return signature;
  }
}
```

---

## Policy Engine

### Policy Evaluation

```typescript
// src/policy/PolicyEngine.ts

import { PolicyConfig, PolicyAction, PolicyResult, SpendingStats } from '../core/types';

export class PolicyEngine {
  private config: PolicyConfig;
  private stats: {
    dailySpent: number;
    weeklySpent: number;
    monthlySpent: number;
    lastReset: { daily: number; weekly: number; monthly: number };
  };

  constructor(config: PolicyConfig) {
    this.config = config;
    this.stats = {
      dailySpent: 0,
      weeklySpent: 0,
      monthlySpent: 0,
      lastReset: {
        daily: Date.now(),
        weekly: Date.now(),
        monthly: Date.now()
      }
    };
  }

  /**
   * Evaluate if an action is allowed under current policies
   */
  public async evaluate(action: PolicyAction): Promise<PolicyResult> {
    // Reset counters if needed
    this.resetCountersIfNeeded();
    
    // Check spending limits
    const limitCheck = this.checkSpendingLimits(action.amount);
    if (!limitCheck.allowed) {
      return limitCheck;
    }
    
    // Check transaction limit
    if (this.config.transactionLimit && action.amount > this.config.transactionLimit) {
      return {
        allowed: false,
        reason: `Transaction amount ($${action.amount}) exceeds limit ($${this.config.transactionLimit})`
      };
    }
    
    // Check protocol whitelist
    if (this.config.allowedProtocols && action.purpose) {
      const protocol = this.extractProtocol(action.purpose);
      if (!this.config.allowedProtocols.includes(protocol)) {
        return {
          allowed: false,
          reason: `Protocol '${protocol}' not in whitelist`
        };
      }
    }
    
    // Check if approval required
    if (this.config.requireApproval) {
      if (this.config.requireApproval.above && action.amount > this.config.requireApproval.above) {
        return {
          allowed: false,
          requiresApproval: true,
          approvalUrl: this.generateApprovalUrl(action)
        };
      }
      
      if (this.config.requireApproval.for && 
          this.config.requireApproval.for.includes(action.type)) {
        return {
          allowed: false,
          requiresApproval: true,
          approvalUrl: this.generateApprovalUrl(action)
        };
      }
    }
    
    // All checks passed
    this.updateStats(action.amount);
    return { allowed: true };
  }

  /**
   * Check spending limits
   */
  private checkSpendingLimits(amount: number): PolicyResult {
    if (this.config.dailyLimit) {
      if (this.stats.dailySpent + amount > this.config.dailyLimit) {
        return {
          allowed: false,
          reason: `Daily limit exceeded. Spent: $${this.stats.dailySpent}, Limit: $${this.config.dailyLimit}`
        };
      }
    }
    
    if (this.config.weeklyLimit) {
      if (this.stats.weeklySpent + amount > this.config.weeklyLimit) {
        return {
          allowed: false,
          reason: `Weekly limit exceeded. Spent: $${this.stats.weeklySpent}, Limit: $${this.config.weeklyLimit}`
        };
      }
    }
    
    return { allowed: true };
  }

  /**
   * Update spending statistics
   */
  private updateStats(amount: number): void {
    this.stats.dailySpent += amount;
    this.stats.weeklySpent += amount;
    this.stats.monthlySpent += amount;
  }

  /**
   * Reset counters if time periods have elapsed
   */
  private resetCountersIfNeeded(): void {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const WEEK = 7 * DAY;
    const MONTH = 30 * DAY;
    
    if (now - this.stats.lastReset.daily >= DAY) {
      this.stats.dailySpent = 0;
      this.stats.lastReset.daily = now;
    }
    
    if (now - this.stats.lastReset.weekly >= WEEK) {
      this.stats.weeklySpent = 0;
      this.stats.lastReset.weekly = now;
    }
    
    if (now - this.stats.lastReset.monthly >= MONTH) {
      this.stats.monthlySpent = 0;
      this.stats.lastReset.monthly = now;
    }
  }

  /**
   * Extract protocol from purpose string
   */
  private extractProtocol(purpose: string): string {
    // Extract domain or protocol name from URL or identifier
    try {
      const url = new URL(purpose);
      return url.hostname;
    } catch {
      return purpose.toLowerCase();
    }
  }

  /**
   * Generate approval URL
   */
  private generateApprovalUrl(action: PolicyAction): string {
    const DASHBOARD_URL = process.env.AGENTBANK_DASHBOARD_URL || 'https://app.agentbank.app';
    const actionId = this.generateActionId(action);
    return `${DASHBOARD_URL}/approvals/${actionId}`;
  }

  /**
   * Generate unique action ID
   */
  private generateActionId(action: PolicyAction): string {
    return `act_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Get current spending statistics
   */
  public getStats(): SpendingStats {
    return {
      dailySpent: this.stats.dailySpent,
      weeklySpent: this.stats.weeklySpent,
      monthlySpent: this.stats.monthlySpent,
      dailyLimit: this.config.dailyLimit || 0,
      weeklyLimit: this.config.weeklyLimit || 0,
      topEndpoints: [], // Would be populated from transaction logs
      suggestions: this.generateSuggestions()
    };
  }

  /**
   * Generate optimization suggestions
   */
  private generateSuggestions(): string[] {
    const suggestions: string[] = [];
    
    if (this.config.dailyLimit) {
      const utilization = (this.stats.dailySpent / this.config.dailyLimit) * 100;
      if (utilization > 80) {
        suggestions.push(`You've used ${utilization.toFixed(0)}% of your daily budget`);
      }
    }
    
    // Add more suggestion logic as needed
    
    return suggestions;
  }

  /**
   * Request approval for an action
   */
  public async requestApproval(action: PolicyAction): Promise<ApprovalToken> {
    const AGENTBANK_API = process.env.AGENTBANK_API_URL || 'https://api.agentbank.app';
    
    const approvalToken: ApprovalToken = {
      id: this.generateActionId(action),
      action,
      requestedAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      approvalUrl: this.generateApprovalUrl(action),
      status: 'pending'
    };
    
    // Send to AgentBank backend
    await fetch(`${AGENTBANK_API}/api/approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(approvalToken)
    });
    
    return approvalToken;
  }
}
```

---

## Database Schema

### New Tables for AgentStack

Add these to your existing AgentBank Supabase schema:

```sql
-- x402 Transactions
CREATE TABLE x402_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  provider TEXT NOT NULL,
  amount DECIMAL(20, 8) NOT NULL,
  currency TEXT NOT NULL,
  signature TEXT NOT NULL,
  network TEXT NOT NULL,
  latency INTEGER,
  status TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE INDEX idx_x402_agent ON x402_transactions(agent_id);
CREATE INDEX idx_x402_created ON x402_transactions(created_at);

-- x402 Providers Registry
CREATE TABLE x402_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  service TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  price_per_request DECIMAL(10, 6) NOT NULL,
  currency TEXT NOT NULL,
  avg_latency INTEGER,
  uptime DECIMAL(5, 2),
  rating DECIMAL(3, 2),
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_provider_service ON x402_providers(service);
CREATE INDEX idx_provider_price ON x402_providers(price_per_request);

-- Payment Sessions
CREATE TABLE payment_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  budget DECIMAL(20, 8) NOT NULL,
  spent DECIMAL(20, 8) DEFAULT 0,
  escrow_address TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE INDEX idx_session_agent ON payment_sessions(agent_id);
CREATE INDEX idx_session_expires ON payment_sessions(expires_at);

-- Approval Requests
CREATE TABLE approval_requests (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_data JSONB NOT NULL,
  requested_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  status TEXT NOT NULL,
  approved_by TEXT,
  approved_at TIMESTAMP,
  
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE INDEX idx_approval_agent ON approval_requests(agent_id);
CREATE INDEX idx_approval_status ON approval_requests(status);

-- SDK Usage Analytics
CREATE TABLE sdk_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key TEXT NOT NULL,
  agent_id TEXT,
  method TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  latency INTEGER,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_usage_key ON sdk_usage(api_key);
CREATE INDEX idx_usage_created ON sdk_usage(created_at);
```

---

## API Endpoints

### New Backend Endpoints for AgentStack

Add these to your existing AgentBank Fastify backend:

```typescript
// routes/x402.ts

import { FastifyInstance } from 'fastify';
import { supabase } from '../lib/supabase';

export async function x402Routes(fastify: FastifyInstance) {
  
  // Log x402 transaction
  fastify.post('/api/x402-transactions', async (request, reply) => {
    const { 
      agent_id, 
      endpoint, 
      provider, 
      amount, 
      currency, 
      signature, 
      network, 
      latency, 
      status 
    } = request.body as any;
    
    const { data, error } = await supabase
      .from('x402_transactions')
      .insert({
        agent_id,
        endpoint,
        provider,
        amount,
        currency,
        signature,
        network,
        latency,
        status
      })
      .select()
      .single();
    
    if (error) {
      return reply.code(500).send({ error: error.message });
    }
    
    return { transaction: data };
  });
  
  // Get x402 transactions for an agent
  fastify.get('/api/x402-transactions/:agentId', async (request, reply) => {
    const { agentId } = request.params as any;
    
    const { data, error } = await supabase
      .from('x402_transactions')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) {
      return reply.code(500).send({ error: error.message });
    }
    
    return { transactions: data };
  });
  
  // Get x402 providers for a service
  fastify.get('/api/x402-providers', async (request, reply) => {
    const { service } = request.query as any;
    
    let query = supabase.from('x402_providers').select('*');
    
    if (service) {
      query = query.eq('service', service);
    }
    
    const { data, error } = await query.order('price_per_request', { ascending: true });
    
    if (error) {
      return reply.code(500).send({ error: error.message });
    }
    
    return { providers: data };
  });
  
  // Register new x402 provider
  fastify.post('/api/x402-providers', async (request, reply) => {
    const provider = request.body as any;
    
    const { data, error } = await supabase
      .from('x402_providers')
      .insert(provider)
      .select()
      .single();
    
    if (error) {
      return reply.code(500).send({ error: error.message });
    }
    
    return { provider: data };
  });
  
  // Create payment session
  fastify.post('/api/payment-sessions', async (request, reply) => {
    const session = request.body as any;
    
    const { data, error } = await supabase
      .from('payment_sessions')
      .insert(session)
      .select()
      .single();
    
    if (error) {
      return reply.code(500).send({ error: error.message });
    }
    
    return { session: data };
  });
  
  // Get active sessions for an agent
  fastify.get('/api/payment-sessions/:agentId', async (request, reply) => {
    const { agentId } = request.params as any;
    
    const { data, error } = await supabase
      .from('payment_sessions')
      .select('*')
      .eq('agent_id', agentId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    
    if (error) {
      return reply.code(500).send({ error: error.message });
    }
    
    return { sessions: data };
  });
  
  // Create approval request
  fastify.post('/api/approvals', async (request, reply) => {
    const approval = request.body as any;
    
    const { data, error } = await supabase
      .from('approval_requests')
      .insert(approval)
      .select()
      .single();
    
    if (error) {
      return reply.code(500).send({ error: error.message });
    }
    
    return { approval: data };
  });
  
  // Get pending approvals for an agent
  fastify.get('/api/approvals/:agentId', async (request, reply) => {
    const { agentId } = request.params as any;
    
    const { data, error } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('agent_id', agentId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('requested_at', { ascending: false });
    
    if (error) {
      return reply.code(500).send({ error: error.message });
    }
    
    return { approvals: data };
  });
  
  // Approve/reject an approval request
  fastify.patch('/api/approvals/:id', async (request, reply) => {
    const { id } = request.params as any;
    const { status, approved_by } = request.body as any;
    
    const { data, error } = await supabase
      .from('approval_requests')
      .update({
        status,
        approved_by,
        approved_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return reply.code(500).send({ error: error.message });
    }
    
    return { approval: data };
  });
}
```

---

## Developer Experience

### Quick Start Guide

```markdown
# AgentStack Quick Start

## Installation

```bash
npm install @agentbank/sdk
```

## Setup

1. Get API key from [AgentBank Dashboard](https://app.agentbank.app)
2. Create `.env` file:

```env
AGENTBANK_API_KEY=your_api_key_here
```

3. Initialize agent:

```typescript
import { AgentStack } from '@agentbank/sdk';

const agent = new AgentStack({
  apiKey: process.env.AGENTBANK_API_KEY,
  chain: 'solana',
  policies: {
    dailyLimit: 100  // $100 per day
  }
});
```

## Basic Usage

### Check Balance

```typescript
const balance = await agent.getBalance('USDC');
console.log(`Balance: ${balance} USDC`);
```

### Transfer Tokens

```typescript
const tx = await agent.transfer({
  to: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  amount: 10,  // 10 USDC
  token: 'USDC'
});

console.log(`Tx: ${tx.signature}`);
```

### Pay for API Access (x402)

```typescript
const response = await agent.payForAPI(
  'https://api.example.com/data',
  'GET'
);

const data = await response.json();
console.log(data);
```

### Swap Tokens

```typescript
const swap = await agent.swap({
  from: 'USDC',
  to: 'SOL',
  amount: 10,
  slippage: 0.5  // 0.5%
});

console.log(`Swapped! Tx: ${swap.signature}`);
```

## Advanced Features

### Payment Sessions

For frequent API usage, create a session to reduce overhead:

```typescript
const session = await agent.createPaymentSession(
  'weather-api.com',
  50,      // $50 budget
  3600     // 1 hour duration
);

// Now all requests to this provider use the session
const weather = await agent.payForAPI('https://weather-api.com/forecast');
```

### Policy Management

```typescript
// Check if action is allowed
const check = await agent.checkPolicy({
  type: 'transfer',
  amount: 500,
  recipient: '...'
});

if (!check.allowed) {
  console.log(`Blocked: ${check.reason}`);
}

// Request approval if needed
if (check.requiresApproval) {
  const approval = await agent.requestApproval({
    type: 'transfer',
    amount: 500,
    recipient: '...'
  });
  
  console.log(`Approval URL: ${approval.approvalUrl}`);
}
```

### Multi-Chain Routing

```typescript
// Automatically routes to cheapest chain
const payment = await agent.routePayment({
  amount: 10,
  currency: 'USDC',
  recipient: '...'
});

console.log(`Paid on ${payment.chain}`);
```

## Examples

See `examples/` folder for complete examples:
- `01-basic-setup.ts` - Basic wallet operations
- `02-x402-payment.ts` - x402 micropayments
- `03-trading-bot.ts` - Automated trading agent
- `04-multi-agent.ts` - Multi-agent coordination
```

### Example: Trading Bot

```typescript
// examples/03-trading-bot.ts

import { AgentStack } from '@agentbank/sdk';
import 'dotenv/config';

async function main() {
  // Initialize agent
  const agent = new AgentStack({
    apiKey: process.env.AGENTBANK_API_KEY!,
    agentId: 'trading-bot-1',
    chain: 'solana',
    policies: {
      dailyLimit: 1000,          // $1000/day max
      transactionLimit: 100,     // $100/tx max
      allowedProtocols: [
        'jup.ag',                 // Jupiter swaps
        'raydium.io'              // Raydium swaps
      ]
    }
  });

  console.log('🤖 Trading Bot Started');
  console.log(`Wallet: ${agent.getAddress()}`);

  // Get current balance
  const usdcBalance = await agent.getBalance('USDC');
  const solBalance = await agent.getBalance();
  
  console.log(`💰 USDC: ${usdcBalance}`);
  console.log(`💰 SOL: ${solBalance}`);

  // Fetch price data via x402
  const priceData = await agent.payForAPI(
    'https://price-api.example.com/sol-usdc',
    'GET'
  );
  
  const price = await priceData.json();
  console.log(`📊 SOL/USDC: $${price.price}`);

  // Simple trading strategy: buy if price < $100
  if (price.price < 100 && usdcBalance > 10) {
    console.log('📈 Buying SOL...');
    
    const swap = await agent.swap({
      from: 'USDC',
      to: 'SOL',
      amount: 10,
      slippage: 0.5
    });
    
    console.log(`✅ Bought SOL: ${swap.signature}`);
    
    // Send message to other agents
    await agent.sendMessage(
      'portfolio-manager',
      `Bought SOL at $${price.price}`
    );
  } else {
    console.log('⏸️  No trade executed');
  }

  // Get spending stats
  const stats = await agent.getSpendingStats();
  console.log(`\n📊 Daily spend: $${stats.dailySpent} / $${stats.dailyLimit}`);
}

main();
```

---

## Security Considerations

### Key Management

**Never hardcode private keys in code!**

```typescript
// ❌ WRONG
const agent = new AgentStack({
  privateKey: 'actual-private-key-here'  // NEVER DO THIS
});

// ✅ CORRECT
const agent = new AgentStack({
  apiKey: process.env.AGENTBANK_API_KEY  // API key from AgentBank
});
```

AgentBank manages keys securely:
- Keys stored encrypted in Supabase
- Access via API key + authentication
- Session tokens for temporary access
- Key rotation support

### Policy Enforcement

All transactions validated against policies:

```typescript
// Policies are enforced before any blockchain tx
const result = await agent.transfer({ to: '...', amount: 1000 });

// If amount > dailyLimit, this will throw PolicyViolationError
```

### Rate Limiting

SDK includes built-in rate limiting:

```typescript
// Max 100 requests/second per agent
// Auto-queues excess requests
// Prevents accidental DoS
```

### Audit Trail

All transactions logged:

```typescript
// View in dashboard: app.agentbank.app/transactions
// Export CSV for accounting
// Webhook notifications available
```

---

## Implementation Roadmap

### Current Status (Apr 25, 2026)

- Core functional scope is live: wallet + policy + x402 paid path.
- Strict and negative smoke suites pass locally with deterministic contracts.
- Advanced roadmap items below include both completed and in-progress work; unchecked items remain roadmap.

### Week 1-2: Core SDK Development

**Tasks:**
- [ ] Extract AgentStack class from AgentBank codebase
- [x] Implement x402 client with basic payment flow
- [x] Add Solana wallet adapter
- [x] Add Base wallet adapter
- [x] Set up npm package structure
- [ ] Write unit tests

**Deliverables:**
- `@agentbank/sdk` package prepared and validated locally (publish status depends on release account)
- Basic wallet operations working
- [~] x402 payment flow tested in local/runtime smoke (devnet coverage can be extended)

### Week 3: Advanced Features

**Tasks:**
- [ ] Implement session management
- [ ] Add payment batching
- [ ] Build pricing index / provider discovery
- [ ] Implement multi-chain routing
- [x] Add policy engine integration

**Deliverables:**
- [ ] All advanced features working
- [~] Integration/smoke tests passing for implemented slices
- [~] Documentation for implemented slices

### Week 4: Developer Experience

**Tasks:**
- [~] Create 5+ example integrations
- [~] Write comprehensive documentation
- [ ] Build documentation website (Mintlify/Docusaurus)
- [ ] Record video tutorials
- [x] Set up GitHub repo with CI/CD

**Deliverables:**
- `@agentbank/sdk` beta packaging target (publish status pending release)
- [ ] Documentation site live
- [ ] Video tutorials published

### Week 5: Hackathon Demo Polish

**Tasks:**
- [ ] Get 10+ developers to integrate SDK
- [ ] Gather testimonials and feedback
- [ ] Create demo video showing:
  - Real agents using SDK
  - x402 payments happening
  - Dashboard monitoring
  - Cost comparison vs building from scratch
- [ ] Prepare pitch deck
- [ ] Record 3-minute presentation

**Deliverables:**
- Polished demo ready for submission
- Traction metrics documented
- Pitch video recorded

---

## Success Metrics

### For Hackathon:

- ✅ 10+ developers integrated SDK
- ✅ 20+ live agents deployed
- ✅ 10,000+ x402 transactions processed
- ✅ $1,000+ in micropayments volume
- ✅ Documentation site with 500+ views
- ✅ 3+ developer testimonials

### Post-Hackathon:

- 100 developers in first month
- 500 agents deployed
- 1M x402 transactions
- $100K payment volume
- Partnerships with 3+ AI agent frameworks (LangChain, AutoGPT, etc.)

---

## Contact & Links

- **GitHub:** github.com/agentbank/agent-sdk
- **Docs:** docs.agentstack.dev
- **Discord:** discord.gg/agentbank
- **Twitter:** @agentbank

---

**End of Architecture Document**
