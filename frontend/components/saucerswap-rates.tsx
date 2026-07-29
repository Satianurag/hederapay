"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

interface RateInfo {
  rate: number;
  inputAmount: string;
  outputAmount: string;
}

export function SaucerSwapRates({ compact = false }: { compact?: boolean }) {
  const [rates, setRates] = useState<Record<string, RateInfo>>({});
  const [loading, setLoading] = useState(true);
  const [timestamp, setTimestamp] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    fetch(`${API_URL}/saucerswap/rates`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setRates(d.rates || {});
        setTimestamp(d.timestamp || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const usdcRate = rates["USDC/WHBAR"]?.rate;

  if (loading) return null;
  if (!usdcRate) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">USDC/WHBAR</span>
        <span className="font-mono text-foreground">{usdcRate.toFixed(4)}</span>
        <span className="text-muted-foreground/50">via SaucerSwap</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-medium uppercase tracking-widest text-blue-400">Live Rates</div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-muted-foreground">via SaucerSwap</span>
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-400/10 text-[10px] font-medium text-blue-400">$</span>
            <span className="text-sm text-foreground">USDC → WHBAR</span>
          </div>
          <span className="text-sm font-mono text-foreground">{usdcRate.toFixed(4)}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          1 USDC = {usdcRate.toFixed(4)} WHBAR on Hedera via SaucerSwap V2
        </div>
        {timestamp && (
          <div className="text-[10px] text-muted-foreground/50">
            Updated {new Date(timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}

export function SaucerSwapQuotePreview({ tokenIn, amount }: { tokenIn: string; amount: string }) {
  const [quote, setQuote] = useState<{
    input?: { amount: string };
    output?: { amount: string };
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!amount || Number(amount) <= 0 || tokenIn === "WHBAR" || tokenIn === "HBAR") {
      setQuote(null);
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;

    setLoading(true);
    fetch(`${API_URL}/saucerswap/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tokenIn, tokenOut: "WHBAR", amount, type: "EXACT_INPUT" }),
    })
      .then((r) => r.json())
      .then((d) => setQuote(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tokenIn, amount]);

  if (tokenIn === "WHBAR" || tokenIn === "HBAR" || !amount || Number(amount) <= 0) return null;
  if (loading) return <div className="text-xs text-muted-foreground">Fetching SaucerSwap quote...</div>;
  if (!quote?.output) return null;

  const inDecimals = tokenIn === "USDC" ? 1e6 : 1e8;
  const inAmt = Number(quote.input?.amount || amount) / inDecimals;
  const outAmt = Number(quote.output.amount) / 1e8;

  return (
    <div className="rounded-lg bg-blue-400/5 border border-blue-400/20 px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">🥗</span>
        <span className="text-xs text-blue-400 font-medium">SaucerSwap Conversion Preview</span>
      </div>
      <div className="text-xs text-foreground">
        {inAmt.toFixed(4)} {tokenIn} → <span className="text-green-400 font-mono">{outAmt.toFixed(4)} WHBAR</span>
      </div>
    </div>
  );
}
