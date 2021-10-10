/*
  This file's purpose and its location somewhat mimics the '@enzymefinance/testutils' package.
  
  Examples:
    https://github.com/enzymefinance/protocol/blob/current/packages/testutils/src/scaffolding/extensions/integrations/uniswapV2.ts#L131-L171
*/

import type { ExitPoolRequest, JoinPoolRequest } from '@balancer-labs/balancer-js';
import type { SwapInfo, SwapTypes } from '@balancer-labs/sor';
import type { AddressLike } from '@enzymefinance/ethers';
import type { ComptrollerLib, IntegrationManager } from '@enzymefinance/protocol';
import {
  callOnIntegrationArgs,
  IntegrationManagerActionId,
  lendSelector,
  redeemSelector,
  takeOrderSelector,
} from '@enzymefinance/protocol';
import type { BigNumber } from '@ethersproject/bignumber';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import type { BalancerV2Redeem } from '../balancerV2';
import { balancerV2LendArgs, balancerV2RedeemArgs, balancerV2TakeOrderArgs, calculateLimits } from '../balancerV2';

export async function balancerV2TakeOrder({
  enzymeController,
  integrationManager,
  enzymeFundOwner,
  balancerV2Adapter,
  swapType,
  swapInfo,
  deadline,
}: {
  enzymeController: ComptrollerLib;
  integrationManager: IntegrationManager;
  enzymeFundOwner: SignerWithAddress;
  balancerV2Adapter: AddressLike;
  swapType: SwapTypes;
  swapInfo: SwapInfo;
  deadline: BigNumber;
}) {
  const limits = calculateLimits(swapType, swapInfo);

  const takeOrderArgs = balancerV2TakeOrderArgs({
    deadline,
    limits,
    swapType,
    swaps: swapInfo.swaps,
    tokenAddresses: [swapInfo.tokenIn, swapInfo.tokenOut],
    tokenOutAmount: swapInfo.returnAmount,
  });

  const callArgs = callOnIntegrationArgs({
    adapter: balancerV2Adapter,
    encodedCallArgs: takeOrderArgs,
    selector: takeOrderSelector,
  });

  return enzymeController
    .connect(enzymeFundOwner)
    .callOnExtension(integrationManager, IntegrationManagerActionId.CallOnIntegration, callArgs);
}
export async function balancerV2Lend({
  enzymeController,
  integrationManager,
  enzymeFundOwner,
  balancerV2Adapter,
  poolId,
  request,
}: {
  enzymeController: ComptrollerLib;
  integrationManager: IntegrationManager;
  enzymeFundOwner: SignerWithAddress;
  balancerV2Adapter: AddressLike;
  poolId: string;
  request: JoinPoolRequest;
}) {
  const lendArgs = balancerV2LendArgs({
    poolId,
    request,
  });
  const callArgs = callOnIntegrationArgs({
    adapter: balancerV2Adapter,
    encodedCallArgs: lendArgs,
    selector: lendSelector,
  });

  return enzymeController
    .connect(enzymeFundOwner)
    .callOnExtension(integrationManager, IntegrationManagerActionId.CallOnIntegration, callArgs);
}
export async function balancerV2Redeem({
  enzymeController,
  integrationManager,
  enzymeFundOwner,
  balancerV2Adapter,
  poolId,
  request,
}: {
  enzymeController: ComptrollerLib;
  integrationManager: IntegrationManager;
  enzymeFundOwner: SignerWithAddress;
  balancerV2Adapter: AddressLike;
  poolId: string;
  request: ExitPoolRequest;
}) {
  const redeemArgs = balancerV2RedeemArgs({
    poolId,
    request,
  } as BalancerV2Redeem);

  const callArgs = callOnIntegrationArgs({
    adapter: balancerV2Adapter,
    encodedCallArgs: redeemArgs,
    selector: redeemSelector,
  });

  return enzymeController
    .connect(enzymeFundOwner)
    .callOnExtension(integrationManager, IntegrationManagerActionId.CallOnIntegration, callArgs);
}
