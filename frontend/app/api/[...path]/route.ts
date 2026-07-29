import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getSaucerSwapRates, getSaucerSwapQuote } from "@/lib/saucerswap-server";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/hederapay";
const JWT_SECRET = process.env.JWT_SECRET || "hederapay-jwt-2026";

// MongoDB connection caching for serverless
let cached = (global as any).mongoose;
if (!cached) cached = (global as any).mongoose = { conn: null, promise: null };

async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then(m => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

// Schemas
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, lowercase: true },
  passwordHash: String,
  role: { type: String, enum: ["LP", "PSP", "ADMIN"] },
  walletAddress: String,
  approved: { type: Boolean, default: false },
  approvalStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  approvedBy: String, approvedAt: Date,
  kybProfile: mongoose.Schema.Types.Mixed,
  kyrScore: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

const poolSchema = new mongoose.Schema({
  poolContractAddress: { type: String, unique: true },
  yieldReserveAddress: String,
  drawdownLimit: String, pspRatePerDay: Number, investorAPY: Number,
  totalLiquidity: { type: String, default: "0" },
  availableLiquidity: { type: String, default: "0" },
  initialized: { type: Boolean, default: false },
}, { timestamps: true });

const depositSchema = new mongoose.Schema({
  lpAddress: String, amount: String, txHash: { type: String, unique: true },
  status: { type: String, default: "pending" }, confirmedAt: Date,
}, { timestamps: true });

const drawdownSchema = new mongoose.Schema({
  pspAddress: String, amount: String, txHash: String,
  status: { type: String, default: "pending_approval" },
  adminApprovalRequired: Boolean, adminApprovedBy: String,
  requestId: Number, riskScore: Number, riskRating: String, executedAt: Date,
}, { timestamps: true });

const repaymentSchema = new mongoose.Schema({
  pspAddress: String, amount: String, token: String, tokenSymbol: String,
  txHash: { type: String, unique: true },
  status: { type: String, default: "pending" },
  convertedUsdcAmount: String, feePortion: String, principalPortion: String, daysElapsed: Number, confirmedAt: Date,
}, { timestamps: true });

const yieldDistSchema = new mongoose.Schema({
  cycle: { type: Number, unique: true }, totalDistributed: String,
  lpPayouts: [{ address: String, amount: String }], txHash: String,
}, { timestamps: true });

