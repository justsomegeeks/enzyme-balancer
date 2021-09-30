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

  it('should return BPT Value and total BPT tokens.', async () => {
    const response = await balancerV2PriceFeed.calcBPTValue(
      '0xa660ba113f9aabaeb4bcd28a4a1705f4997d5432000200000000000000000022',
      '0xa660ba113f9aabaeb4bcd28a4a1705f4997d5432',
    );
    console.log(response);
    expect(response);
  });
});
