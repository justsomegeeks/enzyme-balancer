import { getPoolAddress } from '@balancer-labs/balancer-js';
import { task } from 'hardhat/config';

task('bal_getPoolAddress', 'Gets Balancer WBTC/WETH pool address', async () => {
  const v2WBTCWETHPoolId = '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014';
  const v2WBTCWETHPoolAddress = getPoolAddress(v2WBTCWETHPoolId);

  console.log(`Balancer V2 WBTC/WETH Pool Address: ${v2WBTCWETHPoolAddress}`);
});
