import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const config: HardhatUserConfig = {
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: { chainId: 296 },
    hederaTestnet: {
      url: process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api",
      chainId: 296,
      accounts: [
        process.env.DEPLOYER_PRIVATE_KEY,
        process.env.LP_1_PRIVATE_KEY,
        process.env.PSP_1_PRIVATE_KEY,
        process.env.PSP_2_PRIVATE_KEY,
      ].filter(Boolean) as string[],
    },
  },
};

export default config;
