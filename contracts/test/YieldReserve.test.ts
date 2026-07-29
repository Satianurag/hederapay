import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("YieldReserve", function () {
  async function deployFixture() {
    const [admin, creForwarder, lp1, lp2, randomUser] =
      await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);

    // Predict Pool-like address — use admin's next nonce for a fake "pool" contract
    // For YieldReserve tests, we use admin as the pool to call receiveFee directly
    const pool = admin; // admin acts as pool for isolated YR tests

    const YieldReserve = await ethers.getContractFactory("YieldReserve");
    const yieldReserve = await YieldReserve.deploy(
      await usdc.getAddress(),
      pool.address,
      admin.address
    );

    await yieldReserve.connect(admin).grantCRERole(creForwarder.address);

    // Mint USDC
    const MINT_AMOUNT = ethers.parseUnits("100000", 6);
    await usdc.mint(admin.address, MINT_AMOUNT);
    await usdc.mint(creForwarder.address, MINT_AMOUNT);

    return { yieldReserve, usdc, admin, creForwarder, lp1, lp2, randomUser, pool };
  }

  // ========== RECEIVE FEE ==========

  describe("receiveFee", function () {
    it("should accept fees from the pool contract", async function () {
      const { yieldReserve, usdc, admin } = await loadFixture(deployFixture);
      const feeAmount = ethers.parseUnits("500", 6);

      // admin is acting as pool
      await usdc.connect(admin).approve(await yieldReserve.getAddress(), feeAmount);

      await expect(yieldReserve.connect(admin).receiveFee(feeAmount))
        .to.emit(yieldReserve, "FeeReceived")
        .withArgs(feeAmount);

      expect(await yieldReserve.totalFees()).to.equal(feeAmount);
      expect(await yieldReserve.getReserveBalance()).to.equal(feeAmount);
    });

    it("should accumulate fees across multiple calls", async function () {
      const { yieldReserve, usdc, admin } = await loadFixture(deployFixture);
      const fee1 = ethers.parseUnits("200", 6);
      const fee2 = ethers.parseUnits("300", 6);

      await usdc.connect(admin).approve(await yieldReserve.getAddress(), fee1 + fee2);
      await yieldReserve.connect(admin).receiveFee(fee1);
      await yieldReserve.connect(admin).receiveFee(fee2);

      expect(await yieldReserve.totalFees()).to.equal(fee1 + fee2);
      expect(await yieldReserve.getReserveBalance()).to.equal(fee1 + fee2);
    });

    it("should revert if caller is not the pool", async function () {
      const { yieldReserve, usdc, randomUser } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits("100", 6);

      await usdc.mint(randomUser.address, amount);
      await usdc.connect(randomUser).approve(await yieldReserve.getAddress(), amount);

      await expect(
        yieldReserve.connect(randomUser).receiveFee(amount)
      ).to.be.revertedWith("Only pool");
    });

    it("should revert on zero amount", async function () {
      const { yieldReserve, admin } = await loadFixture(deployFixture);

      await expect(
        yieldReserve.connect(admin).receiveFee(0)
      ).to.be.revertedWith("Zero amount");
    });
  });

  // ========== ON REPORT (CRE YIELD DISTRIBUTION) ==========

  describe("onReport", function () {
    it("should decode report and approve pool to pull yield", async function () {
      const { yieldReserve, usdc, admin, creForwarder, lp1, lp2 } =
        await loadFixture(deployFixture);

      // Seed the reserve with fees
      const totalFee = ethers.parseUnits("1000", 6);
      await usdc.connect(admin).approve(await yieldReserve.getAddress(), totalFee);
      await yieldReserve.connect(admin).receiveFee(totalFee);

      // CRE sends report
      const yield1 = ethers.parseUnits("600", 6);
      const yield2 = ethers.parseUnits("400", 6);
      const report = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address[]", "uint256[]"],
        [[lp1.address, lp2.address], [yield1, yield2]]
      );

      await expect(yieldReserve.connect(creForwarder).onReport(report))
        .to.emit(yieldReserve, "YieldPaid")
        .withArgs(lp1.address, yield1)
        .to.emit(yieldReserve, "YieldPaid")
        .withArgs(lp2.address, yield2);

      expect(await yieldReserve.totalDistributed()).to.equal(yield1 + yield2);

      // Pool (admin) should be approved to pull funds
      const allowance = await usdc.allowance(
        await yieldReserve.getAddress(),
        admin.address // admin is pool
      );
      expect(allowance).to.equal(yield1 + yield2);
    });

    it("should revert if reserve has insufficient balance", async function () {
      const { yieldReserve, usdc, admin, creForwarder, lp1 } =
        await loadFixture(deployFixture);

      // Seed only 100 USDC
      const smallFee = ethers.parseUnits("100", 6);
      await usdc.connect(admin).approve(await yieldReserve.getAddress(), smallFee);
      await yieldReserve.connect(admin).receiveFee(smallFee);

      // Try to distribute 500
      const report = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address[]", "uint256[]"],
        [[lp1.address], [ethers.parseUnits("500", 6)]]
      );

      await expect(
        yieldReserve.connect(creForwarder).onReport(report)
      ).to.be.revertedWith("Insufficient reserve");
    });

    it("should revert if arrays have length mismatch", async function () {
      const { yieldReserve, usdc, admin, creForwarder, lp1, lp2 } =
        await loadFixture(deployFixture);

      const fee = ethers.parseUnits("1000", 6);
      await usdc.connect(admin).approve(await yieldReserve.getAddress(), fee);
      await yieldReserve.connect(admin).receiveFee(fee);

      const report = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address[]", "uint256[]"],
        [[lp1.address, lp2.address], [ethers.parseUnits("100", 6)]]
      );

      await expect(
        yieldReserve.connect(creForwarder).onReport(report)
      ).to.be.revertedWith("Length mismatch");
    });

    it("should revert if called by non-CRE", async function () {
      const { yieldReserve, randomUser, lp1 } = await loadFixture(deployFixture);

      const report = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address[]", "uint256[]"],
        [[lp1.address], [100n]]
      );

      await expect(
        yieldReserve.connect(randomUser).onReport(report)
      ).to.be.reverted;
    });
  });

  // ========== VIEW FUNCTIONS ==========

  describe("getReserveBalance", function () {
    it("should return 0 when empty", async function () {
      const { yieldReserve } = await loadFixture(deployFixture);
      expect(await yieldReserve.getReserveBalance()).to.equal(0);
    });

    it("should reflect actual USDC balance", async function () {
      const { yieldReserve, usdc, admin } = await loadFixture(deployFixture);
      const fee = ethers.parseUnits("750", 6);

      await usdc.connect(admin).approve(await yieldReserve.getAddress(), fee);
      await yieldReserve.connect(admin).receiveFee(fee);

      expect(await yieldReserve.getReserveBalance()).to.equal(fee);
    });
  });

  // ========== ACCESS CONTROL ==========

  describe("Access Control", function () {
    it("should allow admin to grant CRE role", async function () {
      const { yieldReserve, admin, randomUser } = await loadFixture(deployFixture);

      await expect(
        yieldReserve.connect(admin).grantCRERole(randomUser.address)
      ).to.not.be.reverted;
    });

    it("should revert if non-admin grants CRE role", async function () {
      const { yieldReserve, randomUser, lp1 } = await loadFixture(deployFixture);

      await expect(
        yieldReserve.connect(randomUser).grantCRERole(lp1.address)
      ).to.be.reverted;
    });
  });
});
