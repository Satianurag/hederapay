import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
  actor: string; // email or wallet address
  action: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: { type: String, required: true },
    action: { type: String, required: true },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Append-only: no update/delete operations should be used on this collection
auditLogSchema.index({ actor: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
