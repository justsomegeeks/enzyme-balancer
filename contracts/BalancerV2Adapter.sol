// SPDX-License-Identifier: GPL-3.0

/*
    A Balancer V2 adapter for the Enzyme Protocol.
*/

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@enzymefinance/contracts/release/extensions/integration-manager/integrations/utils/AdapterBase2.sol";
import "hardhat/console.sol";
import "./BalancerV2ActionsMixin.sol";
import "./interfaces/IBalancerV2Vault.sol";

/// @title BalancerV2Adapter Contract
/// @author JustSomeGeeks Hackathon Team <https://github.com/justsomegeeks>
/// @notice Adapter for interacting with Balancer (v2)
/// @dev Does not allow any protocol that collects protocol fees in ETH, e.g., 0x v3
contract BalancerV2Adapter is AdapterBase2, BalancerV2ActionsMixin {
    using SafeMath for uint256;
    address private immutable BALANCER_V2_VAULT;

    constructor(address _integrationManager, address _balancerV2Vault)
        public
        AdapterBase2(_integrationManager)
        BalancerV2ActionsMixin(_balancerV2Vault)
    {
        BALANCER_V2_VAULT = _balancerV2Vault;
    }

    // EXTERNAL FUNCTIONS

    /// @notice Provides a constant string identifier for an adapter
    /// @return identifier_ An identifier string
    function identifier() external pure override returns (string memory identifier_) {
        return "BALANCER_V2";
    }

    /// @notice Trades assets on BalancerV2
    /// @param _vaultProxy The VaultProxy of the calling fund
    /// @param _encodedCallArgs Encoded order parameters
    function takeOrder(
        address _vaultProxy,
        bytes calldata _encodedCallArgs,
        bytes calldata
    ) external onlyIntegrationManager {
        (
            IBalancerV2Vault.SwapKind swapKind,
            IBalancerV2Vault.BatchSwapStep[] memory swaps,
            address[] memory assets,
            ,
            int256[] memory limits,
            uint256 deadline
        ) = __decodeTakeOrderCallArgs(_encodedCallArgs);
        IBalancerV2Vault.FundManagement memory funds = IBalancerV2Vault.FundManagement(
            address(this),
            false, // fromInternalBalance
            payable(_vaultProxy),
            false // toInternalBalance
        );

        __balancerV2BatchSwap(swapKind, swaps, assets, funds, limits, deadline);
    }

    /// @notice Parses the expected assets to receive from a call on integration
    /// @param _selector The function selector for the callOnIntegration
    /// @param _encodedCallArgs The encoded parameters for the callOnIntegration
    /// @return spendAssetsHandleType_ A type that dictates how to handle granting
    /// the adapter access to spend assets (`None` by default)
    /// @return spendAssets_ The assets to spend in the call
    /// @return spendAssetAmounts_ The max asset amounts to spend in the call
    /// @return incomingAssets_ The assets to receive in the call
    /// @return minIncomingAssetAmounts_ The min asset amounts to receive in the call
    function parseAssetsForMethod(bytes4 _selector, bytes calldata _encodedCallArgs)
        external
        view
        override
        returns (
            IIntegrationManager.SpendAssetsHandleType spendAssetsHandleType_,
            address[] memory spendAssets_,
            uint256[] memory spendAssetAmounts_,
            address[] memory incomingAssets_,
            uint256[] memory minIncomingAssetAmounts_
        )
    {
        if (_selector == TAKE_ORDER_SELECTOR){
        return __parseAssetsForSwap(_encodedCallArgs);
        }else if (_selector == LEND_SELECTOR){
            return __parseAssetsForLend(_encodedCallArgs);
        }
        revert("parseAssetsForMethod: _selector invalid");
    }
    function __parseAssetsForLend(bytes calldata _encodedCallArgs)
        private
        view
        returns (
            IIntegrationManager.SpendAssetsHandleType spendAssetsHandleType_,
            address[] memory spendAssets_,
            uint256[] memory spendAssetAmounts_,
            address[] memory incomingAssets_,
            uint256[] memory minIncomingAssetAmounts_
        )
    {
        (
            bytes32 poolId,
            ,
            IBalancerV2Vault.JoinPoolRequest memory request
        ) = __decodeLendCallArgs(_encodedCallArgs);

        require(request.assets.length == request.maxAmountsIn.length, "length of request.assets and request.maxAmountsIn must be equal");
        uint256 assetsLength = request.assets.length;

        spendAssets_ = new address[](assetsLength);
        for (uint i = 0; i < assetsLength; i++){
         spendAssets_[i] = request.assets[i];
        }

        spendAssetAmounts_ = new uint256[](assetsLength);
        for (uint i = 0; i < assetsLength; i++){
         spendAssetAmounts_[i] = request.maxAmountsIn[i];
        }



        (address _bpt, ) = IBalancerV2Vault(BALANCER_V2_VAULT).getPool(poolId);
        incomingAssets_ = new address[](1);
        incomingAssets_[0] = _bpt;

        // TODO: How can I calculate minimum incoming _bpt Amount token?
        minIncomingAssetAmounts_ = new uint256[](1);
        minIncomingAssetAmounts_[0] = 0;

        return (
            IIntegrationManager.SpendAssetsHandleType.Transfer,
            spendAssets_,
            spendAssetAmounts_,
            incomingAssets_,
            minIncomingAssetAmounts_
        );
    }
    
    

    /// @dev Helper function to parse spend and incoming assets from encoded call args
    /// during swap() calls
    function __parseAssetsForSwap(bytes calldata _encodedCallArgs)
        private
        pure
        returns (
            IIntegrationManager.SpendAssetsHandleType spendAssetsHandleType_,
            address[] memory spendAssets_,
            uint256[] memory spendAssetAmounts_,
            address[] memory incomingAssets_,
            uint256[] memory minIncomingAssetAmounts_
        )
    {
        (
            ,
            IBalancerV2Vault.BatchSwapStep[] memory swaps,
            address[] memory assets,
            uint256 tokenOutAmount,
            ,

        ) = __decodeTakeOrderCallArgs(_encodedCallArgs);

        spendAssets_ = new address[](1);
        spendAssets_[0] = assets[0];

        spendAssetAmounts_ = new uint256[](1);
        spendAssetAmounts_[0] = swaps[0].amount;

        incomingAssets_ = new address[](1);
        incomingAssets_[0] = assets[1];

        minIncomingAssetAmounts_ = new uint256[](1);
        minIncomingAssetAmounts_[0] = tokenOutAmount;

        return (
            IIntegrationManager.SpendAssetsHandleType.Transfer,
            spendAssets_,
            spendAssetAmounts_,
            incomingAssets_,
            minIncomingAssetAmounts_
        );
    }

    /// @dev Helper to decode the encoded callOnIntegration call arguments
    function __decodeTakeOrderCallArgs(bytes memory _encodedCallArgs)
        private
        pure
        returns (
            IBalancerV2Vault.SwapKind swapKind_,
            IBalancerV2Vault.BatchSwapStep[] memory swaps_,
            address[] memory assets_,
            uint256 tokenOutAmount_,
            int256[] memory limits_,
            uint256 deadline_
        )
    {
        return
            abi.decode(
                _encodedCallArgs,
                (
                    IBalancerV2Vault.SwapKind,
                    IBalancerV2Vault.BatchSwapStep[],
                    address[],
                    uint256,
                    int256[],
                    uint256
                )
            );
    }

    /// @dev Helper to decode the lend encoded call arguments
    function __decodeLendCallArgs(bytes memory _encodedCallArgs)
        private
        pure
        returns (
            bytes32 poolId_,
            address recipient_,
            IBalancerV2Vault.JoinPoolRequest memory request_
        )
    {
        return abi.decode(_encodedCallArgs, (bytes32, address, IBalancerV2Vault.JoinPoolRequest));
    }

    /// @notice Deposits an amount of an underlying asset into a pool
    /// @param _vaultProxy The VaultProxy of the calling fund
    /// @param _encodedCallArgs Encoded order parameters
    function lend(
        address _vaultProxy,
        bytes calldata _encodedCallArgs,
        bytes calldata
    ) external onlyIntegrationManager fundAssetsTransferHandler(_vaultProxy, _encodedCallArgs) {
        (
            bytes32 poolId,
            address recipient,
            IBalancerV2Vault.JoinPoolRequest memory request
        ) = __decodeLendCallArgs(_encodedCallArgs);

        __balancerV2Lend(poolId, msg.sender, recipient, request);
    }
}
