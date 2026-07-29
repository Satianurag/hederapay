"use client";

import { useAppKit, useAppKitAccount } from "@reown/appkit/react";

export function WalletButton() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();

  return (
    <button
      onClick={() => open()}
      className="rounded-lg bg-blue-400 px-4 py-2 text-sm font-medium text-white hover:bg-blue-400/90"
    >
      {isConnected && address
        ? `${address.slice(0, 6)}...${address.slice(-4)}`
        : "Connect HashPack"}
    </button>
  );
}
