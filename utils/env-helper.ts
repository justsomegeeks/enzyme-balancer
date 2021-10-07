import { bnum } from '@balancer-labs/sor';
import { AddressZero } from '@ethersproject/constants';
import type { Contract } from '@ethersproject/contracts';
import type { BaseProvider } from '@ethersproject/providers';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import IERC20Artifact from '@openzeppelin/contracts/build/contracts/IERC20.json';
import { BigNumber as BN } from 'bignumber.js';
import { BigNumber } from 'ethers';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

/**
 * Network: Kovan
 * Aggregator: ETH/USD
 * Address: 0x9326BFA02ADD2366b30bacB125260Af641031331
 */
//chainlink oracle addresses.
// address ETH_USD = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
// address BTC_USD = 0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c;
// address CRV_USD = 0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f;
// address YFI_USD = 0xA027702dbb89fbd58938e4324ac03B58d812b0E1;
// address UNI_ETH = 0xD6aA3D25116d8dA79Ea0246c4826EB951872e02e;
// balancer smart contract addresses on mainnet.
//     Vault: 0xBA12222222228d8Ba445958a75a0704d566BF2C8
// Authorizer: 0xA331D84eC860Bf466b4CdCcFb4aC09a1B43F3aE6
// WeightedPoolFactory: 0x8E9aa87E45e92bad84D5F8DD1bff34Fb92637dE9
// WeightedPool2TokensFactory: 0xA5bf2ddF098bb0Ef6d120C98217dD6B141c74EE0
// StablePoolFactory: 0xc66Ba2B6595D3613CCab350C886aCE23866EDe24
// LiquidityBootstrappingPoolFactory: 0x751A0bC0e3f75b38e01Cf25bFCE7fF36DE1C87DE
// MetastablePoolFactory: 0x67d27634E44793fE63c467035E31ea8635117cd4
// InvestmentPoolFactory: 0x48767F9F868a4A7b86A90736632F6E44C2df7fa9

const SUPPORTED_TOKENS = ['WBTC', 'WETH'] as const;
export type SupportedTokens = typeof SUPPORTED_TOKENS[number];

const SUPPORTED_NETWORKS = ['mainnet'] as const;
type SupportedNetworks = typeof SUPPORTED_NETWORKS[number];

let hre: HardhatRuntimeEnvironment;

// temporary hack to get around testing on pinned mainnet, while using 'live' mainnet chainlink feeds and
// mainnet subgrah
interface ExpectedTrade {
  tokenInAmount: BN;
  tokenOut: SupportedTokens;
  tokenOutAmount: BN;
}

interface PriceAggregatorDescriptor {
  address: string;
  isValue: boolean;
}

export interface TokenDescriptor {
  address: string;
  contract: Contract | undefined;
  decimals: BigNumber;
  // temporary hack to get around testing on pinned mainnet, while using 'live' mainnet chainlink feeds and
  // mainnet subgrah
  mainnetPinnedBlockTradeCache?: ExpectedTrade;
  priceAggregatorDescriptor: PriceAggregatorDescriptor;
  symbol: string;
  whaleAddress: string;
}

type TokenDescriptors = {
  [key in SupportedTokens]: {
    address: string;
    contract: Contract | undefined;
    decimals: BigNumber;
    mainnetPinnedBlockTradeCache?: ExpectedTrade;
    priceAggregatorDescriptor: PriceAggregatorDescriptor;
    symbol: key;
    whaleAddress: string;
  };
};

interface ContractDescriptor {
  [key: string]: string;
}

type ContractDescriptors = {
  [key in 'balancer' | 'enzyme']: ContractDescriptor;
};

export interface NetworkDescriptor {
  chainId: number;
  contracts: ContractDescriptors;
  name: SupportedNetworks;
  subgraphURL: string;
  tokens: TokenDescriptors;
}

type NetworkDescriptors = {
  [key in SupportedNetworks]: {
    chainId: number;
    contracts: ContractDescriptors;
    name: key;
    subgraphURL: string;
    tokens: TokenDescriptors;
  };
};

export function initializeEnvHelper(_hre: HardhatRuntimeEnvironment) {
  hre = _hre;
}

