import type { SwapInfo } from '@balancer-labs/sor';
import { SwapTypes } from '@balancer-labs/sor';
import {
  ComptrollerLib,
  IntegrationManager,
  SpendAssetsHandleType,
  takeOrderSelector,
  VaultLib,
} from '@enzymefinance/protocol';
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

      expect(parsedArgs).to.have.length(5);

      expect(parsedArgs[0]).to.equal(SpendAssetsHandleType.Transfer);

      expect(parsedArgs[1]).to.have.length(1);
      expect(parsedArgs[1][0].toLowerCase()).to.equal(networkDescriptor.tokens.WBTC.address.toLowerCase());

      expect(parsedArgs[2]).to.have.length(1);
      // TODO expect(parsedArgs[2][0]).to.equal(big number amount);

      expect(parsedArgs[3]).to.have.length(1);
      expect(parsedArgs[3][0].toLowerCase()).to.equal(networkDescriptor.tokens.WETH.address.toLowerCase());

      expect(parsedArgs[4]).to.have.length(1);
      // TODO expect(parsedArgs[4][0]).to.equal(big number amount);
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
    });

    it('can only be called via the IntegrationManager', async function () {
      // For more info about 'interface ExpectedTrade {' see docs for the ExpectedTrade interface
      // in ../utils/env-helper.ts
      if (typeof tokenIn.mainnetPinnedBlockTradeCache === 'undefined') {
        throw `Token ${tokenIn.symbol} has no 'mainnetPinnedBlockTradeCache' set. See: ../utils/env-helper.ts`;
      }

      [swapInfo] = await getSwap(
        provider,
        queryOnChain,
        swapType,
        tokenIn,
        tokenOut,
        tokenIn.mainnetPinnedBlockTradeCache.tokenInAmount,
      );

      limits = calculateLimits(swapType, swapInfo);

      args = balancerV2TakeOrderArgs({
        deadline,
        limits,
        swapType,
        swaps: swapInfo.swaps,
        tokenAddresses: [tokenIn.address, tokenOut.address],
        tokenOutAmount: swapInfo.returnAmount,
      });

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
      // For more info about 'interface ExpectedTrade {' see docs for the ExpectedTrade interface
      // in ../utils/env-helper.ts
      if (typeof tokenIn.mainnetPinnedBlockTradeCache === 'undefined') {
        throw `Token ${tokenIn.symbol} has no 'mainnetPinnedBlockTradeCache' set. See: ../utils/env-helper.ts`;
      }

      const preTradeBalances = await getBalances(enzymeFundAddress, tokenIn, tokenOut);

      [swapInfo] = await getSwap(
        provider,
        queryOnChain,
        swapType,
        tokenIn,
        tokenOut,
        tokenIn.mainnetPinnedBlockTradeCache.tokenInAmount,
      );

      limits = calculateLimits(swapType, swapInfo);

      args = balancerV2TakeOrderArgs({
        deadline,
        limits,
        swapType,
        swaps: swapInfo.swaps,
        tokenAddresses: [tokenIn.address, tokenOut.address],
        tokenOutAmount: swapInfo.returnAmount,
      });

      // Trade on BalancerV2

      swapInfo.returnAmount = tokenIn.mainnetPinnedBlockTradeCache.tokenOutAmount;

      // const receipt = await balancerV2TakeOrder({
      await balancerV2TakeOrder({
        balancerV2Adapter: balancerV2Adapter.address,
        deadline,
        enzymeComptroller,
        enzymeFund,
        enzymeFundOwner,
        integrationManager,
        swapInfo,
        swapType,
      });

      // Get the balances of the incoming and outgoing assets post-trade
      const postTradeBalances = await getBalances(enzymeFundAddress, tokenIn, tokenOut);

      const tokenInAmountBigNumber = hre.ethers.BigNumber.from(
        tokenIn.mainnetPinnedBlockTradeCache.tokenInAmount.toString(),
      );
      const returnAmountBigNumber = hre.ethers.BigNumber.from(swapInfo.returnAmount.toString());

      // Assert the correct final token balances of incoming and outgoing assets
      expect(postTradeBalances.tokenIn.balance).to.equal(preTradeBalances.tokenIn.balance.sub(tokenInAmountBigNumber));
      expect(postTradeBalances.tokenOut.balance).to.equal(preTradeBalances.tokenOut.balance.add(returnAmountBigNumber));
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

    // it('works as expected when called by a fund - REVERSE TRADE', async function () {
    //   const reverseTokenIn = tokenOut;
    //   const reverseTokenOut = tokenIn;

    //   // For more info about 'interface ExpectedTrade {' see docs for the ExpectedTrade interface
    //   // in ../utils/env-helper.ts
    //   if (typeof reverseTokenIn.mainnetPinnedBlockTradeCache === 'undefined') {
    //     throw `Token ${reverseTokenIn.symbol} has no 'mainnetPinnedBlockTradeCache' set. See: ../utils/env-helper.ts`;
    //   }

    //   const preTradeBalances = await getBalances(enzymeFundAddress, reverseTokenIn, reverseTokenOut);

    //   [swapInfo] = await getSwap(
    //     provider,
    //     queryOnChain,
    //     swapType,
    //     reverseTokenIn,
    //     reverseTokenOut,
    //     reverseTokenIn.mainnetPinnedBlockTradeCache.tokenInAmount,
    //   );

    //   limits = calculateLimits(swapType, swapInfo);

    //   args = balancerV2TakeOrderArgs({
    //     deadline,
    //     limits,
    //     swapType,
    //     swaps: swapInfo.swaps,
    //     tokenAddresses: [reverseTokenIn.address, reverseTokenOut.address],
    //     tokenOutAmount: swapInfo.returnAmount,
    //   });

    //   // Trade on BalancerV2

    //   swapInfo.returnAmount = reverseTokenIn.mainnetPinnedBlockTradeCache.tokenOutAmount;

    //   // const receipt = await balancerV2TakeOrder({
    //   await balancerV2TakeOrder({
    //     balancerV2Adapter: balancerV2Adapter.address,
    //     deadline,
    //     enzymeComptroller,
    //     enzymeFund,
    //     enzymeFundOwner,
    //     integrationManager,
    //     swapInfo,
    //     swapType,
    //   });

    //   // Get the balances of the incoming and outgoing assets post-trade
    //   const postTradeBalances = await getBalances(enzymeFundAddress, reverseTokenIn, reverseTokenOut);

    //   console.log(`Pre-trade balances:`);
    //   printBalances(preTradeBalances);

    //   console.log(`Post-trade balances:`);
    //   printBalances(postTradeBalances);

    //   // // Assert the correct final token balances of incoming and outgoing assets
    //   // expect(postTxIncomingAssetBalance).toEqBigNumber(preTxIncomingAssetBalance.add(expectedIncomingAssetAmount));
    //   // expect(postTxOutgoingAssetBalance).toEqBigNumber(preTxOutgoingAssetBalance.sub(outgoingAssetAmount));

    //   // // Assert the correct event was emitted
    //   // const CallOnIntegrationExecutedForFundEvent = integrationManager.abi.getEvent('CallOnIntegrationExecutedForFund');
    //   // assertEvent(receipt, CallOnIntegrationExecutedForFundEvent, {
    //   //   comptrollerProxy: comptrollerProxy,
    //   //   vaultProxy,
    //   //   caller: fundOwner,
    //   //   adapter: uniswapV2Adapter,
    //   //   selector: takeOrderSelector,
    //   //   incomingAssets: [incomingAsset],
    //   //   incomingAssetAmounts: [expectedIncomingAssetAmount],
    //   //   outgoingAssets: [outgoingAsset],
    //   //   outgoingAssetAmounts: [outgoingAssetAmount],
    //   //   integrationData: expect.anything(),
    //   // });
    // });
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
