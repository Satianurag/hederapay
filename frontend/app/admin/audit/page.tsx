"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

const ACTION_COLORS: Record<string, string> = {
  USER_REGISTERED: "bg-blue-400/10 text-blue-400",
  KYB_SUBMITTED: "bg-purple-400/10 text-purple-400",
  PSP_APPROVED: "bg-green-400/10 text-green-400",
  PSP_REJECTED: "bg-red-400/10 text-red-400",
  POOL_INITIALIZED: "bg-purple-400/10 text-purple-400",
  DEPOSIT_RECORDED: "bg-green-400/10 text-green-400",
  WITHDRAWAL_RECORDED: "bg-yellow-400/10 text-yellow-400",
  DRAWDOWN_REQUESTED: "bg-blue-400/10 text-blue-400",
  REPAYMENT_RECORDED: "bg-green-400/10 text-green-400",
  YIELD_DISTRIBUTED: "bg-green-400/10 text-green-400",
};

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

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` };

  useEffect(() => {
    fetch(`${API_URL}/admin/audit-log?page=${page}&limit=20`, { headers })
      .then(r => r.json()).then(d => { setLogs(d.logs || []); setTotal(d.total || 0); }).catch(() => {});
  }, [page]);

  const filteredLogs = filter === "ALL" ? logs : logs.filter(l => l.action === filter);
  const uniqueActions = [...new Set(logs.map(l => l.action))];

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
            <Link href="/admin/psps" className="text-xs text-muted-foreground hover:text-foreground">PSP Management</Link>
            <Link href="/admin/audit" className="text-xs text-purple-400">Audit Log</Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl w-full px-6 py-8 flex-1">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Audit Log</h1>
            <p className="text-sm text-muted-foreground mt-1">{total} total entries — immutable activity trail</p>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button onClick={() => setFilter("ALL")}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              filter === "ALL" ? "bg-purple-400/10 text-purple-400 border border-purple-400/30" : "text-muted-foreground hover:text-foreground"
            }`}>All</button>
          {uniqueActions.map(a => (
            <button key={a} onClick={() => setFilter(a)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                filter === a ? "bg-purple-400/10 text-purple-400 border border-purple-400/30" : "text-muted-foreground hover:text-foreground"
              }`}>{a.replace(/_/g, " ")}</button>
          ))}
        </div>

        {/* Log entries */}
        <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
          {filteredLogs.length > 0 ? (
            <div className="divide-y divide-border/20">
              {filteredLogs.map((log, i) => (
                <div key={i}>
                  <button onClick={() => setExpandedId(expandedId === log._id ? null : log._id)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-secondary/10 transition-colors text-left">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-medium ${ACTION_COLORS[log.action] || "bg-secondary text-muted-foreground"}`}>
                      {log.action.slice(0, 2)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground">{log.action.replace(/_/g, " ")}</div>
                      <div className="text-xs text-muted-foreground truncate">{log.actor}</div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">{new Date(log.createdAt).toLocaleString()}</div>
                    <span className="text-xs text-muted-foreground">{expandedId === log._id ? "▲" : "▼"}</span>
                  </button>
                  {expandedId === log._id && log.details && (
                    <div className="px-5 pb-4 pl-[4.5rem]">
                      <pre className="text-xs text-muted-foreground bg-secondary/30 rounded-lg p-3 overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="text-3xl mb-3">📋</div>
              <div className="text-sm text-muted-foreground">No logs found</div>
            </div>
          )}
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="border-border text-muted-foreground">← Previous</Button>
            <span className="text-xs text-muted-foreground">Page {page} of {Math.ceil(total / 20)}</span>
            <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}
              className="border-border text-muted-foreground">Next →</Button>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
