"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

function UtilizationRing({ value, size = 90 }: { value: number; size?: number }) {
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
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold text-foreground">{value}%</span>
        <span className="text-[10px] text-muted-foreground">util</span>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="mt-auto border-t border-border/50 py-8">
      <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-6 text-xs text-muted-foreground/60">
          <span>Hedera</span><span>•</span><span>Hedera Automation</span><span>•</span><span>SaucerSwap</span><span>•</span><span>x402 HBAR</span>
        </div>
        <div className="text-xs text-muted-foreground/40">HederaPay Protocol • Hedera x402 Bounty</div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [yieldStatus, setYieldStatus] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Init pool form
  const [initForm, setInitForm] = useState({ poolContractAddress: "", yieldReserveAddress: "", drawdownLimit: "", pspRatePerDay: "50", investorAPY: "500" });

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` };

  function loadData() {
    if (!token) return;
    fetch(`${API_URL}/admin/dashboard`, { headers }).then(r => r.json()).then(d => setDashboard(d)).catch(() => {});
    fetch(`${API_URL}/yield/status`, { headers }).then(r => r.json()).then(d => setYieldStatus(d)).catch(() => {});
    fetch(`${API_URL}/admin/audit-log?limit=10`, { headers }).then(r => r.json()).then(d => setAuditLogs(d.logs || [])).catch(() => {});
  }

  useEffect(() => { loadData(); }, []);

  async function initializePool() {
    setError(""); setSuccess(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/initialize-pool`, { method: "POST", headers, body: JSON.stringify({
        ...initForm, pspRatePerDay: Number(initForm.pspRatePerDay), investorAPY: Number(initForm.investorAPY),
      })});
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess("Pool initialized successfully"); loadData();
    } catch { setError("Network error"); } finally { setLoading(false); }
  }

  const pool = dashboard?.pool;
  const stats = dashboard?.stats;
  const utilization = pool ? Math.round(((Number(pool.totalLiquidity) - Number(pool.availableLiquidity)) / Math.max(Number(pool.totalLiquidity), 1)) * 100) : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <div className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-lg font-semibold tracking-tight"><span className="text-foreground">Pay</span><span className="text-blue-400">Mate</span></Link>
            <span className="rounded-full bg-purple-400/10 border border-purple-400/20 px-3 py-0.5 text-xs text-purple-400 font-medium">Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/admin/psps" className="text-xs text-muted-foreground hover:text-foreground transition-colors">PSP Management</Link>
            <Link href="/admin/audit" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Audit Log</Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl w-full px-6 py-8 flex-1">
        {error && <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}
        {success && <div className="mb-4 rounded-lg border border-green-400/20 bg-green-400/5 px-4 py-3 text-sm text-green-400">{success}</div>}

        {/* Pool not initialized — show init form */}
        {!pool && (
          <div className="max-w-xl mx-auto">
            <div className="text-center mb-8">
              <div className="text-4xl mb-3">⚙️</div>
              <h1 className="text-2xl font-semibold text-foreground">Initialize Pool</h1>
              <p className="text-sm text-muted-foreground mt-2">Set up the credit pool before PSPs and investors can interact</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-purple-400/5 p-8 space-y-5">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Pool Contract Address</label>
                <Input value={initForm.poolContractAddress} onChange={e => setInitForm(f => ({ ...f, poolContractAddress: e.target.value }))}
                  placeholder="0xf9F800B7950F2e64A88c914B3e2764B1e8990955" className="bg-background/50 border-border font-mono text-sm" />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Yield Reserve Address</label>
                <Input value={initForm.yieldReserveAddress} onChange={e => setInitForm(f => ({ ...f, yieldReserveAddress: e.target.value }))}
                  placeholder="0xe7E0C0c9Ec9772FF4c36033B0a789437023B34e3" className="bg-background/50 border-border font-mono text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Drawdown Limit (6 dec)</label>
                  <Input value={initForm.drawdownLimit} onChange={e => setInitForm(f => ({ ...f, drawdownLimit: e.target.value }))}
                    placeholder="20000000" className="bg-background/50 border-border font-mono" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">PSP Rate (bps/day)</label>
                  <Input value={initForm.pspRatePerDay} onChange={e => setInitForm(f => ({ ...f, pspRatePerDay: e.target.value }))}
                    placeholder="50" className="bg-background/50 border-border font-mono" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Investor APY (bps)</label>
                  <Input value={initForm.investorAPY} onChange={e => setInitForm(f => ({ ...f, investorAPY: e.target.value }))}
                    placeholder="500" className="bg-background/50 border-border font-mono" />
                </div>
              </div>
              <Button onClick={initializePool} disabled={loading} className="w-full bg-purple-400 text-white hover:bg-purple-400/90 h-12 font-medium">
                {loading ? "Initializing..." : "Initialize Pool"}
              </Button>
            </div>
          </div>
        )}

        {/* Pool initialized — show dashboard */}
        {pool && (
          <div className="space-y-6">
            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="rounded-xl bg-gradient-to-br from-card via-card to-purple-400/5 border border-border/50 p-5">
                <div className="text-xs text-muted-foreground mb-1">Total Liquidity</div>
                <div className="text-xl font-semibold text-foreground">${(Number(pool.totalLiquidity) / 1e6).toFixed(2)}</div>
                <div className="text-xs text-muted-foreground mt-1">USDC</div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-card via-card to-green-400/5 border border-border/50 p-5">
                <div className="text-xs text-muted-foreground mb-1">Available</div>
                <div className="text-xl font-semibold text-green-400">${(Number(pool.availableLiquidity) / 1e6).toFixed(2)}</div>
                <div className="text-xs text-muted-foreground mt-1">USDC</div>
              </div>
              <div className="rounded-xl border border-border/50 bg-card/50 p-4 flex items-center gap-3">
                <UtilizationRing value={utilization} size={70} />
                <div>
                  <div className="text-xs text-muted-foreground">Utilization</div>
                  <div className="text-xs text-foreground mt-1">{utilization < 50 ? "Healthy" : utilization < 75 ? "Moderate" : "High"}</div>
                </div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-card via-card to-blue-400/5 border border-border/50 p-5">
                <div className="text-xs text-muted-foreground mb-1">Active Drawdowns</div>
                <div className="text-xl font-semibold text-blue-400">{dashboard?.activeDrawdowns || 0}</div>
                <div className="text-xs text-muted-foreground mt-1">${dashboard?.totalDrawnAmount ? (Number(dashboard.totalDrawnAmount) / 1e6).toFixed(2) : "0.00"} drawn</div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-card via-card to-green-400/5 border border-border/50 p-5">
                <div className="text-xs text-muted-foreground mb-1">Investors</div>
                <div className="text-xl font-semibold text-foreground">{stats?.totalLPs || 0}</div>
                <div className="text-xs text-muted-foreground mt-1">depositors</div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-card via-card to-purple-400/5 border border-border/50 p-5">
                <div className="text-xs text-muted-foreground mb-1">PSPs</div>
                <div className="text-xl font-semibold text-foreground">{stats?.approvedPSPs || 0}<span className="text-sm text-muted-foreground">/{stats?.totalPSPs || 0}</span></div>
                <div className="text-xs text-muted-foreground mt-1">approved / total</div>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left column — Pool info + Yield */}
              <div className="lg:col-span-2 space-y-6">
                {/* Pool Parameters */}
                <div className="rounded-xl border border-border/50 bg-card/50 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-medium text-foreground">Pool Configuration</div>
                    <a href={`https://hashscan.io/testnet/address/${pool.address}`} target="_blank" rel="noreferrer" className="text-xs text-purple-400 hover:underline font-mono">{pool.address?.slice(0, 16)}...</a>
                  </div>
                  <div className="grid sm:grid-cols-4 gap-4">
                    <div className="rounded-lg bg-secondary/30 p-4">
                      <div className="text-xs text-muted-foreground">Drawdown Limit</div>
                      <div className="text-lg font-semibold text-foreground mt-1">${(Number(pool.drawdownLimit) / 1e6).toFixed(0)}</div>
                    </div>
                    <div className="rounded-lg bg-secondary/30 p-4">
                      <div className="text-xs text-muted-foreground">PSP Rate</div>
                      <div className="text-lg font-semibold text-foreground mt-1">{pool.pspRatePerDay / 100}%<span className="text-sm text-muted-foreground">/day</span></div>
                    </div>
                    <div className="rounded-lg bg-secondary/30 p-4">
                      <div className="text-xs text-muted-foreground">Investor APY</div>
                      <div className="text-lg font-semibold text-green-400 mt-1">{pool.investorAPY / 100}%</div>
                    </div>
                    <div className="rounded-lg bg-secondary/30 p-4">
                      <div className="text-xs text-muted-foreground">Yield Cycle</div>
                      <div className="text-lg font-semibold text-foreground mt-1">7 days</div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
                  <div className="p-5 border-b border-border/30 flex items-center justify-between">
                    <div className="text-sm font-medium text-foreground">Recent Activity</div>
                    <Link href="/admin/audit" className="text-xs text-purple-400 hover:underline">View all →</Link>
                  </div>
                  {auditLogs.length > 0 ? (
                    <div className="divide-y divide-border/20">
                      {auditLogs.slice(0, 6).map((log, i) => (
                        <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-secondary/10 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs ${
                              log.action.includes("APPROVED") ? "bg-green-400/10 text-green-400" :
                              log.action.includes("REJECTED") ? "bg-red-400/10 text-red-400" :
                              log.action.includes("DEPOSIT") ? "bg-green-400/10 text-green-400" :
                              log.action.includes("DRAWDOWN") ? "bg-blue-400/10 text-blue-400" :
                              log.action.includes("REPAYMENT") ? "bg-purple-400/10 text-purple-400" :
                              "bg-secondary text-muted-foreground"
                            }`}>{log.action.slice(0, 2)}</span>
                            <div>
                              <div className="text-sm text-foreground">{log.action.replace(/_/g, " ")}</div>
                              <div className="text-xs text-muted-foreground">{log.actor}</div>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <div className="text-3xl mb-3">📋</div>
                      <div className="text-sm text-muted-foreground">No activity yet</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right column — Yield + Quick links */}
              <div className="space-y-6">
                {/* Yield Reserve */}
                <div className="rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-green-400/5 p-6">
                  <div className="text-xs font-medium uppercase tracking-widest text-green-400 mb-4">Yield Reserve</div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Reserve Balance</span><span className="text-green-400 font-mono">{yieldStatus?.allTimeDistributed ? `$${(Number(yieldStatus.allTimeDistributed) / 1e6).toFixed(4)}` : "$0.00"}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Last Cycle</span><span className="text-foreground">{yieldStatus?.lastCycle ? `#${yieldStatus.lastCycle.cycle}` : "None"}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Next Distribution</span><span className="text-foreground">{yieldStatus?.nextCycleDate ? new Date(yieldStatus.nextCycleDate).toLocaleDateString() : "—"}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Investor APY</span><span className="text-green-400 font-medium">{pool.investorAPY / 100}%</span></div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-border/30 text-xs text-muted-foreground">
                    Yield is distributed automatically by Hedera Automation every 7 days
                  </div>
                </div>

                {/* Quick navigation */}
                <div className="rounded-xl border border-border/50 bg-card/50 p-6">
                  <div className="text-xs font-medium uppercase tracking-widest text-purple-400 mb-4">Management</div>
                  <div className="space-y-2">
                    <Link href="/admin/psps" className="flex items-center justify-between rounded-lg bg-secondary/30 p-3 hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">🏢</span>
                        <div>
                          <div className="text-sm text-foreground">PSP Management</div>
                          <div className="text-xs text-muted-foreground">Review applications, approve PSPs</div>
                        </div>
                      </div>
                      <span className="text-muted-foreground">→</span>
                    </Link>
                    <Link href="/admin/audit" className="flex items-center justify-between rounded-lg bg-secondary/30 p-3 hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">📋</span>
                        <div>
                          <div className="text-sm text-foreground">Audit Log</div>
                          <div className="text-xs text-muted-foreground">Full activity trail</div>
                        </div>
                      </div>
                      <span className="text-muted-foreground">→</span>
                    </Link>
                  </div>
                </div>

                {/* Tech stack */}
                <div className="rounded-xl border border-purple-400/20 bg-purple-400/5 p-5">
                  <div className="text-xs text-purple-400 font-medium mb-3">Infrastructure</div>
                  <div className="space-y-2">
                    <div className="text-xs text-foreground">⭕ Hedera Testnet <span className="text-muted-foreground">— settlement layer</span></div>
                    <div className="text-xs text-foreground">🔗 Hedera Automation <span className="text-muted-foreground">— yield automation</span></div>
                    <div className="text-xs text-foreground">🥗 SaucerSwap <span className="text-muted-foreground">— liquidity sourcing</span></div>
                    <div className="text-xs text-foreground">🤖 AI Agents <span className="text-muted-foreground">— nanopayment risk scoring</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
