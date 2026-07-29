# HederaPay on Hedera — Technical Specification

## 1. Overview

HederaPay is a programmable credit pool for Payment Service Providers (PSPs) on **Hedera testnet**. Licensed PSPs draw **WHBAR** for corridor settlement; institutional investors earn a fixed **5% APY**. AI agents pay per API call via **x402** (`@x402/hedera`, HBAR micropayments). Liquidity gaps and repayment conversions are handled by **hedera-automation** using **SaucerSwap V2** on Hedera EVM.

## 2. Architecture

| Layer | Technology |
|-------|------------|
| Settlement | Pool.sol + YieldReserve.sol on Hedera EVM (chainId 296) |
| Pool asset | WHBAR (`0xb1F616b8134F602c3Bb465fB5b5e6565cCAd37Ed`, 8 decimals) |
| Wallet | HashPack via `@hashgraph/hedera-wallet-connect` + Reown AppKit |
| x402 payments | `@x402/hedera`, Blocky402 facilitator (`https://api.testnet.blocky402.com`) |
| DEX | SaucerSwap V2 Router `0.0.1414040`, QuoterV2 `0.0.1390002` |
| Oracle | Chainlink USDC/USD on Hedera testnet |
| Automation | `hedera-automation/` — node-cron + ethers event listeners |
| Backend | Express + MongoDB |
| Frontend | Next.js + wagmi (hederaTestnet) |

## 3. Smart Contracts

**Pool** — Deposits, drawdowns, repayments, LP yield accounting. Emits `LiquidityShortfall` and `RepaymentReceived` for automation handlers.

**YieldReserve** — Holds PSP repayment fees. Automation calls `onReport` then `distributeYield` on the 7-day cycle.

**CRE_ROLE** — On-chain role granted to the hedera-automation wallet. Allows `completeDrawdown`, `processConvertedRepayment`, `distributeYield`, and `onReport`.

## 4. Agent Layer (x402)

| Service | Port | Price |
|---------|------|-------|
| Data Service | 4001 | $0.01 + $0.005 + $0.002 HBAR |
| Pool Monitor | 4002 | $0.003 HBAR (buy-side) |

Credit Risk Agent orchestrates payments via `@x402/axios` + `createClientHederaSigner`.

## 5. Hedera Automation

- **Cron** — Weekly yield distribution (`YIELD_CRON`, default `0 0 */7 * *`)
- **LiquidityShortfall** — SaucerSwap swap + `completeDrawdown`
- **RepaymentReceived** — SaucerSwap USDC→WHBAR + `processConvertedRepayment`

## 6. SaucerSwap Integration

Quotes use SaucerSwap V2 QuoterV2 (`quoteExactInputSingle`) via Hedera JSON-RPC relay. EVM address: `0x00000000000000000000000000000000001535b2`.

## 7. Environment

See `.env.example` for all required variables including `HEDERA_RPC_URL`, `SAUCERSWAP_QUOTER_EVM`, `X402_FACILITATOR_URL`, and contract addresses after `npm run deploy:hedera`.

## 8. Explorer

All transactions: [HashScan testnet](https://hashscan.io/testnet)
