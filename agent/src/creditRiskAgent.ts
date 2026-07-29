import { config, createAgentClient } from "./agentClient.js";

/**
 * Credit Risk Agent — standalone x402 assessment runner.
 * Scoring rules mirror backend/src/services/creditRiskCore.ts (drawdown flow).
 */

export interface CreditRiskAssessment {
  pspAddress: string;
  creditScore: number;
  complianceStatus: string;
  poolHealthContext: {
    utilizationRate: number;
    liquidityRisk: string;
    canHandleDrawdown: boolean;
  };
  overallRiskScore: number;
  overallRating: string;
  recommendation: "approve" | "reduced_limit" | "manual_review" | "decline";
  totalCost: string;
  dataSources: string[];
  timestamp: string;
}

function buildAssessment(
  pspAddress: string,
  creditScore: number,
  complianceStatus: string,
  poolHealth: { utilizationRate: number; liquidityRisk: string; canHandleDrawdown: boolean },
  dataSources: string[]
): CreditRiskAssessment {
  let overallScore = creditScore;
  if (complianceStatus === "fail") overallScore -= 30;
  else if (complianceStatus === "review") overallScore -= 10;
  if (poolHealth.liquidityRisk === "high") overallScore -= 5;
  if (!poolHealth.canHandleDrawdown) overallScore -= 15;
  overallScore = Math.max(0, Math.min(100, overallScore));

  let rating: string;
  let recommendation: CreditRiskAssessment["recommendation"];
  if (overallScore >= 85) {
    rating = "AAA";
    recommendation = "approve";
  } else if (overallScore >= 70) {
    rating = "AA";
    recommendation = "approve";
  } else if (overallScore >= 55) {
    rating = "A";
    recommendation = "reduced_limit";
  } else {
    rating = "B/C";
    recommendation = complianceStatus === "fail" ? "decline" : "manual_review";
  }

  return {
    pspAddress,
    creditScore,
    complianceStatus,
    poolHealthContext: poolHealth,
    overallRiskScore: overallScore,
    overallRating: rating,
    recommendation,
    totalCost: "$0.018",
    dataSources,
    timestamp: new Date().toISOString(),
  };
}

export async function assessCreditRisk(pspAddress: string): Promise<CreditRiskAssessment> {
  const client = await createAgentClient();
  const dataSources: string[] = [];

  console.log("[credit-risk] Step 1: Paying Pool Monitor $0.003 for pool health...");
  let poolHealth = { utilizationRate: 50, liquidityRisk: "medium", canHandleDrawdown: true };
  try {
    const poolRes = await client.pay(`${config.POOL_MONITOR_URL}/api/agent/pool-health`);
    poolHealth = (poolRes.data as any).analysis;
    if (poolRes.settlement?.hashscanUrl) {
      console.log(`[credit-risk] Pool Monitor tx: ${poolRes.settlement.hashscanUrl}`);
    }
    dataSources.push("Pool Monitor Agent ($0.003)");
  } catch (err: any) {
    console.log("[credit-risk] Pool Monitor unavailable:", err.message);
  }

  console.log("[credit-risk] Step 2: Paying Data Service $0.01 for credit score...");
  let creditScore = 60;
  try {
    const creditRes = await client.pay(
      `${config.DATA_SERVICE_URL}/api/agent/credit-score?pspAddress=${pspAddress}`
    );
    creditScore = (creditRes.data as any).score;
    dataSources.push("Credit Bureau ($0.01)");
  } catch (err: any) {
    console.log("[credit-risk] Credit service unavailable:", err.message);
  }

  console.log("[credit-risk] Step 3: Paying Data Service $0.005 for compliance check...");
  let complianceStatus = "review";
  try {
    const compRes = await client.pay(
      `${config.DATA_SERVICE_URL}/api/agent/compliance-check?pspAddress=${pspAddress}`
    );
    complianceStatus = (compRes.data as any).status;
    dataSources.push("Compliance Screening ($0.005)");
  } catch (err: any) {
    console.log("[credit-risk] Compliance service unavailable:", err.message);
  }

  const assessment = buildAssessment(pspAddress, creditScore, complianceStatus, poolHealth, dataSources);
  console.log(
    `[credit-risk] Assessment complete: ${assessment.overallRiskScore}/100 (${assessment.overallRating}) → ${assessment.recommendation}`
  );
  return assessment;
}

async function main() {
  const testAddress = process.argv[2] || "0xTestPSP123";
  const result = await assessCreditRisk(testAddress);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
