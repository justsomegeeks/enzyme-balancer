import { SwapTypes } from '@balancer-labs/sor';
import type { AddressLike } from '@enzymefinance/ethers';
import {
  assetTransferArgs,
  IntegrationAdapterInterface,
  IntegrationManager,
  StandardToken,
  takeOrderSelector,
} from '@enzymefinance/protocol';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumberish, Contract, ContractFactory } from 'ethers';
import { BigNumber, utils } from 'ethers';
import hre from 'hardhat';
import { before } from 'mocha';
import { BalancerV2Adapter } from '../typechain';

function balancerV2TakeOrderArgs({
  pathAddresses,
  pathFees,
  outgoingAssetAmount,
  minIncomingAssetAmount,
}: {
  swapType: SwapTypes;
  pathFees: BigNumber[];
  outgoingAssetAmount: BigNumberish;
  minIncomingAssetAmount: BigNumberish;
}) {
  return '';
}

const addresses = {
  contracts: {
    BalancerV2Vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    EnzymeCouncil: '0xb270fe91e8e4b80452fbf1b4704208792a350f53',
    IntegrationManager: '0x965ca477106476B4600562a2eBe13536581883A6',
  },
  erc20s: {
    comp: {
      address: '0xc00e94cb662c3520282e6f5717214004a7f26888',
      decimals: 18,
    },
    usdc: {
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
    },
  },
  whales: {
    comp: '0xC89b6f0146642688bb254bF93C28fcCF1E182C81',
    usdc: '0xae2d4617c862309a3d75a0ffb358c7a5009c673f',
  },
};

describe('BalancerV2Adapter', async function () {
  let enzymeCouncil: SignerWithAddress;
  let integrationManager: IntegrationManager;

  let balancerV2AdapterFactory: ContractFactory;

  before(async function () {
    enzymeCouncil = await hre.ethers.getSigner(addresses.contracts.EnzymeCouncil);
    await hre.network.provider.send('hardhat_impersonateAccount', [enzymeCouncil.address]);

    balancerV2AdapterFactory = await hre.ethers.getContractFactory('BalancerV2Adapter');

    integrationManager = new IntegrationManager(addresses.contracts.IntegrationManager, enzymeCouncil);
  });

  describe('constructor', async function () {
    it('deploys correctly', async function () {
      const balancerV2Adapter = await balancerV2AdapterFactory.deploy(
        addresses.contracts.IntegrationManager,
        addresses.contracts.BalancerV2Vault,
      );

      await integrationManager.registerAdapters([balancerV2Adapter.address]);

      // Check that the initial values are set in the constructor.
      expect(await balancerV2Adapter.getIntegrationManager()).to.equal(addresses.contracts.IntegrationManager);
      expect(await balancerV2Adapter.getBalancerV2Vault()).to.equal(addresses.contracts.BalancerV2Vault);

      // Check that the adapter is registered on the integration manager.
      expect(await integrationManager.getRegisteredAdapters()).to.include(balancerV2Adapter.address);
    });
  });

  describe('takeOrder', async function () {
    let balancerV2Adapter: Contract;
    let usdcWhale: SignerWithAddress;

    before(async function () {
      balancerV2Adapter = await balancerV2AdapterFactory.deploy(
        addresses.contracts.IntegrationManager,
        addresses.contracts.BalancerV2Vault,
      );

      await integrationManager.registerAdapters([balancerV2Adapter.address]);

      usdcWhale = await hre.ethers.getSigner(addresses.whales.usdc);
      await hre.network.provider.send('hardhat_impersonateAccount', [usdcWhale.address]);
    });

    it('can only be called via the IntegrationManager', async function () {
      const outgoingAsset = new StandardToken(addresses.erc20s.usdc.address, usdcWhale);
      const incomingAsset = new StandardToken(addresses.erc20s.comp.address, hre.ethers.getDefaultProvider());

      const takeOrderArgs = balancerV2TakeOrderArgs({
        minIncomingAssetAmount: utils.parseUnits('1', await incomingAsset.decimals()),
        outgoingAssetAmount: utils.parseUnits('1', await outgoingAsset.decimals()),
        pathAddresses: [outgoingAsset, incomingAsset],
        pathFees: [BigNumber.from('3000')],
      });

      const transferArgs = await assetTransferArgs({
        adapter: balancerV2Adapter.getInterface(),
        encodedCallArgs: takeOrderArgs,
        selector: takeOrderSelector,
      });

      await expect(
        balancerV2Adapter.takeOrder(balancerV2Adapter.address, takeOrderSelector, transferArgs),
      ).to.be.revertedWith('Only the IntegrationManager can call this function');
    });
  });
});
