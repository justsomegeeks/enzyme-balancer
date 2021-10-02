import type { SwapInfo } from '@balancer-labs/sor';
import { SwapTypes } from '@balancer-labs/sor';
<<<<<<< HEAD
import { IntegrationManager, takeOrderSelector } from '@enzymefinance/protocol';
=======
import { JoinPoolRequest } from '@balancer-labs/balancer-js';
import { assetTransferArgs, IntegrationManager, takeOrderSelector, lendSelector } from '@enzymefinance/protocol';
>>>>>>> WIP: tests
import type { BaseProvider } from '@ethersproject/providers';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber as BN } from 'bignumber.js';
import { expect } from 'chai';
import type { ContractFactory } from 'ethers';
import hre from 'hardhat';
<<<<<<< HEAD

import type { BalancerV2Adapter } from '../typechain';
import type { NetworkDescriptor, TokenDescriptor } from '../utils/env-helper';
import { getNetworkDescriptor, initializeEnvHelper } from '../utils/env-helper';
import { balancerV2TakeOrderArgs, calculateLimits, getSwap } from '../utils/integrations/balancerV2';

describe('BalancerV2Adapter', function () {
=======
import { before } from 'mocha';

import type { BalancerV2Lend, BalancerV2TakeOrder, FundManagement, NetworkDescriptor } from '../utils/env-helper';
import {
  balancerV2TakeOrderArgs,
  BalancerV2LendArgs,
  calculateLimits,
  getNetworkDescriptor,
  getSwap,
  initializeEnvHelper,
  
} from '../utils/env-helper';

describe('BalancerV2Adapter', async function () {
>>>>>>> WIP: tests
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

  describe('constructor', function () {
    it('deploys correctly', async function () {
      const balancerV2Adapter = await balancerV2AdapterFactory.deploy(
        networkDescriptor.contracts.IntegrationManager,
        networkDescriptor.contracts.BalancerV2Vault,
      );

      await integrationManager.registerAdapters([balancerV2Adapter.address]);

      // AdapterBase2
      expect(await balancerV2Adapter.getIntegrationManager()).to.equal(networkDescriptor.contracts.IntegrationManager);

      // BalancerV2ActionsMixin
      expect(await balancerV2Adapter.getBalancerV2Vault()).to.equal(networkDescriptor.contracts.BalancerV2Vault);

      // Check that the adapter is registered on the integration manager.
      expect(await integrationManager.getRegisteredAdapters()).to.include(balancerV2Adapter.address);
    });
  });

  describe('parseAssetsForMethod', function () {
    const queryOnChain = true;
    const swapType = SwapTypes.SwapExactIn;
    const swapAmount = new BN(1);

    const deadline = hre.ethers.constants.MaxUint256;

    let balancerV2Adapter: BalancerV2Adapter;
    let swapInfo: SwapInfo;
    let limits: string[];
    let args: string;

    let tokenIn: TokenDescriptor;
    let tokenOut: TokenDescriptor;

    before(async function () {
      tokenIn = networkDescriptor.tokens.WBTC;
      tokenOut = networkDescriptor.tokens.WETH;

      balancerV2Adapter = (await balancerV2AdapterFactory.deploy(
        networkDescriptor.contracts.IntegrationManager,
        networkDescriptor.contracts.BalancerV2Vault,
      )) as BalancerV2Adapter;

      await balancerV2Adapter.deployed();

      await integrationManager.registerAdapters([balancerV2Adapter.address]);

      [swapInfo] = await getSwap(provider, queryOnChain, swapType, tokenIn, tokenOut, swapAmount);
      limits = calculateLimits(swapType, swapInfo);

      args = balancerV2TakeOrderArgs({
        deadline,
        limits,
        swapType,
        swaps: swapInfo.swaps,
        tokenAddresses: [tokenIn.address, tokenOut.address],
        tokenOutAmount: swapInfo.returnAmount,
      });
    });

    it('does not allow a bad selector', async function () {
      // avoid temptation to use `utils.randomBytes(4)`. unlikely in this case, but randomness in tests
      // can cause spurious test failures
      const randomBytes = [241, 189, 26, 18];
      await expect(balancerV2Adapter.parseAssetsForMethod(randomBytes, args)).to.be.revertedWith('_selector invalid');
    });

    it('returns expected parsed assets for method', async function () {
      expect(await balancerV2Adapter.parseAssetsForMethod(takeOrderSelector, args)).to.have.length(5);

      /*
        TODO: find toMatchFunctionOutput() matcher
        expect(result).toMatchFunctionOutput(paraSwapV4Adapter.parseAssetsForMethod, {
          spendAssetsHandleType_: SpendAssetsHandleType.Transfer,
          incomingAssets_: [incomingAsset],
          spendAssets_: [outgoingAsset],
          spendAssetAmounts_: [outgoingAssetAmount],
          minIncomingAssetAmounts_: [minIncomingAssetAmount]
        });
      */
    });

    xit('generates expected output for lending', async function () {
      return;
    });

    xit('generates expected output for redeeming', async function () {
      return;
    });
  });

  describe('takeOrder', function () {
    xit('can only be called via the IntegrationManager', async function () {
      return;
    });

    xit('works as expected when called by a fund', async function () {
      return;
    });
  });

  describe('lend', function () {
    xit('can only be called via the IntegrationManager', async function () {
      return;
    });

    xit('works as expected when called by a fund', async function () {
      return;
    });
  });

  describe('redeem', function () {
    xit('can only be called via the IntegrationManager', async function () {
      return;
    });

    xit('works as expected when called by a fund', async function () {
      return;
    });
  });

  describe('lend',() => {
    let balancerV2Adapter: Contract;
    let usdcWhale: SignerWithAddress;
    let lendArgs: any;
    before(async function () {
      balancerV2Adapter = await balancerV2AdapterFactory.deploy(
        networkDescriptor.contracts.IntegrationManager,
        networkDescriptor.contracts.BalancerV2Vault,
      );

      await integrationManager.registerAdapters([balancerV2Adapter.address]);
      usdcWhale = await hre.ethers.getSigner(networkDescriptor.tokens.USDC.whaleAddress);
      await hre.network.provider.send('hardhat_impersonateAccount', [usdcWhale.address]);
      const poolId = '0x01abc00e86c7e258823b9a055fd62ca6cf61a16300010000000000000000003b';
      const recipient = usdcWhale.address;
      let joinRequest: JoinPoolRequest;
      const tokens = networkDescriptor.tokens;
      const initialBalances = [0 , 1];
      const initUserData =
      hre.ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'],[0, initialBalances]);


      joinRequest = {
        assets: [tokens.DAI.address, tokens.USDC.address],
        maxAmountsIn: [0, 1],
        userData: initUserData,
        fromInternalBalance: false,
      };

      lendArgs = BalancerV2LendArgs({
        poolId, recipient, joinRequest
      } as BalancerV2Lend);

      const transferArgs = await assetTransferArgs({
        adapter: balancerV2Adapter.getInterface(),
        encodedCallArgs: lendArgs,
        selector: lendSelector,
      });

      expect(balancerV2Adapter.lend(balancerV2Adapter.address, lendSelector, transferArgs));
    });

    it('should revert if parameter is invalid', async() => {
      await expect(
        balancerV2Adapter.lend(
          balancerV2Adapter.address,
          1,
          lendArgs
      ) ,
      ).to.be.reverted;
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
     const receipt = balancerV2Adapter.lend(balancerV2Adapter.address, 1, lendArgs);
     expect(receipt).to.not.be.undefined;
    });
  });
});
