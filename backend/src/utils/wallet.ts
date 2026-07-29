import { ethers } from "ethers";

/**
 * Verify an EIP-191 signed message to prove wallet ownership.
 * The user signs a message like "Link wallet to HederaPay: <email>"
 * and we recover the signer address to confirm they own the wallet.
 */
export function verifyWalletSignature(
  message: string,
  signature: string,
  expectedAddress: string
): boolean {
  try {
    const recovered = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}

export function getLinkWalletMessage(email: string): string {
  return `Link wallet to HederaPay: ${email}`;
}
