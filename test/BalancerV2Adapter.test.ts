import type { ExitPoolRequest, JoinPoolRequest } from '@balancer-labs/balancer-js';
import { WeightedPoolEncoder } from '@balancer-labs/balancer-js';
import type { SwapInfo } from '@balancer-labs/sor';
import { SwapTypes } from '@balancer-labs/sor';
import {
  AggregatedDerivativePriceFeed,
  ComptrollerLib,
  IntegrationManager,
  lendSelector,
  redeemSelector,
  SpendAssetsHandleType,
  takeOrderSelector,
} from '@enzymefinance/protocol';
import { assertEvent } from '@enzymefinance/testutils';
import type { BaseProvider } from '@ethersproject/providers';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber as BN } from 'bignumber.js';
import { expect } from 'chai';
import type { ContractFactory } from 'ethers';
import hre from 'hardhat';

import type { BalancerV2Adapter, BalancerV2PriceFeed } from '../typechain';
import type { NetworkDescriptor, PriceFeedDeployArgs, TokenDescriptor } from '../utils/env-helper';
import {
  bnToBigNumber,
  getBalances,
  getNetworkDescriptor,
  initializeEnvHelper,
  priceFeedDeployArgsFromNetworkDescriptor,
} from '../utils/env-helper';
import type { BalancerV2Lend } from '../utils/integrations/balancerV2';
import {
  assetTransferArgs,
  balancerV2LendArgs,
  balancerV2RedeemArgs,
  balancerV2TakeOrderArgs,
  calculateLimits,
  getSwap,
} from '../utils/integrations/balancerV2';
import {
  balancerV2Lend,
  balancerV2Redeem,
  balancerV2TakeOrder,
} from '../utils/integrations/testutils/balancerV2TestHelper';

