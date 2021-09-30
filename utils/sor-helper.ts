/*
    This code is heavily inspired by: https://github.com/balancer-labs/balancer-sor/blob/master/test/testScripts/swapExample.ts
*/

import type { SwapInfo, SwapV2 } from '@balancer-labs/sor';
import { bnum, scale, SOR, SwapTypes } from '@balancer-labs/sor';
import { encodeArgs } from '@enzymefinance/protocol';
import { AddressZero } from '@ethersproject/constants';
import type { Contract } from '@ethersproject/contracts';
import type { BaseProvider } from '@ethersproject/providers';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import IERC20Artifact from '@openzeppelin/contracts/build/contracts/IERC20.json';
import { BigNumber as BN } from 'bignumber.js';
import type { BigNumber } from 'ethers';
import { utils } from 'ethers';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

const SUPPORTED_TOKENS = ['AAVE', 'ETH', 'BAL', 'COMP', 'USDC', 'DAI'] as const;
type SupportedTokens = typeof SUPPORTED_TOKENS[number];

const SUPPORTED_NETWORKS = ['mainnet'] as const;
type SupportedNetworks = typeof SUPPORTED_NETWORKS[number];

let hre: HardhatRuntimeEnvironment;

export function initializeSorHelper(_hre: HardhatRuntimeEnvironment) {
  hre = _hre;
}

interface TokenDescriptor {
  address: string;
  contract: Contract | undefined;
  decimals: BN;
  symbol: string;
  whaleAddress: string;
}

type TokenDescriptors = {
  [key in SupportedTokens]: {
    address: string;
    contract: Contract | undefined;
    decimals: BN;
    symbol: key;
    whaleAddress: string;
  };
};

interface ContractDescriptor {
  [key: string]: string;
}

export interface NetworkDescriptor {
  chainId: number;
  contracts: ContractDescriptor;
  name: SupportedNetworks;
  subgraphURL: string;
  tokens: TokenDescriptors;
}

type NetworkDescriptors = {
  [key in SupportedNetworks]: {
    chainId: number;
    contracts: ContractDescriptor;
    name: key;
    subgraphURL: string;
    tokens: TokenDescriptors;
  };
};

export async function getNetworkDescriptors(): Promise<NetworkDescriptors> {
  return {
    mainnet: {
      chainId: 1,
      contracts: {
        BalancerV2Vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
        EnzymeCouncil: '0xb270fe91e8e4b80452fbf1b4704208792a350f53',
        IntegrationManager: '0x965ca477106476B4600562a2eBe13536581883A6',
      },
      name: 'mainnet',
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2',
      tokens: {
        AAVE: {
          address: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
          contract: await hre.ethers.getContractAt(IERC20Artifact.abi, '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9'),
          decimals: new BN(18),
          symbol: 'AAVE',
          whaleAddress: '0xF977814e90dA44bFA03b6295A0616a897441aceC',
        },
        BAL: {
          address: '0xba100000625a3754423978a60c9317c58a424e3d',
          contract: await hre.ethers.getContractAt(IERC20Artifact.abi, '0xba100000625a3754423978a60c9317c58a424e3d'),
          decimals: new BN(18),
          symbol: 'BAL',
          whaleAddress: '0x876EabF441B2EE5B5b0554Fd502a8E0600950cFa',
        },
        COMP: {
          address: '0xc00e94cb662c3520282e6f5717214004a7f26888',
          contract: await hre.ethers.getContractAt(IERC20Artifact.abi, '0xc00e94cb662c3520282e6f5717214004a7f26888'),
          decimals: new BN(18),
          symbol: 'COMP',
          whaleAddress: '0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8',
        },
        DAI: {
          address: '0x6b175474e89094c44da98b954eedeac495271d0f',
          contract: await hre.ethers.getContractAt(IERC20Artifact.abi, '0x6b175474e89094c44da98b954eedeac495271d0f'),
          decimals: new BN(18),
          symbol: 'DAI',
          whaleAddress: '0x28C6c06298d514Db089934071355E5743bf21d60',
        },
        ETH: {
          address: AddressZero,
          contract: undefined,
          decimals: new BN(18),
          symbol: 'ETH',
          whaleAddress: '0xf66852bC122fD40bFECc63CD48217E88bda12109',
        },
        USDC: {
          address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          contract: await hre.ethers.getContractAt(IERC20Artifact.abi, '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
          decimals: new BN(6),
          symbol: 'USDC',
          whaleAddress: '0xae2d4617c862309a3d75a0ffb358c7a5009c673f',
        },
      },
    },
  };
}

export async function getNetworkDescriptor(provider: BaseProvider): Promise<NetworkDescriptor> {
  try {
    const chainId = (await provider.getNetwork()).chainId;
    const networkDescriptor = chainId === 1 ? (await getNetworkDescriptors()).mainnet : undefined;

    if (!networkDescriptor) {
      throw `Network with chainId '${chainId}' not supported`;
    }

    return networkDescriptor;
  } catch (ex) {
    throw ex;
  }
}

export function isETH(tokenAddress: string) {
  return tokenAddress === AddressZero;
}

export function supportedTokensMessage() {
  return `Supported tokens: ${SUPPORTED_TOKENS.join(', ')}`;
}

export function isSupportedToken(token: SupportedTokens) {
  return SUPPORTED_TOKENS.includes(token);
}

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

export async function getWhaleSigner(
  networkDescriptor: NetworkDescriptor,
  tokenIn: SupportedTokens,
): Promise<SignerWithAddress> {
  const whaleAddress = networkDescriptor.tokens[tokenIn].whaleAddress;

  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [whaleAddress],
  });

  return await hre.ethers.getSigner(whaleAddress);
}

