import { IntegrationManager } from '@enzymefinance/protocol';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import hre from 'hardhat';

import type { BalancerV2Adapter } from '../typechain';

const addresses = {
  // TODO: change addresses to Balancer addresses when we know which addresses/pools we'll be using
  AugustusSwapper: '0x1bD435F3C054b6e901B7b108a0ab7617C808677b',
  EnzymeCouncil: '0xb270fe91e8e4b80452fbf1b4704208792a350f53',
  IntegrationManager: '0x965ca477106476B4600562a2eBe13536581883A6',
  TokenTransferProxy: '0xb70Bc06D2c9Bf03b3373799606dc7d39346c06B3',
};

let enzymeCouncil: SignerWithAddress;
let balancerV2Adapter: BalancerV2Adapter;
let integrationManager: IntegrationManager;

before(async () => {
  enzymeCouncil = await hre.ethers.getSigner(addresses.EnzymeCouncil);
  await hre.network.provider.send('hardhat_impersonateAccount', [enzymeCouncil.address]);

  const balancerV2AdapterFactory = await hre.ethers.getContractFactory('BalancerV2Adapter');
  balancerV2Adapter = await balancerV2AdapterFactory.deploy(
    addresses.IntegrationManager,
    addresses.AugustusSwapper,
    addresses.TokenTransferProxy,
  );

  integrationManager = new IntegrationManager(addresses.IntegrationManager, enzymeCouncil);
  await integrationManager.registerAdapters([balancerV2Adapter.address]);
});

it('deploys correctly', async () => {
  // Check that the initial values are set in the constructor.
  expect(await balancerV2Adapter.getIntegrationManager()).to.equal(addresses.IntegrationManager);
  //   expect(await balancerV2Adapter.getParaSwapV4AugustusSwapper()).to.equal(addresses.AugustusSwapper);
  //   expect(await balancerV2Adapter.getParaSwapV4TokenTransferProxy()).to.equal(addresses.TokenTransferProxy);

  // Check that the adapter is registered on the integration manager.
  //   expect(await integrationManager.getRegisteredAdapters()).to.include(balancerV2Adapter.address);
});

xit('... test functionality', async () => {
  // TODO: Test functionality.
});
