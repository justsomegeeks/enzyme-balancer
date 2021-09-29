/*
    This code is heavily inspired by: https://github.com/balancer-labs/balancer-sor/blob/master/test/testScripts/swapExample.ts
*/

import { task } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

const supportedTokens = 'Supported tokens are: AAVE, BAL, COMP, ETH, USDC';

task('bal_sorswap', 'Swap 2 tokens via Balancer SOR')
  .addParam('tokenIn', supportedTokens, 'AAVE')
  .addParam('tokenOut', supportedTokens, 'USDC')
  .addParam('amount', 'Swap Amount', '100')
  .setAction(async (args: SorSwapArgs, hre: HardhatRuntimeEnvironment) => {