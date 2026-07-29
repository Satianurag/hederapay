export type UserRole = "LP" | "PSP" | "ADMIN";

export interface KYBProfile {
  companyName?: string;
  registrationNumber?: string;
  country?: string;
  businessType?: string;
  annualVolume?: string;
  bankingPartners?: string[];
  [key: string]: unknown;
}

export interface KYRScore {
  paymentHistory?: number;
  transactionVolume?: number;
  bankingPartners?: number;
  compliance?: number;
  totalScore?: number;
  rating?: string;
  [key: string]: unknown;
}

export function omitPassword<T extends { passwordHash?: string }>(user: T): Omit<T, "passwordHash"> {
  const { passwordHash: _removed, ...rest } = user;
  return rest;
}
