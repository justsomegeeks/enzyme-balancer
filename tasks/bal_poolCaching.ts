/*
    This code is heavily inspired by:https://github.com/balancer-labs/balancer-sor/blob/7b7ff636378568b08990643f3dd8db2d237e2e53/src/poolCaching/subgraph.ts
*/
import { task } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import fetch from 'isomorphic-fetch';
import weightedPool_abi from '../node_modules/@balancer-labs/v2-deployments/dist/tasks/20210418-weighted-pool/abi/WeightedPool.json';

enum Networks {
  MAINNET = 1,
}

const SUBGRAPH_URLS = {
  [Networks.MAINNET]: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2',
};
const subGraphQueries = `{
  id
  address
  poolType
  swapFee
  totalShares
  tokens {
    id
    address
    balance
    decimals
    weight
    priceRate
  }
  tokensList
  totalWeight
  amp
  expiryTime
  unitSeconds
  principalToken
  baseToken
  swapEnabled
}`;
interface SubgraphToken {
  address: string;
  balance: string;
  decimals: number;
  priceRate: string;
  // WeightedPool field
  weight: string | null;
}

interface SubgraphPoolBase {
  id: string;
  address: string;
  poolType: string;
  swapFee: string;
  totalShares: string;
  tokens: SubgraphToken[];
  tokensList: string[];

  // Weighted & Element field
  totalWeight?: string;

  // Stable specific fields
  amp?: string;

  // Element specific fields
  expiryTime?: number;
  unitSeconds?: number;
  principalToken?: string;
  baseToken?: string;

  // LBP specific fields
  swapEnabled?: boolean;
}
// Returns all public pools
export async function fetchSubgraphPools(subgraphUrl: string): Promise<SubgraphPoolBase[]> {
  // can filter for publicSwap too??
  const query = `
      {
        pools: pools(first: 1000) ${subGraphQueries}}`;

  console.log(`fetchSubgraphPools: ${subgraphUrl}`);
  const response = await fetch(subgraphUrl, {
    body: JSON.stringify({
      query,
    }),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const { data } = await response.json();

  return data.pools ?? [];
}
export async function fetchSubgraphPool(subgraphUrl: string, pooladdress: string): Promise<SubgraphPoolBase[]> {
  // can filter for publicSwap too??
  const query = `
      {
        pools(where: {address: "${pooladdress}"}) ${subGraphQueries}}`;

  console.log(`fetchSubgraphPools: ${subgraphUrl}`);
  const response = await fetch(subgraphUrl, {
    body: JSON.stringify({
      query,
    }),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const { data } = await response.json();

  return data.pools ?? [];
}
export async function fetchSubgraphPairs(
  subgraphUrl: string,
  token1: string,
  token2: string,
): Promise<SubgraphPoolBase[]> {
  // can filter for publicSwap too??
  const query = `
      {
        pools(where: {tokensList_contains: ["${token1}", "${token2}"]})  ${subGraphQueries}}`;

  console.log(`fetchSubgraphPools: ${subgraphUrl}`);
  const response = await fetch(subgraphUrl, {
    body: JSON.stringify({
      query,
    }),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const { data } = await response.json();

  return data.pools ?? [];
}

task('bal_getPools', 'Get all public pools on balancer', async (args, hre: HardhatRuntimeEnvironment) => {
  const provider = hre.ethers.getDefaultProvider();
  const chainId = (await provider.getNetwork()).chainId;
  const networkInfo: Networks | undefined = Networks[Networks[chainId] as keyof typeof Networks];
  const result = fetchSubgraphPools(SUBGRAPH_URLS[networkInfo]);
  console.log(await result);
});

task(
  'bal_getPool',
  'Fetches info for a specific pool with an address',
  async function (args, hre: HardhatRuntimeEnvironment) {
    const provider = hre.ethers.getDefaultProvider();
    const chainId = (await provider.getNetwork()).chainId;
    const networkInfo: Networks | undefined = Networks[Networks[chainId] as keyof typeof Networks];
    const result = await fetchSubgraphPool(SUBGRAPH_URLS[networkInfo], '0xa660ba113f9aabaeb4bcd28a4a1705f4997d5432');
    console.log(result);
    return result;
  },
);

task(
  'bal_getWETH_WBTCPools',
  'fetches all pools with WETH and WBTC in the token list',
  async function (args, hre: HardhatRuntimeEnvironment) {
    const provider = hre.ethers.getDefaultProvider();
    const chainId = (await provider.getNetwork()).chainId;
    const networkInfo: Networks | undefined = Networks[Networks[chainId] as keyof typeof Networks];
    const result = await fetchSubgraphPairs(
      SUBGRAPH_URLS[networkInfo],
      '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    );
    console.log(result);
  },
);

task(
  'bal_getAllPoolsSupplyOnChain',
  'Iterate over all pools to see if weighted pool is a good encapsulation',
  async function (args, hre: HardhatRuntimeEnvironment) {
    const provider = hre.ethers.getDefaultProvider();
    const chainId = (await provider.getNetwork()).chainId;
    const networkInfo: Networks | undefined = Networks[Networks[chainId] as keyof typeof Networks];
    const result = fetchSubgraphPools(SUBGRAPH_URLS[networkInfo]);
    const supplys = [{ graph: 'test', contract: 'test' }];
    (await result).map(async (pool) => {
      const poolContract = new hre.ethers.Contract(pool.address, weightedPool_abi, provider);

      const totalSupply = await poolContract.totalSupply();
      console.log('from subgraph', pool.totalShares);
      console.log('From contract', await totalSupply);
      supplys.push({ graph: pool.totalShares, contract: await totalSupply });
    });
    console.log('supplies:', supplys);
  },
);
