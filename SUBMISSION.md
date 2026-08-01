# Hedera x402 Bounty — Submission Proof

**Project:** HederaPay  
**Bounty:** https://hedera.com/x402-bounty/  
**Repo:** https://github.com/Satianurag/hederapay  
**Live demo:** https://hederapay-web.onrender.com

## x402 on Hedera (verified live)

| Check | Command | Result |
|-------|---------|--------|
| x402 USDC route config | `cd agent && npx tsx scripts/verify-x402-usdc-config.ts` | PASS |
| Live x402 payment | `cd agent && npx tsx scripts/e2e-x402-pay.ts` | PASS — settlement on testnet |

### HashScan proof (live x402 micropayment)

- **Transaction:** https://hashscan.io/testnet/transaction/0.0.7162784@1785560519.673149876
- **Payer:** 0.0.9769419
- **Facilitator:** Blocky402 (`https://api.testnet.blocky402.com`)
- **Package:** `@x402/hedera` + `ExactHederaScheme`

## Hedera rails used

| Rail | Evidence |
|------|----------|
| x402 agent payments | `agent/src/x402Server.ts`, `agent/src/poolMonitorAgent.ts` |
| WHBAR pool (EVM) | `contracts/src/Pool.sol`, deployed testnet |
| HashPack wallet | `frontend/lib/web3-provider.tsx` |
| SaucerSwap V2 quotes | `backend/scripts/verify-saucerswap-quote.mjs` — PASS |
| Chainlink HBAR/USD | `backend/scripts/verify-chainlink-hbar.mjs` — PASS |
| Neon PostgreSQL | Prisma + Render deploy |

## SaucerSwap swap path (verified on testnet)

```bash
node hedera-automation/scripts/verify-saucerswap-path.mjs
```

**Proven facts:**
- SS_USDC / SS_WHBAR pool exists (`0x914B98992d7eD602D1f5d9084ECe8160Fc0e741a`)
- Circle USDC has **no** SaucerSwap pool on testnet
- Pool WHBAR (`0xb1F616...`) has **no** SaucerSwap pool — automation tops up pool WHBAR from operator wallet

## Full E2E verification

```bash
bash scripts/e2e-verify.sh
```

## Demo video checklist

1. Show x402 402 → pay → data returned (credit-score endpoint)
2. Show HashScan settlement link
3. Show HashPack connect + WHBAR pool deposit/drawdown
4. Show agent-to-agent flow (pool monitor pays data service)
