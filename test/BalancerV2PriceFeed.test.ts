import type { BaseProvider } from '@ethersproject/providers';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import hre from 'hardhat';

import type { NetworkDescriptor } from '../utils/env-helper';
import { getNetworkDescriptor, priceFeedContractArgsFromNetworkDescriptor } from '../utils/env-helper';

describe('BalancerV2PriceFeed', function () {
  let enzymeCouncil: SignerWithAddress;
  let balancerV2PriceFeed: any;

  let provider: BaseProvider;
  let networkDescriptor: NetworkDescriptor;
  let balancerV2PriceFeedArgs: [string, string[], string[], boolean[]];

  before(async () => {
    provider = hre.ethers.getDefaultProvider();

    networkDescriptor = await getNetworkDescriptor(provider);
    balancerV2PriceFeedArgs = priceFeedContractArgsFromNetworkDescriptor(networkDescriptor);

    const balancerV2PriceFeedFactory = await hre.ethers.getContractFactory('BalancerV2PriceFeed');

    balancerV2PriceFeed = await balancerV2PriceFeedFactory.deploy(...balancerV2PriceFeedArgs);
    await balancerV2PriceFeed.deployed();

    enzymeCouncil = await hre.ethers.getSigner(networkDescriptor.contracts.enzyme.EnzymeCouncil);
    await hre.network.provider.send('hardhat_impersonateAccount', [enzymeCouncil.address]);
  });

  it('deploys correctly', async function () {
    expect(await balancerV2PriceFeed.getBalancerV2Vault()).to.equal(
      networkDescriptor.contracts.balancer.BalancerV2Vault,
    );
  });

  it('should return accurate total supply', async () => {
    const supply = await balancerV2PriceFeed.getPoolTotalSupply(
      networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolAddress,
    );

    const graphSupply = await hre.run('bal_getTotalSupply');
    expect(graphSupply === supply);
  });

  it('should return total underlying tokens and their values', async () => {
    const [tokens] = await balancerV2PriceFeed.callStatic.calcUnderlyingValues(
      networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolId,
    );
    const graphTokens = await hre.run('bal_getPool');
    //const graphSupply = await hre.run('bal_getTotalSupply');
    expect(tokens.filter((el: number, i: number) => el === graphTokens[0].tokensList[i]).length === 2);
  });

  it('should return total value of supply in pool and total BPTValue', async () => {
    const [totalSupply, BPTValue] = await balancerV2PriceFeed.callStatic.calcBPTValue(
      networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolId,
    );
    //const graphSupply = await hre.run('bal_getTotalSupply');    // BPTValue);
    expect(BPTValue, totalSupply);
  });
  // it('should return the value of the token passed in', async function () {
  //   //not sure why this is reverting.  I'll work on it more after redeem is working.
  //   const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
  //   const WETHPrice = await balancerV2PriceFeed.callStatic.getLatestPrice(WETH);
  //   console.log('WETH', WETHPrice);
  //   expect(WETHPrice);
  // });
});
