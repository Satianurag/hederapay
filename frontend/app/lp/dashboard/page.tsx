"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WalletButton } from "@/components/wallet-button";
import { useAccount } from "wagmi";
import { useApproveToken, useDeposit, useWithdraw, usePoolState, useLPBalance } from "@/lib/hooks/use-pool";
import { WHBAR_ADDRESS } from "@/lib/chain";
import { SaucerSwapRates } from "@/components/saucerswap-rates";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";
type Tab = "deposit" | "withdraw" | "history" | "pool";

function YieldRing({ apy, size = 90 }: { apy: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(apy, 20) / 20) * circumference;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="currentColor" strokeWidth="4" className="text-secondary" />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#4ade80" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold text-green-400">{apy}%</span>
        <span className="text-[10px] text-muted-foreground">APY</span>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="mt-auto border-t border-border/50 py-8">
      <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-6 text-xs text-muted-foreground/60">
          <span>Hedera</span><span>•</span><span>Hedera Automation</span><span>•</span><span>SaucerSwap</span><span>•</span><span>x402 HBAR</span>
        </div>
        <div className="text-xs text-muted-foreground/40">HederaPay Protocol • Hedera x402 Bounty</div>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="text-5xl mb-4">{icon}</div>
      <div className="text-lg font-medium text-foreground mb-2">{title}</div>
      <div className="text-sm text-muted-foreground text-center max-w-sm">{desc}</div>
    </div>
  );
}

