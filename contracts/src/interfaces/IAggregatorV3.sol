// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Chainlink AggregatorV3Interface
/// @notice Minimal interface for reading Chainlink Price Feeds on-chain
interface IAggregatorV3 {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );

    function decimals() external view returns (uint8);
}
