/* eslint-disable prefer-const */
/*
    This code is heavily inspired by: https://github.com/balancer-labs/balancer-sor/blob/master/test/testScripts/swapExample.ts
*/

import type { SwapInfo } from '@balancer-labs/sor';
import { bnum, scale, SOR, SwapTypes } from '@balancer-labs/sor';
import { getBalancerContract } from '@balancer-labs/v2-deployments';
import type { BigNumberish } from '@ethersproject/bignumber';
import { Contract } from '@ethersproject/contracts';
import type { BaseProvider } from '@ethersproject/providers';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'bignumber.js';
import { task } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

enum Networks {
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

interface ERC20Descriptors {
  [key: string]: ERC20Info;
}

type NetworkERC20s = {
  [key in Networks]: ERC20Descriptors;
};

interface FundManagement {
  sender: string;
  recipient: string;
  fromInternalBalance: boolean;
  toInternalBalance: boolean;
}

function getNetworkERC20s(hre: HardhatRuntimeEnvironment): NetworkERC20s {
  return {
    [Networks.mainnet]: {
      BAL: {
        address: '0xba100000625a3754423978a60c9317c58a424e3d',
        decimals: new BigNumber(18),
        symbol: 'BAL',
      },
      ETH: {
        address: hre.ethers.constants.AddressZero,
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

async function getSwap(
  provider: BaseProvider,
  networkInfo: Networks,
  queryOnChain: boolean,
  swapType: SwapTypes,
  tokenIn: ERC20Info,
  tokenOut: ERC20Info,
  swapAmount: BigNumber,
): Promise<SwapInfo> {
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

  return swapInfo;
}

task('bal_sorswap', 'Swap 2 tokens via Balancer SOR', async (args, hre: HardhatRuntimeEnvironment) => {
  const provider = hre.ethers.getDefaultProvider();
  const chainId = (await provider.getNetwork()).chainId;
  const networkInfo: Networks | undefined = Networks[Networks[chainId] as keyof typeof Networks];
  const networkName = Networks[networkInfo];

  if (typeof networkInfo === 'undefined') {
    throw `Invalid chain id: ${chainId}`;
  }

  const networkERC20s = getNetworkERC20s(hre);

  // If true(swaps erc20 for erc20) else (swaps eth for erc20)
  const isErc20Swap = true;

  const queryOnChain = true;
  const swapType = SwapTypes.SwapExactIn;
  const ethDescriptor = networkERC20s[networkInfo]['ETH'];
  const usdcDescriptor = networkERC20s[networkInfo]['USDC'];
  const balDescriptor = networkERC20s[networkInfo]['BAL'];
  const swapAmount = new BigNumber(100);

  let swapInfo: SwapInfo;
  if (isErc20Swap) {
    swapInfo = await getSwap(provider, networkInfo, queryOnChain, swapType, balDescriptor, usdcDescriptor, swapAmount);
  } else {
    swapInfo = await getSwap(provider, networkInfo, queryOnChain, swapType, ethDescriptor, usdcDescriptor, swapAmount);
  }
  if (!swapInfo.returnAmount.gt(0)) {
    console.log(`Return amount is 0. No swaps to execute.`);
    return;
  }

  const ierc20abi = [
    'function balanceOf(address) external view returns (uint256)',
    'function allowance(address,address) external view returns (uint256)',
    'function approve(address,uint256) external returns (bool)',
    'function transferFrom(address,address,uint256) external returns (bool)',
    'function transfer(address,uint256) external returns (bool)',
  ];

  // We need different whales if both tokens are erc20
  let whale: SignerWithAddress;
  if (isErc20Swap) {
    const balWhaleAddr = '0x876EabF441B2EE5B5b0554Fd502a8E0600950cFa';
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [balWhaleAddr],
    });
    whale = await hre.ethers.getSigner(balWhaleAddr);
  } else {
    whale = (await hre.ethers.getSigners())[1];
  }

  const vaultContract = await getBalancerContract('20210418-vault', 'Vault', networkName);

  if (swapInfo.tokenIn !== hre.ethers.constants.AddressZero) {
    // TODO ERC20 allowance/approve
    // Vault needs approval for swapping non ETH
    console.log('Checking vault allowance...');
    const tokenInContract = new Contract(swapInfo.tokenIn, ierc20abi, provider);
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

  // Limits:
  // +ve means max to send
  // -ve mean min to receive
  // For a multihop the intermediate tokens should be 0
  // This is where slippage tolerance would be added
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

  const deadline = hre.ethers.constants.MaxUint256;

  console.log(funds);
  console.log(swapInfo.tokenAddresses);
  console.log(limits);

  const balToken = await hre.ethers.getContractAt(ierc20abi, balDescriptor.address);
  const usdcToken = await hre.ethers.getContractAt(ierc20abi, usdcDescriptor.address);

  let usdcBalanceBefore, usdcBalanceAfter, balBalanceAfter, balBalanceBefore: any;
  let ethBalanceBefore, ethBalanceAfter: BigNumberish;
  // eslint-disable-next-line prefer-const
  usdcBalanceBefore = await usdcToken.balanceOf(whale.address);
  if (isErc20Swap) {
    balBalanceBefore = await balToken.balanceOf(whale.address);
  }
  ethBalanceBefore = await whale.getBalance();

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

  if (isErc20Swap) {
    balBalanceAfter = await balToken.balanceOf(whale.address);
  }
  ethBalanceAfter = await whale.getBalance();
  usdcBalanceAfter = await usdcToken.balanceOf(whale.address);

  if (isErc20Swap) {
    console.log(
      `Balances before swap:\n  BAL: ${hre.ethers.utils.formatEther(
        balBalanceBefore,
      )}\n  USDC: ${hre.ethers.utils.formatUnits(usdcBalanceBefore, 6)}`,
    );

    console.log(
      `Balances after swap:\n  BAL: ${hre.ethers.utils.formatEther(
        balBalanceAfter,
      )}\n  USDC: ${hre.ethers.utils.formatUnits(usdcBalanceAfter, 6)}`,
    );
  } else {
    console.log(
      `Balances before swap:\n  ETH: ${ethBalanceBefore}\n  USDC: ${hre.ethers.utils.formatUnits(
        usdcBalanceBefore,
        6,
      )}`,
    );
    console.log(
      `Balances after swap:\n  ETH: ${ethBalanceAfter}\n  USDC: ${hre.ethers.utils.formatUnits(usdcBalanceAfter, 6)}`,
    );
  }
});
