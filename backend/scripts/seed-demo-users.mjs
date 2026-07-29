#!/usr/bin/env node
/**
 * Seed demo login accounts (run after fresh PostgreSQL / PC restart).
 * Usage: node backend/scripts/seed-demo-users.mjs
 */
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const PASSWORD = "hederapay123";

const users = [
  { email: "lp@hederapay.test", role: "LP", approved: true, approvalStatus: "approved" },
  { email: "psp@hederapay.test", role: "PSP", approved: true, approvalStatus: "approved" },
  { email: "admin@hederapay.test", role: "ADMIN", approved: true, approvalStatus: "approved" },
];

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const hash = await bcrypt.hash(PASSWORD, 12);

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { ...u, passwordHash: hash },
      create: { ...u, passwordHash: hash },
    });
    console.log(`✓ ${u.email} (${u.role})`);
  }

  console.log(`\nPassword for all: ${PASSWORD}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
