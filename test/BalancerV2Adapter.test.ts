import type { SwapInfo } from '@balancer-labs/sor';
import { SwapTypes } from '@balancer-labs/sor';
import { ComptrollerLib, IntegrationManager, takeOrderSelector, VaultLib } from '@enzymefinance/protocol';
import type { BaseProvider } from '@ethersproject/providers';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber as BN } from 'bignumber.js';
import { expect } from 'chai';
import type { ContractFactory } from 'ethers';
import hre from 'hardhat';

import type { BalancerV2Adapter } from '../typechain';
import type { NetworkDescriptor, TokenDescriptor } from '../utils/env-helper';
import { getBalances, getNetworkDescriptor, initializeEnvHelper } from '../utils/env-helper';
import { assetTransferArgs, balancerV2TakeOrderArgs, calculateLimits, getSwap } from '../utils/integrations/balancerV2';
import { balancerV2TakeOrder } from '../utils/integrations/testutils/balancerV2TestHelper';

describe('BalancerV2Adapter', function () {
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
        networkDescriptor.contracts.BalancerV2WBTCWETHVault,
      );

      await integrationManager.registerAdapters([balancerV2Adapter.address]);

      // AdapterBase2
      expect(await balancerV2Adapter.getIntegrationManager()).to.equal(networkDescriptor.contracts.IntegrationManager);

      // BalancerV2ActionsMixin
      expect(await balancerV2Adapter.getBalancerV2Vault()).to.equal(
        networkDescriptor.contracts.BalancerV2WBTCWETHVault,
      );

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
        networkDescriptor.contracts.BalancerV2WBTCWETHVault,
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

    it('returns expected parsed assets for swap', async function () {
      // const expectedParsedArgs = [
      //   2,
      //   [networkDescriptor.tokens.WBTC.address],
      //   [swapAmount],
      //   [networkDescriptor.tokens.WETH.address],
      //   [swapInfo.returnAmount],
      // ];

      const parsedArgs = await balancerV2Adapter.parseAssetsForMethod(takeOrderSelector, args);

      console.log({ parsedArgs });
      console.log(`---------------\n`);
      console.log(`parsedArgs = `);

      parsedArgs.forEach((arg: unknown, index: number) => {
        console.log(`  [${index}]: ${arg}`);
      });

      expect(parsedArgs).to.have.length(5);

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
    const queryOnChain = true;
    const swapType = SwapTypes.SwapExactIn;
    const swapAmount = new BN(1);

    const deadline = hre.ethers.constants.MaxUint256;

    let enzymeComptrollerAddress: string;
    let enzymeFundAddress: string;
    let enzymeFundOwner: SignerWithAddress;

    let enzymeComptroller: ComptrollerLib;
    let enzymeFund: VaultLib;

    let balancerV2Adapter: BalancerV2Adapter;
    let swapInfo: SwapInfo;
    let limits: string[];
    let args: string;

    let tokenIn: TokenDescriptor;
    let tokenOut: TokenDescriptor;

    before(async function () {
      enzymeComptrollerAddress = networkDescriptor.contracts.EnyzmeComptroller;
      enzymeFundAddress = networkDescriptor.contracts.EnzymeVaultProxy;

      enzymeFundOwner = await hre.ethers.getSigner(networkDescriptor.contracts.FundOwner);
      await hre.network.provider.send('hardhat_impersonateAccount', [enzymeFundOwner.address]);

      enzymeComptroller = new ComptrollerLib(enzymeComptrollerAddress, enzymeFundOwner);
      enzymeFund = new VaultLib(enzymeFundAddress, enzymeFundOwner);

      tokenIn = networkDescriptor.tokens.WBTC;
      tokenOut = networkDescriptor.tokens.WETH;

      balancerV2Adapter = (await balancerV2AdapterFactory.deploy(
        networkDescriptor.contracts.IntegrationManager,
        networkDescriptor.contracts.BalancerV2WBTCWETHVault,
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

    it('can only be called via the IntegrationManager', async function () {
      const transferArgs = await assetTransferArgs({
        adapter: balancerV2Adapter,
        encodedCallArgs: args,
        selector: takeOrderSelector,
      });

      await expect(balancerV2Adapter.takeOrder(enzymeFundAddress, takeOrderSelector, transferArgs)).to.be.revertedWith(
        'Only the IntegrationManager can call this function',
      );
    });

    it('works as expected when called by a fund', async function () {
      let balances = await getBalances(enzymeFundAddress, tokenIn, tokenOut);
      console.log(`balances = ${JSON.stringify(balances, undefined, 2)}`);

      // const outgoingAssetAmount = utils.parseEther('0.1');
      // const amountsOut = await uniswapRouter.getAmountsOut(outgoingAssetAmount, path);
      // const expectedIncomingAssetAmount = amountsOut[1];

      // Seed fund with outgoing asset
      // await outgoingAsset.transfer(vaultProxy, outgoingAssetAmount);

      // Get the balances of the incoming and outgoing assets pre-trade
      // const [preTxIncomingAssetBalance, preTxOutgoingAssetBalance] = await getAssetBalances({
      //   account: vaultProxy,
      //   assets: [incomingAsset, outgoingAsset],
      // });

      // Trade on BalancerV2
      const receipt = await balancerV2TakeOrder({
        balancerV2Adapter: balancerV2Adapter.address,
        deadline,
        enzymeComptroller,
        enzymeFund,
        enzymeFundOwner,
        integrationManager,
        swapInfo,
        swapType,
      });

      console.log(`receipt = ${JSON.stringify(receipt, undefined, 2)}`);

      // Get the balances of the incoming and outgoing assets post-trade
      balances = await getBalances(enzymeFundAddress, tokenIn, tokenOut, balances);
      console.log(`balances = ${JSON.stringify(balances, undefined, 2)}`);

      // // Assert the correct final token balances of incoming and outgoing assets
      // expect(postTxIncomingAssetBalance).toEqBigNumber(preTxIncomingAssetBalance.add(expectedIncomingAssetAmount));
      // expect(postTxOutgoingAssetBalance).toEqBigNumber(preTxOutgoingAssetBalance.sub(outgoingAssetAmount));

      // // Assert the correct event was emitted
      // const CallOnIntegrationExecutedForFundEvent = integrationManager.abi.getEvent('CallOnIntegrationExecutedForFund');
      // assertEvent(receipt, CallOnIntegrationExecutedForFundEvent, {
      //   comptrollerProxy: comptrollerProxy,
      //   vaultProxy,
      //   caller: fundOwner,
      //   adapter: uniswapV2Adapter,
      //   selector: takeOrderSelector,
      //   incomingAssets: [incomingAsset],
      //   incomingAssetAmounts: [expectedIncomingAssetAmount],
      //   outgoingAssets: [outgoingAsset],
      //   outgoingAssetAmounts: [outgoingAssetAmount],
      //   integrationData: expect.anything(),
      // });
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
});
