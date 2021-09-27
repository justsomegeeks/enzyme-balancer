import { AddressLike } from '@enzymefinance/ethers';
import { assetTransferArgs, StandardToken, takeOrderSelector } from '@enzymefinance/protocol';
import type { ProtocolDeployment } from '@enzymefinance/testutils';
import { createNewFund, deployProtocolFixture, getAssetBalances, uniswapV3TakeOrder } from '@enzymefinance/testutils';
import { expect } from 'chai';
import { BigNumber, BigNumberish, utils } from 'ethers';

function balancerV2TakeOrderArgs({ pathAddresses, pathFees, outgoingAssetAmount, minIncomingAssetAmount, }: {
    pathAddresses: AddressLike[];
    pathFees: BigNumber[];
    outgoingAssetAmount: BigNumberish;
    minIncomingAssetAmount: BigNumberish;
}) {
  return '';
}

let fork: ProtocolDeployment;
beforeEach(async () => {
  fork = await deployProtocolFixture();
});

describe('constructor', () => {
  it('sets state vars', async () => {
    const uniswapV3Adapter = fork.deployment.uniswapV3Adapter;

    expect(await uniswapV3Adapter.getUniswapV3Router()).to.equal(fork.config.uniswapV3.router);

    expect(await uniswapV3Adapter.getIntegrationManager()).to.equal(fork.deployment.integrationManager);
  });
});

