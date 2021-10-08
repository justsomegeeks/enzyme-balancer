// SPDX-License-Identifier: GPL-3.0

/*
    A Balancer V2 price feed for BPT tokens
*/

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import "@enzymefinance/contracts/release/infrastructure/price-feeds/derivatives/IDerivativePriceFeed.sol";
import "@enzymefinance/contracts/release/infrastructure/price-feeds/primitives/IPrimitivePriceFeed.sol";
import "@enzymefinance/contracts/release/extensions/utils/FundDeployerOwnerMixin.sol";
import "@enzymefinance/contracts/release/utils/MathHelpers.sol";

import "./interfaces/IBalancerV2Pool.sol";
import "./interfaces/IBalancerV2Vault.sol";
import "hardhat/console.sol";

/// @title BalancerV2PoolPriceFeed Contract
/// @author JustSomeGeeks Hackathon Team <https://github.com/justsomegeeks>
/// @notice Price feed for Balancer V2 BPT tokens
contract BalancerV2PriceFeed is
    IDerivativePriceFeed,
    FundDeployerOwnerMixin,
    MathHelpers
    /*Balancer V2V2PoolTokenValueCalculator*/
{
    event PoolTokenAdded(address indexed poolToken, address token0, address token1);

    struct PoolTokenInfo {
        address token0;
        address token1;
        uint8 token0Decimals;
        uint8 token1Decimals;
    }

    // BPT tokens have 18 decimals
    uint256 private constant POOL_TOKEN_UNIT = 10**18;

    address private immutable DERIVATIVE_PRICE_FEED;
    address private immutable PRIMITIVE_PRICE_FEED;
    address private immutable VALUE_INTERPRETER;

    IBalancerV2Vault private immutable BALANCER_V2_VAULT;

    bytes32 private immutable BALANCER_V2_POOL_ID;
    // Balancer V2 pool address and BPT ERC20 token address are the same
    address private immutable BALANCER_V2_POOL_ADDRESS;

    mapping(address => PoolTokenInfo) private poolTokenToInfo;

    constructor(
        address _fundDeployer,
        address _derivativePriceFeed,
        address _primitivePriceFeed,
        address _valueInterpreter,
        address _balancerV2Vault,
        bytes32 _balancerPoolId
    ) public FundDeployerOwnerMixin(_fundDeployer) {
        DERIVATIVE_PRICE_FEED = _derivativePriceFeed;
        PRIMITIVE_PRICE_FEED = _primitivePriceFeed;
        VALUE_INTERPRETER = _valueInterpreter;
        BALANCER_V2_VAULT = IBalancerV2Vault(_balancerV2Vault);
        BALANCER_V2_POOL_ID = _balancerPoolId;

        __initPool();
    }

    function __initPool() private {
        (IERC20[] memory poolTokens, , ) = BALANCER_V2_VAULT.getPoolTokens(BALANCER_V2_POOL_ID);

        require(
            __poolTokenIsSupportable(
                DERIVATIVE_PRICE_FEED,
                PRIMITIVE_PRICE_FEED,
                address(poolTokens[0]),
                address(poolTokens[1])
            ),
            "__addPoolTokens: Unsupported pool token"
        );

        (BALANCER_V2_POOL_ADDRESS, ) = BALANCER_V2_VAULT.getPool(BALANCER_V2_POOL_ID);

        poolTokenToInfo[BALANCER_V2_POOL_ADDRESS] = PoolTokenInfo({
            token0: address(poolTokens[0]),
            token1: address(poolTokens[1]),
            token0Decimals: ERC20(address(poolTokens[0])).decimals(),
            token1Decimals: ERC20(address(poolTokens[1])).decimals()
        });

        emit PoolTokenAdded(
            BALANCER_V2_POOL_ADDRESS,
            address(poolTokens[0]),
            address(poolTokens[1])
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
        // IBalancerV2Pool poolContract = IBalancerV2Pool(_derivative);
        uint256 totalBPT = getPoolTotalSupply(_derivative);
        uint256 BPTPercentage = _derivativeAmount / totalBPT;
        console.log(totalBPT, BPTPercentage);
        (IERC20[] memory tokens, uint256[] memory balances, ) = getPoolInfoFromPool(
            BALANCER_V2_POOL_ID
        );

        underlyingAmounts_ = new uint256[](tokens.length);
        underlyings_ = new address[](tokens.length);

        for (uint256 i = 0; i < tokens.length; ) {
            underlyingAmounts_[i] = balances[i] * BPTPercentage;
            underlyings_[i] = address(tokens[i]);
        }
        // // Define normalized rates for each underlying
        // underlyingAmounts_ = new uint256[](2);
        // underlyingAmounts_[0] = _derivativeAmount.mul(token0DenormalizedRate).div(POOL_TOKEN_UNIT);
        // underlyingAmounts_[1] = _derivativeAmount.mul(token1DenormalizedRate).div(POOL_TOKEN_UNIT);

        underlyingAmounts_ = new uint256[](2);
        underlyingAmounts_[0] = _derivativeAmount.div(POOL_TOKEN_UNIT);
        underlyingAmounts_[1] = _derivativeAmount.div(POOL_TOKEN_UNIT);

        return (underlyings_, underlyingAmounts_);
    }

    /// @notice Checks if an asset is supported by the price feed
    /// @param _asset The asset to check
    /// @return isSupported_ True if the asset is supported
    function isSupportedAsset(address _asset) public view override returns (bool isSupported_) {
        return poolTokenToInfo[_asset].token0 != address(0);
    }

    // PRIVATE FUNCTIONS

    /// @dev Calculates the trusted rate of two assets based on our price feeds.
    /// Uses the decimals-derived unit for whichever asset is used as the quote asset.
    // function __calcTrustedRate(
    //     address _token0,
    //     address _token1,
    //     uint256 _token0Decimals,
    //     uint256 _token1Decimals
    // ) private returns (uint256 token0RateAmount_, uint256 token1RateAmount_) {
    //     bool rateIsValid;
    //     // The quote asset of the value lookup must be a supported primitive asset,
    //     // so we cycle through the tokens until reaching a primitive.
    //     // If neither is a primitive, will revert at the ValueInterpreter
    //     if (IPrimitivePriceFeed(PRIMITIVE_PRICE_FEED).isSupportedAsset(_token0)) {
    //         token1RateAmount_ = 10**_token1Decimals;
    //         (token0RateAmount_, rateIsValid) = ValueInterpreter(VALUE_INTERPRETER)
    //             .calcCanonicalAssetValue(_token1, token1RateAmount_, _token0);
    //     } else {
    //         token0RateAmount_ = 10**_token0Decimals;
    //         (token1RateAmount_, rateIsValid) = ValueInterpreter(VALUE_INTERPRETER)
    //             .calcCanonicalAssetValue(_token0, token0RateAmount_, _token1);
    //     }

    //     require(rateIsValid, "__calcTrustedRate: Invalid rate");

    //     return (token0RateAmount_, token1RateAmount_);
    // }

    //////////////////////////
    // POOL TOKENS REGISTRY //
    //////////////////////////

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

    /// @notice Gets the `PoolTokenInfo` for a given pool token
    /// @param _poolToken The pool token for which to get the `PoolTokenInfo`
    /// @return poolTokenInfo_ The `PoolTokenInfo` value
    function getPoolTokenInfo(address _poolToken)
        external
        view
        returns (PoolTokenInfo memory poolTokenInfo_)
    {
        return poolTokenToInfo[_poolToken];
    }

    /// @notice Gets the underlyings for a given pool token
    /// @param _poolToken The pool token for which to get its underlyings
    /// @return token0_ The UniswapV2Pair.token0 value
    /// @return token1_ The UniswapV2Pair.token1 value
    function getPoolTokenUnderlyings(address _poolToken)
        external
        view
        returns (address token0_, address token1_)
    {
        return (poolTokenToInfo[_poolToken].token0, poolTokenToInfo[_poolToken].token1);
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

    ////////////////////////////////////////////////////////
    //////////////////old pricefeed functions///////////////////////
    //////////////////////////////////////////
    function getLatestPrice(address _token) public view returns (uint256) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(_token);
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return uint256(price);
    }

    function getAllPrices(IERC20[] memory tokens) internal view returns (uint256[] memory result) {
        uint256 size = tokens.length;
        result = new uint256[](size);
        for (uint256 i = 0; i < tokens.length; i++) {
            // if (tokenAggregator[address(tokens[i])].isValue) {
            //prevents calling obscure tokens until we decide what to do with those
            result[i] = getLatestPrice(address(tokens[i]));
            console.log("RESULT", result[i]);

            // } else {
            //     revert("token price not available");
            // }
        }
    }

    function getTimestamp(address _token) public view returns (int256) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(_token);
        (, , , uint256 timeStamp, ) = priceFeed.latestRoundData();
        return int256(timeStamp);
    }

    function getPoolInfoFromPool(bytes32 _poolId)
        public
        view
        returns (
            IERC20[] memory tokens,
            uint256[] memory balances,
            uint256 lastChangeBlock
        )
    {
        IBalancerV2Vault vault = IBalancerV2Vault(BALANCER_V2_VAULT);
        (tokens, balances, lastChangeBlock) = vault.getPoolTokens(_poolId);
        return (tokens, balances, lastChangeBlock);
    }

    function getBalancerV2Vault() public view returns (address) {
        return address(BALANCER_V2_VAULT);
    }

    function getTokensFromPool(bytes32 _poolId) public view returns (IERC20[] memory tokens) {
        IBalancerV2Vault vault = IBalancerV2Vault(BALANCER_V2_POOL_ADDRESS);
        (tokens, , ) = vault.getPoolTokens(_poolId);
        return tokens;
    }

    function calcPoolValues(bytes32 _poolId)
        public
        view
        returns (uint256[] memory underlyingValues_)
    {
        (IERC20[] memory tokens, uint256[] memory balances, ) = getPoolInfoFromPool(_poolId);
        uint256[] memory prices = getAllPrices(tokens);
        underlyingValues_ = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            underlyingValues_[i] = balances[i] * prices[i];
        }
        return (underlyingValues_);
    }

    function getPoolTotalSupply() public view returns (uint256 totalSupply) {
        IBalancerV2Pool pool = IBalancerV2Pool(BALANCER_V2_POOL_ADDRESS);
        totalSupply = pool.totalSupply();
    }

    function calcBPTValue(bytes32 _poolId)
        public
        view
        returns (uint256 totalSupply, uint256 BPTValue)
    {
        totalSupply = getPoolTotalSupply();
        uint256 totalTokenValue;
        uint256[] memory underlyingValues_ = calcPoolValues(_poolId);
        for (uint256 i = 0; i < underlyingValues_.length; i++) {
            totalTokenValue += underlyingValues_[i];
        }
        BPTValue = totalTokenValue / totalSupply;
    }
}
