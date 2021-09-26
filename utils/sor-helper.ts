/*
    This code is heavily inspired by: https://github.com/balancer-labs/balancer-sor/blob/master/test/testScripts/swapExample.ts
*/

import type { SwapInfo, SwapV2 } from '@balancer-labs/sor';
import { scale, SOR, SwapTypes } from '@balancer-labs/sor';
import { encodeArgs } from '@enzymefinance/protocol';
import { AddressZero } from '@ethersproject/constants';
import type { BaseProvider } from '@ethersproject/providers';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'bignumber.js';
import { utils } from 'ethers';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

export enum Networks {
  mainnet = 1,
}

const SUBGRAPH_URLS = {
  [Networks.mainnet]: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2',
};

interface ERC20Info {
  address: string;
  decimals: BigNumber;
  symbol: string;
}

type SupportedTokens = 'ETH' | 'BAL' | 'USDC' | 'AAVE';

interface ERC20Descriptors {
  [key: string]: ERC20Info;
}

type NetworkERC20s = {
  [key in Networks]: ERC20Descriptors;
};

export interface FundManagement {
  sender: string;
  recipient: string;
  fromInternalBalance: boolean;
  toInternalBalance: boolean;
}

export interface BalancerV2TakeOrder {
  swapType: SwapTypes;
  swaps: SwapV2[];
  tokenAddresses: string[];
  funds: FundManagement;
  limits: string[];
  deadline: BigNumber;
  //   overrides: { value: string } | {};
}

export interface Balances {
  tokenIn: {
    before: string | undefined;
    after: string | undefined;
  };
  tokenOut: {
    before: string | undefined;
    after: string | undefined;
  };
}

export function getNetworkERC20s(): NetworkERC20s {
  return {
    [Networks.mainnet]: {
      AAVE: {
        address: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
        decimals: new BigNumber(18),
        symbol: 'AAVE',
      },
      BAL: {
        address: '0xba100000625a3754423978a60c9317c58a424e3d',
        decimals: new BigNumber(18),
        symbol: 'BAL',
      },
      ETH: {
        address: AddressZero,
        decimals: new BigNumber(18),
        symbol: 'ETH',
      },
      USDC: {
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        decimals: new BigNumber(6),
        symbol: 'USDC',
      },
    },
  };
}

const swapV2Tuple = utils.ParamType.fromString(
  'tuple(string poolId, number assetInIndex, number assetOutIndex, string amount, string userData)',
);

const swapV2TupleArray = `${swapV2Tuple.format('full')}[]`;

const swapV2FundManagement = utils.ParamType.fromString(
  'tuple(address sender, bool fromInternalBalance, address payable recipient, bool toInternalBalance)',
);

export function balancerV2TakeOrderArgs({
  swapType,
  swaps,
  tokenAddresses,
  funds,
  limits,
  deadline,
}: BalancerV2TakeOrder) {
  return encodeArgs(
    ['uint8', swapV2TupleArray, 'string[]', swapV2FundManagement, 'int256[]', 'uint256'],
    [swapType, swaps, tokenAddresses, funds, limits, deadline],
  );
}

export async function getSwap(
  provider: BaseProvider,
  networkInfo: Networks,
  queryOnChain: boolean,
  swapType: SwapTypes,
  tokenIn: ERC20Info,
  tokenOut: ERC20Info,
  swapAmount: BigNumber,
): Promise<[SwapInfo, BigNumber]> {
  const chainId = (await provider.getNetwork()).chainId;

  const sor = new SOR(provider, chainId, SUBGRAPH_URLS[networkInfo]);

  // Will get onChain data for pools list
  await sor.fetchPools(sor.getPools(), queryOnChain);

  // gasPrice is used by SOR as a factor to determine how many pools to swap against.
  // i.e. higher cost means more costly to trade against lots of different pools.
  const gasPrice = new BigNumber('40000000000');
  // This determines the max no of pools the SOR will use to swap.
  const maxPools = 4;

  // This calculates the cost to make a swap which is used as an input to sor to allow it to make gas efficient recommendations.
  // Note - tokenOut for SwapExactIn, tokenIn for SwapExactOut
  const outputToken = swapType === SwapTypes.SwapExactOut ? tokenIn : tokenOut;
  const cost = await sor.getCostOfSwapInToken(outputToken.address, outputToken.decimals, gasPrice);

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

export async function getWhaleAddress(
  hre: HardhatRuntimeEnvironment,
  tokenIn: SupportedTokens,
): Promise<SignerWithAddress> {
  let whale: SignerWithAddress;
  if (tokenIn === 'ETH') {
    whale = (await hre.ethers.getSigners())[1];
  } else {
    const whaleAddress =
      tokenIn === 'BAL'
        ? '0x876EabF441B2EE5B5b0554Fd502a8E0600950cFa'
        : tokenIn === 'AAVE'
        ? '0xF977814e90dA44bFA03b6295A0616a897441aceC'
        : // if its USDC
          '0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8';

    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [whaleAddress],
    });
    whale = await hre.ethers.getSigner(whaleAddress);
  }
  return whale;
}

export function printSwapDetails(
  swapType: SwapTypes,
  swapInfo: SwapInfo,
  funds: FundManagement,
  limits: string[],
  tokenIn: ERC20Info,
  tokenOut: ERC20Info,
  swapAmount: BigNumber,
  cost: string,
  balances: Balances,
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
  console.log(`  ${tokenIn.symbol}: ${balances.tokenIn.before}`);
  console.log(`  ${tokenOut.symbol}: ${balances.tokenOut.before}`);

  console.log(`Balances after swap:`);
  console.log(`  ${tokenIn.symbol}: ${balances.tokenIn.after}`);
  console.log(`  ${tokenOut.symbol}: ${balances.tokenOut.after}`);

  console.log(`================================================\n`);
}
