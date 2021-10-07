// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import "@enzymefinance/contracts/release/infrastructure/price-feeds/derivatives/IDerivativePriceFeed.sol";
import "@enzymefinance/contracts/release/infrastructure/price-feeds/primitives/IPrimitivePriceFeed.sol";
import "@enzymefinance/contracts/release/extensions/utils/FundDeployerOwnerMixin.sol";

import "./interfaces/IBalancerV2Vault.sol";
import "./interfaces/IBalancerV2Pool.sol";
import "hardhat/console.sol";

contract BalancerV2PriceFeed is FundDeployerOwnerMixin {
    using SafeMath for uint256;
    AggregatorV3Interface internal priceFeed;
    IBalancerV2Vault internal vault;
    mapping(address => Aggregator) public tokenAggregator;

    struct Aggregator {
        address aggAddress;
        bool isValue;
    }

    constructor(
        address _fundDeployer,
        address _balancerV2Vault,
        address[] memory _erc20Addresses,
        address[] memory _aggregatorAddresses,
        bool[] memory _isValues
    ) public FundDeployerOwnerMixin(_fundDeployer) {
        require(
            (_erc20Addresses.length == _aggregatorAddresses.length) &&
                (_aggregatorAddresses.length == _isValues.length)
        );

        vault = IBalancerV2Vault(_balancerV2Vault);

        for (uint256 i = 0; i < _erc20Addresses.length; i++) {
            tokenAggregator[_erc20Addresses[i]] = Aggregator(
                _aggregatorAddresses[i],
                _isValues[i]
            );
        }
    }

    function getLatestPrice(address _token) public returns (uint256) {
        priceFeed = AggregatorV3Interface(_token);
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return uint256(price);
    }

    function getAllPrices(IERC20[] memory tokens) internal returns (uint256[] memory result) {
        uint256 size = tokens.length;
        result = new uint256[](size);
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokenAggregator[address(tokens[i])].isValue) {
                //prevents calling obscure tokens until we decide what to do with those
                result[i] = getLatestPrice(tokenAggregator[address(tokens[i])].aggAddress);
                console.log("RESULT", result[i]);
            } else {
                revert("token price not available");
            }
        }
    }

    function getTimestamp(address _token) public returns (int256) {
        priceFeed = AggregatorV3Interface(_token);
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
        (tokens, balances, lastChangeBlock) = vault.getPoolTokens(_poolId);
        return (tokens, balances, lastChangeBlock);
    }

    function getBalancerV2Vault() public view returns (address) {
        return address(vault);
    }

    function getTokensFromPool(bytes32 _poolId) public view returns (IERC20[] memory tokens) {
        (tokens, , ) = vault.getPoolTokens(_poolId);
        return tokens;
    }

    function calcUnderlyingValues(bytes32 _poolId)
        public
        returns (address[] memory underlyingTokens_, uint256[] memory underlyingValues_)
    {
        (IERC20[] memory tokens, uint256[] memory balances, ) = getPoolInfoFromPool(_poolId);
        for (uint256 i = 0; i < tokens.length; i++) {
            console.log("CALCUNDER Tokens", address(tokens[i]));
        }
        uint256[] memory prices = getAllPrices(tokens);
        underlyingTokens_ = new address[](tokens.length);
        underlyingValues_ = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            underlyingValues_[i] = balances[i] * prices[i];
            underlyingTokens_[i] = address(tokens[i]);
        }
        return (underlyingTokens_, underlyingValues_);
    }

    function getPoolTotalSupply(address _poolAddress) public view returns (uint256 totalSupply) {
        IBalancerV2Pool pool = IBalancerV2Pool(_poolAddress);
        totalSupply = pool.totalSupply();
    }

    function calcBPTValue(bytes32 _poolId) public returns (uint256 totalSupply, uint256 BPTValue) {
        address _poolAddress = getAddress(_poolId);
        totalSupply = getPoolTotalSupply(_poolAddress);
        uint256 totalTokenValue;
        (, uint256[] memory underlyingValues_) = calcUnderlyingValues(_poolId);
        for (uint256 i = 0; i < underlyingValues_.length; i++) {
            totalTokenValue += underlyingValues_[i];
        }
        BPTValue = totalTokenValue / totalSupply;
    }

    //////////////////////////
    // POOL TOKENS REGISTRY //
    //////////////////////////

    /// @notice Adds Uniswap pool tokens to the price feed
    /// @param _poolTokens Uniswap pool tokens to add
    function addPoolTokens(address[] calldata _poolTokens) external onlyFundDeployerOwner {
        require(_poolTokens.length > 0, "addPoolTokens: Empty _poolTokens");

        // __addPoolTokens(_poolTokens, DERIVATIVE_PRICE_FEED, PRIMITIVE_PRICE_FEED);
    }

    /// @dev Helper to add Uniswap pool tokens
    function __addPoolTokens(
        address[] memory _poolTokens,
        address _derivativePriceFeed,
        address _primitivePriceFeed
    ) private {
        console.log("We need to make it work");
        // for (uint256 i; i < _poolTokens.length; i++) {
        //     require(_poolTokens[i] != address(0), "__addPoolTokens: Empty poolToken");
        //     require(
        //         poolTokenToInfo[_poolTokens[i]].token0 == address(0),
        //         "__addPoolTokens: Value already set"
        //     );

        //     IUniswapV2Pair uniswapV2Pair = IUniswapV2Pair(_poolTokens[i]);
        //     address token0 = uniswapV2Pair.token0();
        //     address token1 = uniswapV2Pair.token1();

        //     require(
        //         __poolTokenIsSupportable(
        //             _derivativePriceFeed,
        //             _primitivePriceFeed,
        //             token0,
        //             token1
        //         ),
        //         "__addPoolTokens: Unsupported pool token"
        //     );

        //     poolTokenToInfo[_poolTokens[i]] = PoolTokenInfo({
        //         token0: token0,
        //         token1: token1,
        //         token0Decimals: ERC20(token0).decimals(),
        //         token1Decimals: ERC20(token1).decimals()
        //     });

        //     emit PoolTokenAdded(_poolTokens[i], token0, token1);
        // }
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
    function getAddress(bytes32 data) public pure returns (address) {
        return address(bytes20(data));
    }
}
