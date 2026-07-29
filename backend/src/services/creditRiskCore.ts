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

export interface CreditRiskInputs {
  pspAddress: string;
  creditScore: number;
  complianceStatus: string;
  poolHealth: {
    utilizationRate: number;
    liquidityRisk: string;
    canHandleDrawdown: boolean;
  };
  dataSources: string[];
}

export function buildCreditRiskAssessment(input: CreditRiskInputs): CreditRiskAssessment {
  let overallScore = input.creditScore;

  if (input.complianceStatus === "fail") overallScore -= 30;
  else if (input.complianceStatus === "review") overallScore -= 10;

  if (input.poolHealth.liquidityRisk === "high") overallScore -= 5;
  if (!input.poolHealth.canHandleDrawdown) overallScore -= 15;

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
    recommendation = input.complianceStatus === "fail" ? "decline" : "manual_review";
  }

  return {
    pspAddress: input.pspAddress,
    creditScore: input.creditScore,
    complianceStatus: input.complianceStatus,
    poolHealthContext: {
      utilizationRate: input.poolHealth.utilizationRate,
      liquidityRisk: input.poolHealth.liquidityRisk,
      canHandleDrawdown: input.poolHealth.canHandleDrawdown,
    },
    overallRiskScore: overallScore,
    overallRating: rating,
    recommendation,
    totalCost: "$0.018",
    dataSources: input.dataSources,
    timestamp: new Date().toISOString(),
  };
}

export interface DrawdownRiskDecision {
  approved: boolean;
  status: "approved" | "pending_approval" | "rejected";
  amount: string;
  adminApprovalRequired: boolean;
  message: string;
}

/** Map credit assessment → drawdown DB status + optional amount cap */
export function applyDrawdownRiskDecision(
  requestedAmount: string,
  drawdownLimit: string,
  assessment: CreditRiskAssessment
): DrawdownRiskDecision {
  if (assessment.recommendation === "decline") {
    return {
      approved: false,
      status: "rejected",
      amount: requestedAmount,
      adminApprovalRequired: false,
      message: "Drawdown declined by autonomous credit risk assessment.",
    };
  }

  if (assessment.recommendation === "manual_review") {
    return {
      approved: true,
      status: "pending_approval",
      amount: requestedAmount,
      adminApprovalRequired: true,
      message: "Drawdown pending admin review after credit risk assessment.",
    };
  }

  let amount = BigInt(requestedAmount);
  if (assessment.recommendation === "reduced_limit") {
    const cap = BigInt(drawdownLimit) / 2n;
    if (amount > cap) amount = cap;
  }

  return {
    approved: true,
    status: "approved",
    amount: amount.toString(),
    adminApprovalRequired: false,
    message:
      assessment.recommendation === "reduced_limit"
        ? "Drawdown approved with reduced limit based on credit risk score."
        : "Drawdown approved. Sign the transaction in your wallet.",
  };
}
