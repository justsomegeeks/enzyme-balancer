import { bnum } from '@balancer-labs/sor';
import { ChainlinkRateAsset } from '@enzymefinance/protocol';
import { AddressZero } from '@ethersproject/constants';
import type { Contract } from '@ethersproject/contracts';
import type { BaseProvider } from '@ethersproject/providers';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import IERC20Artifact from '@openzeppelin/contracts/build/contracts/IERC20.json';
import { BigNumber as BN } from 'bignumber.js';
import { BigNumber } from 'ethers';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

const SUPPORTED_TOKENS = ['WBTC', 'WETH'] as const;
export type SupportedTokens = typeof SUPPORTED_TOKENS[number];

const SUPPORTED_NETWORKS = ['mainnet'] as const;
type SupportedNetworks = typeof SUPPORTED_NETWORKS[number];

let hre: HardhatRuntimeEnvironment;

//
//
// MAINNET config: https://github.com/enzymefinance/protocol/blob/current/deploy/scripts/config/Mainnet.ts
// WETH is not included as it is auto-included in the chainlink price feed
//
// const primitives = {
//   ...
//   wbtc: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
//   ...
// }
//
// const weth = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
//
// const aggregators = {
//   ...
//   wbtc: ['0xdeb288f737066589598e9214e782fa5a8ed689e8', ChainlinkRateAsset.ETH],     <-- ChainLinkRateAsset
//   ...
// }
//
// ChainLinkRateAsset: https://github.com/enzymefinance/protocol/blob/987ed191ecd6e0ca9c4a89569754b3ea562c75cb/packages/protocol/src/types.ts
//
// ChainLinkPriceFeed: https://github.com/enzymefinance/protocol/blob/current/contracts/release/infrastructure/price-feeds/primitives/ChainlinkPriceFeed.sol
//
// derivatives: UniswapV2PoolPriceFeed.sol: https://github.com/enzymefinance/protocol/blob/987ed191ecd6e0ca9c4a89569754b3ea562c75cb/contracts/release/infrastructure/price-feeds/derivatives/feeds/UniswapV2PoolPriceFeed.sol
//
//
// UniswapV2PoolTokenCalculator: https://github.com/enzymefinance/protocol/blob/987ed191ecd6e0ca9c4a89569754b3ea562c75cb/contracts/release/infrastructure/price-feeds/utils/UniswapV2PoolTokenValueCalculator.sol  MDC: wow.  that's a hell of a thing!
//
//
// https://github.com/enzymefinance/protocol/blob/current/deploy/utils/config.ts
//
// export interface DeploymentConfig {
//   weth: string;
//   primitives: Record<string, string>;
//   chainlink: {
//     ethusd: string;
//     aggregators: Record<string, readonly [string, ChainlinkRateAsset]>;
//   },
//   ...
//   idle: Record<string, string>;
//   ...
//   paraSwapV4: {
//     augustusSwapper: string;
//     tokenTransferProxy: string;
//   };
//   stakehound: {
//     steth: string;
//   };
//   unsupportedAssets: Record<string, string>;
//   uniswap: {
//     factory: string;
//     router: string;
//     pools: Record<string, string>;
//   };
//   uniswapV3: {
//     router: string;
//   };
// };
//

//
//
// KOVAN config: github.com/enzymefinance/protocol/blob/current/deploy/scripts/config/Kovan.ts
//
//

// temporary hack to get around testing on pinned mainnet, while using 'live' mainnet chainlink feeds and
// mainnet subgrah
interface ExpectedTrade {
  tokenInAmount: BN;
  tokenOut: SupportedTokens;
  tokenOutAmount: BN;
}

interface PriceAggregatorDescriptor {
  address: string;
  rateAsset?: ChainlinkRateAsset;
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
    priceAggregatorDescriptor?: PriceAggregatorDescriptor;
    symbol: key;
    whaleAddress: string;
  };
};

interface ContractDescriptor {
  [key: string]: string;
}

type ContractDescriptors = {
  [key in 'balancer' | 'chainlink' | 'enzyme']: ContractDescriptor;
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
        chainlink: {
          ETHUSDAggregator: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
        },
        enzyme: {
          AggregatedDerivativePriceFeed: '0x2e45f9b3fd5871ccaf4eb415dfccbdd126f57c4f',
          EnyzmeComptroller: '0xe0dcf68b0b2fd1097442f2134e57339404a00639',
          EnzymeCouncil: '0xb270fe91e8e4b80452fbf1b4704208792a350f53',
          EnzymeDeployer: '0x7e6d3b1161df9c9c7527f68d651b297d2fdb820b', // Rhino Fund Deployer
          EnzymeVaultProxy: '0x24f3b37934D1AB26B7bda7F86781c90949aE3a79', // Rhino Fund
          FundOwner: '0x978cc856357946f980fba68db3b7f0d72e570da8', // Rhino Fund Manager
          IntegrationManager: '0x965ca477106476B4600562a2eBe13536581883A6',
          DerivativePriceFeedAddress: '0x2e45f9b3fd5871ccaf4eb415dfccbdd126f57c4f',
          PrimitivePriceFeedAddress: '0x1fad8faf11e027f8630f394599830dbeb97004ee',
          // TODO valueInterpreter: https://github.com/enzymefinance/protocol/blob/current/packages/testutils/src/deployment.ts#L102
          // import from @enzymefinance/protocol
          ValueInterpreter: '0x10a5624840Ac07287f756777DF1DEC34d2C2d654',
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
            address: '0xdeb288f737066589598e9214e782fa5a8ed689e8', // Chainlink BTC/ETH Price Feed
            rateAsset: ChainlinkRateAsset.ETH,
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
          // priceAggregatorDescriptor: {
          //   address: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
          // },
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

export type PriceFeedDeployArgs = [
  string, // fund deployer address,
  string, // derivative price feed address,
  string, // primitive price feed address,
  string, // value interpretor address,
  string, // factory address   TODO what is factory, a factory of what?
  [string, string], // token0 and token1 erc20 addresses of tokens in pool
  string,
];

export function priceFeedDeployArgsFromNetworkDescriptor(networkDescriptor: NetworkDescriptor): PriceFeedDeployArgs {
  return [
    networkDescriptor.contracts.enzyme.EnzymeDeployer,
    networkDescriptor.contracts.enzyme.DerivativePriceFeedAddress,
    networkDescriptor.contracts.enzyme.PrimitivePriceFeedAddress,
    networkDescriptor.contracts.enzyme.ValueInterpreter,
    networkDescriptor.contracts.enzyme
      .AggregatedDerivativePriceFeed /* not sure if this is right but using it for now this is the "factory" variable*/,
    [networkDescriptor.tokens.WBTC.address, networkDescriptor.tokens.WETH.address],
    networkDescriptor.contracts.balancer.BalancerV2Vault,
  ];
}
