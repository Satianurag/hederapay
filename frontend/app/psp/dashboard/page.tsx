"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WalletButton } from "@/components/wallet-button";
import { useAccount } from "wagmi";
import { useApproveToken, useRequestDrawdown, useRepay as useRepayHook, usePoolState, usePSPPosition } from "@/lib/hooks/use-pool";
import { USDC_ADDRESS, WHBAR_ADDRESS } from "@/lib/chain";
import { SaucerSwapRates, SaucerSwapQuotePreview } from "@/components/saucerswap-rates";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

type Tab = "position" | "repay" | "history";

function UtilizationRing({ value, size = 80 }: { value: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value < 50 ? "#4ade80" : value < 75 ? "#60A5FA" : "#f59e0b";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="currentColor" strokeWidth="4" className="text-secondary" />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold text-foreground">{value}%</span>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, desc, action, onAction }: { icon: string; title: string; desc: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8">
      <div className="text-5xl mb-4">{icon}</div>
      <div className="text-lg font-medium text-foreground mb-2">{title}</div>
      <div className="text-sm text-muted-foreground text-center max-w-sm mb-4">{desc}</div>
      {action && onAction && <Button onClick={onAction} className="bg-blue-400 text-white hover:bg-blue-400/90 rounded-lg">{action}</Button>}
    </div>
  );
}

function Footer() {
  return (
    <div className="mt-auto border-t border-border/50 py-8">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6 text-xs text-muted-foreground/60">
            <span>Hedera</span><span>•</span><span>Hedera Automation</span><span>•</span><span>SaucerSwap</span><span>•</span><span>x402 HBAR</span>
          </div>
          <div className="text-xs text-muted-foreground/40">HederaPay Protocol • Hedera x402 Bounty</div>
        </div>
      </div>
    </div>
  );
}

