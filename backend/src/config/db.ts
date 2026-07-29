import { prisma } from "./prisma";

export async function connectDB(): Promise<void> {
  try {
    await prisma.$connect();
    console.log("PostgreSQL connected (Neon)");
  } catch (err) {
    console.error("PostgreSQL connection error:", err);
    process.exit(1);
  }
}

export { prisma };
