# HederaPay on Hedera — PSP Pre-Funding Credit Pool

Programmable credit liquidity for Payment Service Providers on **Hedera testnet**. Investors earn fixed 5% APY in **HBAR (WHBAR)**. PSPs access instant capital for settlement. AI agents pay per API call via **x402 / `@x402/hedera`**. Liquidity automation via **SaucerSwap V2** and **Hedera automation** (replaces Chainlink CRE).

**Built for the [Hedera x402 Bounty](https://hedera.com/x402-bounty/)**

---

## Hedera stack (official packages only)

| Layer | Package / Service |
|-------|-------------------|
| Payments (x402) | `@x402/hedera`, `@x402/express`, `@x402/axios`, Blocky402 facilitator |
| SDK | `@hiero-ledger/sdk` |
| Wallet | `@hashgraph/hedera-wallet-connect` + Reown AppKit (HashPack) |
| EVM / contracts | Hardhat → Hedera testnet (chainId **296**), WHBAR pool asset |
| DEX | SaucerSwap V2 Router `0.0.1414040`, QuoterV2 `0.0.1390002` |
| Oracles | Chainlink HBAR/USD on Hedera testnet |
| Automation | `hedera-automation/` (ethers + node-cron on Hedera JSON-RPC) |
| Explorer | [HashScan testnet](https://hashscan.io/testnet) |

---

## Quick start

### 1. Environment

```bash
cp .env.example .env
# Fund accounts via https://portal.hedera.com/faucet
# Set HEDERA_ACCOUNT_ID, DEPLOYER_PRIVATE_KEY, SELLER_ACCOUNT_ID
```

### 2. Deploy contracts

```bash
cd contracts && npm install && npm run deploy:hedera
```

### 3. Agents (x402 HBAR micropayments)

```bash
cd agent && npm install
npm run data-service    # port 4001 — sell-side APIs
npm run pool-monitor    # port 4002 — agent-to-agent
npm run credit-risk     # demo assessment flow
```

### 4. Automation (yield + event handlers)

```bash
cd hedera-automation && npm install && npm start
```

### 5. Frontend + API

```bash
cd frontend && npm install && npm run dev
```

Connect **HashPack** on Hedera testnet. Pool operations use WHBAR via wagmi on `https://testnet.hashio.io/api`.

---

## Project structure

```
HederaPay/
├── agent/                 # x402 agents (@x402/hedera, HBAR payments)
├── contracts/             # Pool.sol + YieldReserve.sol on Hedera EVM
├── hedera-automation/     # Yield cron + SaucerSwap event handlers
├── backend/               # Express API + Prisma/Neon PostgreSQL
├── frontend/              # Next.js + HashPack + wagmi (hederaTestnet)
```

---

## x402 agent payment flow

1. **Credit Risk Agent** pays Pool Monitor ($0.003 HBAR) + Data Service ($0.01 + $0.005 HBAR)
2. Each payment settles on Hedera testnet via Blocky402 facilitator
3. View transactions on HashScan

Total per assessment: **$0.018 HBAR**