const auditSchema = new mongoose.Schema({
  actor: String, action: String, details: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Pool = mongoose.models.Pool || mongoose.model("Pool", poolSchema);
const Deposit = mongoose.models.Deposit || mongoose.model("Deposit", depositSchema);
const Drawdown = mongoose.models.Drawdown || mongoose.model("Drawdown", drawdownSchema);
const Repayment = mongoose.models.Repayment || mongoose.model("Repayment", repaymentSchema);
const YieldDistribution = mongoose.models.YieldDistribution || mongoose.model("YieldDistribution", yieldDistSchema);
const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", auditSchema);

async function audit(actor: string, action: string, details: any = {}) {
  await AuditLog.create({ actor, action, details });
}

function verifyToken(req: NextRequest): any {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try { return jwt.verify(auth.split(" ")[1], JWT_SECRET) as any; } catch { return null; }
}

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

// Route handler
async function handleRequest(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const route = "/" + path.join("/");

  // Health — no DB needed
  if (route === "/health") return json({ status: "ok", timestamp: new Date().toISOString() });

  try {
    await connectDB();
  } catch (e: any) {
    return json({ error: "Database connection failed", detail: e.message }, 500);
  }

  const body = req.method !== "GET" ? await req.json().catch(() => ({})) : {};
  const user = verifyToken(req);

  // AUTH
  if (route === "/auth/register" && req.method === "POST") {
    const { email, password, role } = body;
    if (!email || !password || !role) return json({ error: "email, password, role required" }, 400);
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return json({ error: "Email already registered" }, 409);
    const passwordHash = await bcrypt.hash(password, 12);
    const u = await User.create({ email: email.toLowerCase(), passwordHash, role, approved: role !== "PSP", approvalStatus: role === "PSP" ? "pending" : "approved" });
    await audit(email, "USER_REGISTERED", { role });
    const token = jwt.sign({ userId: u._id, email: u.email, role: u.role }, JWT_SECRET, { expiresIn: "24h" } as any);
    return json({ token, user: { id: u._id, email: u.email, role: u.role, approved: u.approved, approvalStatus: u.approvalStatus } }, 201);
  }

  if (route === "/auth/login" && req.method === "POST") {
    const { email, password } = body;
    const u = await User.findOne({ email: email?.toLowerCase() });
    if (!u || !(await bcrypt.compare(password, u.passwordHash))) return json({ error: "Invalid credentials" }, 401);
    const token = jwt.sign({ userId: u._id, email: u.email, role: u.role }, JWT_SECRET, { expiresIn: "24h" } as any);
    return json({ token, user: { id: u._id, email: u.email, role: u.role, approved: u.approved, approvalStatus: u.approvalStatus, walletAddress: u.walletAddress } });
  }

  if (route === "/auth/me") {
    if (!user) return json({ error: "Not authenticated" }, 401);
    const u = await User.findById(user.userId).select("-passwordHash");
    return json({ user: u });
  }

  // PSP
  if (route === "/psp/onboard" && req.method === "POST") {
    if (!user || user.role !== "PSP") return json({ error: "Unauthorized" }, 403);
    const u = await User.findById(user.userId);
    if (u?.kybProfile) return json({ error: "KYB profile already submitted" }, 400);
    if (u) { u.kybProfile = body; await u.save(); }
    await audit(user.email, "KYB_SUBMITTED", { companyName: body.companyName });
    return json({ message: "KYB profile submitted. Pending admin approval.", approvalStatus: "pending" });
  }

  if (route === "/psp/profile") {
    if (!user || user.role !== "PSP") return json({ error: "Unauthorized" }, 403);
    const u = await User.findById(user.userId).select("-passwordHash");
    return json({ email: u?.email, walletAddress: u?.walletAddress, approved: u?.approved, approvalStatus: u?.approvalStatus, kybProfile: u?.kybProfile, kyrScore: u?.kyrScore });
  }

  if (route === "/psp/request-drawdown" && req.method === "POST") {
    if (!user || user.role !== "PSP") return json({ error: "Unauthorized" }, 403);
    const u = await User.findById(user.userId);
    if (!u?.approved) return json({ error: "PSP not approved" }, 403);
    if (!u?.walletAddress) return json({ error: "Wallet not linked" }, 400);
    const pool = await Pool.findOne({ initialized: true });
    if (!pool) return json({ error: "Pool not initialized" }, 400);
    if (BigInt(body.amount) > BigInt(pool.drawdownLimit)) return json({ error: "Exceeds drawdown limit" }, 400);
    const active = await Drawdown.findOne({ pspAddress: u.walletAddress, status: { $in: ["pending_approval", "approved", "executed", "shortfall"] } });
    if (active) return json({ error: "Active drawdown exists. Repay before requesting another." }, 400);
    const dd = await Drawdown.create({ pspAddress: u.walletAddress, amount: body.amount, status: "approved", riskScore: u.kyrScore?.totalScore, riskRating: u.kyrScore?.rating });
    await audit(user.email, "DRAWDOWN_REQUESTED", { amount: body.amount });
    return json({ drawdown: dd, sufficientLiquidity: BigInt(pool.availableLiquidity) >= BigInt(body.amount), message: "Drawdown approved." }, 201);
  }

  if (route === "/psp/position") {
    if (!user || user.role !== "PSP") return json({ error: "Unauthorized" }, 403);
    const u = await User.findById(user.userId);
    if (!u?.walletAddress) return json({ error: "Wallet not linked" }, 400);
    const drawdowns = await Drawdown.find({ pspAddress: u.walletAddress }).sort({ createdAt: -1 });
    const repayments = await Repayment.find({ pspAddress: u.walletAddress }).sort({ createdAt: -1 });
    const active = drawdowns.find(d => ["pending_approval", "approved", "executed", "shortfall"].includes(d.status));
    return json({ activeDrawdown: active || null, drawdownHistory: drawdowns, repaymentHistory: repayments });
  }

  if (route === "/psp/repay" && req.method === "POST") {
    if (!user || user.role !== "PSP") return json({ error: "Unauthorized" }, 403);
    const u = await User.findById(user.userId);
    if (!u?.walletAddress) return json({ error: "Wallet not linked" }, 400);
    const existing = await Repayment.findOne({ txHash: body.txHash });
    if (existing) return json({ error: "Transaction already recorded" }, 409);
    const active = await Drawdown.findOne({ pspAddress: u.walletAddress, status: "executed" });
    if (!active) return json({ error: "No active executed drawdown to repay" }, 400);
    const rep = await Repayment.create({ pspAddress: u.walletAddress, amount: body.amount, token: body.token, tokenSymbol: body.tokenSymbol, txHash: body.txHash });
    await audit(user.email, "REPAYMENT_RECORDED", { amount: body.amount, token: body.tokenSymbol });
    return json({ repayment: rep, message: body.tokenSymbol === "WHBAR" || body.tokenSymbol === "HBAR" ? "WHBAR repayment recorded." : `${body.tokenSymbol} repayment recorded. Hedera automation will convert via SaucerSwap.` }, 201);
  }

  // LP
  if (route === "/lp/deposit" && req.method === "POST") {
    if (!user || user.role !== "LP") return json({ error: "Unauthorized" }, 403);
    const u = await User.findById(user.userId);
    if (!u?.walletAddress) return json({ error: "Wallet not linked. Link wallet first." }, 400);
    const existing = await Deposit.findOne({ txHash: body.txHash });
    if (existing) return json({ error: "Transaction already recorded" }, 409);
    const dep = await Deposit.create({ lpAddress: u.walletAddress, amount: body.amount, txHash: body.txHash });
    await audit(user.email, "DEPOSIT_RECORDED", { amount: body.amount });
    return json({ deposit: dep }, 201);
  }

  if (route === "/lp/balance") {
    if (!user || user.role !== "LP") return json({ error: "Unauthorized" }, 403);
    const u = await User.findById(user.userId);
    if (!u?.walletAddress) return json({ error: "Wallet not linked" }, 400);
    const deposits = await Deposit.find({ lpAddress: u.walletAddress }).sort({ createdAt: -1 });
    const pool = await Pool.findOne({ initialized: true });
    return json({ walletAddress: u.walletAddress, totalDeposited: "0", investorAPY: pool?.investorAPY || 0, deposits });
  }

  if (route === "/lp/withdraw" && req.method === "POST") {
    if (!user || user.role !== "LP") return json({ error: "Unauthorized" }, 403);
    await audit(user.email, "WITHDRAWAL_RECORDED", { txHash: body.txHash });
    return json({ message: "Withdrawal recorded" });
  }

  if (route === "/lp/history") {
    if (!user || user.role !== "LP") return json({ error: "Unauthorized" }, 403);
    const u = await User.findById(user.userId);
    const deposits = await Deposit.find({ lpAddress: u?.walletAddress }).sort({ createdAt: -1 });
    return json({ deposits });
  }

  // ADMIN
  if (route === "/admin/initialize-pool" && req.method === "POST") {
    if (!user || user.role !== "ADMIN") return json({ error: "Insufficient permissions" }, 403);
    const existing = await Pool.findOne({ poolContractAddress: body.poolContractAddress });
    if (existing) return json({ error: "Pool already registered" }, 409);
    const pool = await Pool.create({ ...body, initialized: true });
    await audit(user.email, "POOL_INITIALIZED", body);
    return json({ pool }, 201);
  }

  if (route === "/admin/dashboard") {
    if (!user) return json({ error: "Not authenticated" }, 401);
    const pool = await Pool.findOne({ initialized: true });
    const [activeDrawdowns, totalPSPs, approvedPSPs, totalLPs, recentRepayments, lastYield] = await Promise.all([
      Drawdown.find({ status: { $in: ["executed", "shortfall"] } }),
      User.countDocuments({ role: "PSP" }), User.countDocuments({ role: "PSP", approved: true }),
      User.countDocuments({ role: "LP" }), Repayment.find().sort({ createdAt: -1 }).limit(10),
      YieldDistribution.findOne().sort({ cycle: -1 }),
    ]);
    return json({ pool: pool ? { address: pool.poolContractAddress, totalLiquidity: pool.totalLiquidity, availableLiquidity: pool.availableLiquidity, drawdownLimit: pool.drawdownLimit, pspRatePerDay: pool.pspRatePerDay, investorAPY: pool.investorAPY, utilizationRate: "0%" } : null, activeDrawdowns: activeDrawdowns.length, totalDrawnAmount: "0", stats: { totalPSPs, approvedPSPs, totalLPs }, recentRepayments, lastYieldCycle: lastYield });
  }

  if (route === "/admin/pending-psps") {
    if (!user || user.role !== "ADMIN") return json({ error: "Insufficient permissions" }, 403);
    const psps = await User.find({ role: "PSP", approvalStatus: "pending" }).select("-passwordHash");
    return json({ psps });
  }

  if (route === "/admin/psps") {
    if (!user || user.role !== "ADMIN") return json({ error: "Insufficient permissions" }, 403);
    const psps = await User.find({ role: "PSP" }).select("-passwordHash");
    return json({ psps });
  }

  if (route === "/admin/approve-psp" && req.method === "POST") {
    if (!user || user.role !== "ADMIN") return json({ error: "Insufficient permissions" }, 403);
    const psp = await User.findById(body.pspUserId);
    if (!psp || psp.role !== "PSP") return json({ error: "PSP not found" }, 404);
    const ks = body.kyrScore || {};
    const total = Object.values(ks).reduce((s: number, v: any) => s + (Number(v) || 0), 0) as number;
    const rating = total >= 85 ? "AAA" : total >= 70 ? "AA" : total >= 55 ? "A" : "B/C";
    psp.kyrScore = { ...ks, totalScore: total, rating };
    psp.approved = true; psp.approvalStatus = "approved"; psp.approvedBy = user.email; psp.approvedAt = new Date();
    await psp.save();
    await audit(user.email, "PSP_APPROVED", { pspEmail: psp.email, kyrTotalScore: total, kyrRating: rating });
    return json({ message: "PSP approved", psp: { id: psp._id, email: psp.email, companyName: psp.kybProfile?.companyName, kyrScore: psp.kyrScore } });
  }

  if (route === "/admin/reject-psp" && req.method === "POST") {
    if (!user || user.role !== "ADMIN") return json({ error: "Insufficient permissions" }, 403);
    const psp = await User.findById(body.pspUserId);
    if (psp) { psp.approved = false; psp.approvalStatus = "rejected"; await psp.save(); }
    await audit(user.email, "PSP_REJECTED", { reason: body.reason });
    return json({ message: "PSP rejected" });
  }

  if (route === "/admin/audit-log") {
    if (!user || user.role !== "ADMIN") return json({ error: "Insufficient permissions" }, 403);
    const page = Number(new URL(req.url).searchParams.get("page")) || 1;
    const limit = Number(new URL(req.url).searchParams.get("limit")) || 50;
    const [logs, total] = await Promise.all([AuditLog.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), AuditLog.countDocuments()]);
    return json({ logs, total, page, pages: Math.ceil(total / limit) });
  }

  // YIELD
  if (route === "/yield/status") {
    if (!user) return json({ error: "Not authenticated" }, 401);
    const pool = await Pool.findOne({ initialized: true });
    const last = await YieldDistribution.findOne().sort({ cycle: -1 });
    return json({ investorAPY: pool?.investorAPY || 0, lastCycle: last ? { cycle: last.cycle, totalDistributed: last.totalDistributed, date: last.createdAt } : null, nextCycleDate: last ? new Date(last.createdAt.getTime() + 7 * 86400000) : null, allTimeDistributed: "0" });
  }

  if (route === "/yield/trigger-distribution" && req.method === "POST") {
    if (!user || user.role !== "ADMIN") return json({ error: "Insufficient permissions" }, 403);
    const last = await YieldDistribution.findOne().sort({ cycle: -1 });
    const cycle = (last?.cycle || 0) + 1;
    const total = body.lpPayouts?.reduce((s: bigint, p: any) => s + BigInt(p.amount), 0n) || 0n;
    const dist = await YieldDistribution.create({ cycle, totalDistributed: total.toString(), lpPayouts: body.lpPayouts, txHash: body.txHash });
    await audit(user.email, "YIELD_DISTRIBUTED", { cycle });
    return json({ distribution: dist }, 201);
  }

  if (route === "/yield/history") {
    if (!user) return json({ error: "Not authenticated" }, 401);
    const distributions = await YieldDistribution.find().sort({ cycle: -1 });
    return json({ distributions });
  }

  // SaucerSwap V2 (Hedera)
  if (route === "/saucerswap/rates") {
    if (!user) return json({ error: "Not authenticated" }, 401);
    try {
      const data = await getSaucerSwapRates();
      return json(data);
    } catch (err: any) {
      return json({ rates: {}, source: "SaucerSwap V2 QuoterV2", error: err.message || "Failed" });
    }
  }

  if (route === "/saucerswap/quote" && req.method === "POST") {
    if (!user) return json({ error: "Not authenticated" }, 401);
    try {
      const data = await getSaucerSwapQuote(body.tokenIn, body.tokenOut || "WHBAR", body.amount);
      return json(data);
    } catch (err: any) {
      return json({ error: err.message || "Quote failed" }, 400);
    }
  }

  return json({ error: "Not found" }, 404);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) { return handleRequest(req, ctx); }
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) { return handleRequest(req, ctx); }
