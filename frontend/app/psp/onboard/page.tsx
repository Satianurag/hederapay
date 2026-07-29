"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

const steps = [
  { id: 1, title: "Company", icon: "🏢", heading: "Tell us about your company", desc: "Basic registration and incorporation details" },
  { id: 2, title: "License", icon: "📄", heading: "Your regulatory license", desc: "We need your payment license details" },
  { id: 3, title: "Operations", icon: "🌐", heading: "How you operate", desc: "Transaction volumes, corridors, and settlement" },
  { id: 4, title: "Financials", icon: "📊", heading: "Financial overview", desc: "Revenue, equity, and banking relationships" },
  { id: 5, title: "Compliance", icon: "🛡", heading: "Compliance & AML", desc: "Your compliance posture and screening" },
  { id: 6, title: "Documents", icon: "📁", heading: "Upload documents", desc: "Supporting documentation for review" },
  { id: 7, title: "Review", icon: "✓", heading: "Review & submit", desc: "Verify your details before submitting" },
];

// Defined outside component to prevent re-render focus loss
function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-6">
      <div className="text-xs font-medium uppercase tracking-widest text-blue-400 mb-5">{title}</div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, placeholder, value, onChange, type = "text" }: any) {
  return (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input type={type} value={value} onChange={(e: any) => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder} className="bg-background/50 border-border" />
    </div>
  );
}

