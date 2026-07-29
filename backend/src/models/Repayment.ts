import mongoose, { Schema, Document } from "mongoose";

export type RepaymentStatus = "pending" | "confirmed" | "converted";

export interface IRepayment extends Document {
  pspAddress: string;
  amount: string;
  token: string; // token address
  tokenSymbol: string; // WHBAR | USDC
  txHash: string;
  status: RepaymentStatus;
  convertedUsdcAmount?: string;
  feePortion?: string;
  principalPortion?: string;
  daysElapsed?: number;
  confirmedAt?: Date;
  createdAt: Date;
}

const repaymentSchema = new Schema<IRepayment>(
  {
    pspAddress: { type: String, required: true, lowercase: true },
    amount: { type: String, required: true },
    token: { type: String, required: true },
    tokenSymbol: { type: String, required: true },
    txHash: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["pending", "confirmed", "converted"],
      default: "pending",
    },
    convertedUsdcAmount: String,
    feePortion: String,
    principalPortion: String,
    daysElapsed: Number,
    confirmedAt: Date,
  },
  { timestamps: true }
);

repaymentSchema.index({ pspAddress: 1 });

export const Repayment = mongoose.model<IRepayment>("Repayment", repaymentSchema);
