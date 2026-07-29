import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const env = {
  PORT: parseInt(process.env.PORT || "4000", 10),
  DATABASE_URL: process.env.DATABASE_URL || "",
  DIRECT_URL: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  JWT_SECRET: process.env.JWT_SECRET || "dev-jwt-secret-change-in-prod",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "24h",

  HEDERA_RPC_URL: process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api",
  HEDERA_WS_URL: process.env.HEDERA_WS_URL || "",
  HEDERA_CHAIN_ID: 296,
  HEDERA_NETWORK: process.env.HEDERA_NETWORK || "hedera:testnet",

  POOL_CONTRACT_ADDRESS: process.env.POOL_CONTRACT_ADDRESS || "",
  YIELD_RESERVE_ADDRESS: process.env.YIELD_RESERVE_ADDRESS || "",

  DEPLOYER_PRIVATE_KEY: process.env.DEPLOYER_PRIVATE_KEY || "",
  HEDERA_ACCOUNT_ID: process.env.HEDERA_ACCOUNT_ID || "",
  OPERATOR_ID: process.env.OPERATOR_ID || process.env.HEDERA_ACCOUNT_ID || "",
  OPERATOR_KEY: process.env.OPERATOR_KEY || process.env.AGENT_PRIVATE_KEY || "",

  SAUCERSWAP_V2_ROUTER: process.env.SAUCERSWAP_V2_ROUTER || "0.0.1414040",
  SAUCERSWAP_V2_QUOTER: process.env.SAUCERSWAP_V2_QUOTER || "0.0.1390002",
  WHBAR_ADDRESS: process.env.WHBAR_ADDRESS || "0xb1F616b8134F602c3Bb465fB5b5e6565cCAd37Ed",
  USDC_TOKEN_ADDRESS: process.env.USDC_TOKEN_ADDRESS || "0.0.429274",
  USDC_EVM_ADDRESS:
    process.env.USDC_EVM_ADDRESS || "0x0000000000000000000000000000000000068cda",
  SAUCERSWAP_USDC_EVM:
    process.env.SAUCERSWAP_USDC_EVM || "0x0000000000000000000000000000000000001549",
  SAUCERSWAP_WHBAR_EVM:
    process.env.SAUCERSWAP_WHBAR_EVM || "0x0000000000000000000000000000000000003ad2",
  SAUCERSWAP_FACTORY_EVM:
    process.env.SAUCERSWAP_FACTORY_EVM || "0x00000000000000000000000000000000001243ee",
  SAUCERSWAP_POOL_FEE: parseInt(process.env.SAUCERSWAP_POOL_FEE || "3000", 10),
  CHAINLINK_HBAR_USD_FEED:
    process.env.CHAINLINK_HBAR_USD_FEED || "0x59bC155EB6c6C415fE43255aF66EcF0523c92B4a",
  CHAINLINK_MAX_STALENESS_SEC: parseInt(process.env.CHAINLINK_MAX_STALENESS_SEC || "86400", 10),
  CHAINLINK_SWAP_TOLERANCE_BPS: parseInt(process.env.CHAINLINK_SWAP_TOLERANCE_BPS || "200", 10),

  X402_FACILITATOR_URL: process.env.X402_FACILITATOR_URL || "https://api.testnet.blocky402.com",

  AGENT_PRIVATE_KEY: process.env.AGENT_PRIVATE_KEY || "",
  SELLER_ACCOUNT_ID: process.env.SELLER_ACCOUNT_ID || process.env.SELLER_WALLET_ADDRESS || "",
  AGENT_DATA_SERVICE_URL: process.env.AGENT_DATA_SERVICE_URL || "http://localhost:4001",
  POOL_MONITOR_URL: process.env.POOL_MONITOR_URL || "http://localhost:4002",
  EVENT_POLL_INTERVAL_MS: parseInt(process.env.EVENT_POLL_INTERVAL_MS || "12000", 10),
  HEDERA_CLIENT_ID: process.env.HEDERA_CLIENT_ID || process.env.HEDERA_ACCOUNT_ID || "",
  HEDERA_CLIENT_KEY: process.env.HEDERA_CLIENT_KEY || process.env.AGENT_PRIVATE_KEY || "",
  CREDIT_RISK_ENABLED: process.env.CREDIT_RISK_ENABLED !== "false",
};
