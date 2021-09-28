/* eslint-disable prefer-const */
/*
    This code is heavily inspired by: https://github.com/balancer-labs/balancer-sor/blob/master/test/testScripts/swapExample.ts
*/

import { bnum, SwapTypes } from '@balancer-labs/sor';
import { getBalancerContract } from '@balancer-labs/v2-deployments';
import { BigNumber } from 'bignumber.js';
import { task } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import erc20Artifact from '../abis/ERC20.json';
import type { Balances, FundManagement, SupportedTokens } from '../utils/sor-helper';
// eslint-disable-next-line @typescript-eslint/no-duplicate-imports
import {
  calculateLimits,
  getNetworkERC20s,
  getSwap,
  getWhaleAddress,
  Networks,
  printSwapDetails,
} from '../utils/sor-helper';

interface SorSwapArgs {
  tokenIn: SupportedTokens;
  tokenOut: SupportedTokens;
  amount: string;
}
const supportedTokens = ['ETH', 'BAL', 'USDC', 'AAVE'];

task('bal_sorswap', 'Swap 2 tokens via Balancer SOR')
  .addParam('tokenIn', "'ETH' or 'BAL' or 'USDC' or 'AAVE'", 'AAVE')
  .addParam('tokenOut', "'ETH' or 'BAL' or 'USDC' or 'AAVE'", 'USDC')
  .addParam('amount', 'Swap Amount', '100')
  .setAction(async (args: SorSwapArgs, hre: HardhatRuntimeEnvironment) => {
    const { amount, tokenIn, tokenOut } = args;
    const swapAmount = new BigNumber(Number(amount));

    // Validate arguments
    if (!supportedTokens.includes(tokenIn) || !supportedTokens.includes(tokenOut)) {
      throw new Error(`Token not supported. Supported tokens are ${supportedTokens.join(' | ')}`);
    }
    const provider = hre.ethers.getDefaultProvider();
    const chainId = (await provider.getNetwork()).chainId;
    const networkInfo: Networks | undefined = Networks[Networks[chainId] as keyof typeof Networks];
    const networkName = Networks[networkInfo];

    if (typeof networkInfo === 'undefined') {
      throw `Invalid chain id: ${chainId}`;
    }

    const networkERC20s = getNetworkERC20s();

    const queryOnChain = true;
    let swapType = SwapTypes.SwapExactIn;
    const tokenInDescriptor = networkERC20s[networkInfo][tokenIn];
    const tokenOutDescriptor = networkERC20s[networkInfo][tokenOut];

    let [swapInfo, cost] = await getSwap(
      provider,
      networkInfo,
      queryOnChain,
      swapType,
      tokenInDescriptor,
      tokenOutDescriptor,
      new BigNumber(Number(swapAmount)),
    );
    if (!swapInfo.returnAmount.gt(0)) {
      console.log(`Return amount is 0. No swaps to execute.`);
      return;
    }

    const whale = await getWhaleAddress(hre, tokenIn);

    const vaultContract = await getBalancerContract('20210418-vault', 'Vault', networkName);

    if (swapInfo.tokenIn !== hre.ethers.constants.AddressZero) {
      console.log('Checking vault allowance...');
      const tokenInContract = await hre.ethers.getContractAt(erc20Artifact.abi, swapInfo.tokenIn);
      let allowance = await tokenInContract.allowance(whale.address, vaultContract.address);
      if (bnum(allowance).lt(swapInfo.swapAmount)) {
        console.log(`Not Enough Allowance: ${allowance.toString()}. Approving vault now...`);
        const txApprove = await tokenInContract
          .connect(whale)
          .approve(vaultContract.address, hre.ethers.constants.MaxUint256);
        await txApprove.wait();
        console.log(`Allowance updated: ${txApprove.hash}`);
        allowance = await tokenInContract.allowance(whale.address, vaultContract.address);
      }
      console.log(`Allowance: ${allowance.toString()}`);
    }

    const funds: FundManagement = {
      fromInternalBalance: false,
      recipient: whale.address,
      sender: whale.address,
      toInternalBalance: false,
    };

    const limits: string[] = calculateLimits(swapType, swapInfo);

    const deadline = hre.ethers.constants.MaxUint256;

    const token1 = await hre.ethers.getContractAt(erc20Artifact.abi, tokenInDescriptor.address);
    const token2 = await hre.ethers.getContractAt(erc20Artifact.abi, tokenOutDescriptor.address);

    let tokenInBalanceBefore, tokenInBalanceAfter, tokenOutBalanceBefore, tokenOutBalanceAfter: any;
    // eslint-disable-next-line prefer-const
    if (tokenIn === 'ETH') {
      tokenInBalanceBefore = await whale.getBalance();
      tokenOutBalanceBefore = await token2.balanceOf(whale.address);
    } else if (tokenOut === 'ETH') {
      tokenInBalanceBefore = await token1.balanceOf(whale.address);
      tokenOutBalanceBefore = await whale.getBalance();
    } else {
      tokenInBalanceBefore = await token1.balanceOf(whale.address);
      tokenOutBalanceBefore = await token2.balanceOf(whale.address);
    }

    console.log('Swapping...');

    // ETH in swaps must send ETH value
    const overrides =
      swapInfo.tokenIn === hre.ethers.constants.AddressZero ? { value: swapInfo.swapAmount.toString() } : {};

    // overrides['gasLimit'] = '200000';
    // overrides['gasPrice'] = '20000000000';

    const swapTxn = await vaultContract
      .connect(whale)
      .batchSwap(swapType, swapInfo.swaps, swapInfo.tokenAddresses, funds, limits, deadline, overrides);

    await swapTxn.wait();

    console.log('Swap completed..');
    if (tokenIn === 'ETH') {
      tokenInBalanceAfter = await whale.getBalance();
      tokenOutBalanceAfter = await token2.balanceOf(whale.address);
    } else if (tokenOut === 'ETH') {
      tokenInBalanceAfter = await token1.balanceOf(whale.address);
      tokenOutBalanceAfter = await whale.getBalance();
    } else {
      tokenInBalanceAfter = await token1.balanceOf(whale.address);
      tokenOutBalanceAfter = await token2.balanceOf(whale.address);
    }
    // TODO when to format units and when to format ethers
    const balances: Balances = {
      tokenIn: {
        after: hre.ethers.utils.formatUnits(tokenInBalanceAfter, tokenInDescriptor.decimals.toNumber()),
        before: hre.ethers.utils.formatUnits(tokenInBalanceBefore, tokenInDescriptor.decimals.toNumber()),
      },
      tokenOut: {
        after: hre.ethers.utils.formatUnits(tokenOutBalanceAfter, tokenOutDescriptor.decimals.toNumber()),
        before: hre.ethers.utils.formatUnits(tokenOutBalanceBefore, tokenOutDescriptor.decimals.toNumber()),
      },
    };
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
