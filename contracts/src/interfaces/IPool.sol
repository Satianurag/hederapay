// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPool {
    // Events
    event PoolInitialized(uint256 drawdownLimit, uint256 pspRate, uint256 apy);
    event Deposited(address indexed lp, uint256 amount);
    event DrawdownExecuted(address indexed psp, uint256 amount);
    event LiquidityShortfall(address indexed psp, uint256 deficit, uint256 requestId);
    event RepaymentReceived(address indexed psp, address indexed token, uint256 amount);
    event RepaymentProcessed(address indexed psp, uint256 principal, uint256 fee);
    event YieldDistributed(uint256 totalAmount, uint256 timestamp);
    event Withdrawn(address indexed lp, uint256 amount);

    // LP functions
    function deposit(uint256 amount) external;
    function withdraw() external;

    // PSP functions
    function requestDrawdown(uint256 amount) external;
    function repay(uint256 amount, address token) external;

    // CRE functions
    function completeDrawdown(address psp, uint256 amount) external;
    function processConvertedRepayment(address psp, uint256 usdcAmount) external;
    function distributeYield(address[] calldata lps, uint256[] calldata amounts) external;

    // View functions
    function getPoolState() external view returns (
        uint256 totalLiquidity,
        uint256 availableLiquidity,
        uint256 drawdownLimit,
        uint256 pspRatePerDay,
        uint256 investorAPY
    );
    function getLPBalance(address lp) external view returns (uint256 deposited, uint256 claimable);
    function getPSPPosition(address psp) external view returns (uint256 amount, uint256 timestamp, bool repaid);
}