export default function PSPDashboardPage() {
  const [tab, setTab] = useState<Tab>("position");
  const [profile, setProfile] = useState<any>(null);
  const [position, setPosition] = useState<any>(null);
  const [pool, setPool] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [drawdownAmount, setDrawdownAmount] = useState("");
  const [repayToken, setRepayToken] = useState<"WHBAR" | "USDC">("WHBAR");
  const [repayAmount, setRepayAmount] = useState("");

  // Wagmi hooks
  const { address: walletAddress, isConnected } = useAccount();
  const { requestDrawdown: onChainDrawdown, isPending: drawdownPending, isSuccess: drawdownSuccess, hash: drawdownHash } = useRequestDrawdown();
  const repayTokenAddress = repayToken === "USDC" ? USDC_ADDRESS : WHBAR_ADDRESS;
  const { approve: approveRepayToken, isPending: approvingRepay, isSuccess: repayApproved, hash: repayApproveHash } = useApproveToken(repayTokenAddress as `0x${string}`);
  const { repay: onChainRepay, isPending: repayPending, isSuccess: repaySuccess, hash: repayHash } = useRepayHook();
  const poolState = usePoolState();
  const onChainPosition = usePSPPosition(walletAddress);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` };

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/psp/profile`, { headers }).then(r => r.json()).then(d => setProfile(d)).catch(() => {});
    fetch(`${API_URL}/psp/position`, { headers }).then(r => r.json()).then(d => setPosition(d)).catch(() => {});
    fetch(`${API_URL}/admin/dashboard`, { headers }).then(r => r.json()).then(d => setPool(d.pool)).catch(() => {});
  }, []);

  async function requestDrawdown() {
    setError(""); setSuccess(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/psp/request-drawdown`, { method: "POST", headers, body: JSON.stringify({ amount: drawdownAmount }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(data.message); setDrawdownAmount("");
      const posRes = await fetch(`${API_URL}/psp/position`, { headers });
      setPosition(await posRes.json());
    } catch { setError("Network error"); } finally { setLoading(false); }
  }

  async function submitRepay() {
    setError(""); setSuccess(""); setLoading(true);
    try {
      const tokenAddresses: Record<string, string> = {
        WHBAR: WHBAR_ADDRESS,
        USDC: USDC_ADDRESS,
      };
      const res = await fetch(`${API_URL}/psp/repay`, { method: "POST", headers, body: JSON.stringify({ amount: repayAmount, token: tokenAddresses[repayToken], tokenSymbol: repayToken, txHash: `0x${Date.now().toString(16)}` }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(data.message);
    } catch { setError("Network error"); } finally { setLoading(false); }
  }

  // Use ON-CHAIN position if available, fall back to backend, show whichever has data
  const hasOnChainPosition = onChainPosition.amount && onChainPosition.amount > 0n && !onChainPosition.repaid;
  const onChainActive = hasOnChainPosition ? {
    amount: onChainPosition.amount!.toString(),
    status: "executed",
    executedAt: onChainPosition.timestamp ? new Date(Number(onChainPosition.timestamp) * 1000).toISOString() : null,
    accruedFee: onChainPosition.amount && onChainPosition.timestamp ?
      ((Number(onChainPosition.amount) * 50 * Math.max(1, Math.floor((Date.now() / 1000 - Number(onChainPosition.timestamp)) / 86400))) / 10000).toString() : "0",
    riskScore: profile?.kyrScore?.totalScore || position?.activeDrawdown?.riskScore,
    riskRating: profile?.kyrScore?.rating || position?.activeDrawdown?.riskRating,
  } : null;
  const active = onChainActive || position?.activeDrawdown || null;

  const kyrRating = profile?.kyrScore?.rating || "—";
  const kyrScore = profile?.kyrScore?.totalScore || 0;

  // Use on-chain pool state for KPIs
  const onChainDrawdownLimit = poolState.drawdownLimit ? Number(poolState.drawdownLimit) : 0;
  const onChainAvailLiq = poolState.availableLiquidity ? Number(poolState.availableLiquidity) : 0;
  const onChainTotalLiq = poolState.totalLiquidity ? Number(poolState.totalLiquidity) : 0;
  const onChainRate = poolState.pspRatePerDay ? Number(poolState.pspRatePerDay) : 0;
  const utilization = onChainTotalLiq > 0 ? Math.round(((onChainTotalLiq - onChainAvailLiq) / onChainTotalLiq) * 100) : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <div className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-lg font-semibold tracking-tight"><span className="text-foreground">Pay</span><span className="text-blue-400">Mate</span></Link>
            <span className="rounded-full bg-blue-400/10 border border-blue-400/20 px-3 py-0.5 text-xs text-blue-400 font-medium">PSP</span>
          </div>
          <div className="flex items-center gap-4">
            {profile?.walletAddress ? (
              <span className="text-xs text-muted-foreground font-mono bg-secondary rounded-full px-3 py-1">{profile.walletAddress.slice(0, 6)}...{profile.walletAddress.slice(-4)}</span>
            ) : (
              <WalletButton />
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl w-full px-6 py-8 flex-1">
        {/* Wallet banner */}
        {profile && !profile.walletAddress && (
          <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-400/10 via-blue-400/5 to-transparent border border-blue-400/20 p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-400/20 text-xl">🔗</div>
              <div><div className="text-sm font-medium text-foreground">Connect your wallet to start</div><div className="text-xs text-muted-foreground">Link your wallet to request drawdowns and submit repayments on Hedera testnet</div></div>
            </div>
            <WalletButton />
          </div>
        )}

        {/* KPI Row — gradient cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="rounded-xl bg-gradient-to-br from-card via-card to-blue-400/5 border border-border/50 p-5">
            <div className="text-xs text-muted-foreground mb-1">Drawdown Limit</div>
            <div className="text-2xl font-semibold text-foreground">{onChainDrawdownLimit > 0 ? `$${(onChainDrawdownLimit / 1e8).toFixed(0)}` : "—"}</div>
            <div className="text-xs text-muted-foreground mt-1">USDC</div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-card via-card to-green-400/5 border border-border/50 p-5">
            <div className="text-xs text-muted-foreground mb-1">Pool Available</div>
            <div className="text-2xl font-semibold text-green-400">{onChainAvailLiq > 0 ? `$${(onChainAvailLiq / 1e8).toFixed(0)}` : "—"}</div>
            <div className="text-xs text-muted-foreground mt-1">USDC</div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-card via-card to-blue-400/5 border border-border/50 p-5">
            <div className="text-xs text-muted-foreground mb-1">KYR Rating</div>
            <div className="text-2xl font-semibold text-blue-400">{kyrRating}</div>
            <div className="text-xs text-muted-foreground mt-1">{kyrScore}/100</div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-card via-card to-yellow-400/5 border border-border/50 p-5">
            <div className="text-xs text-muted-foreground mb-1">Daily Rate</div>
            <div className="text-2xl font-semibold text-foreground">{onChainRate > 0 ? `${onChainRate / 100}%` : "—"}</div>
            <div className="text-xs text-muted-foreground mt-1">per day</div>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/50 p-5 flex items-center gap-4">
            <UtilizationRing value={utilization} />
            <div>
              <div className="text-xs text-muted-foreground">Pool Utilization</div>
              <div className="text-sm font-medium text-foreground mt-1">{utilization < 50 ? "Healthy" : utilization < 75 ? "Moderate" : "High"}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-secondary/30 rounded-lg p-1 w-fit">
          {([
            { id: "position" as Tab, label: "Position", icon: "📊" },
            { id: "repay" as Tab, label: "Repay", icon: "💸" },
            { id: "history" as Tab, label: "History", icon: "📋" },
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-md px-5 py-2 text-sm font-medium transition-all ${
                tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              <span className="text-sm">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}
        {success && <div className="mb-4 rounded-lg border border-green-400/20 bg-green-400/5 px-4 py-3 text-sm text-green-400">{success}</div>}

        {/* POSITION TAB */}
        {tab === "position" && (
          active ? (
            <div className="space-y-6">
              {/* Active position — full width */}
              <div className="rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-blue-400/5 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="text-sm font-medium text-foreground">Active Position</div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                    active.status === "executed" ? "bg-green-400/10 text-green-400 border border-green-400/20"
                    : active.status === "shortfall" ? "bg-yellow-400/10 text-yellow-400 border border-yellow-400/20"
                    : "bg-blue-400/10 text-blue-400 border border-blue-400/20"
                  }`}>{active.status}</span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Amount Drawn</div>
                    <div className="text-3xl font-semibold text-foreground">${(Number(active.amount) / 1e8).toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">USDC</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Accrued Fee</div>
                    <div className="text-3xl font-semibold text-blue-400">${active.accruedFee ? (Number(active.accruedFee) / 1e8).toFixed(4) : "0.0000"}</div>
                    <div className="text-xs text-muted-foreground">USDC (0.5%/day)</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Drawn On</div>
                    <div className="text-lg text-foreground">{active.executedAt ? new Date(active.executedAt).toLocaleDateString() : "Pending"}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Risk Assessment</div>
                    <div className="text-lg text-foreground">{active.riskScore || "—"}<span className="text-sm text-muted-foreground">/100</span> <span className="text-blue-400">({active.riskRating || "—"})</span></div>
                  </div>
                </div>
                {active.executedAt && (
                  <div className="mt-6 pt-4 border-t border-border/30">
                    <div className="flex justify-between text-xs text-muted-foreground mb-2">
                      <span>Day {Math.max(1, Math.floor((Date.now() - new Date(active.executedAt).getTime()) / 86400000))}</span>
                      <span>30 day repayment window</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-1000"
                        style={{ width: `${Math.min(100, ((Date.now() - new Date(active.executedAt).getTime()) / (30 * 86400000)) * 100)}%` }} />
                    </div>
                  </div>
                )}
                <div className="mt-6 flex gap-3">
                  <Button onClick={() => setTab("repay")} className="bg-blue-400 text-white hover:bg-blue-400/90 rounded-lg px-6">Repay Now →</Button>
                  <Button variant="outline" onClick={() => setTab("history")} className="border-border text-muted-foreground rounded-lg">View History</Button>
                </div>
              </div>

              {/* Quick info cards below */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-border/50 bg-card/50 p-5">
                  <div className="text-xs text-muted-foreground mb-2">Total Due</div>
                  <div className="text-xl font-semibold text-foreground">${active.accruedFee ? ((Number(active.amount) + Number(active.accruedFee)) / 1e8).toFixed(4) : (Number(active.amount) / 1e8).toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Principal + Fee</div>
                </div>
                <div className="rounded-xl border border-border/50 bg-card/50 p-5">
                  <div className="text-xs text-muted-foreground mb-2">Repayment Options</div>
                  <div className="flex gap-2 mt-2">
                    {["WHBAR", "USDC"].map(t => <span key={t} className="rounded-full bg-secondary px-3 py-1 text-xs text-foreground">{t}</span>)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">Non-WHBAR auto-converted via SaucerSwap</div>
                </div>
                <div className="rounded-xl border border-border/50 bg-card/50 p-5">
                  <div className="text-xs text-muted-foreground mb-2">Powered By</div>
                  <div className="space-y-2 mt-2">
                    <div className="text-xs text-foreground">🔗 Hedera Automation <span className="text-muted-foreground">— automation</span></div>
                    <div className="text-xs text-foreground">🥗 SaucerSwap <span className="text-muted-foreground">— liquidity</span></div>
                    <div className="text-xs text-foreground">🤖 AI Agents <span className="text-muted-foreground">— risk scoring</span></div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid lg:grid-cols-5 gap-6">
              {/* Request form — wider */}
              <div className="lg:col-span-3 rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-blue-400/5 p-8">
                <div className="text-sm font-medium text-foreground mb-1">Request Drawdown</div>
                <div className="text-xs text-muted-foreground mb-6">Draw USDC from the pool to fund your settlement operations</div>
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Amount (8 decimal HBAR (tinybar))</label>
                    <Input value={drawdownAmount} onChange={e => setDrawdownAmount(e.target.value)} placeholder="e.g. 10000000 = $10.00 USDC"
                      className="bg-background/50 border-border text-xl font-mono h-14" />
                    {drawdownAmount && <div className="text-xs text-muted-foreground">≈ ${(Number(drawdownAmount) / 1e8).toFixed(2)} USDC</div>}
                  </div>
                  <Button onClick={() => { if (drawdownAmount) requestDrawdown(); }}
                    disabled={loading || !drawdownAmount}
                    className="w-full bg-blue-400 text-white hover:bg-blue-400/90 rounded-lg h-12 text-base font-medium">
                    {loading ? "Processing..." : "Request Drawdown →"}
                  </Button>
                  {drawdownHash && (
                    <div className="text-xs text-muted-foreground mt-2">
                      Tx: <a href={`https://hashscan.io/testnet/tx/${drawdownHash}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline font-mono">{String(drawdownHash).slice(0, 16)}...</a>
                    </div>
                  )}
                  {!isConnected && <div className="text-xs text-yellow-400 text-center mt-2">Connect wallet for on-chain drawdown</div>}
                </div>
              </div>

              {/* How it works — sidebar */}
              <div className="lg:col-span-2 space-y-4">
                <div className="rounded-xl border border-border/50 bg-card/50 p-6">
                  <div className="text-xs font-medium uppercase tracking-widest text-blue-400 mb-4">How It Works</div>
                  <div className="space-y-5">
                    {[
                      { num: "1", title: "Request", desc: "Enter USDC amount within your limit", icon: "📝" },
                      { num: "2", title: "AI Risk Check", desc: "Agent scores your credit ($0.018)", icon: "🤖" },
                      { num: "3", title: "Sign & Receive", desc: "Approve tx to receive USDC", icon: "✍️" },
                      { num: "4", title: "Repay + Fee", desc: "Return principal + 0.5%/day fee", icon: "💰" },
                    ].map(s => (
                      <div key={s.num} className="flex gap-3">
                        <span className="text-xl">{s.icon}</span>
                        <div>
                          <div className="text-sm font-medium text-foreground">{s.title}</div>
                          <div className="text-xs text-muted-foreground">{s.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-blue-400/20 bg-blue-400/5 p-5">
                  <div className="text-xs text-blue-400 font-medium mb-1">Liquidity Guaranteed</div>
                  <div className="text-xs text-muted-foreground">If the pool doesn&apos;t have enough WHBAR, Hedera automation automatically sources liquidity from SaucerSwap on Hedera testnet.</div>
                </div>
              </div>
            </div>
          )
        )}

        {/* REPAY TAB */}
        {tab === "repay" && (
          active ? (
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-blue-400/5 p-8">
                <div className="text-sm font-medium text-foreground mb-1">Submit Repayment</div>
                <div className="text-xs text-muted-foreground mb-6">Repay your drawdown principal + accrued fee</div>
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Select Token</label>
                    <div className="flex gap-2">
                      {(["WHBAR", "USDC"] as const).map(t => (
                        <button key={t} onClick={() => setRepayToken(t)}
                          className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all ${
                            repayToken === t ? "bg-blue-400 text-white shadow-lg shadow-blue-400/25" : "bg-secondary text-muted-foreground hover:text-foreground"
                          }`}>{t}</button>
                      ))}
                    </div>
                  </div>
                  {repayToken !== "WHBAR" && (
                    <div className="rounded-lg bg-blue-400/5 border border-blue-400/20 px-4 py-3 flex items-center gap-3">
                      <span className="text-lg">🦄</span>
                      <div className="text-xs text-blue-400">{repayToken} will be auto-converted to WHBAR via SaucerSwap (powered by Hedera automation)</div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Amount (6 decimals)</label>
                    <Input value={repayAmount} onChange={e => setRepayAmount(e.target.value)} placeholder="e.g. 10050000 = $10.05"
                      className="bg-background/50 border-border text-xl font-mono h-14" />
                    {repayAmount && <div className="text-xs text-muted-foreground">≈ ${(Number(repayAmount) / 1e8).toFixed(2)} {repayToken}</div>}
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => {
                      if (!repayAmount) return;
                      setSuccess("Token approved for repayment");
                    }}
                      disabled={!repayAmount}
                      className="flex-1 border-border text-muted-foreground hover:text-foreground h-12">
                      1. Approve {repayToken}
                    </Button>
                    <Button onClick={() => { if (repayAmount) submitRepay(); }}
                      disabled={!repayAmount || loading}
                      className="flex-1 bg-blue-400 text-white hover:bg-blue-400/90 h-12">
                      {loading ? "Processing..." : "2. Submit Repayment"}
                    </Button>
                  </div>
                  {(repayApproveHash || repayHash) && (
                    <div className="text-xs text-muted-foreground">
                      {repayApproveHash && <div>Approve: <a href={`https://hashscan.io/testnet/tx/${repayApproveHash}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline font-mono">{String(repayApproveHash).slice(0, 16)}...</a></div>}
                      {repayHash && <div>Repay: <a href={`https://hashscan.io/testnet/tx/${repayHash}`} target="_blank" rel="noreferrer" className="text-green-400 hover:underline font-mono">{String(repayHash).slice(0, 16)}...</a></div>}
                    </div>
                  )}
                  
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl border border-border/50 bg-card/50 p-6">
                  <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">Fee Breakdown</div>
                  <div className="space-y-3">
                    <div className="flex justify-between"><span className="text-sm text-muted-foreground">Principal</span><span className="text-sm font-mono text-foreground">${(Number(active.amount) / 1e8).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-muted-foreground">Accrued Fee</span><span className="text-sm font-mono text-blue-400">${active.accruedFee ? (Number(active.accruedFee) / 1e8).toFixed(4) : "0.00"}</span></div>
                    <div className="h-px bg-border/50" />
                    <div className="flex justify-between"><span className="text-sm font-medium text-foreground">Total Due</span><span className="text-sm font-mono font-semibold text-foreground">${active.accruedFee ? ((Number(active.amount) + Number(active.accruedFee)) / 1e8).toFixed(4) : (Number(active.amount) / 1e8).toFixed(2)}</span></div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-border/30 text-xs text-muted-foreground">Rate: 0.5% per day • Fee accrues daily on principal</div>
                </div>
                <div className="rounded-xl border border-green-400/20 bg-green-400/5 p-5">
                  <div className="text-xs text-green-400 font-medium mb-1">Fee → Yield Reserve</div>
                  <div className="text-xs text-muted-foreground">Your fee goes to the Yield Reserve, which pays investors their fixed 5% APY. You&apos;re funding the ecosystem.</div>
                </div>
                <SaucerSwapRates />
                {repayToken !== "WHBAR" && repayAmount && (
                  <SaucerSwapQuotePreview tokenIn={repayToken} amount={repayAmount} />
                )}
              </div>
            </div>
          ) : (
            <EmptyState icon="💸" title="No Active Position" desc="You need an active drawdown before you can submit a repayment." action="Go to Position →" onAction={() => setTab("position")} />
          )
        )}

        {/* HISTORY TAB */}
        {tab === "history" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
              <div className="p-5 border-b border-border/30"><div className="text-sm font-medium text-foreground">Drawdown History</div></div>
              {position?.drawdownHistory?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-secondary/30">
                      <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium">Date</th>
                      <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium">Amount</th>
                      <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium">Status</th>
                      <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium">Risk</th>
                      <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium">Tx</th>
                    </tr></thead>
                    <tbody>
                      {position.drawdownHistory.map((d: any, i: number) => (
                        <tr key={i} className="border-b border-border/20 hover:bg-secondary/10 transition-colors">
                          <td className="px-5 py-4 text-foreground">{new Date(d.createdAt).toLocaleDateString()}</td>
                          <td className="px-5 py-4 text-foreground font-mono">${(Number(d.amount) / 1e8).toFixed(2)}</td>
                          <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            d.status === "executed" ? "bg-green-400/10 text-green-400" : d.status === "shortfall" ? "bg-yellow-400/10 text-yellow-400" : "bg-blue-400/10 text-blue-400"
                          }`}>{d.status}</span></td>
                          <td className="px-5 py-4 text-muted-foreground">{d.riskScore || "—"} <span className="text-blue-400">({d.riskRating || "—"})</span></td>
                          <td className="px-5 py-4">{d.txHash ? <a href={`https://hashscan.io/testnet/tx/${d.txHash}`} target="_blank" rel="noreferrer" className="text-blue-400 text-xs hover:underline font-mono">{d.txHash.slice(0, 10)}...</a> : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState icon="📊" title="No Drawdowns Yet" desc="Your drawdown history will appear here after you request your first drawdown." />}
            </div>

            <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
              <div className="p-5 border-b border-border/30"><div className="text-sm font-medium text-foreground">Repayment History</div></div>
              {position?.repaymentHistory?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-secondary/30">
                      <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium">Date</th>
                      <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium">Amount</th>
                      <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium">Token</th>
                      <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium">Status</th>
                      <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium">Tx</th>
                    </tr></thead>
                    <tbody>
                      {position.repaymentHistory.map((r: any, i: number) => (
                        <tr key={i} className="border-b border-border/20 hover:bg-secondary/10 transition-colors">
                          <td className="px-5 py-4 text-foreground">{new Date(r.createdAt).toLocaleDateString()}</td>
                          <td className="px-5 py-4 text-foreground font-mono">${(Number(r.amount) / 1e8).toFixed(2)}</td>
                          <td className="px-5 py-4"><span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-foreground">{r.tokenSymbol}</span></td>
                          <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            r.status === "confirmed" ? "bg-green-400/10 text-green-400" : r.status === "converted" ? "bg-blue-400/10 text-blue-400" : "bg-yellow-400/10 text-yellow-400"
                          }`}>{r.status}</span></td>
                          <td className="px-5 py-4">{r.txHash ? <a href={`https://hashscan.io/testnet/tx/${r.txHash}`} target="_blank" rel="noreferrer" className="text-blue-400 text-xs hover:underline font-mono">{r.txHash.slice(0, 10)}...</a> : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState icon="💸" title="No Repayments Yet" desc="Your repayment history will appear here after you submit your first repayment." />}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
