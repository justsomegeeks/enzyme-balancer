// SPDX-License-Identifier: GPL-3.0

/*
    Price feed for Balancer V2 'two token' pool BPT tokens (IBalancerV2Vault.PoolSpecialization.TWO_TOKEN)
*/

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import "@enzymefinance/contracts/release/infrastructure/price-feeds/derivatives/IDerivativePriceFeed.sol";
import "@enzymefinance/contracts/release/infrastructure/price-feeds/primitives/IPrimitivePriceFeed.sol";
import "@enzymefinance/contracts/release/infrastructure/value-interpreter/ValueInterpreter.sol";
import "@enzymefinance/contracts/release/extensions/utils/FundDeployerOwnerMixin.sol";
import "@enzymefinance/contracts/release/utils/MathHelpers.sol";

import "./interfaces/IBalancerV2Pool.sol";
import "./interfaces/IBalancerV2Vault.sol";
import "hardhat/console.sol";

/// @title BalancerV2PoolPriceFeed Contract
/// @author JustSomeGeeks Hackathon Team <https://github.com/justsomegeeks>
/// @notice Price feed for Balancer V2 'two token' pool BPT tokens (IBalancerV2Vault.PoolSpecialization.TWO_TOKEN)
contract BalancerV2PriceFeed is
    IDerivativePriceFeed,
    FundDeployerOwnerMixin,
    MathHelpers
    /*BalancerV2PoolTokenValueCalculator*/
{
    event PoolTokenAdded(
        address indexed poolToken,
        /* bytes32 poolId,     TODO: useful to add? or does it need to conform to specific Enzyme PoolTokenAdded event?*/
        address token0,
        address token1
    );

    struct PoolTokenDescriptor {
        address token0;
        address token1;
        uint8 token0Decimals;
        uint8 token1Decimals;
    }

    struct PoolDescriptor {
        bytes32 poolId;
        PoolTokenDescriptor poolTokenDescriptor;
    }

    // BPT tokens have 18 decimals
    uint256 private constant POOL_TOKEN_UNIT = 10**18;

    address private immutable DERIVATIVE_PRICE_FEED;
    address private immutable PRIMITIVE_PRICE_FEED;
    address private immutable VALUE_INTERPRETER;
    address private immutable VAULT;

    // Balancer V2 pool address and BPT ERC20 token address are one and the same
    mapping(address => PoolDescriptor) private poolTokenToPoolDescriptor;

    constructor(
        address _fundDeployer,
        address _derivativePriceFeed,
        address _primitivePriceFeed,
        address _valueInterpreter,
        address _balancerV2Vault,
        bytes32[] memory _balancerPoolIds
    ) public FundDeployerOwnerMixin(_fundDeployer) {
        DERIVATIVE_PRICE_FEED = _derivativePriceFeed;
        VAULT = _balancerV2Vault;
        PRIMITIVE_PRICE_FEED = _primitivePriceFeed;
        VALUE_INTERPRETER = _valueInterpreter;

        __addPoolTokens(
            _balancerV2Vault,
            _balancerPoolIds,
            _derivativePriceFeed,
            _primitivePriceFeed
        );
    }

    /// @notice Converts a given amount of a derivative to its underlying asset values
    /// @param _derivative The derivative to convert
    /// @param _derivativeAmount The amount of the derivative to convert
    /// @return underlyings_ The underlying assets for the _derivative
    /// @return underlyingAmounts_ The amount of each underlying asset for the equivalent derivative amount
    //_derivative is the BPT token address, _derivativeAmount is the number of bpts
    function calcUnderlyingValues(address _derivative, uint256 _derivativeAmount)
        external
        override
        returns (address[] memory underlyings_, uint256[] memory underlyingAmounts_)
    {
        console.log("Calling....");

        uint256 totalBPT = getPoolTotalSupply(_derivative);
        uint256 BPTPercentage = _derivativeAmount / totalBPT;
        console.log(totalBPT, BPTPercentage);
        (IERC20[] memory tokens, uint256[] memory balances, ) = getPoolData(_derivative);

        underlyingAmounts_ = new uint256[](tokens.length);
        underlyings_ = new address[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            underlyingAmounts_[i] = balances[i] * BPTPercentage;
            underlyings_[i] = address(tokens[i]);
        }

        underlyingAmounts_ = new uint256[](2);
        underlyingAmounts_[0] = _derivativeAmount.div(POOL_TOKEN_UNIT);
        underlyingAmounts_[1] = _derivativeAmount.div(POOL_TOKEN_UNIT);

        return (underlyings_, underlyingAmounts_);
    }

    /// @notice Checks if an asset is supported by the price feed
    /// @param _asset The asset to check
    /// @return isSupported_ True if the asset is supported
    function isSupportedAsset(address _asset) public view override returns (bool isSupported_) {
        return poolTokenToPoolDescriptor[_asset].poolTokenDescriptor.token0 != address(0);
    }

    // PRIVATE FUNCTIONS

    /// @dev Calculates the trusted rate of two assets based on our price feeds.
    /// Uses the decimals-derived unit for whichever asset is used as the quote asset.
    function __calcTrustedRate(
        address _token0,
        address _token1,
        uint256 _token0Decimals,
        uint256 _token1Decimals
    ) private returns (uint256 token0RateAmount_, uint256 token1RateAmount_) {
        bool rateIsValid;
        // The quote asset of the value lookup must be a supported primitive asset,
        // so we cycle through the tokens until reaching a primitive.
        // If neither is a primitive, will revert at the ValueInterpreter
        if (IPrimitivePriceFeed(PRIMITIVE_PRICE_FEED).isSupportedAsset(_token0)) {
            token1RateAmount_ = 10**_token1Decimals;
            (token0RateAmount_, rateIsValid) = ValueInterpreter(VALUE_INTERPRETER)
                .calcCanonicalAssetValue(_token1, token1RateAmount_, _token0);
        } else {
            token0RateAmount_ = 10**_token0Decimals;
            (token1RateAmount_, rateIsValid) = ValueInterpreter(VALUE_INTERPRETER)
                .calcCanonicalAssetValue(_token0, token0RateAmount_, _token1);
        }

        require(rateIsValid, "__calcTrustedRate: Invalid rate");

        return (token0RateAmount_, token1RateAmount_);
    }

    //////////////////////////
    // POOL TOKENS REGISTRY //
    //////////////////////////

    /// @notice Adds Balancer V2 pool tokens to the price feed
    /// @param _poolIds Balancer pool ids to add BPT tokens for
    function addPoolTokens(address _vault, bytes32[] calldata _poolIds)
        external
        onlyFundDeployerOwner
    {
        require(_poolIds.length > 0, "addPoolTokens: Empty _poolsIds");

        __addPoolTokens(_vault, _poolIds, DERIVATIVE_PRICE_FEED, PRIMITIVE_PRICE_FEED);
    }

    /// @dev Helper to add Balancer V2 pool BPT tokens
    function __addPoolTokens(
        address _vault,
        bytes32[] memory _poolIds,
        address _derivativePriceFeed,
        address _primitivePriceFeed
    ) private {
        IBalancerV2Vault vault = IBalancerV2Vault(_vault);

        for (uint256 i; i < _poolIds.length; i++) {
            (address poolAddress, IBalancerV2Vault.PoolSpecialization specialization) = vault
                .getPool(_poolIds[i]);

            require(
                specialization == IBalancerV2Vault.PoolSpecialization.TWO_TOKEN,
                "__addPoolTokens: Unsupported pool type. Only TWO_TOKEN pools supported."
            );

            (IERC20[] memory tokens, , ) = vault.getPoolTokens(_poolIds[i]);

            address token0 = address(tokens[0]);
            address token1 = address(tokens[1]);

            require(
                __poolTokenIsSupportable(
                    _derivativePriceFeed,
                    _primitivePriceFeed,
                    token0,
                    token1
                ),
                "__addPoolTokens: Unsupported pool token"
            );

            PoolTokenDescriptor memory poolTokenDescriptor = PoolTokenDescriptor({
                token0: token0,
                token1: token1,
                token0Decimals: ERC20(token0).decimals(),
                token1Decimals: ERC20(token1).decimals()
            });

            poolTokenToPoolDescriptor[poolAddress] = PoolDescriptor({
                poolId: _poolIds[i],
                poolTokenDescriptor: poolTokenDescriptor
            });

            emit PoolTokenAdded(poolAddress, token0, token1);
            // emit PoolTokenAdded(poolAddress, _poolIds[i], token0, token1);
        }
    }

    /// @dev Helper to determine if a pool token is supportable, based on whether price feeds are
    /// available for its underlying feeds. At least one of the underlying tokens must be
    /// a supported primitive asset, and the other must be a primitive or derivative.
    function __poolTokenIsSupportable(
        address _derivativePriceFeed,
        address _primitivePriceFeed,
        address _token0,
        address _token1
    ) private view returns (bool isSupportable_) {
        IDerivativePriceFeed derivativePriceFeedContract = IDerivativePriceFeed(
            _derivativePriceFeed
        );
        IPrimitivePriceFeed primitivePriceFeedContract = IPrimitivePriceFeed(_primitivePriceFeed);

        if (primitivePriceFeedContract.isSupportedAsset(_token0)) {
            if (
                primitivePriceFeedContract.isSupportedAsset(_token1) ||
                derivativePriceFeedContract.isSupportedAsset(_token1)
            ) {
                return true;
            }
        } else if (
            derivativePriceFeedContract.isSupportedAsset(_token0) &&
            primitivePriceFeedContract.isSupportedAsset(_token1)
        ) {
            return true;
        }

        return false;
    }

    ///////////////////
    // STATE GETTERS //
    ///////////////////

    /// @notice Gets the `DERIVATIVE_PRICE_FEED` variable value
    /// @return derivativePriceFeed_ The `DERIVATIVE_PRICE_FEED` variable value
    function getDerivativePriceFeed() external view returns (address derivativePriceFeed_) {
        return DERIVATIVE_PRICE_FEED;
    }

    /// @notice Gets the `VAULT` variable value
    /// @return vault_ The `VAULT` variable value
    function getVault() external view returns (address vault_) {
        return VAULT;
    }

    /// @notice Gets the `PoolDescriptor` metadata for a given pool address
    /// @param _poolAddress The pool address for which to get the `PoolDescriptor`
    /// @return poolDescriptor_ The `PoolDescriptor` value
    function getPoolDescriptor(address _poolAddress)
        public
        view
        returns (PoolDescriptor memory poolDescriptor_)
    {
        return poolTokenToPoolDescriptor[_poolAddress];
    }

    function getPoolData(address _poolAddress)
        public
        view
        returns (
            IERC20[] memory tokens,
            uint256[] memory balances,
            uint256 lastChangeBlock
        )
    {
        IBalancerV2Vault vault = IBalancerV2Vault(VAULT);
        (tokens, balances, lastChangeBlock) = vault.getPoolTokens(
            poolTokenToPoolDescriptor[_poolAddress].poolId
        );
        return (tokens, balances, lastChangeBlock);
    }

    function getBalancerV2Vault() public view returns (address) {
        return address(vault);
    }

    function getTokensFromPool(bytes32 _poolId) public view returns (IERC20[] memory tokens) {
        (tokens, , ) = vault.getPoolTokens(_poolId);
        return tokens;
    }

    function calcPoolValues(bytes32 _poolId) public returns (uint256[] memory underlyingValues_) {
        (IERC20[] memory tokens, uint256[] memory balances, ) = getPoolInfoFromPool(_poolId);
        uint256[] memory prices = getAllPrices(tokens);
        underlyingValues_ = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            underlyingValues_[i] = balances[i] * prices[i];
        }
        return (underlyingValues_);
    }

    //_derivative is the BPT token address, _derivativeAmount is the number of bpts
    function calcUnderlyingValues(address _derivative, uint256 _derivativeAmount)
        external
        returns (address[] memory underlyings_, uint256[] memory underlyingAmounts_)
    {
        IBalancerV2Pool poolContract = IBalancerV2Pool(_derivative);
        bytes32 poolId = poolContract.getPoolId();
        uint256 totalBPT = poolContract.totalSupply();
        uint256 BPTPercentage = _derivativeAmount / totalBPT;
        (IERC20[] memory tokens, uint256[] memory balances, ) = getPoolInfoFromPool(poolId);
        underlyingAmounts_ = new uint256[](tokens.length);
        underlyings_ = new address[](tokens.length);
        for (uint256 i = 0; i < tokens.length; ) {
            underlyingAmounts_[i] = balances[i] * BPTPercentage;
            underlyings_[i] = address(tokens[i]);
        }
    }

    /// @notice Gets the `PRIMITIVE_PRICE_FEED` variable value
    /// @return primitivePriceFeed_ The `PRIMITIVE_PRICE_FEED` variable value
    function getPrimitivePriceFeed() external view returns (address primitivePriceFeed_) {
        return PRIMITIVE_PRICE_FEED;
    }

    /// @notice Gets the `VALUE_INTERPRETER` variable value
    /// @return valueInterpreter_ The `VALUE_INTERPRETER` variable value
    function getValueInterpreter() external view returns (address valueInterpreter_) {
        return VALUE_INTERPRETER;
    }

    function calcBPTValue(bytes32 _poolId) public returns (uint256 totalSupply, uint256 BPTValue) {
        address _poolAddress = getAddress(_poolId);
        totalSupply = getPoolTotalSupply(_poolAddress);
        uint256 totalTokenValue;
        uint256[] memory underlyingValues_ = calcPoolValues(_poolId);
        for (uint256 i = 0; i < underlyingValues_.length; i++) {
            totalTokenValue += underlyingValues_[i];
        }
        BPTValue = totalTokenValue / totalSupply;
    }

    function getPoolTotalSupply(address _poolAddress) public view returns (uint256) {
        return IBalancerV2Pool(_poolAddress).totalSupply();
    }
}
