/*
  This file's purpose and its location somewhat mimics the '@enzymefinance/protocol' package.
  
  Examples:
    https://github.com/enzymefinance/protocol/blob/current/packages/protocol/src/utils/integrations/paraSwapV4.ts
    https://github.com/enzymefinance/protocol/blob/current/packages/protocol/src/utils/integrations/uniswapV2.ts

  The code here is heavily inspired by: https://github.com/balancer-labs/balancer-sor/blob/master/test/testScripts/swapExample.ts
*/

import type { ExitPoolRequest, JoinPoolRequest } from '@balancer-labs/balancer-js';
import type { SwapInfo, SwapV2 } from '@balancer-labs/sor';
import { scale, SOR, SwapTypes } from '@balancer-labs/sor';
import { encodeArgs } from '@enzymefinance/protocol';
import type { BaseProvider } from '@ethersproject/providers';
import { BigNumber as BN } from 'bignumber.js';
import type { Bytes, BytesLike } from 'ethers';
import { BigNumber, utils } from 'ethers';

import type { BalancerV2Adapter } from '../../typechain';
import type { Balances, SupportedTokens, TokenDescriptor } from '../env-helper';
import { getNetworkDescriptor } from '../env-helper';

export interface SorSwapArgs {
  tokenIn: SupportedTokens;
  tokenOut: SupportedTokens;
  amount: string;
}

export interface FundManagement {
  sender: string;
  recipient: string;
  fromInternalBalance: boolean;
  toInternalBalance: boolean;
}

export interface poolExit {
  poolId: BigNumber;
  sender: string;
  recipient: string;
  exitRequest: exitRequest;
}

export interface exitRequest {
  assets: string[];
  minAmountsOut: BigNumber[];
  userData: Bytes;
  toInternalBalance: boolean;
}

export interface BalancerV2TakeOrder {
  swapType: SwapTypes;
  swaps: SwapV2[];
  tokenAddresses: string[];
  tokenOutAmount: BN;
  limits: string[];
  deadline: BigNumber;
  //   overrides: { value: string } | {};
}

export interface BalancerV2PoolExit {
  poolId: BigNumber;
  sender: string;
  recipient: string;
  exitRequest: BalancerV2ExitRequest;
}

export interface BalancerV2ExitRequest {
  assets: string[];
  minAmountsOut: BigNumber[];
  userData: Bytes;
  toInternalBalance: boolean;
}

const swapV2Tuple = utils.ParamType.fromString(
  'tuple(bytes32 poolId, uint256 assetInIndex, uint256 assetOutIndex, uint256 amount, bytes userData)',
);

const swapV2TupleArray = `${swapV2Tuple.format('full')}[]`;

export function balancerV2TakeOrderArgs({
  swapType,
  swaps,
  tokenAddresses,
  tokenOutAmount,
  limits,
  deadline,
}: BalancerV2TakeOrder) {
  const _tokenOutAmount = BigNumber.from(tokenOutAmount.toString());

  return encodeArgs(
    ['uint8', swapV2TupleArray, 'address[]', 'uint256', 'int256[]', 'uint256'],
    [swapType, swaps, tokenAddresses, _tokenOutAmount, limits, deadline],
  );
}

const lendV2JoinPoolRequest = utils.ParamType.fromString(
  'tuple(address[] assets, uint256[] maxAmountsIn, bytes userData, bool fromInternalBalance)',
);

const redeemV2JoinPoolRequest = utils.ParamType.fromString(
  'tuple(address[] assets, uint256[] minAmountsOut, bytes userData, bool toInternalBalance)',
);

export function balancerV2LendArgs({ poolId, request }: BalancerV2Lend) {
  return encodeArgs(['bytes32', lendV2JoinPoolRequest], [poolId, request]);
}
export interface BalancerV2Lend {
  poolId: string;
  request: JoinPoolRequest;
}
export function balancerV2RedeemArgs({ poolId, recipient, request }: BalancerV2Redeem) {
  return encodeArgs(['bytes32', 'address', redeemV2JoinPoolRequest], [poolId, recipient, request]);
}
export interface BalancerV2Redeem {
  poolId: string;
  recipient: string;
  request: ExitPoolRequest;
}

export async function getSwap(
  provider: BaseProvider,
  queryOnChain: boolean,
  swapType: SwapTypes,
  tokenIn: TokenDescriptor,
  tokenOut: TokenDescriptor,
  swapAmount: BN,
): Promise<[SwapInfo, BN]> {
  const networkDescriptor = await getNetworkDescriptor(provider);

  const sor = new SOR(provider, networkDescriptor.chainId, networkDescriptor.subgraphURL);

  // Will get onChain data for pools list
  await sor.fetchPools(sor.getPools(), queryOnChain);

  // gasPrice is used by SOR as a factor to determine how many pools to swap against.
  // i.e. higher cost means more costly to trade against lots of different pools.
  const gasPrice = new BN('40000000000');
  // This determines the max no of pools the SOR will use to swap.
  const maxPools = 4;

  // This calculates the cost to make a swap which is used as an input to sor to allow it to make gas efficient recommendations.
  // Note - tokenOut for SwapExactIn, tokenIn for SwapExactOut
  const outputToken = swapType === SwapTypes.SwapExactOut ? tokenIn : tokenOut;
  const cost = await sor.getCostOfSwapInToken(outputToken.address, new BN(outputToken.decimals.toString()), gasPrice);

  const swapInfo: SwapInfo = await sor.getSwaps(tokenIn.address, tokenOut.address, swapType, swapAmount, {
    gasPrice,
    maxPools,
  });

  return [swapInfo, cost];
}

