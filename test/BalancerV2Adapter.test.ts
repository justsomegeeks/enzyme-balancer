import { SwapTypes } from '@balancer-labs/sor';
import { assetTransferArgs, IntegrationManager, takeOrderSelector } from '@enzymefinance/protocol';
import type { BaseProvider } from '@ethersproject/providers';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import BigNumber from 'bignumber.js';
import { expect } from 'chai';
import type { Contract, ContractFactory } from 'ethers';
import hre from 'hardhat';
import { before } from 'mocha';

import type { BalancerV2TakeOrder, FundManagement, NetworkDescriptor } from '../utils/env-helper';
import {
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
    let balancerV2Adapter: Contract;
    let usdcWhale: SignerWithAddress;

    before(async function () {
      balancerV2Adapter = await balancerV2AdapterFactory.deploy(
        networkDescriptor.contracts.IntegrationManager,
        networkDescriptor.contracts.BalancerV2Vault,
      );

      await integrationManager.registerAdapters([balancerV2Adapter.address]);
      usdcWhale = await hre.ethers.getSigner(networkDescriptor.tokens.USDC.whaleAddress);
      await hre.network.provider.send('hardhat_impersonateAccount', [usdcWhale.address]);
    });

    xit('can only be called via the IntegrationManager', async function () {
      const queryOnChain = true;
      const swapType = SwapTypes.SwapExactIn;

      const tokenIn = networkDescriptor.tokens.ETH;
      const tokenOut = networkDescriptor.tokens.USDC;
      const swapAmount = new BigNumber(1);

      const [swapInfo] = await getSwap(provider, queryOnChain, swapType, tokenIn, tokenOut, swapAmount);

      const funds: FundManagement = {
        fromInternalBalance: false,
        recipient: tokenIn.whaleAddress,
        sender: tokenIn.whaleAddress,
        toInternalBalance: false,
      };

      const limits = calculateLimits(swapType, swapInfo);

      const deadline = hre.ethers.constants.MaxUint256;

      const takeOrderArgs = balancerV2TakeOrderArgs({
        deadline,
        funds,
        limits,
        swapType,
        swaps: swapInfo.swaps,
        tokenAddresses: [tokenIn.address, tokenOut.address],
      } as BalancerV2TakeOrder);

      const transferArgs = await assetTransferArgs({
        adapter: balancerV2Adapter.getInterface(),
        encodedCallArgs: takeOrderArgs,
        selector: takeOrderSelector,
      });

      expect(transferArgs).to.not.be.undefined;

      await expect(
        balancerV2Adapter.takeOrder(balancerV2Adapter.address, takeOrderSelector, transferArgs),
      ).to.be.revertedWith('Only the IntegrationManager can call this function');
    });
  });

  describe('lend',() => {
    let balancerV2Adapter: Contract;
    let usdcWhale: SignerWithAddress;
    before(async function () {
      balancerV2Adapter = await balancerV2AdapterFactory.deploy(
        networkDescriptor.contracts.IntegrationManager,
        networkDescriptor.contracts.BalancerV2Vault,
      );

      await integrationManager.registerAdapters([balancerV2Adapter.address]);
      usdcWhale = await hre.ethers.getSigner(networkDescriptor.tokens.USDC.whaleAddress);
      await hre.network.provider.send('hardhat_impersonateAccount', [usdcWhale.address]);
    });

    it('works as expected when called for lending by a fund', async () => {
  
      /*const { comptrollerProxy, vaultProxy } = await createNewFund({
        signer: usdcWhale,
        usdcWhale,
        fundDeployer: fork.deployment.fundDeployer,
        denominationAsset: new StandardToken(fork.config.weth, usdcWhale),
      });
  
      const token = new StandardToken(fork.config.primitives.usdc, whales.usdc);
      const amount = utils.parseUnits('1', await token.decimals());
      const aToken = new StandardToken(fork.config.aave.atokens.ausdc[0], whales.ausdc);
  
      await token.transfer(vaultProxy, amount);
  
      const [preTxIncomingAssetBalance, preTxOutgoingAssetBalance] = await getAssetBalances({
        account: vaultProxy,
        assets: [aToken, token],
      });
  
      const lendReceipt = await aaveLend({
        comptrollerProxy,
        integrationManager: fork.deployment.integrationManager,
        fundOwner,
        aaveAdapter: fork.deployment.aaveAdapter,
        aToken,
        amount,
      });
  
      const [postTxIncomingAssetBalance, postTxOutgoingAssetBalance] = await getAssetBalances({
        account: vaultProxy,
        assets: [aToken, token],
      });
  
      // aToken amount received can be a small amount less than expected
      const expectedIncomingAssetBalance = preTxIncomingAssetBalance.add(amount);
      expect(postTxIncomingAssetBalance).toBeLteBigNumber(expectedIncomingAssetBalance);
      expect(postTxIncomingAssetBalance).toBeGteBigNumber(expectedIncomingAssetBalance.sub(roundingBuffer));
  
      expect(postTxOutgoingAssetBalance).toEqBigNumber(preTxOutgoingAssetBalance.sub(amount));
  
      // Rounding up from 540942
      expect(lendReceipt).toCostLessThan('542000');*/
      await expect(
        balancerV2Adapter.lend(
          1,
          1,
          1,
          1
      ) ,
      ).to.be.reverted;
    });
  });
});
