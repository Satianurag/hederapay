// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IPool.sol";
import "./interfaces/IYieldReserve.sol";
import "./interfaces/IAggregatorV3.sol";

contract Pool is IPool, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 public constant CRE_ROLE = keccak256("CRE_ROLE");

    struct Position {
        uint256 amount;
        uint256 drawdownTimestamp;
        bool repaid;
    }

    // --- State ---
    IERC20 public usdc;
    IYieldReserve public yieldReserve;
    bool public initialized;

    uint256 public totalLiquidity;
    uint256 public availableLiquidity;
    uint256 public drawdownLimit;
    uint256 public pspRatePerDay; // basis points (e.g. 50 = 0.5%)
    uint256 public investorAPY;   // basis points (e.g. 500 = 5%)

    mapping(address => uint256) public lpBalances;
    mapping(address => uint256) public lpYieldClaimable;
    mapping(address => Position) public pspPositions;
    address[] public lpAddresses;

    // Chainlink Price Feed for HBAR/USD rate verification
    IAggregatorV3 public priceFeed;

    // Pending drawdowns waiting for CRE to fill a shortfall
    struct PendingDrawdown {
        address psp;
        uint256 amount;
        bool active;
    }
    uint256 public nextRequestId;
    mapping(uint256 => PendingDrawdown) public pendingDrawdowns;

    // --- Constructor ---
    constructor(address _usdc, address _yieldReserve, address _admin) {
        usdc = IERC20(_usdc);
        yieldReserve = IYieldReserve(_yieldReserve);
        _grantRole(ADMIN_ROLE, _admin);
    }

    // --- Admin ---
    function initializePool(
        uint256 _drawdownLimit,
        uint256 _pspRate,
        uint256 _apy
    ) external onlyRole(ADMIN_ROLE) {
        require(!initialized, "Already initialized");
        drawdownLimit = _drawdownLimit;
        pspRatePerDay = _pspRate;
        investorAPY = _apy;
        initialized = true;
        emit PoolInitialized(_drawdownLimit, _pspRate, _apy);
    }

    function grantCRERole(address cre) external onlyRole(ADMIN_ROLE) {
        _grantRole(CRE_ROLE, cre);
    }

    // --- LP Functions ---
    function deposit(uint256 amount) external {
        require(initialized, "Pool not initialized");
        require(amount > 0, "Zero amount");

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        if (lpBalances[msg.sender] == 0) {
            lpAddresses.push(msg.sender);
        }
        lpBalances[msg.sender] += amount;
        totalLiquidity += amount;
        availableLiquidity += amount;

        emit Deposited(msg.sender, amount);
    }

    function withdraw() external {
        uint256 principal = lpBalances[msg.sender];
        uint256 yield_ = lpYieldClaimable[msg.sender];
        uint256 total = principal + yield_;
        require(total > 0, "Nothing to withdraw");

        lpBalances[msg.sender] = 0;
        lpYieldClaimable[msg.sender] = 0;
        totalLiquidity -= principal;
        availableLiquidity -= principal;

        usdc.safeTransfer(msg.sender, total);

        emit Withdrawn(msg.sender, total);
    }

    // --- PSP Functions ---
    function requestDrawdown(uint256 amount) external {
        require(initialized, "Pool not initialized");
        require(amount > 0, "Zero amount");
        require(amount <= drawdownLimit, "Exceeds drawdown limit");
        require(
            pspPositions[msg.sender].amount == 0 || pspPositions[msg.sender].repaid,
            "Active position exists"
        );

        if (availableLiquidity >= amount) {
            // Direct drawdown
            availableLiquidity -= amount;
            pspPositions[msg.sender] = Position(amount, block.timestamp, false);
            usdc.safeTransfer(msg.sender, amount);
            emit DrawdownExecuted(msg.sender, amount);
        } else {
            // Shortfall — emit event for CRE to handle
            uint256 deficit = amount - availableLiquidity;
            uint256 requestId = nextRequestId++;
            pendingDrawdowns[requestId] = PendingDrawdown(msg.sender, amount, true);
            emit LiquidityShortfall(msg.sender, deficit, requestId);
        }
    }

    function repay(uint256 amount, address token) external {
        Position storage pos = pspPositions[msg.sender];
        require(pos.amount > 0 && !pos.repaid, "No active position");
        require(amount > 0, "Zero amount");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        if (token == address(usdc)) {
            _processRepayment(msg.sender, amount);
        } else {
            // Non-USDC token — hold and let CRE convert
            emit RepaymentReceived(msg.sender, token, amount);
        }
    }

    // --- CRE Functions ---
    function completeDrawdown(address psp, uint256 requestId) external onlyRole(CRE_ROLE) {
        PendingDrawdown storage pending = pendingDrawdowns[requestId];
        require(pending.active, "No pending drawdown");
        require(pending.psp == psp, "PSP mismatch");

        uint256 amount = pending.amount;
        pending.active = false;

        // CRE has bridged liquidity into the pool, so available liquidity was topped up.
        // Use whatever is available from pool + newly bridged funds.
        availableLiquidity -= amount;
        pspPositions[psp] = Position(amount, block.timestamp, false);
        usdc.safeTransfer(psp, amount);

        emit DrawdownExecuted(psp, amount);
    }

    function processConvertedRepayment(address psp, uint256 usdcAmount) external onlyRole(CRE_ROLE) {
        _processRepayment(psp, usdcAmount);
    }

    function distributeYield(
        address[] calldata lps,
        uint256[] calldata amounts
    ) external onlyRole(CRE_ROLE) {
        require(lps.length == amounts.length, "Length mismatch");

        uint256 totalAmount;
        for (uint256 i = 0; i < lps.length; i++) {
            lpYieldClaimable[lps[i]] += amounts[i];
            totalAmount += amounts[i];
        }

        // Pull yield from the YieldReserve into this contract
        usdc.safeTransferFrom(address(yieldReserve), address(this), totalAmount);

        emit YieldDistributed(totalAmount, block.timestamp);
    }

    // --- Internal ---
    function _processRepayment(address psp, uint256 usdcAmount) internal {
        Position storage pos = pspPositions[psp];
        require(pos.amount > 0 && !pos.repaid, "No active position");

        // Calculate fee: amount * ratePerDay * days / 10000
        uint256 daysElapsed = (block.timestamp - pos.drawdownTimestamp) / 1 days;
        if (daysElapsed == 0) daysElapsed = 1; // minimum 1 day
        uint256 fee = (pos.amount * pspRatePerDay * daysElapsed) / 10_000;

        // Ensure repayment covers at least the principal
        uint256 principal = usdcAmount > fee ? usdcAmount - fee : usdcAmount;
        uint256 actualFee = usdcAmount - principal;

        pos.repaid = true;

        // Principal back to pool
        availableLiquidity += principal;

        // Fee to YieldReserve
        if (actualFee > 0) {
            usdc.forceApprove(address(yieldReserve), actualFee);
            yieldReserve.receiveFee(actualFee);
        }

        emit RepaymentProcessed(psp, principal, actualFee);
    }

    // --- View Functions ---
    function getPoolState() external view returns (
        uint256, uint256, uint256, uint256, uint256
    ) {
        return (totalLiquidity, availableLiquidity, drawdownLimit, pspRatePerDay, investorAPY);
    }

    function getLPBalance(address lp) external view returns (uint256 deposited, uint256 claimable) {
        return (lpBalances[lp], lpYieldClaimable[lp]);
    }

    function getPSPPosition(address psp) external view returns (uint256 amount, uint256 timestamp, bool repaid) {
        Position memory pos = pspPositions[psp];
        return (pos.amount, pos.drawdownTimestamp, pos.repaid);
    }

    function getLPAddresses() external view returns (address[] memory) {
        return lpAddresses;
    }

    // --- Chainlink Price Feed Integration ---

    /// @notice Set the Chainlink Price Feed address (e.g. HBAR/USD)
    function setPriceFeed(address _priceFeed) external onlyRole(ADMIN_ROLE) {
        priceFeed = IAggregatorV3(_priceFeed);
    }

    /// @notice Read the latest price from the Chainlink Price Feed
    /// @return price The latest price (8 decimals for USD pairs)
    /// @return updatedAt Timestamp of the last update
    function getLatestPrice() external view returns (int256 price, uint256 updatedAt) {
        require(address(priceFeed) != address(0), "Price feed not set");
        (, price,, updatedAt,) = priceFeed.latestRoundData();
    }

    /// @notice Verify a conversion rate is within acceptable bounds using Chainlink
    /// @param expectedRate The rate to verify (8 decimals)
    /// @param toleranceBps Maximum deviation in basis points (e.g. 100 = 1%)
    function verifyConversionRate(int256 expectedRate, uint256 toleranceBps) external view returns (bool) {
        require(address(priceFeed) != address(0), "Price feed not set");
        (, int256 chainlinkPrice,, uint256 updatedAt,) = priceFeed.latestRoundData();
        require(block.timestamp - updatedAt < 3600, "Stale price feed");

        int256 diff = expectedRate - chainlinkPrice;
        if (diff < 0) diff = -diff;
        int256 maxDiff = (chainlinkPrice * int256(toleranceBps)) / 10000;
        return diff <= maxDiff;
    }
}
