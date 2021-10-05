// SPDX-License-Identifier: GPL-3.0

/*
    Balancer V2 mixins for the Enzyme Protocol.
*/

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@enzymefinance/contracts/release/utils/AssetHelpers.sol";
import "./interfaces/IBalancerV2Vault.sol";

/// @title BalancerV2ActionsMixin Contract
/// @author JustSomeGeeks Hackathon Team <https://github.com/justsomegeeks>
/// @notice Mixin contract for interacting with BalancerV2
abstract contract BalancerV2ActionsMixin is AssetHelpers {
    address private immutable BALANCER_V2_VAULT;

    constructor(address _balancerV2Vault) public {
        BALANCER_V2_VAULT = _balancerV2Vault;
    }

    /// @dev Helper to do batch swap using batch steps provided by off-chain Balancer SOR
    function __balancerV2BatchSwap(
        IBalancerV2Vault.SwapKind _swapKind,
        IBalancerV2Vault.BatchSwapStep[] memory _swaps,
        address[] memory _assets,
        IBalancerV2Vault.FundManagement memory _funds,
        int256[] memory _limits,
        uint256 _deadline
    ) internal {
        __approveAssetMaxAsNeeded(_assets[0], BALANCER_V2_VAULT, _swaps[0].amount);

        IBalancerV2Vault(BALANCER_V2_VAULT).batchSwap(
            _swapKind,
            _swaps,
            _assets,
            _funds,
            _limits,
            _deadline
        );
    }

    /// @dev Helper to add liquidity
    function __balancerV2Lend(
        bytes32 _poolId,
        address _sender,
        address _recipient,
        IBalancerV2Vault.JoinPoolRequest memory _request
    ) internal {
        IBalancerV2Vault(BALANCER_V2_VAULT).joinPool(_poolId, _sender, _recipient, _request);
    }

    /// @dev Helper to remove liquidity
    function __balancerV2Redeem(
        bytes32 _poolId,
        address _sender,
        address payable _recipient,
        IBalancerV2Vault.ExitPoolRequest memory _request
    ) internal {
        IBalancerV2Vault(BALANCER_V2_VAULT).exitPool(_poolId, _sender, _recipient, _request);
    }

    ///////////////////
    // STATE GETTERS //
    ///////////////////

    /// @notice Gets the `BALANCER_V2_VAULT` variable
    /// @return balancerV2Vault_ The `BALANCER_V2_VAULT` variable value
    function getBalancerV2Vault() public view returns (address balancerV2Vault_) {
        return BALANCER_V2_VAULT;
    }
}
