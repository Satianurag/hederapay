import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("MockSwapRouter", function () {
  async function deployFixture() {
    const [deployer, user] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const altToken = await MockERC20.deploy("Alt Stable", "ALT", 6);
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);

    // 30 bps = 0.3% fee
    const MockSwapRouter = await ethers.getContractFactory("MockSwapRouter");
    const router = await MockSwapRouter.deploy(30);

    // Mint tokens
    const MINT = ethers.parseUnits("100000", 6);
    await altToken.mint(user.address, MINT);
    await usdc.mint(deployer.address, MINT);

    // Fund router with USDC so it can fulfill ALT->USDC swaps
    await usdc.connect(deployer).approve(await router.getAddress(), MINT);
    await router.connect(deployer).fund(await usdc.getAddress(), MINT);

    return { router, altToken, usdc, deployer, user, MINT };
  }

  describe("exactInputSingle", function () {
    it("should swap tokenIn for tokenOut at 1:1 minus fee", async function () {
      const { router, altToken, usdc, user } = await loadFixture(deployFixture);
      const amountIn = ethers.parseUnits("10000", 6);

      await altToken.connect(user).approve(await router.getAddress(), amountIn);

      const expectedOut = amountIn - (amountIn * 30n) / 10_000n; // 0.3% fee
      const balBefore = await usdc.balanceOf(user.address);

      await router.connect(user).exactInputSingle({
        tokenIn: await altToken.getAddress(),
        tokenOut: await usdc.getAddress(),
        fee: 500,
        recipient: user.address,
        amountIn,
        amountOutMinimum: expectedOut,
        sqrtPriceLimitX96: 0,
      });

      const balAfter = await usdc.balanceOf(user.address);
      expect(balAfter - balBefore).to.equal(expectedOut);

      // Router should hold the ALT
      expect(await altToken.balanceOf(await router.getAddress())).to.equal(amountIn);
    });

    it("should revert if slippage exceeded", async function () {
      const { router, altToken, usdc, user } = await loadFixture(deployFixture);
      const amountIn = ethers.parseUnits("10000", 6);

      await altToken.connect(user).approve(await router.getAddress(), amountIn);

      // Set amountOutMinimum higher than possible output
      await expect(
        router.connect(user).exactInputSingle({
          tokenIn: await altToken.getAddress(),
          tokenOut: await usdc.getAddress(),
          fee: 500,
          recipient: user.address,
          amountIn,
          amountOutMinimum: amountIn, // expecting full amount = impossible with fee
          sqrtPriceLimitX96: 0,
        })
      ).to.be.revertedWith("Slippage exceeded");
    });

    it("should revert on zero amount", async function () {
      const { router, altToken, usdc, user } = await loadFixture(deployFixture);

      await expect(
        router.connect(user).exactInputSingle({
          tokenIn: await altToken.getAddress(),
          tokenOut: await usdc.getAddress(),
          fee: 500,
          recipient: user.address,
          amountIn: 0,
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0,
        })
      ).to.be.revertedWith("Zero amount");
    });

    it("should send output to specified recipient (not caller)", async function () {
      const { router, altToken, usdc, user, deployer } =
        await loadFixture(deployFixture);
      const amountIn = ethers.parseUnits("1000", 6);
      const expectedOut = amountIn - (amountIn * 30n) / 10_000n;

      await altToken.connect(user).approve(await router.getAddress(), amountIn);

      const recipientBalBefore = await usdc.balanceOf(deployer.address);

      await router.connect(user).exactInputSingle({
        tokenIn: await altToken.getAddress(),
        tokenOut: await usdc.getAddress(),
        fee: 500,
        recipient: deployer.address, // different from caller
        amountIn,
        amountOutMinimum: expectedOut,
        sqrtPriceLimitX96: 0,
      });

      const recipientBalAfter = await usdc.balanceOf(deployer.address);
      expect(recipientBalAfter - recipientBalBefore).to.equal(expectedOut);
    });
  });

  describe("fund", function () {
    it("should allow funding the router with tokens", async function () {
      const { router, altToken, user } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits("5000", 6);

      await altToken.connect(user).approve(await router.getAddress(), amount);
      await router.connect(user).fund(await altToken.getAddress(), amount);

      expect(await altToken.balanceOf(await router.getAddress())).to.equal(amount);
    });
  });

  describe("getAmountOut", function () {
    it("should return correct expected output", async function () {
      const { router } = await loadFixture(deployFixture);
      const amountIn = ethers.parseUnits("10000", 6);
      const expected = amountIn - (amountIn * 30n) / 10_000n;

      expect(await router.getAmountOut(amountIn)).to.equal(expected);
    });

    it("should return 0 for 0 input", async function () {
      const { router } = await loadFixture(deployFixture);
      expect(await router.getAmountOut(0)).to.equal(0);
    });
  });
});
