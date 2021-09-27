import { SwapTypes } from '@balancer-labs/sor';
import { getBalancerContract } from '@balancer-labs/v2-deployments';
import { BigNumber } from 'bignumber.js';
import { task } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import type { Balances, FundManagement } from '../utils/sor-helper';
import { calculateLimits, getNetworkERC20s, getSwap, Networks, printSwapDetails } from '../utils/sor-helper';

task('bal_sorswap', 'Swap 2 tokens via Balancer SOR', async (args, hre: HardhatRuntimeEnvironment) => {
  const provider = hre.ethers.getDefaultProvider();
  const chainId = (await provider.getNetwork()).chainId;
  const networkInfo: Networks | undefined = Networks[Networks[chainId] as keyof typeof Networks];
  const networkName = Networks[networkInfo];

  if (typeof networkInfo === 'undefined') {
    throw `Invalid chain id: ${chainId}`;
  }

  const networkERC20s = getNetworkERC20s(hre);

  const queryOnChain = true;
  const swapType = SwapTypes.SwapExactIn;
  const tokenIn = networkERC20s[networkInfo]['ETH'];
  const tokenOut = networkERC20s[networkInfo]['USDC'];
  const swapAmount = new BigNumber(1);

  const [swapInfo, cost] = await getSwap(provider, networkInfo, queryOnChain, swapType, tokenIn, tokenOut, swapAmount);

  if (!swapInfo.returnAmount.gt(0)) {
    console.log(`Return amount is 0. No swaps to execute.`);
    return;
  }

  if (swapInfo.tokenIn !== hre.ethers.constants.AddressZero) {
    // TODO ERC20 allowance/approve
    // // Vault needs approval for swapping non ETH
    // console.log('Checking vault allowance...');
    // const tokenInContract = new Contract(swapInfo.tokenIn, erc20abi, provider);
    // let allowance = await tokenInContract.allowance(wallet.address, vaultAddr);
    // if (bnum(allowance).lt(swapInfo.swapAmount)) {
    //   console.log(`Not Enough Allowance: ${allowance.toString()}. Approving vault now...`);
    //   const txApprove = await tokenInContract.connect(wallet).approve(vaultAddr, MaxUint256);
    //   await txApprove.wait();
    //   console.log(`Allowance updated: ${txApprove.hash}`);
    //   allowance = await tokenInContract.allowance(wallet.address, vaultAddr);
    // }
    // console.log(`Allowance: ${allowance.toString()}`);
  }

  const [, whale] = await hre.ethers.getSigners();

  const vaultContract = await getBalancerContract('20210418-vault', 'Vault', networkName);

  const funds: FundManagement = {
    fromInternalBalance: false,
    recipient: whale.address,
    sender: whale.address,
    toInternalBalance: false,
  };

  const limits = calculateLimits(swapType, swapInfo);

  const deadline = hre.ethers.constants.MaxUint256;

  const ierc20abi = ['function balanceOf(address) external view returns (uint256)'];
  const tokenOutContract = await hre.ethers.getContractAt(ierc20abi, tokenOut.address);

  const tokenInBalanceBefore = await whale.getBalance();
  const tokenOutBalanceBefore = await tokenOutContract.balanceOf(whale.address);

  const balances: Balances = {
    tokenIn: {
      after: undefined,
      before: hre.ethers.utils.formatEther(tokenInBalanceBefore),
    },
    tokenOut: {
      after: undefined,
      before: hre.ethers.utils.formatEther(tokenOutBalanceBefore),
    },
  };

  console.log('Swapping...');

  // ETH in swaps must send ETH value
  const overrides =
    swapInfo.tokenIn === hre.ethers.constants.AddressZero ? { value: swapInfo.swapAmount.toString() } : {};

  // overrides['gasLimit'] = '200000';
  // overrides['gasPrice'] = '20000000000';

  const swapTxn = await vaultContract
    .connect(whale)
    .batchSwap(swapType, swapInfo.swaps, swapInfo.tokenAddresses, funds, limits, deadline, overrides);

  const swapTxnReceipt = await swapTxn.wait();

  console.log(`swapTxnReceipt: ${JSON.stringify(swapTxnReceipt, undefined, 2)}`);

  const tokenInBalanceAfter = await whale.getBalance();
  const tokenOutBalanceAfter = await tokenOutContract.balanceOf(whale.address);

  balances.tokenIn.after = hre.ethers.utils.formatEther(tokenInBalanceAfter);
  balances.tokenOut.after = hre.ethers.utils.formatEther(tokenOutBalanceAfter);

  const costScaled = cost.times(tokenIn.decimals).dp(0, BigNumber.ROUND_HALF_EVEN).toString();
  const swapInTokenCost = hre.ethers.utils.formatUnits(costScaled, tokenIn.decimals.toString());

  printSwapDetails(swapType, swapInfo, funds, limits, tokenIn, tokenOut, swapAmount, swapInTokenCost, balances);
});
