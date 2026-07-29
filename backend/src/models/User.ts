import mongoose, { Schema, Document } from "mongoose";

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
  businessType: string; // RSP | PSP | OTC

  // Operational
  monthlyTransactionVolume: number;
  primaryCorridors: string[];
  settlementPartners: string[];
  settlementCycle: string; // T+0 | T+1 | T+2

  // Financial
  annualRevenue: number;
  netIncome: number;
  totalEquity: number;
  debtRatio: number;
  bankRelationships: string[];

  // Compliance
  amlPolicyInPlace: boolean;
  sanctionsScreeningProvider: string;
  lastRegulatoryAuditDate: string;
  enforcementActions: boolean;

  // Documents (file paths / URLs)
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
  incorporationRegulatory: number;       // max 5
  businessAgeTrackRecord: number;        // max 5
  transactionVolumeVelocity: number;     // max 10
  settlementPartnerQuality: number;      // max 10
  corridorRemittanceRisk: number;        // max 8
  prefundingCycleLiquidity: number;      // max 8
  historicalDataAuditTrail: number;      // max 8
  bankFloatManagement: number;           // max 7
  financialStrength: number;             // max 10
  amlComplianceHealth: number;           // max 8
  technologyIntegration: number;         // max 5
  guarantorsCollateral: number;          // max 5
  previousFinancingPayback: number;      // max 7
  creditBureau: number;                  // max 4
  totalScore: number;                    // max 100
  rating: string;                        // AAA | AA | A | B/C
}

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  role: UserRole;
  walletAddress?: string;
  approved: boolean;
  approvalStatus: PSPApprovalStatus;
  approvedBy?: string;
  approvedAt?: Date;
  kybProfile?: KYBProfile;
  kyrScore?: KYRScore;
  createdAt: Date;
  updatedAt: Date;
}

const kybProfileSchema = new Schema(
  {
    companyName: { type: String, required: true },
    registrationNumber: { type: String, required: true },
    jurisdiction: { type: String, required: true },
    dateOfIncorporation: { type: String, required: true },
    yearsInOperation: { type: Number, required: true },
    licenseType: { type: String, required: true },
    licenseNumber: { type: String, required: true },
    issuingAuthority: { type: String, required: true },
    businessType: { type: String, enum: ["RSP", "PSP", "OTC"], required: true },
    monthlyTransactionVolume: { type: Number, required: true },
    primaryCorridors: [{ type: String }],
    settlementPartners: [{ type: String }],
    settlementCycle: { type: String, enum: ["T+0", "T+1", "T+2"], required: true },
    annualRevenue: { type: Number, required: true },
    netIncome: { type: Number, required: true },
    totalEquity: { type: Number, required: true },
    debtRatio: { type: Number, required: true },
    bankRelationships: [{ type: String }],
    amlPolicyInPlace: { type: Boolean, required: true },
    sanctionsScreeningProvider: { type: String, required: true },
    lastRegulatoryAuditDate: { type: String, required: true },
    enforcementActions: { type: Boolean, required: true },
    documents: {
      registrationDocs: String,
      licenseCopy: String,
      auditedFinancials: String,
      settlementLog: String,
      bankStatements: String,
      kycKybPackage: String,
    },
  },
  { _id: false }
);

const kyrScoreSchema = new Schema(
  {
    incorporationRegulatory: { type: Number, default: 0 },
    businessAgeTrackRecord: { type: Number, default: 0 },
    transactionVolumeVelocity: { type: Number, default: 0 },
    settlementPartnerQuality: { type: Number, default: 0 },
    corridorRemittanceRisk: { type: Number, default: 0 },
    prefundingCycleLiquidity: { type: Number, default: 0 },
    historicalDataAuditTrail: { type: Number, default: 0 },
    bankFloatManagement: { type: Number, default: 0 },
    financialStrength: { type: Number, default: 0 },
    amlComplianceHealth: { type: Number, default: 0 },
    technologyIntegration: { type: Number, default: 0 },
    guarantorsCollateral: { type: Number, default: 0 },
    previousFinancingPayback: { type: Number, default: 0 },
    creditBureau: { type: Number, default: 0 },
    totalScore: { type: Number, default: 0 },
    rating: { type: String, enum: ["AAA", "AA", "A", "B/C"], default: "B/C" },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["LP", "PSP", "ADMIN"], required: true },
    walletAddress: { type: String, sparse: true },
    approved: { type: Boolean, default: false },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvedBy: String,
    approvedAt: Date,
    kybProfile: kybProfileSchema,
    kyrScore: kyrScoreSchema,
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", userSchema);
