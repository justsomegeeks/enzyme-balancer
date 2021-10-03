import type { SwapInfo } from '@balancer-labs/sor';
import { SwapTypes } from '@balancer-labs/sor';
import { JoinPoolRequest } from '@balancer-labs/balancer-js';
import { IntegrationManager, takeOrderSelector, lendSelector } from '@enzymefinance/protocol';
import type { BaseProvider } from '@ethersproject/providers';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber as BN } from 'bignumber.js';
import { expect } from 'chai';
import type { ContractFactory } from 'ethers';
import hre from 'hardhat';

import type { BalancerV2Adapter } from '../typechain';
import type { NetworkDescriptor, TokenDescriptor, BalancerV2Lend } from '../utils/env-helper';
import { getNetworkDescriptor, initializeEnvHelper, BalancerV2LendArgs } from '../utils/env-helper';
import { balancerV2TakeOrderArgs, calculateLimits, getSwap } from '../utils/integrations/balancerV2';

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
    let balancerV2Adapter: BalancerV2Adapter;
    let lendArgs: any;
    before(async function () {
      balancerV2Adapter = (await balancerV2AdapterFactory.deploy(
        networkDescriptor.contracts.IntegrationManager,
        networkDescriptor.contracts.BalancerV2Vault,
      )) as BalancerV2Adapter;

      await balancerV2Adapter.deployed();

      await integrationManager.registerAdapters([balancerV2Adapter.address]);

      const poolId = '0x01abc00e86c7e258823b9a055fd62ca6cf61a16300010000000000000000003b';
      const recipient = enzymeCouncil.address;
      let request: JoinPoolRequest;
      const tokens = networkDescriptor.tokens;
      const initialBalances = [0 , 1];
      const initUserData =
      hre.ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'],[0, initialBalances]);


      request = {
        assets: [tokens.DAI.address, tokens.USDC.address],
        maxAmountsIn: [0, 1],
        userData: initUserData,
        fromInternalBalance: false,
      };
      
      lendArgs = BalancerV2LendArgs({
          poolId, recipient, request
      } as BalancerV2Lend);

    });
    it('can only be called via the IntegrationManager', async function () {
       expect(await
        balancerV2Adapter.lend(
          balancerV2Adapter.address,
          lendSelector,
          lendArgs
      ) ,
      ).to.be.reverted;
    });

    it('works as expected when called by a fund', async function () {
      expect(lendArgs).to.not.be.undefined;
      const receipt = balancerV2Adapter.lend(balancerV2Adapter.address, lendSelector, lendArgs);      
      expect(receipt).to.not.be.undefined;
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
