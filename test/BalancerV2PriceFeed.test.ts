import { IntegrationManager } from '@enzymefinance/protocol';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import hre from 'hardhat';

const addresses = {
  BalancerV2Vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
  EnzymeCouncil: '0xb270fe91e8e4b80452fbf1b4704208792a350f53',
  IntegrationManager: '0x965ca477106476B4600562a2eBe13536581883A6',
};

let enzymeCouncil: SignerWithAddress;
let balancerV2PriceFeed: any;
let integrationManager: IntegrationManager;

before(async () => {
  enzymeCouncil = await hre.ethers.getSigner(addresses.EnzymeCouncil);
  await hre.network.provider.send('hardhat_impersonateAccount', [enzymeCouncil.address]);

  const balancerV2PriceFeedFactory = await hre.ethers.getContractFactory('BalancerV2PriceFeed');
  balancerV2PriceFeed = await balancerV2PriceFeedFactory.deploy(addresses.BalancerV2Vault);

  integrationManager = new IntegrationManager(addresses.IntegrationManager, enzymeCouncil);
  await integrationManager.registerAdapters([balancerV2PriceFeed.address]);
});

it('deploys correctly', async () => {
  // Check that the initial values are set in the constructor.
  expect(await balancerV2PriceFeed.getIntegrationManager()).to.equal(addresses.IntegrationManager);
  expect(await balancerV2PriceFeed.getBalancerV2Vault()).to.equal(addresses.BalancerV2Vault);

  // Check that the adapter is registered on the integration manager.
  expect(await integrationManager.getRegisteredAdapters()).to.include(balancerV2PriceFeed.address);
});

it('should return an array of tokens and balances', async () => {
  const response = balancerV2PriceFeed.getPoolTokens(100);
  console.log(response);
});