export async function getNetworkDescriptors(): Promise<NetworkDescriptors> {
  return {
    mainnet: {
      chainId: 1,
      contracts: {
        balancer: {
          BalancerV2Vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
          BalancerV2WBTCWETHPoolAddress: '0xA6F548DF93de924d73be7D25dC02554c6bD66dB5',
          BalancerV2WBTCWETHPoolId: '0xa6f548df93de924d73be7d25dc02554c6bd66db500020000000000000000000e',
        },
        enzyme: {
          AggregatedDerivativePriceFeed: '0x2e45f9b3fd5871ccaf4eb415dfccbdd126f57c4f',
          EnyzmeComptroller: '0xe0dcf68b0b2fd1097442f2134e57339404a00639',
          EnzymeCouncil: '0xb270fe91e8e4b80452fbf1b4704208792a350f53',
          EnzymeVaultProxy: '0x24f3b37934D1AB26B7bda7F86781c90949aE3a79', // Rhino Fund
          FundOwner: '0x978cc856357946f980fba68db3b7f0d72e570da8', // Rhino Fund Manager
          IntegrationManager: '0x965ca477106476B4600562a2eBe13536581883A6',
        },
      },
      name: 'mainnet',
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2',
      tokens: {
        WBTC: {
          address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
          contract: await hre.ethers.getContractAt(IERC20Artifact.abi, '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'),
          decimals: BigNumber.from(8),
          mainnetPinnedBlockTradeCache: {
            tokenInAmount: new BN('1'),
            tokenOut: 'WETH',
            tokenOutAmount: new BN('14048180065889770850'),
          },
          priceAggregatorDescriptor: {
            address: '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
            isValue: true,
          },
          symbol: 'WBTC',
          whaleAddress: '0xe08A8b19e5722a201EaF20A6BC595eF655397bd5',
        },
        WETH: {
          address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          contract: await hre.ethers.getContractAt(IERC20Artifact.abi, '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'),
          decimals: BigNumber.from(18),
          mainnetPinnedBlockTradeCache: {
            tokenInAmount: new BN('14048180065889770850'),
            tokenOut: 'WBTC',
            tokenOutAmount: new BN('1'),
          },
          priceAggregatorDescriptor: {
            address: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
            isValue: true,
          },
          symbol: 'WETH',
          whaleAddress: '0x56178a0d5F301bAf6CF3e1Cd53d9863437345Bf9',
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

export interface Balances {
  address: string;
  tokenIn: {
    balance: BigNumber;
    tokenDescriptor: TokenDescriptor;
  };
  tokenOut: {
    balance: BigNumber;
    tokenDescriptor: TokenDescriptor;
  };
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

export async function adjustAllowanceIfNeeded(
  signer: SignerWithAddress,
  token: TokenDescriptor,
  amount: BigNumber,
  contract: Contract,
) {
  // if 'token' is ETH itself, nothing to do. just return
  if (token.address === AddressZero) {
    return;
  }

  const tokenInContract = await hre.ethers.getContractAt(IERC20Artifact.abi, token.address);
  let allowance = await tokenInContract.allowance(signer.address, contract.address);

  if (bnum(allowance).lt(new BN(amount.toString()))) {
    console.log(`ERC20 token allowance amount is insufficient.`);
    console.log(`Current allowance = ${allowance}, Required allowance = ${amount}`);
    console.log(`Increasing allowance...`);

    const txApprove = await tokenInContract.connect(signer).approve(contract.address, hre.ethers.constants.MaxUint256);

    await txApprove.wait();

    console.log(`Allowance increased...`);

    allowance = await tokenInContract.allowance(signer.address, contract.address);

    console.log(`New allowance = ${allowance}, Required allowance = ${amount}`);
  }
}

export async function getBalance(address: string, token: TokenDescriptor): Promise<BigNumber> {
  const provider = hre.ethers.getDefaultProvider();

  return isETH(token.address) ? await provider.getBalance(address) : await token.contract?.balanceOf(address);
}

export async function getBalances(
  address: string,
  tokenIn: TokenDescriptor,
  tokenOut: TokenDescriptor,
): Promise<Balances> {
  const balances = {
    address,
    tokenIn: {
      balance: await getBalance(address, tokenIn),
      tokenDescriptor: tokenIn,
    },
    tokenOut: {
      balance: await getBalance(address, tokenOut),
      tokenDescriptor: tokenOut,
    },
  } as Balances;

  return balances;
}

export function bnToBigNumber(value: BN, decimals = BigNumber.from('0')): BigNumber {
  return hre.ethers.utils.parseUnits(value.toString(), decimals);
}

export function priceFeedContractArgsFromNetworkDescriptor(
  networkDescriptor: NetworkDescriptor,
): [string, string[], string[], boolean[]] {
  return [
    networkDescriptor.contracts.balancer.BalancerV2Vault,
    Object.values(networkDescriptor.tokens).map((tokenDescriptor) => tokenDescriptor.address),
    Object.values(networkDescriptor.tokens).map((tokenDescriptor) => tokenDescriptor.priceAggregatorDescriptor.address),
    Object.values(networkDescriptor.tokens).map((tokenDescriptor) => tokenDescriptor.priceAggregatorDescriptor.isValue),
  ];
}
