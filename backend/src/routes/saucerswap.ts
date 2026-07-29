import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { getSaucerSwapRates, getSaucerSwapQuote, TOKENS } from "../services/saucerswapQuote";

const router = Router();

router.get("/rates", authenticate, async (_req: Request, res: Response) => {
  try {
    const data = await getSaucerSwapRates();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch SaucerSwap rates", detail: err.message });
  }
});

router.post("/quote", authenticate, async (req: Request, res: Response) => {
  try {
    const { tokenIn, tokenOut, amount } = req.body;
    if (!TOKENS[tokenIn] || !TOKENS[tokenOut || "WHBAR"]) {
      res.status(400).json({ error: "Invalid token pair" });
      return;
    }
    const data = await getSaucerSwapQuote(tokenIn, tokenOut || "WHBAR", amount);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: "Quote failed", detail: err.message });
  }
});

export default router;
