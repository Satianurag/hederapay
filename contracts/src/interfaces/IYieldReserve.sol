// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IYieldReserve {
    event FeeReceived(uint256 amount);
    event YieldPaid(address indexed lp, uint256 amount);

    function receiveFee(uint256 amount) external;
    function getReserveBalance() external view returns (uint256);
}