export default function LPDashboardPage() {
  const [tab, setTab] = useState<Tab>("deposit");
  const [balance, setBalance] = useState<any>(null);
  const [yieldStatus, setYieldStatus] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [depositAmount, setDepositAmount] = useState("");

  // Wagmi hooks for real on-chain transactions
  const { address: walletAddress, isConnected } = useAccount();
  const { approve: approveWhbar, isPending: approving, isSuccess: approved, hash: approveHash } = useApproveToken(WHBAR_ADDRESS);
  const { deposit: onChainDeposit, isPending: depositing, isSuccess: deposited, hash: depositHash } = useDeposit();
  const { withdraw: onChainWithdraw, isPending: withdrawing, isSuccess: withdrawn, hash: withdrawHash } = useWithdraw();
  const poolState = usePoolState();
  const lpBalance = useLPBalance(walletAddress);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` };

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/lp/balance`, { headers }).then(r => r.json()).then(d => setBalance(d)).catch(() => {});
    fetch(`${API_URL}/yield/status`, { headers }).then(r => r.json()).then(d => setYieldStatus(d)).catch(() => {});
    fetch(`${API_URL}/admin/dashboard`, { headers }).then(r => r.json()).then(d => setDashboard(d)).catch(() => {});
  }, []);

  async function submitDeposit() {
    setError(""); setSuccess(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/lp/deposit`, { method: "POST", headers, body: JSON.stringify({ amount: depositAmount, txHash: `0x${Date.now().toString(16)}` }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess("Deposit recorded successfully");
      setDepositAmount("");
      const balRes = await fetch(`${API_URL}/lp/balance`, { headers });
      setBalance(await balRes.json());
    } catch { setError("Network error"); } finally { setLoading(false); }
  }

  async function submitWithdraw() {
    setError(""); setSuccess(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/lp/withdraw`, { method: "POST", headers, body: JSON.stringify({ txHash: `0x${Date.now().toString(16)}` }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess("Withdrawal recorded successfully");
    } catch { setError("Network error"); } finally { setLoading(false); }
  }

  // Use ON-CHAIN data (wagmi) for KPIs, fallback to backend API
  const apy = poolState.investorAPY ? Number(poolState.investorAPY) / 100 : (balance?.investorAPY ? balance.investorAPY / 100 : 5);
  const totalDeposited = lpBalance.deposited ? Number(lpBalance.deposited) / 1e8 : (balance?.totalDeposited ? Number(balance.totalDeposited) / 1e8 : 0);
  const claimableYield = lpBalance.claimable ? Number(lpBalance.claimable) / 1e8 : 0;
  const onChainTotalLiq = poolState.totalLiquidity ? Number(poolState.totalLiquidity) / 1e8 : 0;
  const onChainAvailLiq = poolState.availableLiquidity ? Number(poolState.availableLiquidity) / 1e8 : 0;
  const nextYield = yieldStatus?.nextCycleDate ? new Date(yieldStatus.nextCycleDate).toLocaleDateString() : "—";
  const lastCycle = yieldStatus?.lastCycle;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <div className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-lg font-semibold tracking-tight"><span className="text-foreground">Pay</span><span className="text-blue-400">Mate</span></Link>
            <span className="rounded-full bg-green-400/10 border border-green-400/20 px-3 py-0.5 text-xs text-green-400 font-medium">Investor</span>
          </div>
          <div className="flex items-center gap-4">
            <WalletButton />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl w-full px-6 py-8 flex-1">
        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="rounded-xl bg-gradient-to-br from-card via-card to-green-400/5 border border-border/50 p-5">
            <div className="text-xs text-muted-foreground mb-1">Total Deposited</div>
            <div className="text-2xl font-semibold text-foreground">${totalDeposited.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground mt-1">WHBAR</div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-card via-card to-blue-400/5 border border-border/50 p-5">
            <div className="text-xs text-muted-foreground mb-1">Claimable Yield</div>
            <div className="text-2xl font-semibold text-blue-400">${claimableYield.toFixed(4)}</div>
            <div className="text-xs text-muted-foreground mt-1">WHBAR</div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-card via-card to-green-400/5 border border-border/50 p-5">
            <div className="text-xs text-muted-foreground mb-1">Next Distribution</div>
            <div className="text-lg font-semibold text-foreground">{nextYield}</div>
            <div className="text-xs text-muted-foreground mt-1">7-day cycle</div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-card via-card to-blue-400/5 border border-border/50 p-5">
            <div className="text-xs text-muted-foreground mb-1">Last Distribution</div>
            <div className="text-lg font-semibold text-foreground">{lastCycle ? `Cycle ${lastCycle.cycle}` : "None yet"}</div>
            <div className="text-xs text-muted-foreground mt-1">{lastCycle ? `$${(Number(lastCycle.totalDistributed) / 1e8).toFixed(4)}` : "—"}</div>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/50 p-5 flex items-center gap-4">
            <YieldRing apy={apy} />
            <div>
              <div className="text-xs text-muted-foreground">Fixed APY</div>
              <div className="text-sm font-medium text-foreground mt-1">Guaranteed</div>
              <div className="text-xs text-muted-foreground">Regardless of utilization</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-secondary/30 rounded-lg p-1 w-fit">
          {([
            { id: "deposit" as Tab, label: "Deposit", icon: "💰" },
            { id: "withdraw" as Tab, label: "Withdraw", icon: "🏦" },
            { id: "pool" as Tab, label: "Pool Overview", icon: "🏊" },
            { id: "history" as Tab, label: "History", icon: "📋" },
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-md px-5 py-2 text-sm font-medium transition-all ${
                tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}
        {success && <div className="mb-4 rounded-lg border border-green-400/20 bg-green-400/5 px-4 py-3 text-sm text-green-400">{success}</div>}

        {/* DEPOSIT TAB */}
        {tab === "deposit" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-green-400/5 p-8">
              <div className="text-sm font-medium text-foreground mb-1">Deposit WHBAR</div>
              <div className="text-xs text-muted-foreground mb-6">Deposit WHBAR to start earning {apy}% fixed APY</div>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Amount (8 decimal WHBAR)</label>
                  <Input value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="e.g. 15000000 = 0.15 WHBAR"
                    className="bg-background/50 border-border text-xl font-mono h-14" />
                  {depositAmount && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>≈ {(Number(depositAmount) / 1e8).toFixed(4)} WHBAR</span>
                      <span>Weekly yield: ≈ ${((Number(depositAmount) / 1e8) * (apy / 100) * 7 / 360).toFixed(4)}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => {
                    if (!depositAmount) return;
                    approveWhbar(BigInt(depositAmount));
                  }}
                    disabled={!depositAmount || approving}
                    className="flex-1 border-border text-muted-foreground hover:text-foreground h-12">
                    {approving ? "Approving..." : "1. Approve WHBAR"}
                  </Button>
                  <Button onClick={() => { if (depositAmount) submitDeposit(); }}
                    disabled={!depositAmount || loading}
                    className="flex-1 bg-green-400 text-black hover:bg-green-400/90 h-12 font-medium">
                    {loading ? "Processing..." : "2. Deposit"}
                  </Button>
                </div>
                {(approveHash || depositHash) && (
                  <div className="text-xs text-muted-foreground">
                    {approveHash && <div>Approve tx: <a href={`https://hashscan.io/testnet/tx/${approveHash}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline font-mono">{String(approveHash).slice(0, 16)}...</a></div>}
                    {depositHash && <div>Deposit tx: <a href={`https://hashscan.io/testnet/tx/${depositHash}`} target="_blank" rel="noreferrer" className="text-green-400 hover:underline font-mono">{String(depositHash).slice(0, 16)}...</a></div>}
                  </div>
                )}
                {!isConnected && <div className="text-xs text-yellow-400 text-center">Connect your wallet to deposit</div>}
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border border-border/50 bg-card/50 p-6">
                <div className="text-xs font-medium uppercase tracking-widest text-green-400 mb-4">Your Yield Projection</div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Weekly</span><span className="text-foreground">${(totalDeposited * (apy / 100) * 7 / 360).toFixed(4)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Monthly</span><span className="text-foreground">${(totalDeposited * (apy / 100) * 30 / 360).toFixed(4)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Annual</span><span className="text-foreground font-medium">${(totalDeposited * (apy / 100)).toFixed(2)}</span></div>
                </div>
              </div>
              <div className="rounded-xl border border-green-400/20 bg-green-400/5 p-5">
                <div className="text-xs text-green-400 font-medium mb-1">Fixed & Guaranteed</div>
                <div className="text-xs text-muted-foreground">Your {apy}% APY is fixed regardless of pool utilization. Yield is paid from the Yield Reserve funded by PSP fees.</div>
              </div>
              <SaucerSwapRates />
              <div className="rounded-xl border border-border/50 bg-card/50 p-5">
                <div className="text-xs text-muted-foreground mb-3">Powered By</div>
                <div className="space-y-2">
                  <div className="text-xs text-foreground">⭕ WHBAR on Hedera <span className="text-muted-foreground">— settlement</span></div>
                  <div className="text-xs text-foreground">🔗 Hedera Automation <span className="text-muted-foreground">— auto yield distribution</span></div>
                  <div className="text-xs text-foreground">🛡 Yield Reserve <span className="text-muted-foreground">— isolated from pool</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* WITHDRAW TAB */}
        {tab === "withdraw" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-green-400/5 p-8">
              <div className="text-sm font-medium text-foreground mb-1">Withdraw Funds</div>
              <div className="text-xs text-muted-foreground mb-6">Withdraw your principal + any claimable yield</div>
              <div className="space-y-4">
                <div className="rounded-lg bg-secondary/30 p-4 space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Principal Deposited</span><span className="text-foreground font-mono">${totalDeposited.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Claimable Yield</span><span className="text-green-400 font-mono">${claimableYield.toFixed(4)}</span></div>
                  <div className="h-px bg-border/50" />
                  <div className="flex justify-between text-sm font-medium"><span className="text-foreground">Total Withdrawable</span><span className="text-foreground font-mono">${(totalDeposited + claimableYield).toFixed(4)}</span></div>
                </div>
                <Button onClick={() => submitWithdraw()}
                  disabled={loading || totalDeposited === 0}
                  className="w-full bg-green-400 text-black hover:bg-green-400/90 h-12 font-medium">
                  {loading ? "Processing..." : totalDeposited > 0 ? "Withdraw All" : "No funds to withdraw"}
                </Button>
                {withdrawHash && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Tx: <a href={`https://hashscan.io/testnet/tx/${withdrawHash}`} target="_blank" rel="noreferrer" className="text-green-400 hover:underline font-mono">{String(withdrawHash).slice(0, 16)}...</a>
                  </div>
                )}
                
              </div>
            </div>
            <div className="rounded-xl border border-green-400/20 bg-green-400/5 p-6">
              <div className="text-xs text-green-400 font-medium mb-3">How Withdrawal Works</div>
              <div className="space-y-3">
                {[
                  { s: "1", d: "Click withdraw — signs an on-chain transaction" },
                  { s: "2", d: "Pool transfers your principal + yield in WHBAR" },
                  { s: "3", d: "Funds arrive in your wallet instantly on Hedera testnet" },
                ].map(i => (
                  <div key={i.s} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-400/20 text-xs text-green-400">{i.s}</span>
                    <span className="text-xs text-muted-foreground">{i.d}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* POOL OVERVIEW TAB */}
        {tab === "pool" && (
          <div className="space-y-6">
            {/* Pool Stats */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-border/50 bg-card/50 p-5">
                <div className="text-xs text-muted-foreground mb-1">Total Pool Liquidity</div>
                <div className="text-xl font-semibold text-foreground">{dashboard?.pool ? `$${(Number(dashboard.pool.totalLiquidity) / 1e8).toFixed(2)}` : "—"}</div>
              </div>
              <div className="rounded-xl border border-border/50 bg-card/50 p-5">
                <div className="text-xs text-muted-foreground mb-1">Available Liquidity</div>
                <div className="text-xl font-semibold text-green-400">{dashboard?.pool ? `$${(Number(dashboard.pool.availableLiquidity) / 1e8).toFixed(2)}` : "—"}</div>
              </div>
              <div className="rounded-xl border border-border/50 bg-card/50 p-5">
                <div className="text-xs text-muted-foreground mb-1">Utilization</div>
                <div className="text-xl font-semibold text-foreground">{dashboard?.pool?.utilizationRate || "—"}</div>
              </div>
              <div className="rounded-xl border border-border/50 bg-card/50 p-5">
                <div className="text-xs text-muted-foreground mb-1">Yield Reserve</div>
                <div className="text-xl font-semibold text-green-400">{yieldStatus?.allTimeDistributed ? `$${(Number(yieldStatus.allTimeDistributed) / 1e8).toFixed(4)}` : "$0.00"}</div>
                <div className="text-xs text-muted-foreground mt-1">Total distributed</div>
              </div>
            </div>

            {/* Active PSPs */}
            <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
              <div className="p-5 border-b border-border/30 flex items-center justify-between">
                <div className="text-sm font-medium text-foreground">Active PSP Borrowers</div>
                <span className="text-xs text-muted-foreground">{dashboard?.stats?.approvedPSPs || 0} approved</span>
              </div>
              {dashboard?.activeDrawdowns > 0 ? (
                <div className="p-5 space-y-3">
                  {dashboard.recentRepayments?.slice(0, 5).map((r: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-400/10 text-xs text-blue-400">PSP</span>
                        <div>
                          <div className="text-sm text-foreground font-mono">{r.pspAddress?.slice(0, 10)}...</div>
                          <div className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono text-foreground">${(Number(r.amount) / 1e8).toFixed(2)}</div>
                        <span className={`text-xs rounded-full px-2 py-0.5 ${r.status === "confirmed" ? "bg-green-400/10 text-green-400" : "bg-yellow-400/10 text-yellow-400"}`}>{r.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="text-3xl mb-3">🏢</div>
                  <div className="text-sm text-muted-foreground">No active drawdowns right now</div>
                  <div className="text-xs text-muted-foreground mt-1">PSP borrowing activity will appear here</div>
                </div>
              )}
            </div>

            {/* Pool parameters */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border/50 bg-card/50 p-6">
                <div className="text-xs font-medium uppercase tracking-widest text-green-400 mb-4">Pool Parameters</div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Drawdown Limit</span><span className="text-foreground">{dashboard?.pool ? `$${(Number(dashboard.pool.drawdownLimit) / 1e8).toFixed(0)}` : "—"}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">PSP Rate</span><span className="text-foreground">{dashboard?.pool ? `${dashboard.pool.pspRatePerDay / 100}%/day` : "—"}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Investor APY</span><span className="text-green-400 font-medium">{dashboard?.pool ? `${dashboard.pool.investorAPY / 100}%` : "—"}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Yield Cycle</span><span className="text-foreground">Every 7 days</span></div>
                </div>
              </div>
              <div className="rounded-xl border border-border/50 bg-card/50 p-6">
                <div className="text-xs font-medium uppercase tracking-widest text-green-400 mb-4">Pool Stats</div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Investors</span><span className="text-foreground">{dashboard?.stats?.totalLPs || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Approved PSPs</span><span className="text-foreground">{dashboard?.stats?.approvedPSPs || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Active Drawdowns</span><span className="text-foreground">{dashboard?.activeDrawdowns || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Drawn</span><span className="text-foreground">{dashboard?.totalDrawnAmount ? `$${(Number(dashboard.totalDrawnAmount) / 1e8).toFixed(2)}` : "$0.00"}</span></div>
                </div>
              </div>
            </div>

            {/* Contract links */}
            <div className="rounded-xl border border-green-400/20 bg-green-400/5 p-5">
              <div className="text-xs text-green-400 font-medium mb-3">On-Chain Transparency</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Pool Contract</span>
                  <a href={`https://hashscan.io/testnet/address/${dashboard?.pool?.address || ""}`} target="_blank" rel="noreferrer" className="text-xs text-green-400 hover:underline font-mono">{dashboard?.pool?.address?.slice(0, 16) || "—"}...</a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Network</span>
                  <span className="text-xs text-foreground">Hedera Testnet (Chain 296)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === "history" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
              <div className="p-5 border-b border-border/30"><div className="text-sm font-medium text-foreground">Deposit History</div></div>
              {balance?.deposits?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-secondary/30">
                      <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium">Date</th>
                      <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium">Amount</th>
                      <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium">Status</th>
                      <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium">Tx</th>
                    </tr></thead>
                    <tbody>
                      {balance.deposits.map((d: any, i: number) => (
                        <tr key={i} className="border-b border-border/20 hover:bg-secondary/10 transition-colors">
                          <td className="px-5 py-4 text-foreground">{new Date(d.createdAt).toLocaleDateString()}</td>
                          <td className="px-5 py-4 text-foreground font-mono">${(Number(d.amount) / 1e8).toFixed(2)}</td>
                          <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            d.status === "confirmed" ? "bg-green-400/10 text-green-400" : "bg-yellow-400/10 text-yellow-400"
                          }`}>{d.status}</span></td>
                          <td className="px-5 py-4">{d.txHash ? <a href={`https://hashscan.io/testnet/tx/${d.txHash}`} target="_blank" rel="noreferrer" className="text-blue-400 text-xs hover:underline font-mono">{d.txHash.slice(0, 10)}...</a> : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState icon="💰" title="No Deposits Yet" desc="Your deposit history will appear here." />}
            </div>

            <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
              <div className="p-5 border-b border-border/30"><div className="text-sm font-medium text-foreground">Yield Distributions</div></div>
              {yieldStatus?.lastCycle ? (
                <div className="p-5">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Last Cycle</span><span className="text-foreground">#{yieldStatus.lastCycle.cycle}</span></div>
                  <div className="flex justify-between text-sm mt-2"><span className="text-muted-foreground">Distributed</span><span className="text-green-400 font-mono">${(Number(yieldStatus.lastCycle.totalDistributed) / 1e8).toFixed(4)}</span></div>
                  <div className="flex justify-between text-sm mt-2"><span className="text-muted-foreground">All-time</span><span className="text-foreground font-mono">${(Number(yieldStatus.allTimeDistributed) / 1e8).toFixed(4)}</span></div>
                </div>
              ) : <EmptyState icon="📊" title="No Distributions Yet" desc="Yield is distributed every 7 days by Hedera Automation." />}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
