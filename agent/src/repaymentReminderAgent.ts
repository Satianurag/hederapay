import { config, createAgentClient } from "./agentClient.js";

/**
 * Repayment Reminder Agent
 *
 * Triggered by the yield scheduler when a PSP's drawdown approaches
 * the repayment window (e.g. day 25 of 30).
 *
 * Autonomously buys data from 2 sources via nanopayments:
 *   1. Pool Monitor Agent → pool health context ($0.003)
 *   2. Data Service → compliance re-check ($0.005)
 *
 * Produces an urgency assessment that determines reminder priority.
 * Total cost per check: $0.008
 */

export interface RepaymentUrgency {
  pspAddress: string;
  drawdownAmount: string;
  daysElapsed: number;
  daysRemaining: number;
  complianceStatus: string;
  poolUrgency: string; // "normal" | "elevated" | "critical"
  overallUrgency: string; // "low" | "medium" | "high" | "critical"
  action: string; // "monitor" | "send_reminder" | "escalate_admin"
  totalCost: string;
  dataSources: string[];
  timestamp: string;
}

export async function checkRepaymentUrgency(
  pspAddress: string,
  drawdownAmount: string,
  drawdownTimestamp: number, // unix seconds
  repaymentWindowDays: number // e.g. 30
): Promise<RepaymentUrgency> {
  const client = await createAgentClient();
  const dataSources: string[] = [];

  const now = Math.floor(Date.now() / 1000);
  const daysElapsed = Math.floor((now - drawdownTimestamp) / (24 * 60 * 60));
  const daysRemaining = repaymentWindowDays - daysElapsed;

  console.log(`[repayment-reminder] PSP: ${pspAddress} | Days: ${daysElapsed}/${repaymentWindowDays} | Remaining: ${daysRemaining}`);

  // Step 1: Buy pool health from Pool Monitor Agent ($0.003)
  console.log("[repayment-reminder] Step 1: Paying Pool Monitor $0.003 for pool context...");
  let poolHealth: any;
  try {
    const poolRes = await client.pay(`${config.POOL_MONITOR_URL}/api/agent/pool-health`);
    poolHealth = (poolRes.data as any).analysis;
    dataSources.push("Pool Monitor Agent ($0.003)");
  } catch (err: any) {
    console.log("[repayment-reminder] Pool Monitor unavailable:", err.message);
    poolHealth = { utilizationRate: 50, liquidityRisk: "medium", reserveHealth: "healthy" };
  }

  // Step 2: Compliance re-check from Data Service ($0.005)
  console.log("[repayment-reminder] Step 2: Paying Data Service $0.005 for compliance re-check...");
  let complianceData: any;
  try {
    const compRes = await client.pay(
      `${config.DATA_SERVICE_URL}/api/agent/compliance-check?pspAddress=${pspAddress}`
    );
    complianceData = compRes.data as any;
    dataSources.push("Compliance Screening ($0.005)");
  } catch (err: any) {
    console.log("[repayment-reminder] Compliance service unavailable:", err.message);
    complianceData = { status: "pass" };
  }

  // Determine pool urgency: if pool is stressed, repayment is more critical
  let poolUrgency: string;
  if (poolHealth.utilizationRate > 80 || poolHealth.reserveHealth === "critical") {
    poolUrgency = "critical";
  } else if (poolHealth.utilizationRate > 60 || poolHealth.reserveHealth === "low") {
    poolUrgency = "elevated";
  } else {
    poolUrgency = "normal";
  }

  // Determine overall urgency
  let overallUrgency: string;
  let action: string;

  if (daysRemaining <= 0) {
    // Overdue
    overallUrgency = "critical";
    action = "escalate_admin";
  } else if (daysRemaining <= 3 || complianceData.status === "fail") {
    overallUrgency = "high";
    action = "escalate_admin";
  } else if (daysRemaining <= 7 || poolUrgency === "critical") {
    overallUrgency = "medium";
    action = "send_reminder";
  } else {
    overallUrgency = "low";
    action = "monitor";
  }

  // If pool is stressed and repayment is approaching, escalate
  if (poolUrgency === "critical" && daysRemaining <= 7) {
    overallUrgency = "critical";
    action = "escalate_admin";
  }

  const result: RepaymentUrgency = {
    pspAddress,
    drawdownAmount,
    daysElapsed,
    daysRemaining,
    complianceStatus: complianceData.status,
    poolUrgency,
    overallUrgency,
    action,
    totalCost: "$0.008",
    dataSources,
    timestamp: new Date().toISOString(),
  };

  console.log(`[repayment-reminder] Urgency: ${overallUrgency} → ${action}`);
  return result;
}

// Run standalone for testing
async function main() {
  const testAddress = process.argv[2] || "0xTestPSP123";
  const testAmount = "10000000000"; // 10K USDC
  const testTimestamp = Math.floor(Date.now() / 1000) - 25 * 24 * 60 * 60; // 25 days ago

  console.log(`\nChecking repayment urgency for: ${testAddress}\n`);

  const result = await checkRepaymentUrgency(testAddress, testAmount, testTimestamp, 30);
  console.log("\nFull Assessment:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
