// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import "./interfaces/IBalancerV2Vault.sol";
import "./interfaces/IBalancerV2Pool.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract BalancerV2PriceFeed {
    using SafeMath for uint256;
    AggregatorV3Interface internal priceFeed;
    IBalancerV2Vault internal vault;
    mapping(address => Aggregator) public tokenAggregator;

    struct Aggregator {
        address aggAddress;
        bool isValue;
    }

    constructor(
        address _balancerV2Vault,
        address[] memory _erc20Addresses,
        address[] memory _aggregatorAddresses,
        bool[] memory _isValues
    ) public {
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

    function getPoolTotalSupply(address _poolAddress) public view returns (uint256 totalSupply) {
        IBalancerV2Pool pool = IBalancerV2Pool(_poolAddress);
        totalSupply = pool.totalSupply();
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

    function getAddress(bytes32 data) public pure returns (address) {
        return address(bytes20(data));
    }
}
