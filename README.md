# HederaPay on Hedera — PSP Pre-Funding Credit Pool

Programmable credit liquidity for Payment Service Providers on **Hedera testnet**. Investors earn fixed 5% APY in **HBAR (WHBAR)**. PSPs access instant capital for settlement. AI agents pay per API call via **x402 / `@x402/hedera`**. Liquidity automation via **SaucerSwap V2** and **hedera-automation**.

**Built for the [Hedera x402 Bounty](https://hedera.com/x402-bounty/)**

See also: [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md) | [docs/architecture.md](./docs/architecture.md)

---

## Hedera stack (official packages)

| Layer | Package / Service |
|-------|-------------------|
| Payments (x402) | `@x402/hedera`, `@x402/express`, `@x402/axios`, Blocky402 facilitator |
| SDK | `@hiero-ledger/sdk` |
| Wallet | `@hashgraph/hedera-wallet-connect` + Reown AppKit (HashPack) |
| EVM / contracts | Hardhat → Hedera testnet (chainId **296**), WHBAR pool asset |
| DEX | SaucerSwap V2 Router `0.0.1414040`, QuoterV2 `0.0.1390002` |
| Oracles | Chainlink USDC/USD on Hedera testnet |
| Automation | `hedera-automation/` (ethers + node-cron on Hedera JSON-RPC) |
| Explorer | [HashScan testnet](https://hashscan.io/testnet) |

---

## Quick start

```bash
cp .env.example .env
# Fund accounts via https://portal.hedera.com/faucet

cd contracts && npm install && npm run deploy:hedera
cd ../agent && npm install && npm run data-service
cd ../hedera-automation && npm install && npm start
cd ../frontend && npm install && npm run dev
```

Connect **HashPack** on Hedera testnet.

---

## Project structure

```
HederaPay/
├── agent/                 # x402 agents (@x402/hedera, HBAR payments)
├── contracts/             # Pool.sol + YieldReserve.sol on Hedera EVM
├── hedera-automation/     # Yield cron + SaucerSwap event handlers
├── backend/               # Express API + MongoDB
└── frontend/              # Next.js + HashPack + wagmi (hederaTestnet)
```

---

## x402 agent payment flow

1. **Credit Risk Agent** pays Pool Monitor ($0.003 HBAR) + Data Service ($0.01 + $0.005 HBAR)
2. Each payment settles on Hedera testnet via Blocky402 facilitator
3. View transactions on HashScan

Total per assessment: **$0.018 HBAR**

---

## Features

- **LP deposits** — WHBAR into pool, earn 5% APY
- **PSP drawdowns** — Instant WHBAR up to drawdown limit
- **Repayments** — WHBAR direct or USDC via SaucerSwap conversion
- **Liquidity shortfall** — Automation sources WHBAR via SaucerSwap
- **Yield distribution** — Weekly cron via hedera-automation
- **AI credit assessment** — x402 micropayments between agents