// Limits:
// +ve means max to send
// -ve mean min to receive
// For a multihop the intermediate tokens should be 0
// This is where slippage tolerance would be added
export function calculateLimits(swapType: SwapTypes, swapInfo: SwapInfo): string[] {
  const limits: string[] = [];

  if (swapType === SwapTypes.SwapExactIn) {
    swapInfo.tokenAddresses.forEach((token, i) => {
      if (token.toLowerCase() === swapInfo.tokenIn.toLowerCase()) {
        limits[i] = swapInfo.swapAmount.toString();
      } else if (token.toLowerCase() === swapInfo.tokenOut.toLowerCase()) {
        limits[i] = swapInfo.returnAmount.times(-0.99).toString().split('.')[0];
      } else {
        limits[i] = '0';
      }
    });
  } else {
    swapInfo.tokenAddresses.forEach((token, i) => {
      if (token.toLowerCase() === swapInfo.tokenIn.toLowerCase()) {
        limits[i] = swapInfo.returnAmount.toString();
      } else if (token.toLowerCase() === swapInfo.tokenOut.toLowerCase()) {
        limits[i] = swapInfo.swapAmount.times(-0.99).toString().split('.')[0];
      } else {
        limits[i] = '0';
      }
    });
  }

  return limits;
}

// export function calcMinTokensOut(exitInfo: poolExit): BigNumber[] {
//   const minTokensOut: BigNumber[] = [];
//   //userPercentage = userBPTTokens / pool.totalSupply();
//   //minTokensOut = poolTokenAmounts.map(el=> el*userPercentage);
//   return minTokensOut;
// }
//
// hand rolled version of:
//   https://github.com/enzymefinance/protocol/blob/current/packages/protocol/src/utils/integrations/common.ts#L52-L72
//
export async function assetTransferArgs({
  adapter,
  selector,
  encodedCallArgs,
}: {
  adapter: BalancerV2Adapter;
  selector: BytesLike;
  encodedCallArgs: BytesLike;
}) {
  const {
    0: spendAssetsHandleType,
    1: spendAssets,
    2: spendAssetAmounts,
    3: expectedIncomingAssets,
  } = await adapter.parseAssetsForMethod(selector, encodedCallArgs);

  return encodeArgs(
    ['uint', 'address[]', 'uint[]', 'address[]'],
    [spendAssetsHandleType, spendAssets, spendAssetAmounts, expectedIncomingAssets],
  );
}

export function printSwapDetails(
  swapType: SwapTypes,
  swapInfo: SwapInfo,
  funds: FundManagement,
  limits: string[],
  tokenIn: TokenDescriptor,
  tokenOut: TokenDescriptor,
  swapAmount: BN,
  cost: string,
  preSwapBalances: Balances,
  postSwapBalances: Balances,
) {
  const amtInScaled =
    swapType === SwapTypes.SwapExactIn
      ? swapAmount.toString()
      : scale(swapInfo.returnAmount, -tokenIn.decimals).toString();
  const amtOutScaled =
    swapType === SwapTypes.SwapExactIn
      ? scale(swapInfo.returnAmount, -tokenOut.decimals).toString()
      : swapAmount.toString();
  const swapTypeStr = swapType === SwapTypes.SwapExactIn ? 'SwapExactIn' : 'SwapExactOut';

  console.log(`\n================================================`);

  console.log(`Funds: ${JSON.stringify(funds, undefined, 2)}`);
  console.log(`Swap addresses: ${JSON.stringify(swapInfo.tokenAddresses, undefined, 2)}`);
  console.log(`Limits: ${JSON.stringify(limits, undefined, 2)}`);

  console.log(`Swap type: ${swapTypeStr}`);
  console.log(`Token In: ${tokenIn.symbol}, Amt: ${amtInScaled}`);
  console.log(`Token Out: ${tokenOut.symbol}, Amt: ${amtOutScaled.toString()}`);
  console.log(`Cost to swap in ${tokenIn.symbol}: ${cost} ${tokenIn.symbol}`);

  console.log(`Balances before swap:`);
  console.log(`  ${tokenIn.symbol}: ${preSwapBalances.tokenIn.balance}`);
  console.log(`  ${tokenOut.symbol}: ${preSwapBalances.tokenOut.balance}`);

  console.log(`Balances after swap:`);
  console.log(`  ${tokenIn.symbol}: ${postSwapBalances.tokenIn.balance}`);
  console.log(`  ${tokenOut.symbol}: ${postSwapBalances.tokenOut.balance}`);

  console.log(`================================================\n`);
}
