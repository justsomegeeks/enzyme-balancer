// SPDX-License-Identifier: GPL-3.0

/*
    A Balancer V2 adapter for the Enzyme Protocol.
*/

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@enzymefinance/contracts/release/extensions/integration-manager/integrations/utils/AdapterBase2.sol";

/// @title BalancerV2Adapter Contract
/// @author JustSomeGeeks Hackathon Team <https://github.com/justsomegeeks>
/// @notice Adapter for interacting with Balancer (v2)
/// @dev Does not allow any protocol that collects protocol fees in ETH, e.g., 0x v3
contract BalancerV2Adapter is AdapterBase2 {
    using SafeMath for uint256;

    constructor(
        address _integrationManager,
        address _balancerSwapper,
        address _tokenTransferProxy
    ) public AdapterBase2(_integrationManager) {}

    // EXTERNAL FUNCTIONS

    /// @notice Provides a constant string identifier for an adapter
    /// @return identifier_ An identifier string
    function identifier() external pure override returns (string memory identifier_) {
        return "BALANCER_V2";
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
        require(_selector == TAKE_ORDER_SELECTOR, "parseAssetsForMethod: _selector invalid");

        // (
        //     uint256 minIncomingAssetAmount,
        //     ,
        //     address outgoingAsset,
        //     uint256 outgoingAssetAmount,
        //     IParaSwapV4AugustusSwapper.Path[] memory paths
        // ) = __decodeCallArgs(_encodedCallArgs);

        // spendAssets_ = new address[](1);
        // spendAssets_[0] = outgoingAsset;

        // spendAssetAmounts_ = new uint256[](1);
        // spendAssetAmounts_[0] = outgoingAssetAmount;

        // incomingAssets_ = new address[](1);
        // incomingAssets_[0] = paths[paths.length - 1].to;

        // minIncomingAssetAmounts_ = new uint256[](1);
        // minIncomingAssetAmounts_[0] = minIncomingAssetAmount;

        spendAssets_ = new address[](1);
        spendAssets_[0] = address(0x0);

        spendAssetAmounts_ = new uint256[](1);
        spendAssetAmounts_[0] = 0;

        incomingAssets_ = new address[](1);
        incomingAssets_[0] = address(0x0);

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

    /// @notice Trades assets on Balancer V2
    /// @param _vaultProxy The VaultProxy of the calling fund
    /// @param _encodedCallArgs Encoded order parameters
    /// @dev Balancer V2
    function takeOrder(
        address _vaultProxy,
        bytes calldata _encodedCallArgs,
        bytes calldata
    ) external {
        // ) external onlyIntegrationManager {
        //     (
        //         uint256 minIncomingAssetAmount,
        //         uint256 expectedIncomingAssetAmount,
        //         address outgoingAsset,
        //         uint256 outgoingAssetAmount,
        //         IParaSwapV4AugustusSwapper.Path[] memory paths
        //     ) = __decodeCallArgs(_encodedCallArgs);
        // __paraSwapV4MultiSwap(
        //     outgoingAsset,
        //     outgoingAssetAmount,
        //     minIncomingAssetAmount,
        //     expectedIncomingAssetAmount,
        //     payable(_vaultProxy),
        //     paths
        // );
    }

    /// @dev Helper to decode the encoded callOnIntegration call arguments
    function __decodeCallArgs(
        bytes memory _encodedCallArgs // returns ( //     uint256 minIncomingAssetAmount_,
    )
        private
        pure
    //     uint256 expectedIncomingAssetAmount_, // Passed as a courtesy to ParaSwap for analytics
    //     address outgoingAsset_,
    //     uint256 outgoingAssetAmount_,
    //     IParaSwapV4AugustusSwapper.Path[] memory paths_
    // )
    {
        // return
        //     abi.decode(
        //         _encodedCallArgs,
        //         (uint256, uint256, address, uint256, IParaSwapV4AugustusSwapper.Path[])
        //     );
    }
}
