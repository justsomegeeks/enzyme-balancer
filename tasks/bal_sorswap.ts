/*
    This code is heavily inspired by: https://github.com/balancer-labs/balancer-sor/blob/master/test/testScripts/swapExample.ts
*/

import { SwapTypes } from '@balancer-labs/sor';
import { getBalancerContract } from '@balancer-labs/v2-deployments';
import { BigNumber as BN } from 'bignumber.js';
import { BigNumber } from 'ethers';
import { task } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import {
  adjustAllowanceIfNeeded,
  getBalances,
  getNetworkDescriptor,
  getWhaleSigner,
  initializeEnvHelper,
  isSupportedToken,
  supportedTokensMessage,
} from '../utils/env-helper';
import type { FundManagement, SorSwapArgs } from '../utils/integrations/balancerV2';
import { calculateLimits, getSwap, printSwapDetails } from '../utils/integrations/balancerV2';

task('bal_sorswap', 'Swap 2 tokens via Balancer SOR')
  .addParam('tokenIn', supportedTokensMessage(), 'AAVE')
  .addParam('tokenOut', supportedTokensMessage(), 'USDC')
  .addParam('amount', 'Swap Amount', '100')
  .setAction(async (args: SorSwapArgs, hre: HardhatRuntimeEnvironment) => {
    initializeEnvHelper(hre);

    const { amount, tokenIn, tokenOut } = args;
    const swapAmount = new BN(+amount);

    // Validate arguments
    if (!isSupportedToken(tokenIn) || !isSupportedToken(tokenOut)) {
      throw new Error(`Token not supported. ${supportedTokensMessage()}`);
    }

    const provider = hre.ethers.getDefaultProvider();
    const networkDescriptor = await getNetworkDescriptor(provider);

    const queryOnChain = true;
    const swapType = SwapTypes.SwapExactIn;
    const tokenInDescriptor = networkDescriptor.tokens[tokenIn];
    const tokenOutDescriptor = networkDescriptor.tokens[tokenOut];

    const [swapInfo, cost] = await getSwap(
      provider,
      queryOnChain,
      swapType,
      tokenInDescriptor,
      tokenOutDescriptor,
      swapAmount,
    );

    if (!swapInfo.returnAmount.gt(0)) {
      console.log(`Return amount is 0. No swaps to execute.`);
      return;
    }

    const whaleSigner = await getWhaleSigner(networkDescriptor, tokenIn);
    const vaultContract = await getBalancerContract('20210418-vault', 'Vault', networkDescriptor.name);

    await adjustAllowanceIfNeeded(whaleSigner, tokenInDescriptor, BigNumber.from(swapAmount.toString()), vaultContract);

    const funds: FundManagement = {
      fromInternalBalance: false,
      recipient: whaleSigner.address,
      sender: whaleSigner.address,
      toInternalBalance: false,
    };

    const limits: string[] = calculateLimits(swapType, swapInfo);

    const deadline = hre.ethers.constants.MaxUint256;

    let balances = await getBalances(whaleSigner.address, tokenInDescriptor, tokenOutDescriptor);

    console.log('Swapping...');

    // ETH in swaps must send ETH value
    const overrides =
      swapInfo.tokenIn === hre.ethers.constants.AddressZero ? { value: swapInfo.swapAmount.toString() } : {};

    // overrides['gasLimit'] = '200000';
    // overrides['gasPrice'] = '20000000000';

    const swapTxn = await vaultContract
      .connect(whaleSigner)
      .batchSwap(swapType, swapInfo.swaps, swapInfo.tokenAddresses, funds, limits, deadline, overrides);

    await swapTxn.wait();

    console.log('Swap completed.');

    balances = await getBalances(whaleSigner.address, tokenInDescriptor, tokenOutDescriptor, balances);

    const costScaled = cost.times(new BN(tokenInDescriptor.decimals.toString())).dp(0, BN.ROUND_HALF_EVEN);
    const swapInTokenCost = hre.ethers.utils.formatUnits(
      BigNumber.from(costScaled.toString()),
      tokenOutDescriptor.decimals.toString(),
    );

    printSwapDetails(
      swapType,
      swapInfo,
      funds,
      limits,
      tokenInDescriptor,
      tokenOutDescriptor,
      swapAmount,
      swapInTokenCost,
      balances,
    );
  });
