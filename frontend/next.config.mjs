/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    unoptimized: true,
  },
  transpilePackages: [
    "@hashgraph/hedera-wallet-connect",
    "@hiero-ledger/sdk",
    "@hiero-ledger/proto",
  ],
}

export default nextConfig
