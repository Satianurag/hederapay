"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function PSPRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (!companyName || !country || !businessType) {
      setError("Please fill in all company details");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role: "PSP" }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Store company info for onboarding pre-fill
      localStorage.setItem("psp_prefill", JSON.stringify({ companyName, country, businessType }));

      router.push("/psp/onboard");
    } catch {
      setError("Network error. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-semibold tracking-tight"><span className="text-foreground">Pay</span><span className="text-blue-400">Mate</span></Link>
          <p className="text-sm text-muted-foreground mt-2">Apply for a USDC liquidity line</p>
        </div>

        {/* Value prop */}
        <div className="mb-6 rounded-lg border border-blue-400/20 bg-blue-400/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-400/10 text-blue-400 text-sm font-semibold">
              T+0
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">Instant Settlement Liquidity</div>
              <div className="text-xs text-muted-foreground">Up to $50K USDC · Repay in any stablecoin</div>
            </div>
          </div>
        </div>

        <Card className="border-border/50 bg-card">
          <CardContent className="pt-6">
            {error && (
              <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1 mb-5">
                <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Company Details</div>
                <div className="h-px bg-border/50" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company" className="text-sm text-muted-foreground">Company Name</Label>
                <Input
                  id="company"
                  type="text"
                  placeholder="A-Express Remit Pte. Ltd."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  className="bg-background border-border"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="country" className="text-sm text-muted-foreground">Country of Operation</Label>
                  <Input
                    id="country"
                    type="text"
                    placeholder="Singapore"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    required
                    className="bg-background border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type" className="text-sm text-muted-foreground">Business Type</Label>
                  <select
                    id="type"
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    required
                    className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="" className="bg-card">Select type</option>
                    <option value="RSP" className="bg-card">RSP (Remittance)</option>
                    <option value="PSP" className="bg-card">PSP (Payments)</option>
                    <option value="OTC" className="bg-card">OTC Desk</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1 mb-5 mt-6">
                <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Account</div>
                <div className="h-px bg-border/50" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-muted-foreground">Business Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="treasury@aexpress.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-background border-border"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm text-muted-foreground">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Min 6 chars"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-background border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm" className="text-sm text-muted-foreground">Confirm</Label>
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="Repeat"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="bg-background border-border"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-400 font-medium text-white hover:bg-blue-400/90 mt-2"
              >
                {loading ? "Creating account..." : "Apply for Liquidity"}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                After registration, you&apos;ll complete KYB verification. Your application will be reviewed by our team.
              </p>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/auth" className="text-blue-400 hover:underline">Sign in</Link>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link href="/" className="text-blue-400 hover:underline">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
