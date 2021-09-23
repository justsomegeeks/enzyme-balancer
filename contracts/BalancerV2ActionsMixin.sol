// SPDX-License-Identifier: GPL-3.0

/*
    A Balancer V2 adapter for the Enzyme Protocol.
*/

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@enzymefinance/contracts/release/utils/AssetHelpers.sol";
import "@balancer-labs/v2-vault/contracts/interfaces/IVault.sol";

/// @title BalancerV2ActionsMixin Contract
/// @author Enzyme Council <security@enzyme.finance>
/// @notice Mixin contract for interacting with BalancerV2
abstract contract BalancerV2ActionsMixin is AssetHelpers {
    address private immutable BALANCER_VAULT;

    constructor(address _balancerVault) public {
        BALANCER_VAULT = _balancerVault;
    }

    /// @dev Helper to do single pool swap
    function __balancerV2Swap(
        IVault.SingleSwap _singleSwap,
        IVault.FundManagement _funds,
        uint256 _limit,
        uint256 _deadline
    ) internal {
        IVault(BALANCER_VAULT).swap(_singleSwap, _funds, _limit, _deadline);
    }

    /// @dev Helper to add liquidity
    function __balancerV2Lend(
        bytes32 _poolId,
        address _sender,
        address _recipient,
        IVault.JoinPoolRequest memory _request
    ) internal {
        IVault(BALANCER_VAULT).joinPool(_poolId, _sender, _recipient, _request);
    }

    /// @dev Helper to remove liquidity
    function __balancerV2Redeem(
        bytes32 _poolId,
        address _sender,
        address payable _recipient,
        IVault.ExitPoolRequest memory _request
    ) internal {
        IVault(BALANCER_VAULT).exitPool(_poolId, _sender, _recipient, _request);
    }
}
