import mongoose, { Schema, Document } from "mongoose";

export type DepositStatus = "pending" | "confirmed";

export interface IDeposit extends Document {
  lpAddress: string;
  amount: string;
  txHash: string;
  status: DepositStatus;
  confirmedAt?: Date;
  createdAt: Date;
}

const depositSchema = new Schema<IDeposit>(
  {
    lpAddress: { type: String, required: true, lowercase: true },
    amount: { type: String, required: true },
    txHash: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "confirmed"], default: "pending" },
    confirmedAt: Date,
  },
  { timestamps: true }
);

depositSchema.index({ lpAddress: 1 });

export const Deposit = mongoose.model<IDeposit>("Deposit", depositSchema);
