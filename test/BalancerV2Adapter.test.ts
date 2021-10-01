import { SwapTypes } from '@balancer-labs/sor';
import { IntegrationManager, takeOrderSelector } from '@enzymefinance/protocol';
import type { BaseProvider } from '@ethersproject/providers';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import BigNumber from 'bignumber.js';
import { expect } from 'chai';
import type { Contract, ContractFactory } from 'ethers';
import hre from 'hardhat';

import type { BalancerV2Adapter } from '../typechain';
import type { NetworkDescriptor } from '../utils/env-helper';
import {
  assetTransferArgs,
  balancerV2TakeOrderArgs,
  calculateLimits,
  getNetworkDescriptor,
  getSwap,
  initializeEnvHelper,
} from '../utils/env-helper';

describe('BalancerV2Adapter', async function () {
  let provider: BaseProvider;

  let networkDescriptor: NetworkDescriptor;
  let enzymeCouncil: SignerWithAddress;
  let integrationManager: IntegrationManager;

  let balancerV2AdapterFactory: ContractFactory;

  before(async function () {
    initializeEnvHelper(hre);

    provider = hre.ethers.getDefaultProvider();

    networkDescriptor = await getNetworkDescriptor(provider);

    enzymeCouncil = await hre.ethers.getSigner(networkDescriptor.contracts.EnzymeCouncil);
    await hre.network.provider.send('hardhat_impersonateAccount', [enzymeCouncil.address]);

    balancerV2AdapterFactory = await hre.ethers.getContractFactory('BalancerV2Adapter');
    integrationManager = new IntegrationManager(networkDescriptor.contracts.IntegrationManager, enzymeCouncil);
  });

  describe('constructor', async function () {
    it('deploys correctly', async function () {
      const balancerV2Adapter = await balancerV2AdapterFactory.deploy(
        networkDescriptor.contracts.IntegrationManager,
        networkDescriptor.contracts.BalancerV2Vault,
      );

      await integrationManager.registerAdapters([balancerV2Adapter.address]);

      // Check that the initial values are set in the constructor.
      expect(await balancerV2Adapter.getIntegrationManager()).to.equal(networkDescriptor.contracts.IntegrationManager);
      expect(await balancerV2Adapter.getBalancerV2Vault()).to.equal(networkDescriptor.contracts.BalancerV2Vault);

      // Check that the adapter is registered on the integration manager.
      expect(await integrationManager.getRegisteredAdapters()).to.include(balancerV2Adapter.address);
    });
  });

  describe('takeOrder', async function () {
    let balancerV2AdapterContract: Contract;
    let balancerV2Adapter: BalancerV2Adapter;
    let usdcWhaleSigner: SignerWithAddress;

    before(async function () {
      balancerV2AdapterContract = await balancerV2AdapterFactory.deploy(
        networkDescriptor.contracts.IntegrationManager,
        networkDescriptor.contracts.BalancerV2Vault,
      );

      await balancerV2AdapterContract.deployed();

      balancerV2Adapter = balancerV2AdapterContract as BalancerV2Adapter;

      await integrationManager.registerAdapters([balancerV2AdapterContract.address]);
      usdcWhaleSigner = await hre.ethers.getSigner(networkDescriptor.tokens.USDC.whaleAddress);
      await hre.network.provider.send('hardhat_impersonateAccount', [usdcWhaleSigner.address]);
    });

    it('can only be called via the IntegrationManager', async function () {
      const queryOnChain = true;
      const swapType = SwapTypes.SwapExactIn;

      const tokenIn = networkDescriptor.tokens.ETH;
      const tokenOut = networkDescriptor.tokens.USDC;
      const swapAmount = new BigNumber(1);

      const [swapInfo] = await getSwap(provider, queryOnChain, swapType, tokenIn, tokenOut, swapAmount);

      const limits = calculateLimits(swapType, swapInfo);
      console.log(swapInfo.swaps);

      const deadline = hre.ethers.constants.MaxUint256;

      const takeOrderArgs = balancerV2TakeOrderArgs({
        deadline,
        limits,
        swapType,
        swaps: swapInfo.swaps,
        tokenAddresses: [tokenIn.address, tokenOut.address],
      });

      const transferArgs = await assetTransferArgs({
        adapter: balancerV2Adapter,
        encodedCallArgs: takeOrderArgs,
        selector: takeOrderSelector,
      });

      await expect(
        balancerV2AdapterContract.takeOrder(balancerV2AdapterContract.address, takeOrderSelector, transferArgs),
      ).to.be.revertedWith('Only the IntegrationManager can call this function');
    });
    it('should allow to do swap', async function () {
      const queryOnChain = true;
      const swapType = SwapTypes.SwapExactIn;

      const tokenIn = networkDescriptor.tokens.ETH;
      const tokenOut = networkDescriptor.tokens.USDC;
      const swapAmount = new BigNumber(1);

      const [swapInfo] = await getSwap(provider, queryOnChain, swapType, tokenIn, tokenOut, swapAmount);

      const limits = calculateLimits(swapType, swapInfo);

      const deadline = hre.ethers.constants.MaxUint256;

      const takeOrderArgs = balancerV2TakeOrderArgs({
        deadline,
        limits,
        swapType,
        swaps: swapInfo.swaps,
        tokenAddresses: [tokenIn.address, tokenOut.address],
      });

      const transferArgs = await assetTransferArgs({
        adapter: balancerV2Adapter,
        encodedCallArgs: takeOrderArgs,
        selector: takeOrderSelector,
      });
      const integrationManagerSigner = await hre.ethers.getSigner(networkDescriptor.contracts.IntegrationManager);
      await hre.network.provider.send('hardhat_impersonateAccount', [integrationManagerSigner.address]);

      //TODO: Error is happening when trying to transfer the fund. Why? I have never seen this happen before.
      const tx = await usdcWhaleSigner.sendTransaction({
        to: networkDescriptor.contracts.IntegrationManager,
        value: hre.ethers.utils.parseEther('10'),
      });
      await tx.wait();

      await expect(
        balancerV2AdapterContract
          .connect(integrationManagerSigner)
          .takeOrder(integrationManager.address, takeOrderSelector, transferArgs),
      ).to.not.reverted;
    });
  });
});
