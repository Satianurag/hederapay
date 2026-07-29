import mongoose, { Schema, Document } from "mongoose";

export type DrawdownStatus =
  | "pending_approval"
  | "approved"
  | "executed"
  | "shortfall"
  | "rejected";

export interface IDrawdown extends Document {
  pspAddress: string;
  amount: string;
  txHash?: string;
  status: DrawdownStatus;
  adminApprovalRequired: boolean;
  adminApprovedBy?: string;
  requestId?: number; // on-chain pending drawdown ID (for shortfall)
  riskScore?: number;
  riskRating?: string;
  riskRecommendation?: string;
  executedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const drawdownSchema = new Schema<IDrawdown>(
  {
    pspAddress: { type: String, required: true, lowercase: true },
    amount: { type: String, required: true },
    txHash: String,
    status: {
      type: String,
      enum: ["pending_approval", "approved", "executed", "shortfall", "rejected"],
      default: "pending_approval",
    },
    adminApprovalRequired: { type: Boolean, default: false },
    adminApprovedBy: String,
    requestId: Number,
    riskScore: Number,
    riskRating: String,
    riskRecommendation: String,
    executedAt: Date,
  },
  { timestamps: true }
);

drawdownSchema.index({ pspAddress: 1 });
drawdownSchema.index({ status: 1 });

export const Drawdown = mongoose.model<IDrawdown>("Drawdown", drawdownSchema);