describe('BalancerV2Adapter', function () {
  let provider: BaseProvider;
  let networkDescriptor: NetworkDescriptor;

  let enzymeCouncil: SignerWithAddress;
  let integrationManager: IntegrationManager;
  let aggregatedDerivativePriceFeed: AggregatedDerivativePriceFeed;

  let balancerV2PriceFeedFactory: ContractFactory;
  let balancerV2PriceFeed: BalancerV2PriceFeed;
  let balancerV2PriceFeedArgs: PriceFeedDeployArgs;

  let balancerV2AdapterFactory: ContractFactory;

  before(async function () {
    initializeEnvHelper(hre);

    provider = hre.ethers.getDefaultProvider();

    networkDescriptor = await getNetworkDescriptor(provider);

    enzymeCouncil = await hre.ethers.getSigner(networkDescriptor.contracts.enzyme.EnzymeCouncil);
    await hre.network.provider.send('hardhat_impersonateAccount', [enzymeCouncil.address]);

    integrationManager = new IntegrationManager(networkDescriptor.contracts.enzyme.IntegrationManager, enzymeCouncil);

    aggregatedDerivativePriceFeed = new AggregatedDerivativePriceFeed(
      networkDescriptor.contracts.enzyme.AggregatedDerivativePriceFeed,
      enzymeCouncil,
    );

    balancerV2PriceFeedFactory = await hre.ethers.getContractFactory('BalancerV2PriceFeed');

    balancerV2PriceFeedArgs = priceFeedDeployArgsFromNetworkDescriptor(networkDescriptor);
    balancerV2PriceFeed = (await balancerV2PriceFeedFactory.deploy(...balancerV2PriceFeedArgs)) as BalancerV2PriceFeed;
    await balancerV2PriceFeed.deployed();

    await aggregatedDerivativePriceFeed.addDerivatives(
      [networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolAddress],
      [balancerV2PriceFeed.address],
    );

    balancerV2AdapterFactory = await hre.ethers.getContractFactory('BalancerV2Adapter');
  });

  after(async function name() {
    await aggregatedDerivativePriceFeed.removeDerivatives([
      networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolAddress,
    ]);
  });

  describe('constructor', function () {
    it('deploys correctly and registers adapter with IntegrationManager', async function () {
      const balancerV2Adapter = (await balancerV2AdapterFactory.deploy(
        networkDescriptor.contracts.enzyme.IntegrationManager,
        networkDescriptor.contracts.balancer.BalancerV2Vault,
        balancerV2PriceFeed.address,
      )) as BalancerV2Adapter;

      // AdapterBase2
      expect(await balancerV2Adapter.getIntegrationManager()).to.equal(
        networkDescriptor.contracts.enzyme.IntegrationManager,
      );

      // BalancerV2ActionsMixin has BalancerV2Vault set correctly
      expect(await balancerV2Adapter.getBalancerV2Vault()).to.equal(
        networkDescriptor.contracts.balancer.BalancerV2Vault,
      );

      // BalancerV2PriceFeed is set correctly
      expect(await balancerV2Adapter.getBalancerPriceFeed()).to.equal(balancerV2PriceFeed.address);

      const registerAdapterTxnReceipt = await integrationManager.registerAdapters([balancerV2Adapter.address]);

      const adapterRegisteredEvent = integrationManager.abi.getEvent('AdapterRegistered');
      assertEvent(registerAdapterTxnReceipt, adapterRegisteredEvent);

      expect(await integrationManager.getRegisteredAdapters()).to.include(balancerV2Adapter.address);

      console.log(`Balancer V2 Adapter deployed at address: ${balancerV2Adapter.address}`);
      console.log(
        `Balancer V2 Adapter has been registered with IntegrationManager via transaction: ${registerAdapterTxnReceipt.transactionHash}`,
      );
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
      initializeEnvHelper(hre);
      tokenIn = networkDescriptor.tokens.WBTC;
      tokenOut = networkDescriptor.tokens.WETH;

      balancerV2PriceFeedFactory = await hre.ethers.getContractFactory('BalancerV2PriceFeed');

      balancerV2PriceFeedArgs = priceFeedDeployArgsFromNetworkDescriptor(networkDescriptor);
      balancerV2PriceFeed = (await balancerV2PriceFeedFactory.deploy(
        ...balancerV2PriceFeedArgs,
      )) as BalancerV2PriceFeed;

      balancerV2Adapter = (await balancerV2AdapterFactory.deploy(
        networkDescriptor.contracts.enzyme.IntegrationManager,
        networkDescriptor.contracts.balancer.BalancerV2Vault,
        balancerV2PriceFeed.address,
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
      if (typeof networkDescriptor.tokens.WBTC.mainnetPinnedBlockTradeCache === 'undefined') {
        throw `Token ${tokenIn.symbol} has no 'mainnetPinnedBlockTradeCache' set. See: ../utils/env-helper.ts`;
      }

      const parsedArgs = await balancerV2Adapter.parseAssetsForMethod(takeOrderSelector, args);

      expect(parsedArgs).to.have.length(5);

      expect(parsedArgs[0]).to.equal(SpendAssetsHandleType.Transfer);

      expect(parsedArgs[1]).to.have.length(1);
      expect(parsedArgs[1][0].toLowerCase()).to.equal(networkDescriptor.tokens.WBTC.address.toLowerCase());

      expect(parsedArgs[2]).to.have.length(1);

      const tokenInAmountBigNumber = bnToBigNumber(
        networkDescriptor.tokens.WBTC.mainnetPinnedBlockTradeCache.tokenInAmount,
        networkDescriptor.tokens.WBTC.decimals,
      );

      expect(parsedArgs[2][0].eq(tokenInAmountBigNumber)).to.be.true;

      expect(parsedArgs[3]).to.have.length(1);
      expect(parsedArgs[3][0].toLowerCase()).to.equal(networkDescriptor.tokens.WETH.address.toLowerCase());

      const returnAmountBigNumber = bnToBigNumber(swapInfo.returnAmount);

      expect(parsedArgs[4]).to.have.length(1);
      expect(parsedArgs[4][0].eq(returnAmountBigNumber)).to.be.true;
    });

    it('returns expected parse assets for lend', async function () {
      const tokens = networkDescriptor.tokens;
      const initialBalances = [0, 1];
      const initUserData = hre.ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [0, initialBalances]);

      const request: JoinPoolRequest = {
        assets: [tokens.WBTC.address, tokens.WETH.address],
        fromInternalBalance: false,
        maxAmountsIn: [hre.ethers.utils.parseUnits('1', 8), hre.ethers.utils.parseEther('20')],
        userData: initUserData,
      };

      args = balancerV2LendArgs({
        poolId: networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolId,
        request,
      } as BalancerV2Lend);

      const parsedLendArgs = await balancerV2Adapter.parseAssetsForMethod(lendSelector, args);

      expect(parsedLendArgs).to.have.length(5);

      expect(parsedLendArgs[0]).to.equal(SpendAssetsHandleType.Transfer);

      expect(parsedLendArgs[1]).to.have.length(2);
      expect(parsedLendArgs[1][0].toLowerCase()).to.equal(networkDescriptor.tokens.WBTC.address.toLowerCase()); //token address in
      expect(parsedLendArgs[1][1].toLowerCase()).to.equal(networkDescriptor.tokens.WETH.address.toLowerCase()); //token address in

      expect(parsedLendArgs[2]).to.have.length(2);
      expect(parsedLendArgs[2][0].eq(request.maxAmountsIn[0])).to.be.true; //tokens in amount

      expect(parsedLendArgs[3]).to.have.length(1); //pooladdress
      expect(parsedLendArgs[3][0].toLowerCase()).to.equal(
        networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolAddress.toLowerCase(),
      );

      expect(parsedLendArgs[4]).to.have.length(1); //incomming assets amount
      expect(parsedLendArgs[4][0]).gt(0);
    });

    it.only('returns expected parse assets for redeem', async function () {
      const amountsOut = [hre.ethers.utils.parseUnits('.1', 8), hre.ethers.utils.parseEther('1.4084120840052506')];

      const minBPTIn = hre.ethers.utils.parseUnits('1', 18);
      const bptToSpend = hre.ethers.utils.parseUnits('1', networkDescriptor.tokens.WBTC_WETH_BPT.decimals);

      const request: ExitPoolRequest = {
        assets: [networkDescriptor.tokens.WBTC.address, networkDescriptor.tokens.WETH.address],
        minAmountsOut: amountsOut,
        toInternalBalance: false,
        userData: WeightedPoolEncoder.exitExactBPTInForTokensOut(minBPTIn),
      };

      args = balancerV2RedeemArgs({
        poolId: networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolId,
        request,
      });

      const parsedLendArgs = await balancerV2Adapter.parseAssetsForMethod(redeemSelector, args);

      expect(parsedLendArgs).to.have.length(5);

      expect(parsedLendArgs[0]).to.equal(SpendAssetsHandleType.Transfer);

      expect(parsedLendArgs[1]).to.have.length(1); // Address of BPT
      expect(parsedLendArgs[1][0].toLowerCase()).to.equal(networkDescriptor.tokens.WBTC_WETH_BPT.address.toLowerCase()); //token address in

      expect(parsedLendArgs[2]).to.have.length(1); // BPT to spend
      expect(parsedLendArgs[2][0]).to.gte(bptToSpend);

      expect(parsedLendArgs[3]).to.have.length(2); // Incoming assets address
      expect(parsedLendArgs[3][0].toLowerCase()).to.equal(networkDescriptor.tokens.WBTC.address.toLowerCase()); // token0
      expect(parsedLendArgs[3][1].toLowerCase()).to.equal(networkDescriptor.tokens.WETH.address.toLowerCase()); //token1

      // TODO: Check and verify minimum incoming asset amounts
      expect(parsedLendArgs[4]).to.have.length(2); // minimum incoming assets
    });
  });

  describe('takeOrder', function () {
    const queryOnChain = true;
    const swapType = SwapTypes.SwapExactIn;

    const deadline = hre.ethers.constants.MaxUint256;

    let enzymeControllerAddress: string;
    let enzymeFundAddress: string;
    let enzymeFundOwner: SignerWithAddress;

    let enzymeController: ComptrollerLib;

    let balancerV2Adapter: any;
    let swapInfo: SwapInfo;
    let limits: string[];
    let args: string;

    let tokenIn: TokenDescriptor;
    let tokenOut: TokenDescriptor;

    let balancerV2PriceFeed: any;

    before(async function () {
      initializeEnvHelper(hre);
      enzymeControllerAddress = networkDescriptor.contracts.enzyme.EnyzmeComptroller;
      enzymeFundAddress = networkDescriptor.contracts.enzyme.EnzymeVaultProxy;

      enzymeFundOwner = await hre.ethers.getSigner(networkDescriptor.contracts.enzyme.FundOwner);
      await hre.network.provider.send('hardhat_impersonateAccount', [enzymeFundOwner.address]);

      enzymeController = new ComptrollerLib(enzymeControllerAddress, enzymeFundOwner);

      tokenIn = networkDescriptor.tokens.WBTC;
      tokenOut = networkDescriptor.tokens.WETH;

      balancerV2PriceFeedFactory = await hre.ethers.getContractFactory('BalancerV2PriceFeed');

      balancerV2PriceFeedArgs = priceFeedDeployArgsFromNetworkDescriptor(networkDescriptor);
      balancerV2PriceFeed = (await balancerV2PriceFeedFactory.deploy(
        ...balancerV2PriceFeedArgs,
      )) as BalancerV2PriceFeed;

      balancerV2Adapter = (await balancerV2AdapterFactory.deploy(
        networkDescriptor.contracts.enzyme.IntegrationManager,
        networkDescriptor.contracts.balancer.BalancerV2Vault,
        balancerV2PriceFeed.address,
      )) as any;

      await balancerV2Adapter.deployed();

      await integrationManager.registerAdapters([balancerV2Adapter.address]);
    });

    it('can only be called via the IntegrationManager', async function () {
      // For more info about 'interface ExpectedTrade' see docs for the ExpectedTrade interface
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
      // For more info about 'interface ExpectedTrade' see docs for the ExpectedTrade interface
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
      const tokenInAmountBigNumber = bnToBigNumber(
        tokenIn.mainnetPinnedBlockTradeCache.tokenInAmount,
        tokenIn.decimals,
      );

      swapInfo.returnAmount = tokenIn.mainnetPinnedBlockTradeCache.tokenOutAmount;
      const returnAmountBigNumber = bnToBigNumber(swapInfo.returnAmount);

      const takeOrderTxnReceipt = await balancerV2TakeOrder({
        balancerV2Adapter: balancerV2Adapter.address,
        deadline,
        enzymeController,
        enzymeFundOwner,
        integrationManager,
        swapInfo,
        swapType,
      });

      const postTradeBalances = await getBalances(enzymeFundAddress, tokenIn, tokenOut);

      expect(preTradeBalances.tokenIn.balance.sub(tokenInAmountBigNumber).eq(postTradeBalances.tokenIn.balance)).to.be
        .true;
      expect(postTradeBalances.tokenOut.balance.gte(preTradeBalances.tokenOut.balance.add(returnAmountBigNumber))).to.be
        .true;

      const CallOnIntegrationExecutedForFundEvent = integrationManager.abi.getEvent('CallOnIntegrationExecutedForFund');
      assertEvent(takeOrderTxnReceipt, CallOnIntegrationExecutedForFundEvent);
    });
  });

  describe('lend', function () {
    let balancerV2Adapter: any;
    let lendArgs: any;
    let enzymeFundAddress: string;
    let enzymeFundOwner: SignerWithAddress;
    let request: JoinPoolRequest;
    let poolId: string;
    let enzymeController: ComptrollerLib;
    let enzymeControllerAddress: string;
    let balancerV2PriceFeed: any;

    before(async function () {
      initializeEnvHelper(hre);

      enzymeControllerAddress = networkDescriptor.contracts.enzyme.EnyzmeComptroller;
      enzymeFundAddress = networkDescriptor.contracts.enzyme.EnzymeVaultProxy;

      enzymeFundOwner = await hre.ethers.getSigner(networkDescriptor.contracts.enzyme.FundOwner);
      await hre.network.provider.send('hardhat_impersonateAccount', [enzymeFundOwner.address]);

      enzymeController = new ComptrollerLib(enzymeControllerAddress, enzymeFundOwner);

      balancerV2PriceFeedFactory = await hre.ethers.getContractFactory('BalancerV2PriceFeed');

      balancerV2PriceFeedArgs = priceFeedDeployArgsFromNetworkDescriptor(networkDescriptor);
      balancerV2PriceFeed = (await balancerV2PriceFeedFactory.deploy(
        ...balancerV2PriceFeedArgs,
      )) as BalancerV2PriceFeed;

      balancerV2Adapter = (await balancerV2AdapterFactory.deploy(
        networkDescriptor.contracts.enzyme.IntegrationManager,
        networkDescriptor.contracts.balancer.BalancerV2Vault,
        balancerV2PriceFeed.address,
      )) as any;

      await balancerV2Adapter.deployed();

      await integrationManager.registerAdapters([balancerV2Adapter.address]);
      //await  integrationManager.addAuthUserForFund(balancerV2Adapter, enzymeFundOwner);
      poolId = networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolId;

      const tokens = networkDescriptor.tokens;

      const initialBalances = [
        await tokens.WBTC.contract.balanceOf(networkDescriptor.contracts.enzyme.EnzymeVaultProxy),
        await tokens.WETH.contract.balanceOf(networkDescriptor.contracts.enzyme.EnzymeVaultProxy),
      ];

      console.log(`initial balances: WBTC: ${initialBalances[0].toString()}, WETH: ${initialBalances[1].toString()}`);

      const amountsIn = [hre.ethers.utils.parseUnits('1', 8), hre.ethers.utils.parseEther('14.084120840052506')];

      // TODO: just making a number up here to try to get lend to work
      const minBPTOut = hre.ethers.utils.parseUnits('1', 1);
      console.log(`minBPTOut = ${minBPTOut.toString()}`);

      request = {
        assets: [tokens.WBTC.address, tokens.WETH.address],
        fromInternalBalance: false,
        maxAmountsIn: amountsIn,
        userData: WeightedPoolEncoder.joinExactTokensInForBPTOut(amountsIn, minBPTOut),
      };

      lendArgs = balancerV2LendArgs({
        poolId,
        request,
      });
    });

    it('can only be called via the IntegrationManager', async function () {
      await expect(balancerV2Adapter.lend(enzymeFundAddress, lendSelector, lendArgs)).to.be.revertedWith(
        'Only the IntegrationManager can call this function',
      );
    });

    it('works as expected when called by a fund', async function () {
      expect(lendArgs).to.not.be.undefined;

      // const preTradeBalances = await getBalances(
      //   enzymeFundAddress,
      //   networkDescriptor.tokens.WBTC.address,
      //   networkDescriptor.tokens.WETH.address,
      // );
      // Whitelisting BPT token and our price feed to enzyme

      const lendTxnReceipt = await balancerV2Lend({
        balancerV2Adapter: balancerV2Adapter.address,
        enzymeController,
        enzymeFundOwner,
        integrationManager,
        poolId,
        request,
      });
      console.log('Lending is working....');

      // Trade on BalancerV2

      // const postTradeBalances = await getBalances(enzymeFundAddress, tokenIn, tokenOut);

      // expect(preTradeBalances.tokenIn.balance.sub(tokenInAmountBigNumber).eq(postTradeBalances.tokenIn.balance)).to.be
      //   .true;
      // expect(postTradeBalances.tokenOut.balance.gte(preTradeBalances.tokenOut.balance.add(returnAmountBigNumber))).to.be
      //   .true;

      const CallOnIntegrationExecutedForFundEvent = integrationManager.abi.getEvent('CallOnIntegrationExecutedForFund');
      assertEvent(lendTxnReceipt, CallOnIntegrationExecutedForFundEvent);
    });
  });

  describe('redeem', function () {
    let balancerV2Adapter: any;
    let redeemArgs: any;
    let enzymeFundAddress: string;
    let enzymeFundOwner: SignerWithAddress;
    let joinPoolRequest: JoinPoolRequest;
    let exitPoolRequest: ExitPoolRequest;
    let poolId: string;
    let enzymeController: ComptrollerLib;
    let enzymeControllerAddress: string;
    let balancerV2PriceFeed: any;

    before(async function () {
      initializeEnvHelper(hre);

      enzymeControllerAddress = networkDescriptor.contracts.enzyme.EnyzmeComptroller;
      enzymeFundAddress = networkDescriptor.contracts.enzyme.EnzymeVaultProxy;

      enzymeFundOwner = await hre.ethers.getSigner(networkDescriptor.contracts.enzyme.FundOwner);
      await hre.network.provider.send('hardhat_impersonateAccount', [enzymeFundOwner.address]);

      enzymeController = new ComptrollerLib(enzymeControllerAddress, enzymeFundOwner);

      balancerV2PriceFeedFactory = await hre.ethers.getContractFactory('BalancerV2PriceFeed');

      balancerV2PriceFeedArgs = priceFeedDeployArgsFromNetworkDescriptor(networkDescriptor);
      balancerV2PriceFeed = (await balancerV2PriceFeedFactory.deploy(
        ...balancerV2PriceFeedArgs,
      )) as BalancerV2PriceFeed;

      balancerV2Adapter = (await balancerV2AdapterFactory.deploy(
        networkDescriptor.contracts.enzyme.IntegrationManager,
        networkDescriptor.contracts.balancer.BalancerV2Vault,
        balancerV2PriceFeed.address,
      )) as any;

      await balancerV2Adapter.deployed();

      await integrationManager.registerAdapters([balancerV2Adapter.address]);
      //await  integrationManager.addAuthUserForFund(balancerV2Adapter, enzymeFundOwner);
      poolId = networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolId;

      const tokens = networkDescriptor.tokens;

      const initialBalances = [
        await tokens.WBTC.contract.balanceOf(networkDescriptor.contracts.enzyme.EnzymeVaultProxy),
        await tokens.WETH.contract.balanceOf(networkDescriptor.contracts.enzyme.EnzymeVaultProxy),
      ];

      console.log(`initial balances: WBTC: ${initialBalances[0].toString()}, WETH: ${initialBalances[1].toString()}`);

      const amountsIn = [hre.ethers.utils.parseUnits('1', 8), hre.ethers.utils.parseEther('14.084120840052506')];
      const amountsOut = [hre.ethers.utils.parseUnits('.1', 8), hre.ethers.utils.parseEther('1.4084120840052506')];

      // TODO: just making a number up here to try to get lend to work
      const minBPTIn = hre.ethers.utils.parseUnits('1', 18);
      console.log(`minBPTIn = ${minBPTIn.toString()}`);
      const minBPTOut = hre.ethers.utils.parseUnits('1', 18);

      exitPoolRequest = {
        assets: [tokens.WBTC.address, tokens.WETH.address],
        minAmountsOut: amountsOut,
        toInternalBalance: false,
        userData: WeightedPoolEncoder.exitExactBPTInForTokensOut(minBPTIn),
      };
      joinPoolRequest = {
        assets: [tokens.WBTC.address, tokens.WETH.address],
        fromInternalBalance: false,
        maxAmountsIn: amountsIn,
        userData: WeightedPoolEncoder.joinExactTokensInForBPTOut(amountsIn, minBPTOut),
      };

      redeemArgs = balancerV2RedeemArgs({
        poolId,
        request: exitPoolRequest,
      });
    });

    it('can only be called via the IntegrationManager', async function () {
      await expect(balancerV2Adapter.redeem(enzymeFundAddress, redeemSelector, redeemArgs)).to.be.revertedWith(
        'Only the IntegrationManager can call this function',
      );
    });

    it('works as expected when called by a fund', async function () {
      // TODO: lend first
      expect(redeemArgs).to.not.be.undefined;

      console.log(
        'Asset registered ',
        await aggregatedDerivativePriceFeed.isSupportedAsset(
          networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolAddress,
        ),
      );
      console.log('Lending to a pool...');
      await balancerV2Lend({
        balancerV2Adapter: balancerV2Adapter.address,
        enzymeController,
        enzymeFundOwner,
        integrationManager,
        poolId,
        request: joinPoolRequest,
      });

      console.log('Redeeming from a pool...');
      const redeemTxnReceipt = await balancerV2Redeem({
        balancerV2Adapter: balancerV2Adapter.address,
        enzymeController,
        enzymeFundOwner,
        integrationManager,
        poolId,
        request: exitPoolRequest,
      });

      // Trade on BalancerV2

      // const postTradeBalances = await getBalances(enzymeFundAddress, tokenIn, tokenOut);

      // expect(preTradeBalances.tokenIn.balance.sub(tokenInAmountBigNumber).eq(postTradeBalances.tokenIn.balance)).to.be
      //   .true;
      // expect(postTradeBalances.tokenOut.balance.gte(preTradeBalances.tokenOut.balance.add(returnAmountBigNumber))).to.be
      //   .true;

      const CallOnIntegrationExecutedForFundEvent = integrationManager.abi.getEvent('CallOnIntegrationExecutedForFund');
      assertEvent(redeemTxnReceipt, CallOnIntegrationExecutedForFundEvent);
    });
  });
});
