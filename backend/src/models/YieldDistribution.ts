import mongoose, { Schema, Document } from "mongoose";

export interface LPPayout {
  address: string;
  amount: string;
}

export interface IYieldDistribution extends Document {
  cycle: number;
  totalDistributed: string;
  lpPayouts: LPPayout[];
  txHash?: string;
  createdAt: Date;
}

const lpPayoutSchema = new Schema(
  {
    address: { type: String, required: true, lowercase: true },
    amount: { type: String, required: true },
  },
  { _id: false }
);

const yieldDistributionSchema = new Schema<IYieldDistribution>(
  {
    cycle: { type: Number, required: true, unique: true },
    totalDistributed: { type: String, required: true },
    lpPayouts: [lpPayoutSchema],
    txHash: String,
  },
  { timestamps: true }
);

export const YieldDistribution = mongoose.model<IYieldDistribution>(
  "YieldDistribution",
  yieldDistributionSchema
);
