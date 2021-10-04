/*
  This file's purpose and its location somewhat mimics the '@enzymefinance/testutils' package.
  
  Examples:
    https://github.com/enzymefinance/protocol/blob/current/packages/testutils/src/scaffolding/extensions/integrations/uniswapV2.ts#L131-L171
*/

import type { SwapInfo, SwapTypes } from '@balancer-labs/sor';
import type { AddressLike } from '@enzymefinance/ethers';
import type { ComptrollerLib, IntegrationManager, VaultLib } from '@enzymefinance/protocol';
import { callOnIntegrationArgs, IntegrationManagerActionId, takeOrderSelector } from '@enzymefinance/protocol';
import type { BigNumber } from '@ethersproject/bignumber';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber as BN } from 'bignumber.js';

import { balancerV2TakeOrderArgs, calculateLimits } from '../balancerV2';

export async function balancerV2TakeOrder({
  enzymeComptroller,
  enzymeFund,
  integrationManager,
  enzymeFundOwner,
  balancerV2Adapter,
  swapType,
  swapInfo,
  deadline,
  seedFund = false,
}: {
  enzymeComptroller: ComptrollerLib;
  enzymeFund: VaultLib;
  integrationManager: IntegrationManager;
  enzymeFundOwner: SignerWithAddress;
  balancerV2Adapter: AddressLike;
  swapType: SwapTypes;
  swapInfo: SwapInfo;
  deadline: BigNumber;
  seedFund?: boolean;
}) {
  if (seedFund) {
    // Seed the enzymeFund with enough outgoingAsset for the tx
    // await pathAddresses[0].transfer(await enzymeComptroller.getVaultProxy(), outgoingAssetAmount);

    // TODO: probably just remove this parameter as we shouldn't need to fund enzyme vaults in the scope
    // of hackathon testing
    enzymeFund;
  }

  const limits = calculateLimits(swapType, swapInfo);

  const takeOrderArgs = balancerV2TakeOrderArgs({
    deadline,
    limits,
    swapType,
    swaps: swapInfo.swaps,
    tokenAddresses: [swapInfo.tokenIn, swapInfo.tokenOut],
    tokenOutAmount: new BN('14048180065889770850'),
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
