// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IYieldReserve.sol";

contract YieldReserve is IYieldReserve, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 public constant CRE_ROLE = keccak256("CRE_ROLE");

    IERC20 public usdc;
    address public poolContract;
    uint256 public totalFees;
    uint256 public totalDistributed;

    constructor(address _usdc, address _pool, address _admin) {
        usdc = IERC20(_usdc);
        poolContract = _pool;
        _grantRole(ADMIN_ROLE, _admin);
    }

    function grantCRERole(address cre) external onlyRole(ADMIN_ROLE) {
        _grantRole(CRE_ROLE, cre);
    }

    /// @notice Called by Pool Contract when processing PSP repayment fees
    function receiveFee(uint256 amount) external override {
        require(msg.sender == poolContract, "Only pool");
        require(amount > 0, "Zero amount");

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        totalFees += amount;

        emit FeeReceived(amount);
    }

    /// @notice IReceiver implementation — called by KeystoneForwarder with CRE-signed report.
    ///         Decodes report into LP addresses and yield amounts, then approves Pool to pull funds.
    function onReport(bytes calldata report) external onlyRole(CRE_ROLE) {
        (address[] memory lps, uint256[] memory amounts) = abi.decode(report, (address[], uint256[]));
        require(lps.length == amounts.length, "Length mismatch");

        uint256 totalAmount;
        for (uint256 i = 0; i < lps.length; i++) {
            totalAmount += amounts[i];
        }

        uint256 reserveBalance = usdc.balanceOf(address(this));
        require(totalAmount <= reserveBalance, "Insufficient reserve");

        // Approve the Pool contract to pull the yield funds via distributeYield()
        usdc.forceApprove(poolContract, totalAmount);
        totalDistributed += totalAmount;

        for (uint256 i = 0; i < lps.length; i++) {
            emit YieldPaid(lps[i], amounts[i]);
        }
    }

    /// @notice Returns the current USDC balance held in the reserve
    function getReserveBalance() external view override returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
