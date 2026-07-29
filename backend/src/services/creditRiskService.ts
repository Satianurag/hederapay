import path from "path";
import { pathToFileURL } from "url";
import { env } from "../config/env";
import { buildCreditRiskAssessment, CreditRiskAssessment } from "./creditRiskCore";

/**
 * Autonomous credit risk assessment — pays for pool health, credit score, compliance via x402.
 */
export async function assessCreditRisk(pspAddress: string): Promise<CreditRiskAssessment> {
  const buyerPath = pathToFileURL(path.resolve(__dirname, "../../lib/x402Buyer.mjs")).href;
  const { createX402Buyer } = await import(buyerPath);
  const client = await createX402Buyer();
  const dataSources: string[] = [];

  let poolHealth: {
    utilizationRate: number;
    liquidityRisk: string;
    canHandleDrawdown: boolean;
  };
  try {
    const poolRes = await client.pay(`${env.POOL_MONITOR_URL}/api/agent/pool-health`);
    poolHealth = (poolRes.data as { analysis: typeof poolHealth }).analysis;
    dataSources.push("Pool Monitor Agent ($0.003)");
  } catch {
    poolHealth = { utilizationRate: 50, liquidityRisk: "medium", canHandleDrawdown: true };
  }

  let creditScore = 60;
  let complianceStatus = "review";
  try {
    const creditRes = await client.pay(
      `${env.AGENT_DATA_SERVICE_URL}/api/agent/credit-score?pspAddress=${encodeURIComponent(pspAddress)}`
    );
    creditScore = (creditRes.data as { score: number }).score;
    dataSources.push("Credit Bureau ($0.01)");
  } catch {
    // keep defaults
  }

  try {
    const compRes = await client.pay(
      `${env.AGENT_DATA_SERVICE_URL}/api/agent/compliance-check?pspAddress=${encodeURIComponent(pspAddress)}`
    );
    complianceStatus = (compRes.data as { status: string }).status;
    dataSources.push("Compliance Screening ($0.005)");
  } catch {
    // keep defaults
  }

  return buildCreditRiskAssessment({
    pspAddress,
    creditScore,
    complianceStatus,
    poolHealth,
    dataSources,
  });
}

export { applyDrawdownRiskDecision, type CreditRiskAssessment } from "./creditRiskCore";
