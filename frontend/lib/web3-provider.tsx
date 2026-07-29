"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import {
  HederaAdapter,
  HederaChainDefinition,
  hederaNamespace,
} from "@hashgraph/hedera-wallet-connect/dist/reown";
import { hederaTestnet } from "viem/chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo";

const wagmiAdapter = new WagmiAdapter({
  networks: [hederaTestnet],
  projectId,
});

const hederaNativeAdapter = new HederaAdapter({
  projectId,
  networks: [HederaChainDefinition.Native.Testnet],
  namespace: hederaNamespace,
});

createAppKit({
  adapters: [wagmiAdapter, hederaNativeAdapter],
  networks: [hederaTestnet],
  projectId,
  metadata: {
    name: "HederaPay",
    description: "PSP credit pool on Hedera",
    url: typeof window !== "undefined" ? window.location.origin : "https://hederapay.app",
    icons: ["https://avatars.githubusercontent.com/u/37784886"],
  },
  themeMode: "dark",
  features: { analytics: false },
  enableBaseAccount: false,
  enableCoinbase: false,
});

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
