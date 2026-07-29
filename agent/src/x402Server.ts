import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactHederaScheme } from "@x402/hedera/exact/server";
import { HEDERA_TESTNET_USDC, HEDERA_USDC_DECIMALS } from "@x402/hedera";
import type { Express } from "express";
import { config } from "./agentClient.js";

const USDC_TOKEN_ID = process.env.USDC_TOKEN_ADDRESS || HEDERA_TESTNET_USDC;
const USDC_DECIMALS = HEDERA_USDC_DECIMALS;

/** Native HBAR price for @x402/hedera exact scheme (amount in tinybars). */
export function hbarPrice(hbar: string) {
  const tinybars = BigInt(Math.round(parseFloat(hbar) * 1e8));
  return { amount: tinybars.toString(), asset: "0.0.0", extra: {} };
}

/** Circle USDC HTS price (amount in smallest units, 6 decimals). */
export function usdcPrice(usdc: string) {
  const units = BigInt(Math.round(parseFloat(usdc) * 10 ** USDC_DECIMALS));
  return { amount: units.toString(), asset: USDC_TOKEN_ID, extra: {} };
}

export function createHederaResourceServer() {
  const facilitatorClient = new HTTPFacilitatorClient({ url: config.FACILITATOR_URL });
  return new x402ResourceServer(facilitatorClient).register(
    "hedera:*",
    new ExactHederaScheme({
      defaultAssets: {
        "hedera:testnet": { asset: USDC_TOKEN_ID, decimals: USDC_DECIMALS },
        "hedera:mainnet": { asset: "0.0.456858", decimals: USDC_DECIMALS },
      },
    })
  );
}

type RouteMeta = {
  priceHbar?: string;
  priceUsdc?: string;
  description: string;
  mimeType?: string;
};

function buildAccepts(meta: RouteMeta) {
  const payTo = config.SELLER_ACCOUNT_ID;
  const base = {
    scheme: "exact" as const,
    network: config.HEDERA_NETWORK,
    payTo,
    maxTimeoutSeconds: 180,
  };

  const options = [];
  if (meta.priceHbar) {
    options.push({ ...base, price: hbarPrice(meta.priceHbar) });
  }
  if (meta.priceUsdc) {
    options.push({ ...base, price: usdcPrice(meta.priceUsdc) });
  }
  if (options.length === 0) {
    throw new Error(`Route "${meta.description}" requires priceHbar and/or priceUsdc`);
  }

  return {
    accepts: options.length === 1 ? options[0] : options,
    description: meta.description,
    mimeType: meta.mimeType || "application/json",
  };
}

export function mountPaidRoutes(app: Express, routes: Record<string, RouteMeta>) {
  const payTo = config.SELLER_ACCOUNT_ID;
  if (!payTo) {
    throw new Error("SELLER_ACCOUNT_ID (or SELLER_WALLET_ADDRESS) must be set");
  }

  const routeConfig = Object.fromEntries(
    Object.entries(routes).map(([route, meta]) => [route, buildAccepts(meta)])
  );

  app.use(paymentMiddleware(routeConfig, createHederaResourceServer()));
}