function TagInputField({ label, placeholder, tags, input, setInput, onAdd, onRemove }: any) {
  return (
    <div className="space-y-2">
      <label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</label>
      <div className="flex gap-2">
        <Input value={input} onChange={(e: any) => setInput(e.target.value)} placeholder={placeholder}
          onKeyDown={(e: any) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }}
          className="bg-background/50 border-border" />
        <Button type="button" size="sm" variant="outline" onClick={onAdd} className="text-blue-400 border-blue-400/30 text-xs shrink-0">+ Add</Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {tags.map((t: string, i: number) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-blue-400/10 border border-blue-400/20 px-3 py-1 text-xs text-blue-400">
              {t}<button onClick={() => onRemove(i)} className="hover:text-white ml-0.5">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PSPOnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    companyName: "", registrationNumber: "", jurisdiction: "", dateOfIncorporation: "", yearsInOperation: 0, businessType: "RSP",
    licenseType: "", licenseNumber: "", issuingAuthority: "",
    monthlyTransactionVolume: 0, primaryCorridors: [] as string[], settlementPartners: [] as string[], settlementCycle: "T+0",
    annualRevenue: 0, netIncome: 0, totalEquity: 0, debtRatio: 0, bankRelationships: [] as string[],
    amlPolicyInPlace: true, sanctionsScreeningProvider: "", lastRegulatoryAuditDate: "", enforcementActions: false,
    documents: {} as Record<string, string>,
  });

  const [corridorInput, setCorridorInput] = useState("");
  const [partnerInput, setPartnerInput] = useState("");
  const [bankInput, setBankInput] = useState("");

  useEffect(() => {
    try {
      const prefill = localStorage.getItem("psp_prefill");
      if (prefill) {
        const { companyName, country, businessType } = JSON.parse(prefill);
        setForm(f => ({ ...f, companyName: companyName || f.companyName, jurisdiction: country || f.jurisdiction, businessType: businessType || f.businessType }));
      }
    } catch {}
  }, []);

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));
  const addTag = (key: string, input: string, setInput: (s: string) => void) => {
    if (input.trim()) { setForm(f => ({ ...f, [key]: [...(f as any)[key], input.trim()] })); setInput(""); }
  };
  const removeTag = (key: string, idx: number) => {
    setForm(f => ({ ...f, [key]: (f as any)[key].filter((_: any, i: number) => i !== idx) }));
  };

  async function handleSubmit() {
    setError(""); setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/psp/onboard`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Submission failed"); return; }
      router.push("/psp/pending");
    } catch { setError("Network error"); } finally { setLoading(false); }
  }

  const currentStep = steps[step - 1];
  const progressPct = Math.round((step / 7) * 100);

  // Components are defined outside — see top of file

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-lg font-semibold tracking-tight"><span className="text-foreground">Pay</span><span className="text-blue-400">Mate</span></Link>
            <span className="text-muted-foreground">·</span>
            <span className="text-sm text-muted-foreground">PSP Application</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Step {step} of 7</span>
            <div className="hidden sm:flex items-center gap-1 bg-secondary rounded-full px-3 py-1">
              <span className="text-xs font-medium text-blue-400">{progressPct}%</span>
              <span className="text-xs text-muted-foreground">complete</span>
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 bg-secondary">
          <div className="h-full bg-blue-400 transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Step pills */}
      <div className="mx-auto max-w-5xl px-6 pt-8">
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
          {steps.map(s => (
            <button key={s.id} onClick={() => s.id <= step && setStep(s.id)}
              className={`flex items-center gap-2 shrink-0 rounded-full px-4 py-2 text-sm transition-all ${
                s.id === step ? "bg-blue-400/15 text-blue-400 border border-blue-400/30"
                : s.id < step ? "bg-secondary/80 text-foreground border border-transparent"
                : "bg-transparent text-muted-foreground/50 border border-transparent"
              }`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium ${
                s.id === step ? "bg-blue-400 text-white" : s.id < step ? "bg-blue-400/30 text-blue-400" : "bg-secondary text-muted-foreground/50"
              }`}>
                {s.id < step ? "✓" : s.id}
              </span>
              <span className="hidden sm:inline">{s.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left — heading + context */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-32">
              <div className="text-4xl mb-3">{currentStep.icon}</div>
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">{currentStep.heading}</h1>
              <p className="text-sm text-muted-foreground mt-2">{currentStep.desc}</p>

              {form.companyName && step > 1 && (
                <div className="mt-6 rounded-lg bg-card/50 border border-border/50 p-4">
                  <div className="text-xs text-muted-foreground">Applicant</div>
                  <div className="text-sm text-foreground font-medium mt-1">{form.companyName}</div>
                  {form.jurisdiction && <div className="text-xs text-muted-foreground mt-0.5">{form.jurisdiction} · {form.businessType}</div>}
                </div>
              )}

              {step === 7 && (
                <div className="mt-6 rounded-lg bg-blue-400/5 border border-blue-400/20 p-4">
                  <div className="text-xs text-blue-400 font-medium">Ready to submit</div>
                  <div className="text-xs text-muted-foreground mt-1">Your application will be reviewed by our team within 24-48 hours.</div>
                </div>
              )}
            </div>
          </div>

          {/* Right — form */}
          <div className="lg:col-span-2 space-y-6">
            {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}

            {step === 1 && <>
              <FieldGroup title="Identification">
                <Field label="Company Name" placeholder="A-Express Remit Pte. Ltd." value={form.companyName} onChange={(v: any) => set("companyName", v)} />
                <Field label="Registration Number" placeholder="SG-202012345A" value={form.registrationNumber} onChange={(v: any) => set("registrationNumber", v)} />
              </FieldGroup>
              <FieldGroup title="Incorporation">
                <div className="grid sm:grid-cols-2 gap-5">
                  <Field label="Jurisdiction / Country" placeholder="Singapore" value={form.jurisdiction} onChange={(v: any) => set("jurisdiction", v)} />
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Business Type</label>
                    <select value={form.businessType} onChange={e => set("businessType", e.target.value)}
                      className="flex h-9 w-full rounded-md border border-border bg-background/50 px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-400">
                      <option value="RSP" className="bg-card">RSP (Remittance)</option>
                      <option value="PSP" className="bg-card">PSP (Payments)</option>
                      <option value="OTC" className="bg-card">OTC Desk</option>
                    </select>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-5">
                  <Field label="Date of Incorporation" placeholder="2018-01-15" value={form.dateOfIncorporation} onChange={(v: any) => set("dateOfIncorporation", v)} />
                  <Field label="Years in Operation" placeholder="8" value={form.yearsInOperation} onChange={(v: any) => set("yearsInOperation", v)} type="number" />
                </div>
              </FieldGroup>
            </>}

            {step === 2 && <FieldGroup title="Regulatory License">
              <Field label="License Type" placeholder="Major Payment Institution" value={form.licenseType} onChange={(v: any) => set("licenseType", v)} />
              <Field label="License Number" placeholder="MPI-2018-001" value={form.licenseNumber} onChange={(v: any) => set("licenseNumber", v)} />
              <Field label="Issuing Authority" placeholder="Monetary Authority of Singapore" value={form.issuingAuthority} onChange={(v: any) => set("issuingAuthority", v)} />
            </FieldGroup>}

            {step === 3 && <>
              <FieldGroup title="Volume & Corridors">
                <Field label="Monthly Transaction Volume (USD)" placeholder="50000000" value={form.monthlyTransactionVolume} onChange={(v: any) => set("monthlyTransactionVolume", v)} type="number" />
                <TagInputField label="Primary Corridors" placeholder="e.g. UAE-India" tags={form.primaryCorridors} input={corridorInput} setInput={setCorridorInput} onAdd={() => addTag("primaryCorridors", corridorInput, setCorridorInput)} onRemove={(i: number) => removeTag("primaryCorridors", i)} />
              </FieldGroup>
              <FieldGroup title="Settlement">
                <TagInputField label="Settlement Partners" placeholder="e.g. DBS Bank" tags={form.settlementPartners} input={partnerInput} setInput={setPartnerInput} onAdd={() => addTag("settlementPartners", partnerInput, setPartnerInput)} onRemove={(i: number) => removeTag("settlementPartners", i)} />
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Settlement Cycle</label>
                  <div className="flex gap-2">
                    {["T+0", "T+1", "T+2"].map(c => (
                      <button key={c} type="button" onClick={() => set("settlementCycle", c)}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          form.settlementCycle === c ? "bg-blue-400 text-white shadow-lg shadow-blue-400/20" : "bg-secondary text-muted-foreground hover:text-foreground"
                        }`}>{c}</button>
                    ))}
                  </div>
                </div>
              </FieldGroup>
            </>}

            {step === 4 && <>
              <FieldGroup title="Revenue & Income">
                <div className="grid sm:grid-cols-2 gap-5">
                  <Field label="Annual Revenue (USD)" placeholder="12000000" value={form.annualRevenue} onChange={(v: any) => set("annualRevenue", v)} type="number" />
                  <Field label="Net Income (USD)" placeholder="2000000" value={form.netIncome} onChange={(v: any) => set("netIncome", v)} type="number" />
                </div>
              </FieldGroup>
              <FieldGroup title="Balance Sheet">
                <div className="grid sm:grid-cols-2 gap-5">
                  <Field label="Total Equity (USD)" placeholder="5000000" value={form.totalEquity} onChange={(v: any) => set("totalEquity", v)} type="number" />
                  <Field label="Debt Ratio" placeholder="0.3" value={form.debtRatio} onChange={(v: any) => set("debtRatio", v)} type="number" />
                </div>
              </FieldGroup>
              <FieldGroup title="Banking">
                <TagInputField label="Bank Relationships" placeholder="e.g. DBS" tags={form.bankRelationships} input={bankInput} setInput={setBankInput} onAdd={() => addTag("bankRelationships", bankInput, setBankInput)} onRemove={(i: number) => removeTag("bankRelationships", i)} />
              </FieldGroup>
            </>}

            {step === 5 && <FieldGroup title="Compliance Posture">
              <div className="flex items-center justify-between py-3 rounded-lg bg-background/50 px-4">
                <div><div className="text-sm text-foreground">AML/CFT Policy in Place</div><div className="text-xs text-muted-foreground">Active anti-money laundering policy</div></div>
                <button onClick={() => set("amlPolicyInPlace", !form.amlPolicyInPlace)}
                  className={`w-11 h-6 rounded-full transition-colors ${form.amlPolicyInPlace ? "bg-blue-400" : "bg-secondary"}`}>
                  <span className={`block w-4 h-4 rounded-full bg-white transition-transform mx-1 ${form.amlPolicyInPlace ? "translate-x-5" : ""}`} />
                </button>
              </div>
              <Field label="Sanctions Screening Provider" placeholder="ComplyAdvantage" value={form.sanctionsScreeningProvider} onChange={(v: any) => set("sanctionsScreeningProvider", v)} />
              <Field label="Last Regulatory Audit Date" placeholder="2025-11-01" value={form.lastRegulatoryAuditDate} onChange={(v: any) => set("lastRegulatoryAuditDate", v)} />
              <div className="flex items-center justify-between py-3 rounded-lg bg-background/50 px-4">
                <div><div className="text-sm text-foreground">Enforcement Actions</div><div className="text-xs text-muted-foreground">Any regulatory enforcement history</div></div>
                <button onClick={() => set("enforcementActions", !form.enforcementActions)}
                  className={`w-11 h-6 rounded-full transition-colors ${form.enforcementActions ? "bg-red-400" : "bg-secondary"}`}>
                  <span className={`block w-4 h-4 rounded-full bg-white transition-transform mx-1 ${form.enforcementActions ? "translate-x-5" : ""}`} />
                </button>
              </div>
            </FieldGroup>}

            {step === 6 && <FieldGroup title="Required Documents">
              <div className="grid sm:grid-cols-2 gap-4">
                {["Registration Docs", "License Copy", "Audited Financials"].map(doc => (
                  <button key={doc} onClick={() => set("documents", { ...form.documents, [doc]: `${doc.toLowerCase().replace(/ /g, "_")}.pdf` })}
                    className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all ${
                      form.documents[doc] ? "border-blue-400/40 bg-blue-400/5" : "border-border/50 bg-card/30 hover:border-border hover:bg-card/50"
                    }`}>
                    <span className="text-2xl mb-2">{form.documents[doc] ? "✓" : "📎"}</span>
                    <span className={`text-sm font-medium ${form.documents[doc] ? "text-blue-400" : "text-foreground"}`}>{doc}</span>
                    <span className="text-xs text-muted-foreground mt-1">{form.documents[doc] ? "Uploaded" : "Click to upload"}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center">Additional documents can be submitted after approval.</p>
            </FieldGroup>}

            {step === 7 && <>
              {[
                { title: "Company", icon: "🏢", items: [form.companyName, `${form.jurisdiction} · ${form.businessType}`, `Incorporated ${form.dateOfIncorporation} · ${form.yearsInOperation} years`] },
                { title: "License", icon: "📄", items: [`${form.licenseType} — ${form.licenseNumber}`, `Issued by ${form.issuingAuthority}`] },
                { title: "Operations", icon: "🌐", items: [`$${(form.monthlyTransactionVolume / 1e6).toFixed(0)}M monthly volume · ${form.settlementCycle}`, `${form.primaryCorridors.length} corridors · ${form.settlementPartners.length} partners`] },
                { title: "Financials", icon: "📊", items: [`$${(form.annualRevenue / 1e6).toFixed(0)}M revenue · $${(form.netIncome / 1e6).toFixed(0)}M net income`, `${form.debtRatio} debt ratio · ${form.bankRelationships.length} bank relationships`] },
                { title: "Compliance", icon: "🛡", items: [`AML Policy: ${form.amlPolicyInPlace ? "Yes" : "No"} · Screening: ${form.sanctionsScreeningProvider || "N/A"}`, `Enforcement: ${form.enforcementActions ? "Yes" : "None"}`] },
                { title: "Documents", icon: "📁", items: [`${Object.keys(form.documents).length} of 3 uploaded`] },
              ].map(section => (
                <div key={section.title} className="rounded-xl border border-border/50 bg-card/50 p-5 flex gap-4">
                  <span className="text-2xl">{section.icon}</span>
                  <div>
                    <div className="text-xs font-medium uppercase tracking-widest text-blue-400 mb-1">{section.title}</div>
                    {section.items.filter(i => i && !i.includes("undefined")).map((item, i) => (
                      <div key={i} className="text-sm text-foreground">{item}</div>
                    ))}
                  </div>
                </div>
              ))}
            </>}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
              {step > 1 ? (
                <Button variant="ghost" onClick={() => setStep(s => s - 1)} className="text-muted-foreground hover:text-foreground">← Back</Button>
              ) : <div />}
              {step < 7 ? (
                <Button onClick={() => setStep(s => s + 1)} className="bg-blue-400 text-white hover:bg-blue-400/90 rounded-lg px-8">Continue →</Button>
              ) : (
                <Button onClick={handleSubmit} disabled={loading} className="bg-blue-400 text-white hover:bg-blue-400/90 rounded-lg px-10">
                  {loading ? "Submitting..." : "Submit Application →"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
