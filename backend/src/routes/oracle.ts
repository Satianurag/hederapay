import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { fetchHbarUsdOracle, fetchPoolOnChainOracle } from "../services/chainlinkPrice";

const router = Router();

router.get("/hbar-usd", authenticate, async (_req: Request, res: Response) => {
  try {
    const oracle = await fetchHbarUsdOracle();
    const poolOracle = await fetchPoolOnChainOracle();
    res.json({
      oracle,
      poolOnChain: poolOracle
        ? {
            priceUsd: Number(poolOracle.price) / 10 ** oracle.decimals,
            updatedAt: Number(poolOracle.updatedAt),
          }
        : null,
      source: "Chainlink AggregatorV3Interface",
      network: "hedera:testnet",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch Chainlink HBAR/USD", detail: err.message });
  }
});

export default router;
