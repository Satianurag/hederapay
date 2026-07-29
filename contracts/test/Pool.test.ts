import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("Pool", function () {
  async function deployFixture() {
    const [admin, lp1, lp2, psp1, psp2, creForwarder] =
      await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    const altToken = await MockERC20.deploy("Alt Stable", "ALT", 6);

    // Deploy YieldReserve (needed by Pool)
    const YieldReserve = await ethers.getContractFactory("YieldReserve");
    // We pass a placeholder for pool address, then update after Pool deploy
    const yieldReserve = await YieldReserve.deploy(
      await usdc.getAddress(),
      ethers.ZeroAddress, // placeholder
      admin.address
    );

    // Deploy Pool
    const Pool = await ethers.getContractFactory("Pool");
    const pool = await Pool.deploy(
      await usdc.getAddress(),
      await yieldReserve.getAddress(),
      admin.address
    );

    // We need YieldReserve to know the real pool address.
    // Since our YieldReserve constructor sets poolContract, we redeploy with real address.
    const yieldReserveReal = await YieldReserve.deploy(
      await usdc.getAddress(),
      await pool.getAddress(),
      admin.address
    );

    // Redeploy Pool with the real YieldReserve
    const poolReal = await Pool.deploy(
      await usdc.getAddress(),
      await yieldReserveReal.getAddress(),
      admin.address
    );

    // Redeploy YieldReserve with the real Pool
    const yr = await YieldReserve.deploy(
      await usdc.getAddress(),
      await poolReal.getAddress(),
      admin.address
    );

    // Final Pool with final YieldReserve
    const finalPool = await Pool.deploy(
      await usdc.getAddress(),
      await yr.getAddress(),
      admin.address
    );

    // Redeploy YieldReserve one last time with finalPool
    const finalYR = await YieldReserve.deploy(
      await usdc.getAddress(),
      await finalPool.getAddress(),
      admin.address
    );

    // OK this circular dep is annoying. Let's just use a simpler approach:
    // Deploy Pool with a dummy YR, then deploy YR with real Pool, then redeploy Pool with real YR.
    // Actually let's just deploy them in order and accept the circular ref by redeploying once.

    // Clean approach: deploy YR first with zero pool, deploy Pool with YR, then...
    // YR's poolContract is immutable in constructor. So we need to deploy Pool first, then YR.
    // But Pool needs YR address in constructor too.
    // Solution: deploy a temporary, get addresses, redeploy properly.

    // Let's just do it cleanly:
    const tempYR = await YieldReserve.deploy(await usdc.getAddress(), ethers.ZeroAddress, admin.address);
    const pool2 = await Pool.deploy(await usdc.getAddress(), await tempYR.getAddress(), admin.address);

    // Now deploy the real YieldReserve with pool2's address
    const realYR = await YieldReserve.deploy(await usdc.getAddress(), await pool2.getAddress(), admin.address);

    // But pool2 points to tempYR... We need pool to point to realYR.
    // The cleanest approach for testing: just deploy both and accept we need to redeploy pool.
    const finalPool2 = await Pool.deploy(await usdc.getAddress(), await realYR.getAddress(), admin.address);
    const finalYR2 = await YieldReserve.deploy(await usdc.getAddress(), await finalPool2.getAddress(), admin.address);

    // Sigh, let me just do it once properly:
    // 1. Deploy YR with placeholder
    // 2. Deploy Pool with that YR
    // 3. Redeploy YR with Pool address
    // 4. Redeploy Pool with new YR
    // This is 4 deploys but gives us correct circular references.

    // ACTUALLY - the simplest: just deploy them and for Pool tests,
    // the YR just needs to accept receiveFee. Let me just do 2 deploys:

    const p = await Pool.deploy(await usdc.getAddress(), ethers.ZeroAddress, admin.address);
    const y = await YieldReserve.deploy(await usdc.getAddress(), await p.getAddress(), admin.address);

    // Problem: p points to address(0) for yieldReserve. We can't change it after deploy.
    // For Pool tests where we don't test yield flow, this is fine.
    // For full integration, we need proper circular deploy.

    // Final clean approach - 2 deploys:
    // Step 1: Predict Pool address using nonce
    const adminNonce = await ethers.provider.getTransactionCount(admin.address);
    const predictedPoolAddr = ethers.getCreateAddress({ from: admin.address, nonce: adminNonce + 1 });

    // Step 2: Deploy YR with predicted Pool address
    const yieldRes = await YieldReserve.deploy(await usdc.getAddress(), predictedPoolAddr, admin.address);

    // Step 3: Deploy Pool (its address will match prediction)
    const poolFinal = await Pool.deploy(await usdc.getAddress(), await yieldRes.getAddress(), admin.address);

    expect(await poolFinal.getAddress()).to.equal(predictedPoolAddr);

    // Grant CRE role
    await poolFinal.connect(admin).grantCRERole(creForwarder.address);
    await yieldRes.connect(admin).grantCRERole(creForwarder.address);

    // Default pool params: 50k USDC limit, 50 bps/day PSP rate, 500 bps APY
    const DRAWDOWN_LIMIT = ethers.parseUnits("50000", 6);
    const PSP_RATE = 50n;
    const LP_APY = 500n;

    // Mint USDC to test accounts
    const MINT_AMOUNT = ethers.parseUnits("100000", 6);
    await usdc.mint(lp1.address, MINT_AMOUNT);
    await usdc.mint(lp2.address, MINT_AMOUNT);
    await usdc.mint(psp1.address, MINT_AMOUNT);
    await usdc.mint(psp2.address, MINT_AMOUNT);

    // Mint alt stablecoin to PSPs for non-base-token repayment tests
    await altToken.mint(psp1.address, MINT_AMOUNT);

    return {
      poolFinal, yieldRes, usdc, altToken,
      admin, lp1, lp2, psp1, psp2, creForwarder,
      DRAWDOWN_LIMIT, PSP_RATE, LP_APY, MINT_AMOUNT,
    };
  }

  // Helper to initialize pool with default params
  async function initPoolFixture() {
    const f = await loadFixture(deployFixture);
    await f.poolFinal.connect(f.admin).initializePool(f.DRAWDOWN_LIMIT, f.PSP_RATE, f.LP_APY);
    return f;
  }

  // Helper: initialized pool with LP deposit
  async function fundedPoolFixture() {
    const f = await initPoolFixture();
    const depositAmount = ethers.parseUnits("50000", 6);
    await f.usdc.connect(f.lp1).approve(await f.poolFinal.getAddress(), depositAmount);
    await f.poolFinal.connect(f.lp1).deposit(depositAmount);
    return { ...f, depositAmount };
  }

  // ========== INITIALIZATION ==========

  describe("Initialization", function () {
    it("should initialize pool with correct parameters", async function () {
      const { poolFinal, admin, DRAWDOWN_LIMIT, PSP_RATE, LP_APY } =
        await loadFixture(deployFixture);

      await expect(poolFinal.connect(admin).initializePool(DRAWDOWN_LIMIT, PSP_RATE, LP_APY))
        .to.emit(poolFinal, "PoolInitialized")
        .withArgs(DRAWDOWN_LIMIT, PSP_RATE, LP_APY);

      expect(await poolFinal.drawdownLimit()).to.equal(DRAWDOWN_LIMIT);
      expect(await poolFinal.pspRatePerDay()).to.equal(PSP_RATE);
      expect(await poolFinal.investorAPY()).to.equal(LP_APY);
      expect(await poolFinal.initialized()).to.equal(true);
    });

    it("should revert if initialized twice", async function () {
      const { poolFinal, admin, DRAWDOWN_LIMIT, PSP_RATE, LP_APY } =
        await loadFixture(initPoolFixture);

      await expect(
        poolFinal.connect(admin).initializePool(DRAWDOWN_LIMIT, PSP_RATE, LP_APY)
      ).to.be.revertedWith("Already initialized");
    });

    it("should revert if non-admin tries to initialize", async function () {
      const { poolFinal, lp1, DRAWDOWN_LIMIT, PSP_RATE, LP_APY } =
        await loadFixture(deployFixture);

      await expect(
        poolFinal.connect(lp1).initializePool(DRAWDOWN_LIMIT, PSP_RATE, LP_APY)
      ).to.be.reverted;
    });
  });

  // ========== LP DEPOSITS ==========

  describe("LP Deposits", function () {
    it("should accept LP deposit and update balances", async function () {
      const { poolFinal, usdc, lp1 } = await loadFixture(initPoolFixture);
      const amount = ethers.parseUnits("10000", 6);

      await usdc.connect(lp1).approve(await poolFinal.getAddress(), amount);

      await expect(poolFinal.connect(lp1).deposit(amount))
        .to.emit(poolFinal, "Deposited")
        .withArgs(lp1.address, amount);

      expect(await poolFinal.lpBalances(lp1.address)).to.equal(amount);
      expect(await poolFinal.totalLiquidity()).to.equal(amount);
      expect(await poolFinal.availableLiquidity()).to.equal(amount);
    });

    it("should handle multiple LP deposits", async function () {
      const { poolFinal, usdc, lp1, lp2 } = await loadFixture(initPoolFixture);
      const amount1 = ethers.parseUnits("10000", 6);
      const amount2 = ethers.parseUnits("20000", 6);

      await usdc.connect(lp1).approve(await poolFinal.getAddress(), amount1);
      await poolFinal.connect(lp1).deposit(amount1);

      await usdc.connect(lp2).approve(await poolFinal.getAddress(), amount2);
      await poolFinal.connect(lp2).deposit(amount2);

      expect(await poolFinal.totalLiquidity()).to.equal(amount1 + amount2);
      expect(await poolFinal.availableLiquidity()).to.equal(amount1 + amount2);

      const addrs = await poolFinal.getLPAddresses();
      expect(addrs).to.include(lp1.address);
      expect(addrs).to.include(lp2.address);
    });

    it("should allow same LP to deposit multiple times", async function () {
      const { poolFinal, usdc, lp1 } = await loadFixture(initPoolFixture);
      const amount = ethers.parseUnits("5000", 6);

      await usdc.connect(lp1).approve(await poolFinal.getAddress(), amount * 2n);
      await poolFinal.connect(lp1).deposit(amount);
      await poolFinal.connect(lp1).deposit(amount);

      expect(await poolFinal.lpBalances(lp1.address)).to.equal(amount * 2n);
    });

    it("should revert deposit of zero amount", async function () {
      const { poolFinal, lp1 } = await loadFixture(initPoolFixture);

      await expect(poolFinal.connect(lp1).deposit(0)).to.be.revertedWith("Zero amount");
    });

    it("should revert deposit before initialization", async function () {
      const { poolFinal, usdc, lp1 } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits("1000", 6);

      await usdc.connect(lp1).approve(await poolFinal.getAddress(), amount);
      await expect(poolFinal.connect(lp1).deposit(amount)).to.be.revertedWith(
        "Pool not initialized"
      );
    });
  });

  // ========== PSP DRAWDOWNS ==========

  describe("PSP Drawdowns", function () {
    it("should execute direct drawdown when liquidity is available", async function () {
      const { poolFinal, usdc, psp1, depositAmount } =
        await loadFixture(fundedPoolFixture);
      const drawdown = ethers.parseUnits("10000", 6);

      const balBefore = await usdc.balanceOf(psp1.address);
      await expect(poolFinal.connect(psp1).requestDrawdown(drawdown))
        .to.emit(poolFinal, "DrawdownExecuted")
        .withArgs(psp1.address, drawdown);

      const balAfter = await usdc.balanceOf(psp1.address);
      expect(balAfter - balBefore).to.equal(drawdown);
      expect(await poolFinal.availableLiquidity()).to.equal(depositAmount - drawdown);

      const [amount, timestamp, repaid] = await poolFinal.getPSPPosition(psp1.address);
      expect(amount).to.equal(drawdown);
      expect(repaid).to.equal(false);
    });

    it("should emit LiquidityShortfall when pool lacks funds", async function () {
      const { poolFinal, usdc, lp1, psp1 } = await loadFixture(initPoolFixture);

      // Deposit only 1000 USDC
      const smallDeposit = ethers.parseUnits("1000", 6);
      await usdc.connect(lp1).approve(await poolFinal.getAddress(), smallDeposit);
      await poolFinal.connect(lp1).deposit(smallDeposit);

      const drawdown = ethers.parseUnits("5000", 6);
      const deficit = drawdown - smallDeposit;

      await expect(poolFinal.connect(psp1).requestDrawdown(drawdown))
        .to.emit(poolFinal, "LiquidityShortfall")
        .withArgs(psp1.address, deficit, 0n);
    });

    it("should revert drawdown exceeding limit", async function () {
      const { poolFinal, psp1, DRAWDOWN_LIMIT } =
        await loadFixture(fundedPoolFixture);

      await expect(
        poolFinal.connect(psp1).requestDrawdown(DRAWDOWN_LIMIT + 1n)
      ).to.be.revertedWith("Exceeds drawdown limit");
    });

    it("should revert drawdown if PSP has active position", async function () {
      const { poolFinal, psp1 } = await loadFixture(fundedPoolFixture);
      const drawdown = ethers.parseUnits("10000", 6);

      await poolFinal.connect(psp1).requestDrawdown(drawdown);

      await expect(
        poolFinal.connect(psp1).requestDrawdown(drawdown)
      ).to.be.revertedWith("Active position exists");
    });

    it("should revert drawdown of zero amount", async function () {
      const { poolFinal, psp1 } = await loadFixture(fundedPoolFixture);

      await expect(poolFinal.connect(psp1).requestDrawdown(0)).to.be.revertedWith(
        "Zero amount"
      );
    });

    it("should revert drawdown before initialization", async function () {
      const { poolFinal, psp1 } = await loadFixture(deployFixture);

      await expect(
        poolFinal.connect(psp1).requestDrawdown(ethers.parseUnits("1000", 6))
      ).to.be.revertedWith("Pool not initialized");
    });
  });

  // ========== CRE: COMPLETE DRAWDOWN ==========

  describe("CRE: completeDrawdown", function () {
    it("should complete a pending drawdown after CRE fills shortfall", async function () {
      const { poolFinal, usdc, lp1, lp2, psp1, creForwarder } =
        await loadFixture(initPoolFixture);

      // Small deposit — not enough for the full drawdown
      const deposit = ethers.parseUnits("1000", 6);
      await usdc.connect(lp1).approve(await poolFinal.getAddress(), deposit);
      await poolFinal.connect(lp1).deposit(deposit);

      // PSP requests more than available — triggers LiquidityShortfall
      const drawdown = ethers.parseUnits("5000", 6);
      await poolFinal.connect(psp1).requestDrawdown(drawdown);

      // CRE bridges extra liquidity: simulated by LP2 depositing the deficit
      // (in production, CRE would bridge USDC from another chain and deposit)
      const deficit = drawdown - deposit;
      await usdc.connect(lp2).approve(await poolFinal.getAddress(), deficit);
      await poolFinal.connect(lp2).deposit(deficit);

      // CRE completes the drawdown — now availableLiquidity >= drawdown amount
      const balBefore = await usdc.balanceOf(psp1.address);
      await expect(poolFinal.connect(creForwarder).completeDrawdown(psp1.address, 0))
        .to.emit(poolFinal, "DrawdownExecuted")
        .withArgs(psp1.address, drawdown);

      const balAfter = await usdc.balanceOf(psp1.address);
      expect(balAfter - balBefore).to.equal(drawdown);
      expect(await poolFinal.availableLiquidity()).to.equal(0);
    });

    it("should revert if called by non-CRE", async function () {
      const { poolFinal, psp1 } = await loadFixture(fundedPoolFixture);

      await expect(
        poolFinal.connect(psp1).completeDrawdown(psp1.address, 0)
      ).to.be.reverted;
    });

    it("should revert if no pending drawdown", async function () {
      const { poolFinal, creForwarder, psp1 } = await loadFixture(fundedPoolFixture);

      await expect(
        poolFinal.connect(creForwarder).completeDrawdown(psp1.address, 99)
      ).to.be.revertedWith("No pending drawdown");
    });
  });

  // ========== PSP REPAYMENT (USDC) ==========

  describe("PSP Repayment (USDC)", function () {
    it("should process USDC repayment with fee split", async function () {
      const { poolFinal, usdc, yieldRes, psp1, depositAmount } =
        await loadFixture(fundedPoolFixture);

      const drawdown = ethers.parseUnits("10000", 6);
      await poolFinal.connect(psp1).requestDrawdown(drawdown);

      // Advance 10 days
      await time.increase(10 * 24 * 60 * 60);

      // Repay full drawdown + extra for fee
      const repayAmount = ethers.parseUnits("10500", 6); // 10000 + 500 (50bps * 10 days = 5%)
      await usdc.connect(psp1).approve(await poolFinal.getAddress(), repayAmount);

      await expect(poolFinal.connect(psp1).repay(repayAmount, await usdc.getAddress()))
        .to.emit(poolFinal, "RepaymentProcessed");

      // Position should be marked repaid
      const [, , repaid] = await poolFinal.getPSPPosition(psp1.address);
      expect(repaid).to.equal(true);

      // YieldReserve should have received fees
      const yrBalance = await usdc.balanceOf(await yieldRes.getAddress());
      expect(yrBalance).to.be.gt(0);
    });

    it("should apply minimum 1 day fee even for same-day repayment", async function () {
      const { poolFinal, usdc, yieldRes, psp1 } =
        await loadFixture(fundedPoolFixture);

      const drawdown = ethers.parseUnits("10000", 6);
      await poolFinal.connect(psp1).requestDrawdown(drawdown);

      // Repay immediately (same block)
      const repayAmount = ethers.parseUnits("10050", 6); // 10000 + 50 (50bps * 1 day)
      await usdc.connect(psp1).approve(await poolFinal.getAddress(), repayAmount);
      await poolFinal.connect(psp1).repay(repayAmount, await usdc.getAddress());

      const yrBalance = await usdc.balanceOf(await yieldRes.getAddress());
      expect(yrBalance).to.be.gt(0);
    });

    it("should revert repayment with no active position", async function () {
      const { poolFinal, usdc, psp1 } = await loadFixture(fundedPoolFixture);
      const amount = ethers.parseUnits("1000", 6);

      await usdc.connect(psp1).approve(await poolFinal.getAddress(), amount);
      await expect(
        poolFinal.connect(psp1).repay(amount, await usdc.getAddress())
      ).to.be.revertedWith("No active position");
    });

    it("should revert repayment of zero amount", async function () {
      const { poolFinal, usdc, psp1 } = await loadFixture(fundedPoolFixture);

      await poolFinal.connect(psp1).requestDrawdown(ethers.parseUnits("1000", 6));

      await expect(
        poolFinal.connect(psp1).repay(0, await usdc.getAddress())
      ).to.be.revertedWith("Zero amount");
    });
  });

  // ========== PSP REPAYMENT (Non-USDC) ==========

  describe("PSP Repayment (Non-USDC)", function () {
    it("should hold non-USDC token and emit RepaymentReceived for CRE", async function () {
      const { poolFinal, altToken, psp1 } = await loadFixture(fundedPoolFixture);

      await poolFinal.connect(psp1).requestDrawdown(ethers.parseUnits("10000", 6));

      const repayAmount = ethers.parseUnits("10500", 6);
      await altToken.connect(psp1).approve(await poolFinal.getAddress(), repayAmount);

      await expect(
        poolFinal.connect(psp1).repay(repayAmount, await altToken.getAddress())
      )
        .to.emit(poolFinal, "RepaymentReceived")
        .withArgs(psp1.address, await altToken.getAddress(), repayAmount);

      // ALT should be held in the pool contract
      expect(await altToken.balanceOf(await poolFinal.getAddress())).to.equal(repayAmount);
    });

    it("should allow CRE to process converted repayment", async function () {
      const { poolFinal, usdc, altToken, yieldRes, psp1, creForwarder } =
        await loadFixture(fundedPoolFixture);

      await poolFinal.connect(psp1).requestDrawdown(ethers.parseUnits("10000", 6));

      // PSP repays in alt stablecoin
      const repayAmount = ethers.parseUnits("10500", 6);
      await altToken.connect(psp1).approve(await poolFinal.getAddress(), repayAmount);
      await poolFinal.connect(psp1).repay(repayAmount, await altToken.getAddress());

      // Automation converts alt token to USDC off-chain, then deposits USDC into pool
      const convertedUsdc = ethers.parseUnits("10490", 6); // after swap fee
      await usdc.mint(await poolFinal.getAddress(), convertedUsdc);

      // CRE calls processConvertedRepayment
      await expect(
        poolFinal.connect(creForwarder).processConvertedRepayment(psp1.address, convertedUsdc)
      ).to.emit(poolFinal, "RepaymentProcessed");

      const [, , repaid] = await poolFinal.getPSPPosition(psp1.address);
      expect(repaid).to.equal(true);
    });
  });

  // ========== YIELD DISTRIBUTION ==========

  describe("Yield Distribution", function () {
    it("should distribute yield from YieldReserve to LPs", async function () {
      const { poolFinal, usdc, yieldRes, lp1, lp2, psp1, creForwarder } =
        await loadFixture(fundedPoolFixture);

      // LP2 also deposits
      const lp2Deposit = ethers.parseUnits("20000", 6);
      await usdc.connect(lp2).approve(await poolFinal.getAddress(), lp2Deposit);
      await poolFinal.connect(lp2).deposit(lp2Deposit);

      // PSP draws down + repays to generate fees
      const drawdown = ethers.parseUnits("10000", 6);
      await poolFinal.connect(psp1).requestDrawdown(drawdown);
      await time.increase(10 * 24 * 60 * 60);
      const repayAmount = ethers.parseUnits("10500", 6);
      await usdc.connect(psp1).approve(await poolFinal.getAddress(), repayAmount);
      await poolFinal.connect(psp1).repay(repayAmount, await usdc.getAddress());

      // YieldReserve now has fees. CRE triggers onReport to approve distribution.
      const yieldForLP1 = ethers.parseUnits("100", 6);
      const yieldForLP2 = ethers.parseUnits("50", 6);
      const totalYield = yieldForLP1 + yieldForLP2;

      // Ensure reserve has enough
      const reserveBal = await usdc.balanceOf(await yieldRes.getAddress());
      expect(reserveBal).to.be.gte(totalYield);

      // CRE calls onReport on YieldReserve to approve the Pool
      const report = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address[]", "uint256[]"],
        [[lp1.address, lp2.address], [yieldForLP1, yieldForLP2]]
      );
      await yieldRes.connect(creForwarder).onReport(report);

      // CRE calls distributeYield on Pool
      await expect(
        poolFinal
          .connect(creForwarder)
          .distributeYield([lp1.address, lp2.address], [yieldForLP1, yieldForLP2])
      ).to.emit(poolFinal, "YieldDistributed");

      expect(await poolFinal.lpYieldClaimable(lp1.address)).to.equal(yieldForLP1);
      expect(await poolFinal.lpYieldClaimable(lp2.address)).to.equal(yieldForLP2);
    });

    it("should revert distributeYield if called by non-CRE", async function () {
      const { poolFinal, lp1 } = await loadFixture(fundedPoolFixture);

      await expect(
        poolFinal.connect(lp1).distributeYield([lp1.address], [100n])
      ).to.be.reverted;
    });

    it("should revert distributeYield with length mismatch", async function () {
      const { poolFinal, creForwarder, lp1 } = await loadFixture(fundedPoolFixture);

      await expect(
        poolFinal.connect(creForwarder).distributeYield([lp1.address], [100n, 200n])
      ).to.be.revertedWith("Length mismatch");
    });
  });

  // ========== LP WITHDRAWAL ==========

  describe("LP Withdrawal", function () {
    it("should allow LP to withdraw principal", async function () {
      const { poolFinal, usdc, lp1, depositAmount } =
        await loadFixture(fundedPoolFixture);

      const balBefore = await usdc.balanceOf(lp1.address);

      await expect(poolFinal.connect(lp1).withdraw())
        .to.emit(poolFinal, "Withdrawn")
        .withArgs(lp1.address, depositAmount);

      const balAfter = await usdc.balanceOf(lp1.address);
      expect(balAfter - balBefore).to.equal(depositAmount);

      expect(await poolFinal.lpBalances(lp1.address)).to.equal(0);
      expect(await poolFinal.totalLiquidity()).to.equal(0);
    });

    it("should allow LP to withdraw principal + claimable yield", async function () {
      const { poolFinal, usdc, yieldRes, lp1, psp1, creForwarder, depositAmount } =
        await loadFixture(fundedPoolFixture);

      // Generate fees via PSP repayment
      const drawdown = ethers.parseUnits("10000", 6);
      await poolFinal.connect(psp1).requestDrawdown(drawdown);
      await time.increase(10 * 24 * 60 * 60);
      const repayAmount = ethers.parseUnits("10500", 6);
      await usdc.connect(psp1).approve(await poolFinal.getAddress(), repayAmount);
      await poolFinal.connect(psp1).repay(repayAmount, await usdc.getAddress());

      // Distribute yield
      const yieldAmount = ethers.parseUnits("100", 6);
      const report = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address[]", "uint256[]"],
        [[lp1.address], [yieldAmount]]
      );
      await yieldRes.connect(creForwarder).onReport(report);
      await poolFinal.connect(creForwarder).distributeYield([lp1.address], [yieldAmount]);

      const expectedTotal = depositAmount + yieldAmount;
      const balBefore = await usdc.balanceOf(lp1.address);

      await poolFinal.connect(lp1).withdraw();

      const balAfter = await usdc.balanceOf(lp1.address);
      expect(balAfter - balBefore).to.equal(expectedTotal);
    });

    it("should revert withdrawal with zero balance", async function () {
      const { poolFinal, lp2 } = await loadFixture(fundedPoolFixture);

      await expect(poolFinal.connect(lp2).withdraw()).to.be.revertedWith(
        "Nothing to withdraw"
      );
    });
  });

  // ========== VIEW FUNCTIONS ==========

  describe("View Functions", function () {
    it("should return correct pool state", async function () {
      const { poolFinal, DRAWDOWN_LIMIT, PSP_RATE, LP_APY, depositAmount } =
        await loadFixture(fundedPoolFixture);

      const [total, available, limit, rate, apy] = await poolFinal.getPoolState();
      expect(total).to.equal(depositAmount);
      expect(available).to.equal(depositAmount);
      expect(limit).to.equal(DRAWDOWN_LIMIT);
      expect(rate).to.equal(PSP_RATE);
      expect(apy).to.equal(LP_APY);
    });

    it("should return correct LP balance", async function () {
      const { poolFinal, lp1, depositAmount } = await loadFixture(fundedPoolFixture);

      const [deposited, claimable] = await poolFinal.getLPBalance(lp1.address);
      expect(deposited).to.equal(depositAmount);
      expect(claimable).to.equal(0);
    });

    it("should return correct PSP position", async function () {
      const { poolFinal, psp1 } = await loadFixture(fundedPoolFixture);

      await poolFinal.connect(psp1).requestDrawdown(ethers.parseUnits("5000", 6));

      const [amount, timestamp, repaid] = await poolFinal.getPSPPosition(psp1.address);
      expect(amount).to.equal(ethers.parseUnits("5000", 6));
      expect(timestamp).to.be.gt(0);
      expect(repaid).to.equal(false);
    });
  });

  // ========== ACCESS CONTROL ==========

  describe("Access Control", function () {
    it("should only allow admin to grant CRE role", async function () {
      const { poolFinal, lp1, psp1 } = await loadFixture(initPoolFixture);

      await expect(poolFinal.connect(lp1).grantCRERole(psp1.address)).to.be.reverted;
    });

    it("should allow admin to grant CRE role", async function () {
      const { poolFinal, admin, psp1 } = await loadFixture(initPoolFixture);

      await expect(poolFinal.connect(admin).grantCRERole(psp1.address)).to.not.be.reverted;
    });
  });
});
