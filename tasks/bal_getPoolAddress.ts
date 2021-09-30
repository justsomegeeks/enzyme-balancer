import { getPoolAddress } from '@balancer-labs/balancer-js';
import { task } from 'hardhat/config';
import { ethers } from 'ethers';
import vault_abi from '../node_modules/@balancer-labs/v2-deployments/dist/tasks/20210418-vault/abi/Vault.json';

task('bal_getPoolAddress', 'Gets Balancer WBTC/WETH pool address', async () => {
  const v2WBTCWETHPoolId = '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014';
  const v2WBTCWETHPoolAddress = getPoolAddress(v2WBTCWETHPoolId);

  console.log(`Balancer V2 WBTC/WETH Pool Address: ${v2WBTCWETHPoolAddress}`);
});

task('bal_getPoolTokens', 'gets balancer pool tokens with poolId', async function () {
  const provider = ethers.getDefaultProvider();
  const Vault = new ethers.Contract('0xBA12222222228d8Ba445958a75a0704d566BF2C8', vault_abi, provider);

  const V2PoolID = '0x01abc00e86c7e258823b9a055fd62ca6cf61a16300010000000000000000003b';

  const poolTokens = Vault.getPoolTokens(V2PoolID);
  console.log(await poolTokens);
});
