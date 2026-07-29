export type UserRole = "LP" | "PSP" | "ADMIN";
export type PSPApprovalStatus = "pending" | "approved" | "rejected";

export interface KYBProfile {
  companyName: string;
  registrationNumber: string;
  jurisdiction: string;
  dateOfIncorporation: string;
  yearsInOperation: number;
  licenseType: string;
  licenseNumber: string;
  issuingAuthority: string;
  businessType: string;
  monthlyTransactionVolume: number;
  primaryCorridors: string[];
  settlementPartners: string[];
  settlementCycle: string;
  annualRevenue: number;
  netIncome: number;
  totalEquity: number;
  debtRatio: number;
  bankRelationships: string[];
  amlPolicyInPlace: boolean;
  sanctionsScreeningProvider: string;
  lastRegulatoryAuditDate: string;
  enforcementActions: boolean;
  documents: {
    registrationDocs?: string;
    licenseCopy?: string;
    auditedFinancials?: string;
    settlementLog?: string;
    bankStatements?: string;
    kycKybPackage?: string;
  };
}

export interface KYRScore {
  incorporationRegulatory: number;
  businessAgeTrackRecord: number;
  transactionVolumeVelocity: number;
  settlementPartnerQuality: number;
  corridorRemittanceRisk: number;
  prefundingCycleLiquidity: number;
  historicalDataAuditTrail: number;
  bankFloatManagement: number;
  financialStrength: number;
  amlComplianceHealth: number;
  technologyIntegration: number;
  guarantorsCollateral: number;
  previousFinancingPayback: number;
  creditBureau: number;
  totalScore: number;
  rating: string;
}

export type DepositStatus = "pending" | "confirmed";

export type DrawdownStatus =
  | "pending_approval"
  | "approved"
  | "executed"
  | "shortfall"
  | "rejected";

export type RepaymentStatus = "pending" | "confirmed" | "converted";

export interface LPPayout {
  address: string;
  amount: string;
}

export function omitPassword<T extends { passwordHash?: string }>(user: T) {
  const { passwordHash: _, ...rest } = user;
  return rest;
}
