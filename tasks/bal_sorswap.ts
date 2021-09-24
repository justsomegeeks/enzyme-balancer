/*
    This code is heavily inspired by: https://github.com/balancer-labs/balancer-sor/blob/master/test/testScripts/swapExample.ts
*/

import type { SwapInfo, SwapV2 } from '@balancer-labs/sor';
import { scale, SOR, SwapTypes } from '@balancer-labs/sor';
import { BigNumber } from 'bignumber.js';
import { task } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

// import { SOR, SwapInfo, SwapTypes, scale, bnum, SubgraphPoolBase } from '../../src';
// import vaultArtifact from '../../src/abi/Vault.json';
// import relayerAbi from '../abi/BatchRelayer.json';
// import erc20abi from '../abi/ERC20.json';

enum Network {
  MAINNET = 1,
}

const SUBGRAPH_URLS = {
  [Network.MAINNET]: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2',
};

interface ERC20Info {
  address: string;
  decimals: BigNumber;
  symbol: string;
}

interface ERC20Descriptor {
  [key: string]: ERC20Info;
}

type NetworkERC20s = {
  [key in Network]: ERC20Descriptor[];
};

// This is the same across networks
const vaultAddr = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';

const mainnetBatchRelayerAddress = '0xdcdbf71A870cc60C6F9B621E28a7D3Ffd6Dd4965';

function getAddresses(hre: HardhatRuntimeEnvironment): NetworkERC20s {
  return {
    [Network.MAINNET]: [
      {
        BAL: {
          address: '0xba100000625a3754423978a60c9317c58a424e3d',
          decimals: new BigNumber(18),
          symbol: 'BAL',
        },
      },
      {
        ETH: {
          address: hre.ethers.constants.AddressZero,
          decimals: new BigNumber(18),
          symbol: 'ETH',
        },
      },
      {
        USDC: {
          address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          decimals: new BigNumber(6),
          symbol: 'USDC',
        },
      },
    ],
  };
}

async function getSwap(
  hre: HardhatRuntimeEnvironment,
  queryOnChain: boolean,
  swapType: SwapTypes,
  tokenIn: ERC20Info,
  tokenOut: ERC20Info,
  swapAmount: BigNumber,
): Promise<SwapInfo> {
  const provider = hre.ethers.getDefaultProvider();
  const chainId = (await provider.getNetwork()).chainId;
  const network: Network | undefined = Network[Network[chainId] as keyof typeof Network];

  if (typeof network === 'undefined') {
    throw `Invalid chain id: ${chainId}`;
  }

  const sor = new SOR(provider, chainId, SUBGRAPH_URLS[network]);

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

  const amtInScaled =
    swapType === SwapTypes.SwapExactIn
      ? swapAmount.toString()
      : scale(swapInfo.returnAmount, -tokenIn.decimals).toString();
  const amtOutScaled =
    swapType === SwapTypes.SwapExactIn
      ? scale(swapInfo.returnAmount, -tokenOut.decimals).toString()
      : swapAmount.toString();
  const swapTypeStr = swapType === SwapTypes.SwapExactIn ? 'SwapExactIn' : 'SwapExactOut';

  console.log(swapTypeStr);
  console.log(`Token In: ${tokenIn.symbol}, Amt: ${amtInScaled}`);
  console.log(`Token Out: ${tokenOut.symbol}, Amt: ${amtOutScaled.toString()}`);
  console.log(`Cost to swap: ${cost.toString()}`);
  console.log(`Swaps:`);
  console.log(swapInfo.swaps);
  console.log(swapInfo.tokenAddresses);

  return swapInfo;
}

task('bal_sorswap', 'Gets Balancer WBTC/WETH pool address', async (args, hre: HardhatRuntimeEnvironment) => {
  const ADDRESSES = getAddresses(hre);
});
