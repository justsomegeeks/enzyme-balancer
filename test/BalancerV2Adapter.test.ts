import { IntegrationManager, takeOrderSelector } from '@enzymefinance/protocol';
import type { ProtocolDeployment } from '@enzymefinance/testutils';
import { createNewFund, deployProtocolFixture } from '@enzymefinance/testutils';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import hre from 'hardhat';

import type { BalancerV2Adapter } from '../typechain';

let fork: ProtocolDeployment;
beforeEach(async () => {
  fork = await deployProtocolFixture();
});

const addresses = {
  BalancerV2Vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
  EnzymeCouncil: '0xb270fe91e8e4b80452fbf1b4704208792a350f53',
  IntegrationManager: '0x965ca477106476B4600562a2eBe13536581883A6',
};

let enzymeCouncil: SignerWithAddress;
let balancerV2Adapter: BalancerV2Adapter;
let integrationManager: IntegrationManager;

before(async () => {
  enzymeCouncil = await hre.ethers.getSigner(addresses.EnzymeCouncil);
  await hre.network.provider.send('hardhat_impersonateAccount', [enzymeCouncil.address]);

  const balancerV2AdapterFactory = await hre.ethers.getContractFactory('BalancerV2Adapter');
  balancerV2Adapter = await balancerV2AdapterFactory.deploy(addresses.IntegrationManager, addresses.BalancerV2Vault);

  integrationManager = new IntegrationManager(addresses.IntegrationManager, enzymeCouncil);
  await integrationManager.registerAdapters([balancerV2Adapter.address]);
});

describe('constructor', () => {
  it('deploys correctly', async () => {
    // Check that the initial values are set in the constructor.
    expect(await balancerV2Adapter.getIntegrationManager()).to.equal(addresses.IntegrationManager);
    expect(await balancerV2Adapter.getBalancerV2Vault()).to.equal(addresses.BalancerV2Vault);

    // Check that the adapter is registered on the integration manager.
    expect(await integrationManager.getRegisteredAdapters()).to.include(balancerV2Adapter.address);
  });
});

describe('takeOrder', () => {
  it('can only be called via the IntegrationManager', async () => {
    const uniswapV3Adapter = fork.deployment.uniswapV3Adapter;
    const [fundOwner] = fork.accounts;

    const { vaultProxy } = await createNewFund({
      denominationAsset: new StandardToken(fork.config.primitives.usdc, provider),
      fundDeployer: fork.deployment.fundDeployer,
      fundOwner,
      signer: fundOwner,
    });

    const outgoingAsset = new StandardToken(fork.config.primitives.mln, whales.mln);
    const incomingAsset = new StandardToken(fork.config.weth, provider);

    const takeOrderArgs = uniswapV3TakeOrderArgs({
      minIncomingAssetAmount: utils.parseUnits('1', await incomingAsset.decimals()),
      outgoingAssetAmount: utils.parseUnits('1', await outgoingAsset.decimals()),
      pathAddresses: [outgoingAsset, incomingAsset],
      pathFees: [BigNumber.from('3000')],
    });

    const transferArgs = await assetTransferArgs({
      adapter: uniswapV3Adapter,
      encodedCallArgs: takeOrderArgs,
      selector: takeOrderSelector,
    });

    await expect(uniswapV3Adapter.takeOrder(vaultProxy, takeOrderSelector, transferArgs)).rejects.toBeRevertedWith(
      'Only the IntegrationManager can call this function',
    );
  });
});
