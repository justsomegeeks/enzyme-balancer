/*
    This code is heavily inspired by:https://github.com/balancer-labs/balancer-sor/blob/7b7ff636378568b08990643f3dd8db2d237e2e53/src/poolCaching/subgraph.ts
*/
import  fetch  from 'isomorphic-fetch';
import { task } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

enum Networks {
   MAINNET = 1,
}
  
const SUBGRAPH_URLS = {
  [Networks.MAINNET]: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2',
};

type SubgraphToken = {
    address: string;
    balance: string;
    decimals: number;
    priceRate: string;
    // WeightedPool field
    weight: string | null;
};

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
export async function fetchSubgraphPools(
    subgraphUrl: string
): Promise<SubgraphPoolBase[]> {
    // can filter for publicSwap too??
    const query = `
      {
        pools: pools(first: 1000) {
          id
          address
          poolType
          swapFee
          totalShares
          tokens {
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
        }
      }
    `;

    console.log(`fetchSubgraphPools: ${subgraphUrl}`);
    const response = await fetch(subgraphUrl, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query,
        }),
    });

    const { data } = await response.json();

    return data.pools ?? [];
}

task('bal_getPools', 'Get all public pools on balancer', async (args, hre: HardhatRuntimeEnvironment) => {
    const provider = hre.ethers.getDefaultProvider();
    const chainId = (await provider.getNetwork()).chainId;
    const networkInfo: Networks | undefined = Networks[Networks[chainId] as keyof typeof Networks];
    const result = fetchSubgraphPools(SUBGRAPH_URLS[networkInfo]);
    console.log( (await result).length);
});