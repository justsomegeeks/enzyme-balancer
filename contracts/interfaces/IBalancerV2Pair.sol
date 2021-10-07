// SPDX-License-Identifier: GPL-3.0

/*
    A Balancer V2 contract for token pairs
*/

pragma solidity 0.6.12;

/// @title IBalancerV2Pair Interface
/// @author JustSomeGeeks Hackathon Team <https://github.com/justsomegeeks>
/// @notice Minimal interface for Balancer V2 token pairs
interface IBalancerV2Pair {
    function getReserves()
        external
        view
        returns (
            uint112,
            uint112,
            uint32
        );

    function kLast() external view returns (uint256);

    function token0() external view returns (address);

    function token1() external view returns (address);

    function totalSupply() external view returns (uint256);
}
