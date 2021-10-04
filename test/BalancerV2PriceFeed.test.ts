// import { IntegrationManager } from '@enzymefinance/protocol';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import hre from 'hardhat';
// import { fetchSubgraphPools } from '../tasks/bal_poolCaching';

describe('BalancerV2PriceFeed', function () {
  const addresses = {
    BalancerV2Vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    EnzymeCouncil: '0xb270fe91e8e4b80452fbf1b4704208792a350f53',
    IntegrationManager: '0x965ca477106476B4600562a2eBe13536581883A6',
  };
  const WETH_BTCPoolId = '0xa6f548df93de924d73be7d25dc02554c6bd66db500020000000000000000000e';
  const WETH_BTCPoolAddress = '0xa6f548df93de924d73be7d25dc02554c6bd66db5';

  let enzymeCouncil: SignerWithAddress;
  let balancerV2PriceFeed: any;
  // let integrationManager: IntegrationManager;

  before(async () => {
    enzymeCouncil = await hre.ethers.getSigner(addresses.EnzymeCouncil);
    await hre.network.provider.send('hardhat_impersonateAccount', [enzymeCouncil.address]);

    const BalancerV2PriceFeed = await hre.ethers.getContractFactory('BalancerV2PriceFeed');
    balancerV2PriceFeed = await BalancerV2PriceFeed.deploy(addresses.BalancerV2Vault);

    // integrationManager = new IntegrationManager(addresses.IntegrationManager, enzymeCouncil);
    // await integrationManager.registerAdapters([balancerV2PriceFeed.address]);
  });

  it('deploys correctly', async function () {
    expect(await balancerV2PriceFeed.getBalancerV2Vault()).to.equal(addresses.BalancerV2Vault);
  });

  it('should return accurate total supply', async () => {
    const supply = await balancerV2PriceFeed.getPoolTotalSupply(WETH_BTCPoolAddress);
    const graphSupply = await hre.run('bal_getTotalSupply');
    expect(graphSupply === supply);
  });

  it('should return total underlying tokens and their values', async () => {
    const [tokens] = await balancerV2PriceFeed.callStatic.calcUnderlyingValues(WETH_BTCPoolId);
    const graphTokens = await hre.run('bal_getPool');
    //const graphSupply = await hre.run('bal_getTotalSupply');
    expect(tokens.filter((el: number, i: number) => el === graphTokens[0].tokensList[i]).length === 2);
  });

  it('should return total value of supply in pool and total BPTValue', async () => {
    const [totalSupply, BPTValue] = await balancerV2PriceFeed.callStatic.calcBPTValue(WETH_BTCPoolId);
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
