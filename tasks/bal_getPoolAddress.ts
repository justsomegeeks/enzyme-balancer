import { getPoolAddress } from '@balancer-labs/balancer-js';
import IVaultArtifact from '@balancer-labs/v2-deployments/dist/tasks/20210418-vault/abi/Vault.json';
import IWeightedPoolArtifact from '@balancer-labs/v2-deployments/dist/tasks/20210418-weighted-pool/abi/WeightedPool.json';
import { task } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
// import weightedPool_abi from '@balancer-labs/v2-deployments/dist/tasks/20210418-weighted-pool/abi/WeightedPool.json';

task('bal_getPoolAddress', 'Gets Balancer WBTC/WETH pool address', async () => {
  const v2WBTCWETHPoolId = '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014';
  const v2WBTCWETHPoolAddress = getPoolAddress(v2WBTCWETHPoolId);

  console.log(`Balancer V2 WBTC/WETH Pool Address: ${v2WBTCWETHPoolAddress}`);
});

task(
  'bal_getPoolTokens',
  'gets balancer pool tokens with poolId',
  async function (args, hre: HardhatRuntimeEnvironment) {
    const provider = hre.ethers.getDefaultProvider();
    const Vault = new hre.ethers.Contract('0xBA12222222228d8Ba445958a75a0704d566BF2C8', IVaultArtifact, provider);

    const V2PoolID = '0x01abc00e86c7e258823b9a055fd62ca6cf61a16300010000000000000000003b';

    const poolTokens = Vault.getPoolTokens(V2PoolID);
    console.log(await poolTokens);
  },
);

task(
  'bal_getTotalSupply',
  'gets totalsupply from a a balancer pool',
  async function (args, hre: HardhatRuntimeEnvironment) {
    const provider = hre.ethers.getDefaultProvider();
    const poolContract = new hre.ethers.Contract(
      '0x454c1d458F9082252750ba42D60faE0887868A3B',
      IWeightedPoolArtifact,
      provider,
    );
    const totalSupply = await poolContract.totalSupply();
    //console.log(totalSupply.toString());
    return totalSupply;
  },
);
