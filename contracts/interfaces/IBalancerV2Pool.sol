pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title IBalancerV2Pool Interface
/// @author JustSomeGeeks Hackathon Team <https://github.com/justsomegeeks>
/// @notice An Enzyme Balancer V2 Pool Interface
/// @dev Provides a subset of the functionality copied from and provided by Balancer
/// @dev Full documentation of structs and functions can be found in Balancer's code
interface IBalancerV2Pool is IERC20 {
    function totalSupply(address _poolAddress) external view returns (uint256);
}
