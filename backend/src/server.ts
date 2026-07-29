import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { connectDB } from "./config/db";
import authRoutes from "./routes/auth";
import pspRoutes from "./routes/psp";
import adminRoutes from "./routes/admin";
import lpRoutes from "./routes/lp";
import yieldRoutes from "./routes/yield";
import saucerswapRoutes from "./routes/saucerswap";
import oracleRoutes from "./routes/oracle";
import { startEventListener } from "./services/eventListener";
import { startYieldScheduler } from "./services/yieldScheduler";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/psp", pspRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/lp", lpRoutes);
app.use("/api/yield", yieldRoutes);
app.use("/api/saucerswap", saucerswapRoutes);
app.use("/api/oracle", oracleRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

async function start() {
  await connectDB();
  app.listen(env.PORT, "0.0.0.0", () => {
    console.log(`HederaPay backend running on port ${env.PORT}`);
  });

  // Start background services
  startEventListener();
  startYieldScheduler();
}

start().catch(console.error);

export default app;
