import mongoose, { Schema, Document } from "mongoose";

export interface IPool extends Document {
  poolContractAddress: string;
  yieldReserveAddress: string;
  drawdownLimit: string; // stored as string for big number precision (6 decimals)
  pspRatePerDay: number; // basis points
  investorAPY: number; // basis points
  totalLiquidity: string;
  availableLiquidity: string;
  initialized: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const poolSchema = new Schema<IPool>(
  {
    poolContractAddress: { type: String, required: true, unique: true },
    yieldReserveAddress: { type: String, required: true },
    drawdownLimit: { type: String, required: true },
    pspRatePerDay: { type: Number, required: true },
    investorAPY: { type: Number, required: true },
    totalLiquidity: { type: String, default: "0" },
    availableLiquidity: { type: String, default: "0" },
    initialized: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Pool = mongoose.model<IPool>("Pool", poolSchema);
