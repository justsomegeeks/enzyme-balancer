/*
  This file's purpose and its location somewhat mimics the '@enzymefinance/testutils' package.
  
  Examples:
    https://github.com/enzymefinance/protocol/blob/current/packages/testutils/src/scaffolding/extensions/integrations/uniswapV2.ts#L131-L171
*/

import type { JoinPoolRequest, ExitPoolRequest } from '@balancer-labs/balancer-js';
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

import type { BalancerV2Lend, BalancerV2Redeem } from '../balancerV2';
import { balancerV2LendArgs, balancerV2TakeOrderArgs, calculateLimits, balancerV2RedeemArgs } from '../balancerV2';

export async function balancerV2TakeOrder({
  enzymeComptroller,
  integrationManager,
  enzymeFundOwner,
  balancerV2Adapter,
  swapType,
  swapInfo,
  deadline,
}: {
  enzymeComptroller: ComptrollerLib;
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

  return enzymeComptroller
    .connect(enzymeFundOwner)
    .callOnExtension(integrationManager, IntegrationManagerActionId.CallOnIntegration, callArgs);
}
export async function balancerV2Lend({
  enzymeComptroller,
  integrationManager,
  enzymeFundOwner,
  balancerV2Adapter,
  poolId,
  recipient,
  request,
}: {
  enzymeComptroller: ComptrollerLib;
  integrationManager: IntegrationManager;
  enzymeFundOwner: SignerWithAddress;
  balancerV2Adapter: AddressLike;
  poolId: string;
  recipient: string;
  request: JoinPoolRequest;
}) {
  const lendArgs = balancerV2LendArgs({
    poolId,
    recipient,
    request,
  });
  const callArgs = callOnIntegrationArgs({
    adapter: balancerV2Adapter,
    encodedCallArgs: lendArgs,
    selector: lendSelector,
  });

  return enzymeComptroller
    .connect(enzymeFundOwner)
    .callOnExtension(integrationManager, IntegrationManagerActionId.CallOnIntegration, callArgs);
}
export async function balancerV2Redeem({
  comptrollerProxy,
  integrationManager,
  enzymeFundOwner,
  balancerV2Adapter,
  poolId,
  recipient,
  request,
}: {
  comptrollerProxy: ComptrollerLib;
  integrationManager: IntegrationManager;
  enzymeFundOwner: SignerWithAddress;
  balancerV2Adapter: AddressLike;
  poolId: string;
  recipient: string;
  request: ExitPoolRequest;
}) {
  const redeemArgs = balancerV2RedeemArgs({
    poolId,
    recipient,
    request,
  } as BalancerV2Redeem);
  const callArgs = callOnIntegrationArgs({
    adapter: balancerV2Adapter,
    encodedCallArgs: redeemArgs,
    selector: redeemSelector,
  });

  return comptrollerProxy
    .connect(enzymeFundOwner)
    .callOnExtension(integrationManager, IntegrationManagerActionId.CallOnIntegration, callArgs);
}
