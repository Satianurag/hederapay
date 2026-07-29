# HederaPay Architecture (Hedera Port)

## System Overview

```mermaid
flowchart TD
    FE[Frontend - Next.js + wagmi + HashPack] --> API[Backend API - Express + MongoDB]
    FE --> |wallet signing| HEDERA

    API --> AGENTS

    subgraph HEDERA[Hedera Testnet - EVM Contracts]
        POOL[Pool.sol - WHBAR deposits, drawdowns, repayments]
        YR[YieldReserve.sol - Fee accumulation]
        PF[Chainlink Price Feed - USDC/USD on Hedera]
        WHBAR[WHBAR - wrapped HBAR]
        POOL --> YR
        POOL --> PF
    end

    subgraph AUTO[Hedera Automation - node-cron + ethers]
        CRON[Cron - 7 Day Yield Cycle]
        SHORT[Event - Liquidity Shortfall]
        REPAY[Event - Repayment Conversion]
    end

    AUTO --> |distributeYield, completeDrawdown, processConvertedRepayment| HEDERA
    AUTO --> |QuoterV2| SAUCER

    subgraph SAUCER[SaucerSwap V2 on Hedera]
        QUOTE[QuoterV2 0.0.1390002]
        ROUTER[SwapRouter 0.0.1414040]
    end

    subgraph AGENTS[AI Agents - x402 HBAR on Hedera]
        DS[Data Service - Credit Score 0.01, Compliance 0.005, Market 0.002]
        CRA[Credit Risk Agent - Pays 0.018 per assessment]
        PMA[Pool Monitor Agent - Buys and Sells 0.003]
        FAC[Blocky402 Facilitator - fee payer]
    end

    CRA --> |@x402/hedera pay| DS
    CRA --> |@x402/hedera pay| PMA
    PMA --> |@x402/hedera pay| DS
    AGENTS --> |HBAR TransferTransaction| HEDERA
```

## x402 Payment Flow (Hedera exact scheme)

Per [Hedera x402 docs](https://docs.hedera.com/solutions/ai/x402):

1. Agent calls protected API → receives HTTP 402 with `hedera:testnet` requirements
2. `@x402/hedera` client builds partially-signed `TransferTransaction` (native HBAR `0.0.0`)
3. Blocky402 facilitator verifies, co-signs as fee payer, submits to consensus
4. Agent retries request with payment proof → receives data
5. Transaction visible on [HashScan](https://hashscan.io/testnet)

## Package mapping (Arc → Hedera)

| Original | Hedera replacement |
|----------|-------------------|
| `@circle-fin/x402-batching` | `@x402/hedera` + `@x402/express` + `@x402/axios` |
| Arc testnet (5042002) | Hedera testnet (296) |
| Circle GatewayWallet | Blocky402 facilitator |
| Chainlink CRE | `hedera-automation/` |
| Uniswap Trading API | SaucerSwap V2 QuoterV2 on-chain |
| RainbowKit / MetaMask | Reown AppKit + HashPack |
| ArcScan | HashScan |

## Deployed contracts

Set after `npm run deploy:hedera` in `contracts/`. Explorer: `https://hashscan.io/testnet/contract/<address>`
