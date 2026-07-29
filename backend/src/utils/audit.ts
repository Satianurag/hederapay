import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";

export async function logAudit(
  actor: string,
  action: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  await prisma.auditLog.create({
    data: { actor, action, details: details as Prisma.InputJsonValue },
  });
}
