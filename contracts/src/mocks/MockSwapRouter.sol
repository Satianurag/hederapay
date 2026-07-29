// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title MockSwapRouter — Simulates Uniswap V3 swap routing for local testing
/// @notice Swaps stablecoins 1:1 minus a configurable slippage fee (default 0.3%)
contract MockSwapRouter {
    using SafeERC20 for IERC20;

    uint256 public feeBps; // e.g. 30 = 0.3%

    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    constructor(uint256 _feeBps) {
        feeBps = _feeBps;
    }

    /// @notice Mimics ISwapRouter.exactInputSingle — swaps tokenIn for tokenOut at ~1:1
    function exactInputSingle(ExactInputSingleParams calldata params) external returns (uint256 amountOut) {
        require(params.amountIn > 0, "Zero amount");

        // Pull tokenIn from caller
        IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);

        // Calculate output: 1:1 minus fee
        amountOut = params.amountIn - (params.amountIn * feeBps / 10_000);
        require(amountOut >= params.amountOutMinimum, "Slippage exceeded");

        // Send tokenOut to recipient (router must be pre-funded with tokenOut)
        IERC20(params.tokenOut).safeTransfer(params.recipient, amountOut);
    }

    /// @notice Pre-fund the router with tokens so it can fulfill swaps during tests
    function fund(address token, uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @notice Helper to get expected output for a given input amount
    function getAmountOut(uint256 amountIn) external view returns (uint256) {
        return amountIn - (amountIn * feeBps / 10_000);
    }
}
