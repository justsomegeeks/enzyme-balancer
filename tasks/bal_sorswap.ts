/*
    This code is heavily inspired by: https://github.com/balancer-labs/balancer-sor/blob/master/test/testScripts/swapExample.ts
*/

import { SwapTypes } from '@balancer-labs/sor';
import { getBalancerContract } from '@balancer-labs/v2-deployments';
import { BigNumber } from 'bignumber.js';
import { task } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import type { FundManagement, SorSwapArgs } from '../utils/env-helper';
import {
  adjustAllowanceIfNeeded,
  calculateLimits,
  getBalances,
  getNetworkDescriptor,
  getSwap,
  getWhaleSigner,
  initializeEnvHelper,
  isSupportedToken,
  printSwapDetails,
  supportedTokensMessage,
} from '../utils/env-helper';

task('bal_sorswap', 'Swap 2 tokens via Balancer SOR')
  .addParam('tokenIn', supportedTokensMessage(), 'AAVE')
  .addParam('tokenOut', supportedTokensMessage(), 'USDC')
  .addParam('amount', 'Swap Amount', '100')
  .setAction(async (args: SorSwapArgs, hre: HardhatRuntimeEnvironment) => {
    initializeEnvHelper(hre);

    const { amount, tokenIn, tokenOut } = args;
    const swapAmount = new BigNumber(+amount);

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

    await adjustAllowanceIfNeeded(whaleSigner, swapInfo, vaultContract);

    const funds: FundManagement = {
      fromInternalBalance: false,
      recipient: whaleSigner.address,
      sender: whaleSigner.address,
      toInternalBalance: false,
    };

    const limits: string[] = calculateLimits(swapType, swapInfo);

    const deadline = hre.ethers.constants.MaxUint256;

    let balances = await getBalances(whaleSigner, tokenInDescriptor, tokenOutDescriptor);

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

    balances = await getBalances(whaleSigner, tokenInDescriptor, tokenOutDescriptor, balances);

    const costScaled = cost.times(tokenInDescriptor.decimals).dp(0, BigNumber.ROUND_HALF_EVEN).toString();
    const swapInTokenCost = hre.ethers.utils.formatUnits(costScaled, tokenOutDescriptor.decimals.toString());

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
