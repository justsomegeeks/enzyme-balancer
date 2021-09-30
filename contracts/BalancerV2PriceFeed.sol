// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import "./interfaces/IBalancerV2Vault.sol";
import "./interfaces/IBalancerV2Asset.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract BalancerV2PriceFeed {
    using SafeMath for uint256;
    AggregatorV3Interface internal priceFeed;
    IBalancerV2Vault internal vault;
    mapping(uint256 => uint256) public tokenValues;
    mapping(address => Aggregator) public tokenAggregator;
    
    struct Aggregator {
     address aggAddress;
     bool isValue;
    }

    constructor(address _balancerV2Vault) public {
        vault = IBalancerV2Vault(_balancerV2Vault);
        tokenAggregator[0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2] = Aggregator(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419, true);//eth_usd
        tokenAggregator[0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599] = Aggregator(0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c, true);//btc_usd
        tokenAggregator[0xD533a949740bb3306d119CC777fa900bA034cd52] = Aggregator(0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f, true);//crv_usd
        tokenAggregator[0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e] = Aggregator(0xA027702dbb89fbd58938e4324ac03B58d812b0E1, true);//yfi_usd
        tokenAggregator[0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984] = Aggregator(0xD6aA3D25116d8dA79Ea0246c4826EB951872e02e, true);//uni_usd
        tokenAggregator[0xba100000625a3754423978a60c9317c58a424e3D] = Aggregator(0xC1438AA3823A6Ba0C159CfA8D98dF5A994bA120b, true);//bal
        tokenAggregator[0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48] = Aggregator(0xdCA36F27cbC4E38aE16C4E9f99D39b42337F6dcf, true);//usdc
        tokenAggregator[0x6B175474E89094C44Da98b954EedeAC495271d0F] = Aggregator(0x2bA49Aaa16E6afD2a993473cfB70Fa8559B523cF, true);//dai
    }

    function getLatestPrice(address _token) public returns (uint256) {
        priceFeed = AggregatorV3Interface(_token);
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return uint256(price);
    }

    function getAllPrices(IERC20[] memory tokens)internal returns(uint256[] memory result){
        for(uint i = 0; i < tokens.length; i++){
            if(tokenAggregator[address(tokens[0])].isValue){//prevents calling obscure tokens until we decide what to do with those
                result[i] = getLatestPrice(tokenAggregator[address(tokens[0])].aggAddress);
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
        returns (
            IERC20[] memory tokens,
            uint256[] memory balances,
            uint256 lastChangeBlock
        )
    {
        (tokens, balances, lastChangeBlock) = vault.getPoolTokens(_poolId);
        for (uint256 i = 0; i < tokens.length; i++) {
            console.log("TOKEN", address(tokens[i]), "BALANCE", uint256(balances[i]));
        }
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
        external
        returns (address[] memory underlyingTokens_, uint256[] memory underlyingValues_)
    {
        (IERC20[] memory tokens, uint256[] memory balances, ) = getPoolInfoFromPool(_poolId);
        uint256[] memory prices = getAllPrices(tokens);

        for (uint256 i = 0; i < tokens.length; i++) {
            underlyingValues_[i] = balances[i] * prices[i];
            underlyingTokens_[i] = address(tokens[i]);
        }

        return (underlyingTokens_, underlyingValues_);
    }
}

/**
 * Network: Kovan
 * Aggregator: ETH/USD
 * Address: 0x9326BFA02ADD2366b30bacB125260Af641031331
 */
//chainlink oracle addresses.
// address ETH_USD = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
// address BTC_USD = 0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c;
// address CRV_USD = 0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f;
// address YFI_USD = 0xA027702dbb89fbd58938e4324ac03B58d812b0E1;
// address UNI_ETH = 0xD6aA3D25116d8dA79Ea0246c4826EB951872e02e;
// balancer smart contract addresses on mainnet.
//     Vault: 0xBA12222222228d8Ba445958a75a0704d566BF2C8
// Authorizer: 0xA331D84eC860Bf466b4CdCcFb4aC09a1B43F3aE6
// WeightedPoolFactory: 0x8E9aa87E45e92bad84D5F8DD1bff34Fb92637dE9
// WeightedPool2TokensFactory: 0xA5bf2ddF098bb0Ef6d120C98217dD6B141c74EE0
// StablePoolFactory: 0xc66Ba2B6595D3613CCab350C886aCE23866EDe24
// LiquidityBootstrappingPoolFactory: 0x751A0bC0e3f75b38e01Cf25bFCE7fF36DE1C87DE
// MetastablePoolFactory: 0x67d27634E44793fE63c467035E31ea8635117cd4
// InvestmentPoolFactory: 0x48767F9F868a4A7b86A90736632F6E44C2df7fa9