#!/usr/bin/env -S npx tsx
/**
 * Verify credit risk → drawdown decision wiring (Phase 5).
 */
import { buildCreditRiskAssessment, applyDrawdownRiskDecision } from "../src/services/creditRiskCore.js";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const high = buildCreditRiskAssessment({
  pspAddress: "0xabc",
  creditScore: 90,
  complianceStatus: "pass",
  poolHealth: { utilizationRate: 40, liquidityRisk: "low", canHandleDrawdown: true },
  dataSources: ["test"],
});

assert(high.recommendation === "approve", "high score should approve");

const low = buildCreditRiskAssessment({
  pspAddress: "0xabc",
  creditScore: 40,
  complianceStatus: "fail",
  poolHealth: { utilizationRate: 90, liquidityRisk: "high", canHandleDrawdown: false },
  dataSources: ["test"],
});

assert(low.recommendation === "decline", "low score + fail should decline");

const decision = applyDrawdownRiskDecision("15000000000", "20000000000", {
  ...high,
  recommendation: "reduced_limit",
  overallRiskScore: 60,
  overallRating: "A",
});

assert(decision.status === "approved", "reduced_limit should approve");
assert(BigInt(decision.amount) === 10000000000n, "reduced_limit should cap at 50% of pool limit");

console.log("PASS: credit risk drawdown wiring");
console.log("  approve:", high.overallRating, high.overallRiskScore);
console.log("  decline:", low.overallRating, low.recommendation);
console.log("  reduced amount:", decision.amount);