export async function adjustAllowanceIfNeeded(signer: SignerWithAddress, swapInfo: SwapInfo, contract: Contract) {
  // if 'token' is ETH itself, nothing to do. just return
  if (swapInfo.tokenIn === AddressZero) {
    return;
  }

  console.log('Checking ERC20 allowance...');

  const tokenInContract = await hre.ethers.getContractAt(IERC20Artifact.abi, swapInfo.tokenIn);
  const allowance = await tokenInContract.allowance(signer.address, contract.address);

  console.log(`allowance = ${allowance}, swapAmount = ${swapInfo.swapAmount}`);

  if (bnum(allowance).lt(swapInfo.swapAmount)) {
    console.log(`ERC20 token allowance amount is insufficient. Increasing allowance now.`);

    const txApprove = await tokenInContract.connect(signer).approve(contract.address, hre.ethers.constants.MaxUint256);

    await txApprove.wait();

    console.log(`ERC20 token allowance increased.`);
  } else {
    console.log('ERC20 allowance is already sufficient.');
  }
}

export async function getBalances(
  signer: SignerWithAddress,
  tokenIn: TokenDescriptor,
  tokenOut: TokenDescriptor,
  currentBalances?: Balances,
): Promise<Balances> {
  const balances = {
    tokenIn: {
      after: undefined,
      before: currentBalances && currentBalances.tokenIn ? currentBalances.tokenIn.before : undefined,
    },
    tokenOut: {
      after: undefined,
      before: currentBalances && currentBalances.tokenOut ? currentBalances.tokenOut.before : undefined,
    },
  } as Balances;

  if (typeof balances.tokenIn.before === 'undefined' || typeof balances.tokenOut.before === 'undefined') {
    if (isETH(tokenIn.address)) {
      balances.tokenIn.before = hre.ethers.utils.formatUnits(
        (await signer.getBalance()).toString(),
        tokenIn.decimals.toString(),
      );
      balances.tokenOut.before = hre.ethers.utils.formatUnits(
        await tokenOut.contract?.balanceOf(signer.address),
        tokenOut.decimals.toString(),
      );
    } else if (isETH(tokenOut.address)) {
      balances.tokenIn.before = hre.ethers.utils.formatUnits(
        await tokenIn.contract?.balanceOf(signer.address),
        tokenIn.decimals.toString(),
      );
      balances.tokenOut.before = hre.ethers.utils.formatUnits(
        (await signer.getBalance()).toString(),
        tokenOut.decimals.toString(),
      );
    } else {
      balances.tokenIn.before = hre.ethers.utils.formatUnits(
        await tokenIn.contract?.balanceOf(signer.address),
        tokenIn.decimals.toString(),
      );
      balances.tokenOut.before = hre.ethers.utils.formatUnits(
        await tokenOut.contract?.balanceOf(signer.address),
        tokenOut.decimals.toString(),
      );
    }
  }

  if (isETH(tokenIn.address)) {
    balances.tokenIn.after = hre.ethers.utils.formatUnits(
      (await signer.getBalance()).toString(),
      tokenIn.decimals.toString(),
    );
    balances.tokenOut.after = hre.ethers.utils.formatUnits(
      await tokenOut.contract?.balanceOf(signer.address),
      tokenOut.decimals.toString(),
    );
  } else if (isETH(tokenOut.address)) {
    balances.tokenIn.after = hre.ethers.utils.formatUnits(
      await tokenIn.contract?.balanceOf(signer.address),
      tokenIn.decimals.toString(),
    );
    balances.tokenOut.after = hre.ethers.utils.formatUnits(
      (await signer.getBalance()).toString(),
      tokenOut.decimals.toString(),
    );
  } else {
    balances.tokenIn.after = hre.ethers.utils.formatUnits(
      await tokenIn.contract?.balanceOf(signer.address),
      tokenIn.decimals.toString(),
    );
    balances.tokenOut.after = hre.ethers.utils.formatUnits(
      await tokenOut.contract?.balanceOf(signer.address),
      tokenOut.decimals.toString(),
    );
  }

  return balances;
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
