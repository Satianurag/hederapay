"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

const KYR_CRITERIA = [
  { key: "incorporationRegulatory", label: "Incorporation & Regulatory", max: 5 },
  { key: "businessAgeTrackRecord", label: "Business Age & Track Record", max: 5 },
  { key: "transactionVolumeVelocity", label: "Transaction Volume", max: 10 },
  { key: "settlementPartnerQuality", label: "Settlement Partners", max: 10 },
  { key: "corridorRemittanceRisk", label: "Corridor Risk", max: 8 },
  { key: "prefundingCycleLiquidity", label: "Prefunding & Liquidity", max: 8 },
  { key: "historicalDataAuditTrail", label: "Historical Data", max: 8 },
  { key: "bankFloatManagement", label: "Bank & Float Mgmt", max: 7 },
  { key: "financialStrength", label: "Financial Strength", max: 10 },
  { key: "amlComplianceHealth", label: "AML / Compliance", max: 8 },
  { key: "technologyIntegration", label: "Technology", max: 5 },
  { key: "guarantorsCollateral", label: "Guarantors / Collateral", max: 5 },
  { key: "previousFinancingPayback", label: "Previous Financing", max: 7 },
  { key: "creditBureau", label: "Credit Bureau", max: 4 },
];

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

export default function AdminPSPsPage() {
  const [pendingPSPs, setPendingPSPs] = useState<any[]>([]);
  const [allPSPs, setAllPSPs] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [kyrScores, setKyrScores] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` };

  function loadData() {
    fetch(`${API_URL}/admin/pending-psps`, { headers }).then(r => r.json()).then(d => setPendingPSPs(d.psps || [])).catch(() => {});
    fetch(`${API_URL}/admin/psps`, { headers }).then(r => r.json()).then(d => setAllPSPs(d.psps || [])).catch(() => {});
  }

  useEffect(() => { loadData(); }, []);

  function getKyrTotal(pspId: string) {
    const scores = kyrScores[pspId] || {};
    return Object.values(scores).reduce((sum, v) => sum + (v || 0), 0);
  }

  function getKyrRating(total: number) {
    if (total >= 85) return { rating: "AAA", color: "text-green-400", bg: "bg-green-400/10" };
    if (total >= 70) return { rating: "AA", color: "text-blue-400", bg: "bg-blue-400/10" };
    if (total >= 55) return { rating: "A", color: "text-yellow-400", bg: "bg-yellow-400/10" };
    return { rating: "B/C", color: "text-red-400", bg: "bg-red-400/10" };
  }

  async function approvePSP(pspId: string) {
    setError(""); setSuccess(""); setLoading(pspId);
    try {
      const res = await fetch(`${API_URL}/admin/approve-psp`, { method: "POST", headers, body: JSON.stringify({ pspUserId: pspId, kyrScore: kyrScores[pspId] || {} }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(`PSP approved — ${data.psp?.kyrScore?.rating || ""} (${data.psp?.kyrScore?.totalScore || 0}/100)`);
      setExpandedId(null); loadData();
    } catch { setError("Network error"); } finally { setLoading(""); }
  }

  async function rejectPSP(pspId: string) {
    setError(""); setSuccess(""); setLoading(pspId);
    try {
      const res = await fetch(`${API_URL}/admin/reject-psp`, { method: "POST", headers, body: JSON.stringify({ pspUserId: pspId, reason: "Does not meet criteria" }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess("PSP rejected"); loadData();
    } catch { setError("Network error"); } finally { setLoading(""); }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-lg font-semibold tracking-tight"><span className="text-foreground">Pay</span><span className="text-blue-400">Mate</span></Link>
            <span className="rounded-full bg-purple-400/10 border border-purple-400/20 px-3 py-0.5 text-xs text-purple-400 font-medium">Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard" className="text-xs text-muted-foreground hover:text-foreground">Dashboard</Link>
            <Link href="/admin/psps" className="text-xs text-purple-400">PSP Management</Link>
            <Link href="/admin/audit" className="text-xs text-muted-foreground hover:text-foreground">Audit Log</Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl w-full px-6 py-8 flex-1">
        <h1 className="text-2xl font-semibold text-foreground mb-2">PSP Management</h1>
        <p className="text-sm text-muted-foreground mb-8">Review KYB applications, score credit risk, and manage PSP approvals</p>

        {error && <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}
        {success && <div className="mb-4 rounded-lg border border-green-400/20 bg-green-400/5 px-4 py-3 text-sm text-green-400">{success}</div>}

        {/* Pending Approvals */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-sm font-medium text-foreground">Pending Applications</div>
            {pendingPSPs.length > 0 && <span className="rounded-full bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 px-2.5 py-0.5 text-xs font-medium">{pendingPSPs.length} pending</span>}
          </div>

          {pendingPSPs.length === 0 ? (
            <div className="rounded-xl border border-border/50 bg-card/50 p-8 text-center">
              <div className="text-3xl mb-3">✅</div>
              <div className="text-sm text-muted-foreground">No pending applications</div>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingPSPs.map(psp => {
                const expanded = expandedId === psp._id;
                const kyb = psp.kybProfile;
                const total = getKyrTotal(psp._id);
                const ratingInfo = getKyrRating(total);

                return (
                  <div key={psp._id} className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
                    {/* Header row */}
                    <button onClick={() => setExpandedId(expanded ? null : psp._id)}
                      className="w-full flex items-center justify-between p-5 hover:bg-secondary/10 transition-colors text-left">
                      <div className="flex items-center gap-4">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-400/10 text-yellow-400 text-sm font-medium">
                          {kyb?.companyName?.charAt(0) || "?"}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-foreground">{kyb?.companyName || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">{kyb?.jurisdiction || ""} · {kyb?.businessType || ""} · {psp.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {total > 0 && <span className={`rounded-full px-3 py-1 text-xs font-medium ${ratingInfo.bg} ${ratingInfo.color}`}>{total}/100 ({ratingInfo.rating})</span>}
                        <span className="text-muted-foreground">{expanded ? "▲" : "▼"}</span>
                      </div>
                    </button>

                    {/* Expanded details */}
                    {expanded && (
                      <div className="border-t border-border/30 p-5 space-y-6">
                        {/* KYB Profile */}
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {[
                            { l: "Registration", v: kyb?.registrationNumber },
                            { l: "Incorporated", v: kyb?.dateOfIncorporation },
                            { l: "Years", v: kyb?.yearsInOperation },
                            { l: "License", v: `${kyb?.licenseType || ""} — ${kyb?.licenseNumber || ""}` },
                            { l: "Authority", v: kyb?.issuingAuthority },
                            { l: "Volume/month", v: kyb?.monthlyTransactionVolume ? `$${(kyb.monthlyTransactionVolume / 1e6).toFixed(0)}M` : "—" },
                            { l: "Settlement", v: kyb?.settlementCycle },
                            { l: "Revenue", v: kyb?.annualRevenue ? `$${(kyb.annualRevenue / 1e6).toFixed(0)}M` : "—" },
                            { l: "Debt Ratio", v: kyb?.debtRatio },
                            { l: "AML Policy", v: kyb?.amlPolicyInPlace ? "Yes" : "No" },
                            { l: "Screening", v: kyb?.sanctionsScreeningProvider || "—" },
                            { l: "Enforcement", v: kyb?.enforcementActions ? "Yes" : "None" },
                          ].map((f, i) => (
                            <div key={i} className="rounded-lg bg-secondary/20 px-3 py-2">
                              <div className="text-xs text-muted-foreground">{f.l}</div>
                              <div className="text-sm text-foreground">{f.v || "—"}</div>
                            </div>
                          ))}
                        </div>

                        {/* KYR Scoring */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-sm font-medium text-foreground">KYR Credit Scoring</div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-semibold text-foreground">{total}</span>
                              <span className="text-sm text-muted-foreground">/100</span>
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ratingInfo.bg} ${ratingInfo.color}`}>{ratingInfo.rating}</span>
                            </div>
                          </div>
                          {/* Progress bar */}
                          <div className="h-2 rounded-full bg-secondary mb-4 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${total >= 85 ? "bg-green-400" : total >= 70 ? "bg-blue-400" : total >= 55 ? "bg-yellow-400" : "bg-red-400"}`}
                              style={{ width: `${total}%` }} />
                          </div>
                          <div className="grid sm:grid-cols-2 gap-2">
                            {KYR_CRITERIA.map(c => (
                              <div key={c.key} className="flex items-center gap-2">
                                <div className="flex-1 text-xs text-muted-foreground truncate">{c.label}</div>
                                <Input type="number" min={0} max={c.max} value={kyrScores[psp._id]?.[c.key] || ""}
                                  onChange={e => setKyrScores(s => ({ ...s, [psp._id]: { ...s[psp._id], [c.key]: Math.min(c.max, Number(e.target.value)) } }))}
                                  placeholder={`/${c.max}`} className="w-16 h-7 text-xs text-center bg-background/50 border-border" />
                                <span className="text-xs text-muted-foreground w-6">/{c.max}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-2">
                          <Button onClick={() => approvePSP(psp._id)} disabled={loading === psp._id}
                            className="bg-green-400 text-black hover:bg-green-400/90 font-medium px-8">
                            {loading === psp._id ? "Processing..." : "Approve PSP"}
                          </Button>
                          <Button onClick={() => rejectPSP(psp._id)} disabled={loading === psp._id} variant="outline"
                            className="border-red-400/30 text-red-400 hover:bg-red-400/10">
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* All PSPs */}
        <div>
          <div className="text-sm font-medium text-foreground mb-4">All PSPs</div>
          <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
            {allPSPs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-secondary/30">
                    <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium">Company</th>
                    <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium">Jurisdiction</th>
                    <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium">Type</th>
                    <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium">Status</th>
                    <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium">KYR</th>
                    <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium">Wallet</th>
                  </tr></thead>
                  <tbody>
                    {allPSPs.map((psp, i) => {
                      const rInfo = psp.kyrScore ? getKyrRating(psp.kyrScore.totalScore) : null;
                      return (
                        <tr key={i} className="border-b border-border/20 hover:bg-secondary/10 transition-colors">
                          <td className="px-5 py-4">
                            <div className="text-foreground font-medium">{psp.kybProfile?.companyName || "—"}</div>
                            <div className="text-xs text-muted-foreground">{psp.email}</div>
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">{psp.kybProfile?.jurisdiction || "—"}</td>
                          <td className="px-5 py-4 text-muted-foreground">{psp.kybProfile?.businessType || "—"}</td>
                          <td className="px-5 py-4">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              psp.approvalStatus === "approved" ? "bg-green-400/10 text-green-400" :
                              psp.approvalStatus === "rejected" ? "bg-red-400/10 text-red-400" :
                              "bg-yellow-400/10 text-yellow-400"
                            }`}>{psp.approvalStatus}</span>
                          </td>
                          <td className="px-5 py-4">
                            {rInfo ? <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${rInfo.bg} ${rInfo.color}`}>{psp.kyrScore.totalScore} ({rInfo.rating})</span> : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{psp.walletAddress ? `${psp.walletAddress.slice(0, 8)}...` : "Not linked"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="text-3xl mb-3">🏢</div>
                <div className="text-sm text-muted-foreground">No PSPs registered yet</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
