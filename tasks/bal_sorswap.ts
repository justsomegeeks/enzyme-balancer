/* eslint-disable prefer-const */
/*
    This code is heavily inspired by: https://github.com/balancer-labs/balancer-sor/blob/master/test/testScripts/swapExample.ts
*/

import type { SwapInfo } from '@balancer-labs/sor';
import { bnum, scale, SOR, SwapTypes } from '@balancer-labs/sor';
import { getBalancerContract } from '@balancer-labs/v2-deployments';
import type { BaseProvider } from '@ethersproject/providers';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'bignumber.js';
import { task } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import erc20Artifact from '../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json';

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
type SupportedTokens = 'ETH' | 'BAL' | 'USDC' | 'AAVE';
interface SorSwapArgs {
  tokenIn: SupportedTokens;
  tokenOut: SupportedTokens;
  swapAmount: string;
}
const supportedTokens = ['ETH', 'BAL', 'USDC', 'AAVE'];

task('bal_sorswap', 'Swap 2 tokens via Balancer SOR')
  .addParam('tokenIn', "'ETH' or 'BAL' or 'USDC' or 'AAVE'", 'BAL')
  .addParam('tokenOut', "'ETH' or 'BAL' or 'USDC' or 'AAVE'", 'AAVE')
  .addParam('swapAmount', 'Swap Amount', '100')
  .setAction(async (args: SorSwapArgs, hre: HardhatRuntimeEnvironment) => {
    const { swapAmount, tokenIn, tokenOut } = args;

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

    const networkERC20s = getNetworkERC20s(hre);

    const queryOnChain = true;
    let swapType = SwapTypes.SwapExactIn;
    const token1Descriptor = networkERC20s[networkInfo][tokenIn];
    const token2Descriptor = networkERC20s[networkInfo][tokenOut];

    let swapInfo = await getSwap(
      provider,
      networkInfo,
      queryOnChain,
      swapType,
      token1Descriptor,
      token2Descriptor,
      new BigNumber(Number(swapAmount)),
    );
    if (!swapInfo.returnAmount.gt(0)) {
      console.log(`Return amount is 0. No swaps to execute.`);
      return;
    }

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

    const vaultContract = await getBalancerContract('20210418-vault', 'Vault', networkName);

    if (swapInfo.tokenIn !== hre.ethers.constants.AddressZero) {
      // TODO ERC20 allowance/approve
      // Vault needs approval for swapping non ETH
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

    const token1 = await hre.ethers.getContractAt(erc20Artifact.abi, token1Descriptor.address);
    const token2 = await hre.ethers.getContractAt(erc20Artifact.abi, token2Descriptor.address);

    let token1BalanceBefore, token1BalanceAfter, token2BalanceBefore, token2BalanceAfter: any;
    // eslint-disable-next-line prefer-const
    if (tokenIn === 'ETH') {
      token1BalanceBefore = await whale.getBalance();
      token2BalanceBefore = await token2.balanceOf(whale.address);
    } else if (tokenOut === 'ETH') {
      token1BalanceBefore = await token1.balanceOf(whale.address);
      token2BalanceBefore = await whale.getBalance();
    } else {
      token1BalanceBefore = await token1.balanceOf(whale.address);
      token2BalanceBefore = await token2.balanceOf(whale.address);
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
      token1BalanceAfter = await whale.getBalance();
      token2BalanceAfter = await token2.balanceOf(whale.address);
    } else if (tokenOut === 'ETH') {
      token1BalanceAfter = await token1.balanceOf(whale.address);
      token2BalanceAfter = await whale.getBalance();
    } else {
      token1BalanceAfter = await token1.balanceOf(whale.address);
      token2BalanceAfter = await token2.balanceOf(whale.address);
    }
    // TODO when to format units and when to format ethers

    console.log(
      `Balances before swap:\n  ${tokenIn}: ${hre.ethers.utils.formatUnits(
        token1BalanceBefore,
        token1Descriptor.decimals.toNumber(),
      )}\n  ${tokenOut}: ${hre.ethers.utils.formatUnits(token2BalanceBefore, token2Descriptor.decimals.toNumber())}`,
    );

    console.log(
      `Balances after swap:\n  ${tokenIn}: ${hre.ethers.utils.formatUnits(
        token1BalanceAfter,
        token1Descriptor.decimals.toNumber(),
      )}\n  ${tokenOut}: ${hre.ethers.utils.formatUnits(token2BalanceAfter, token2Descriptor.decimals.toNumber())}`,
    );
  });
