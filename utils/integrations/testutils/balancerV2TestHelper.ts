/*
  This file's purpose and its location somewhat mimics the '@enzymefinance/testutils' package.
  
  Examples:
    https://github.com/enzymefinance/protocol/blob/current/packages/testutils/src/scaffolding/extensions/integrations/uniswapV2.ts#L131-L171
*/

import type { SwapInfo, SwapTypes } from '@balancer-labs/sor';
import type { AddressLike } from '@enzymefinance/ethers';
import type { ComptrollerLib, IntegrationManager } from '@enzymefinance/protocol';
import { JoinPoolRequest } from '@balancer-labs/balancer-js';
import { callOnIntegrationArgs, IntegrationManagerActionId, takeOrderSelector, lendSelector } from '@enzymefinance/protocol';
import type { BigNumber } from '@ethersproject/bignumber';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { balancerV2TakeOrderArgs, calculateLimits, BalancerV2LendArgs, BalancerV2Lend } from '../balancerV2';

export async function balancerV2TakeOrder({
  comptrollerProxy,
  integrationManager,
  fundOwner,
  balancerV2Adapter,
  swapType,
  swapInfo,
  deadline,
  seedFund = false,
}: {
  comptrollerProxy: ComptrollerLib;
  integrationManager: IntegrationManager;
  fundOwner: SignerWithAddress;
  balancerV2Adapter: AddressLike;
  swapType: SwapTypes;
  swapInfo: SwapInfo;
  deadline: BigNumber;
  seedFund?: boolean;
}) {
  if (seedFund) {
    // Seed the VaultProxy with enough outgoingAsset for the tx
    // await pathAddresses[0].transfer(await comptrollerProxy.getVaultProxy(), outgoingAssetAmount);
  }

  const limits = calculateLimits(swapType, swapInfo);

  const takeOrderArgs = balancerV2TakeOrderArgs({
    deadline,
    limits,
    swapType,
    swaps: swapInfo.swaps,
    tokenAddresses: [swapInfo.tokenIn, swapInfo.tokenIn],
    tokenOutAmount: swapInfo.returnAmount,
  });

  //   const transferArgs = await assetTransferArgs({
  //     adapter: balancerV2Adapter,
  //     encodedCallArgs: takeOrderArgs,
  //     selector: takeOrderSelector,
  //   });

  const callArgs = callOnIntegrationArgs({
    adapter: balancerV2Adapter,
    encodedCallArgs: takeOrderArgs,
    selector: takeOrderSelector,
  });

  return comptrollerProxy
    .connect(fundOwner)
    .callOnExtension(integrationManager, IntegrationManagerActionId.CallOnIntegration, callArgs);
}

export async function balancerV2Lend({
  comptrollerProxy,
  integrationManager,
  fundOwner,
  balancerV2Adapter,
  poolId, 
  recipient, 
  request
}: {
  comptrollerProxy: ComptrollerLib;
  integrationManager: IntegrationManager;
  fundOwner: SignerWithAddress;
  balancerV2Adapter: AddressLike;
  poolId: string;
  recipient: string;
  request: JoinPoolRequest;  
}) {

  const lendArgs = BalancerV2LendArgs({
    poolId, recipient, request
  } as BalancerV2Lend);

  const callArgs = callOnIntegrationArgs({
    adapter: balancerV2Adapter,
    encodedCallArgs: lendArgs,
    selector: lendSelector,
  });

  return comptrollerProxy
    .connect(fundOwner)
    .callOnExtension(integrationManager, IntegrationManagerActionId.CallOnIntegration, callArgs);
}