describe('takeOrder', () => {
  it('can only be called via the IntegrationManager', async () => {
    const uniswapV3Adapter = fork.deployment.uniswapV3Adapter;
    const [fundOwner] = fork.accounts;

    const { vaultProxy } = await createNewFund({
      signer: fundOwner,
      fundOwner,
      fundDeployer: fork.deployment.fundDeployer,
      denominationAsset: new StandardToken(fork.config.primitives.usdc, provider),
    });

    const outgoingAsset = new StandardToken(fork.config.primitives.mln, whales.mln);
    const incomingAsset = new StandardToken(fork.config.weth, provider);

    const takeOrderArgs = balancerV2TakeOrderArgs({
      pathAddresses: [outgoingAsset, incomingAsset],
      pathFees: [BigNumber.from('3000')],
      outgoingAssetAmount: utils.parseUnits('1', await outgoingAsset.decimals()),
      minIncomingAssetAmount: utils.parseUnits('1', await incomingAsset.decimals()),
    });

    const transferArgs = await assetTransferArgs({
      adapter: uniswapV3Adapter,
      selector: takeOrderSelector,
      encodedCallArgs: takeOrderArgs,
    });

    await expect(uniswapV3Adapter.takeOrder(vaultProxy, takeOrderSelector, transferArgs)).rejects.toBeRevertedWith(
      'Only the IntegrationManager can call this function',
    );
  });

  it('does not allow pathAddresses with less than 2 assets', async () => {
    const usdc = new StandardToken(fork.config.primitives.usdc, whales.usdc);
    const outgoingAsset = new StandardToken(fork.config.weth, whales.weth);
    const [fundOwner] = fork.accounts;
    const uniswapV3Adapter = fork.deployment.uniswapV3Adapter;

    const integrationManager = fork.deployment.integrationManager;

    const { comptrollerProxy, vaultProxy } = await createNewFund({
      signer: fundOwner,
    git  fundOwner,
      fundDeployer: fork.deployment.fundDeployer,
      denominationAsset: usdc,
    });

    const pathAddresses = [outgoingAsset];
    const outgoingAssetAmount = utils.parseUnits('1', await outgoingAsset.decimals());
    const pathFees = [BigNumber.from('3000')];

    // Seed fund with outgoing asset
    await outgoingAsset.transfer(vaultProxy, outgoingAssetAmount);

    await expect(
      uniswapV3TakeOrder({
        comptrollerProxy,
        integrationManager,
        fundOwner,
        uniswapV3Adapter: uniswapV3Adapter.address,
        pathAddresses,
        pathFees,
        outgoingAssetAmount,
        minIncomingAssetAmount: 1,
      }),
    ).rejects.toBeRevertedWith('pathAddresses must be >= 2');
  });

  it('does not allow a path with incorrect pathFees and pathAddress length', async () => {
    const usdc = new StandardToken(fork.config.primitives.usdc, whales.usdc);
    const outgoingAsset = new StandardToken(fork.config.weth, whales.weth);
    const incomingAsset = usdc;

    const [fundOwner] = fork.accounts;
    const uniswapV3Adapter = fork.deployment.uniswapV3Adapter;

    const integrationManager = fork.deployment.integrationManager;

    const { comptrollerProxy, vaultProxy } = await createNewFund({
      signer: fundOwner,
      fundOwner,
      fundDeployer: fork.deployment.fundDeployer,
      denominationAsset: usdc,
    });

    const pathAddresses = [outgoingAsset, incomingAsset];
    const outgoingAssetAmount = utils.parseUnits('1', await outgoingAsset.decimals());
    const pathFees = [BigNumber.from('3000'), BigNumber.from('3000')];

    // Seed fund with outgoing asset
    await outgoingAsset.transfer(vaultProxy, outgoingAssetAmount);

    await expect(
      uniswapV3TakeOrder({
        comptrollerProxy,
        integrationManager,
        fundOwner,
        uniswapV3Adapter: uniswapV3Adapter.address,
        pathAddresses,
        pathFees,
        outgoingAssetAmount,
        minIncomingAssetAmount: 1,
      }),
    ).rejects.toBeRevertedWith('incorrect pathAddresses or pathFees length');
  });

  it('correctly swaps assets (no intermediary)', async () => {
    const usdc = new StandardToken(fork.config.primitives.usdc, whales.usdc);
    const outgoingAsset = usdc;
    const incomingAsset = new StandardToken(fork.config.primitives.dai, whales.dai);
    const [fundOwner] = fork.accounts;
    const uniswapV3Adapter = fork.deployment.uniswapV3Adapter;

    const integrationManager = fork.deployment.integrationManager;

    const { comptrollerProxy, vaultProxy } = await createNewFund({
      signer: fundOwner,
      fundOwner,
      fundDeployer: fork.deployment.fundDeployer,
      denominationAsset: usdc,
    });

    const pathAddresses = [outgoingAsset, incomingAsset];
    const outgoingAssetAmount = utils.parseUnits('1', await outgoingAsset.decimals());
    const pathFees = [BigNumber.from('3000')];

    // Seed fund with outgoing asset
    await outgoingAsset.transfer(vaultProxy, outgoingAssetAmount);

    const [preTxOutgoingAssetBalance, preTxIncomingAssetBalance] = await getAssetBalances({
      account: vaultProxy,
      assets: [outgoingAsset, incomingAsset],
    });

    await uniswapV3TakeOrder({
      comptrollerProxy,
      integrationManager,
      fundOwner,
      uniswapV3Adapter: uniswapV3Adapter.address,
      pathAddresses,
      pathFees,
      outgoingAssetAmount,
      minIncomingAssetAmount: 1,
    });

    const [postTxOutgoingAssetBalance, postTxIncomingAssetBalance] = await getAssetBalances({
      account: vaultProxy,
      assets: [outgoingAsset, incomingAsset],
    });

    const spentAssetAmount = preTxOutgoingAssetBalance.sub(postTxOutgoingAssetBalance);
    const receivedAssetAmount = postTxIncomingAssetBalance.sub(preTxIncomingAssetBalance);

    expect(spentAssetAmount).toEqBigNumber(outgoingAssetAmount);
    expect(receivedAssetAmount).toEqBigNumber(BigNumber.from('996693691953170567'));
  });

  it('correctly swaps assets (with one intermediary)', async () => {
    const weth = new StandardToken(fork.config.weth, whales.weth);
    const dai = new StandardToken(fork.config.primitives.dai, whales.dai);
    const outgoingAsset = dai;
    const incomingAsset = new StandardToken(fork.config.primitives.usdc, provider);
    const usdc = incomingAsset;
    const uniswapV3Adapter = fork.deployment.uniswapV3Adapter;

    const [fundOwner] = fork.accounts;
    const integrationManager = fork.deployment.integrationManager;

    const { comptrollerProxy, vaultProxy } = await createNewFund({
      signer: fundOwner,
      fundOwner,
      fundDeployer: fork.deployment.fundDeployer,
      denominationAsset: usdc,
    });

    const pathFees = [BigNumber.from('3000'), BigNumber.from('500')];

    const pathAddresses = [outgoingAsset, weth, incomingAsset];
    const outgoingAssetAmount = utils.parseUnits('1', await outgoingAsset.decimals());

    // Seed fund with outgoing asset
    await outgoingAsset.transfer(vaultProxy, outgoingAssetAmount);

    const [preTxOutgoingAssetBalance, preTxIncomingAssetBalance] = await getAssetBalances({
      account: vaultProxy,
      assets: [outgoingAsset, incomingAsset],
    });

    await uniswapV3TakeOrder({
      comptrollerProxy,
      integrationManager,
      fundOwner,
      uniswapV3Adapter: uniswapV3Adapter.address,
      pathAddresses,
      pathFees,
      outgoingAssetAmount,
      minIncomingAssetAmount: 1,
    });

    const [postTxOutgoingAssetBalance, postTxIncomingAssetBalance] = await getAssetBalances({
      account: vaultProxy,
      assets: [outgoingAsset, incomingAsset],
    });

    const spentAssetAmount = preTxOutgoingAssetBalance.sub(postTxOutgoingAssetBalance);
    const receivedAssetAmount = postTxIncomingAssetBalance.sub(preTxIncomingAssetBalance);

    expect(spentAssetAmount).toEqBigNumber(outgoingAssetAmount);
    expect(receivedAssetAmount).toEqBigNumber(BigNumber.from('993800'));
  });
});
