// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.6.12;

import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";

contract PriceConsumerV3 {
    AggregatorV3Interface internal priceFeedETH;

    AggregatorV3Interface internal priceFeedBTC;

    /**
     * Network: Kovan
     * Aggregator: ETH/USD
     * Address: 0x9326BFA02ADD2366b30bacB125260Af641031331
     Eth/USD ethMainnet 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419 
     btc/USD ethMainnet 0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c 
     CRV/USD ethMainnet 0xcd627aa160a6fa45eb793d19ef54f5062f20f33f
     YFI/USD ethMainnet 0xa027702dbb89fbd58938e4324ac03b58d812b0e1
     UNI/ETH ethMainnet 0xd6aa3d25116d8da79ea0246c4826eb951872e02e
     */

    constructor() public {
        priceFeedETH = AggregatorV3Interface(0x9326BFA02ADD2366b30bacB125260Af641031331);
        priceFeedBTC = AggregatorV3Interface(0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c);
    }

    function getLatestPriceETH() public view returns (int256) {
        // (
        //     uint80 roundID,
        //     int256 price,
        //     uint256 startedAt,
        //     uint256 timeStamp,
        //     uint80 answeredInRound
        // ) = priceFeedETH.latestRoundData();
        (, int256 price, , , ) = priceFeedETH.latestRoundData();
        return price;
    }

    function getLatestPriceBTC() public view returns (int256) {
        // (
        //     uint80 roundID,
        //     int256 price,
        //     uint256 startedAt,
        //     uint256 timeStamp,
        //     uint80 answeredInRound
        // ) = priceFeedETH.latestRoundData();
        (, int256 price, , , ) = priceFeedETH.latestRoundData();
        return price;
    }

    function getTimestampBTC() public view returns (uint256) {
        // (
        //     uint80 roundID,
        //     int256 price,
        //     uint256 startedAt,
        //     uint256 timeStamp,
        //     uint80 answeredInRound
        // ) = priceFeedETH.latestRoundData();
        (, , , uint256 timeStamp, ) = priceFeedETH.latestRoundData();
        return timeStamp;
    }
}
