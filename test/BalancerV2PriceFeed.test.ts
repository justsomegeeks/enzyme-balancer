import { extractEvent } from '@enzymefinance/ethers';
import { AggregatedDerivativePriceFeed } from '@enzymefinance/protocol';
import { assertEvent } from '@enzymefinance/testutils';
import type { BaseProvider } from '@ethersproject/providers';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import type { ContractFactory } from 'ethers';
import hre from 'hardhat';

import type { BalancerV2PriceFeed } from '../typechain';
import type { NetworkDescriptor, PriceFeedDeployArgs } from '../utils/env-helper';
import {
  getNetworkDescriptor,
  initializeEnvHelper,
  priceFeedDeployArgsFromNetworkDescriptor,
} from '../utils/env-helper';

describe('BalancerV2PriceFeed', function () {
  let provider: BaseProvider;
  let networkDescriptor: NetworkDescriptor;

  let enzymeCouncil: SignerWithAddress;

  let balancerV2PriceFeedFactory: ContractFactory;
  let balancerV2PriceFeed: BalancerV2PriceFeed;
  let balancerV2PriceFeedArgs: PriceFeedDeployArgs;

  let aggregatedDerivativePriceFeed: AggregatedDerivativePriceFeed;

  before(async function () {
    initializeEnvHelper(hre);

    provider = hre.ethers.getDefaultProvider();
    networkDescriptor = await getNetworkDescriptor(provider);

    enzymeCouncil = await hre.ethers.getSigner(networkDescriptor.contracts.enzyme.EnzymeCouncil);
    await hre.network.provider.send('hardhat_impersonateAccount', [enzymeCouncil.address]);

    balancerV2PriceFeedArgs = priceFeedDeployArgsFromNetworkDescriptor(networkDescriptor);

    balancerV2PriceFeedFactory = await hre.ethers.getContractFactory('BalancerV2PriceFeed');

    aggregatedDerivativePriceFeed = new AggregatedDerivativePriceFeed(
      networkDescriptor.contracts.enzyme.AggregatedDerivativePriceFeed,
      enzymeCouncil,
    );
  });

  after(async function () {
    await aggregatedDerivativePriceFeed.removeDerivatives([
      networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolAddress,
    ]);
  });

  describe('constructor', function () {
    it('deploys correctly', async function () {
      balancerV2PriceFeedArgs = priceFeedDeployArgsFromNetworkDescriptor(networkDescriptor);

      balancerV2PriceFeed = (await balancerV2PriceFeedFactory.deploy(
        ...balancerV2PriceFeedArgs,
      )) as BalancerV2PriceFeed;

      await balancerV2PriceFeed.deployed();

      expect((await balancerV2PriceFeed.getFundDeployer()).toLowerCase()).to.equal(
        networkDescriptor.contracts.enzyme.EnzymeDeployer.toLowerCase(),
      );

      expect((await balancerV2PriceFeed.getDerivativePriceFeed()).toLowerCase()).to.equal(
        networkDescriptor.contracts.enzyme.DerivativePriceFeedAddress.toLowerCase(),
      );

      expect((await balancerV2PriceFeed.getPrimitivePriceFeed()).toLowerCase()).to.equal(
        networkDescriptor.contracts.enzyme.PrimitivePriceFeedAddress.toLowerCase(),
      );

      expect((await balancerV2PriceFeed.getValueInterpreter()).toLowerCase()).to.equal(
        networkDescriptor.contracts.enzyme.ValueInterpreter.toLowerCase(),
      );

      expect((await balancerV2PriceFeed.getVault()).toLowerCase()).to.equal(
        networkDescriptor.contracts.balancer.BalancerV2Vault.toLowerCase(),
      );

      const poolDescriptor = await balancerV2PriceFeed.getPoolDescriptor(
        networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolAddress,
      );

      expect(poolDescriptor.poolId).to.equal(networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolId);

      expect(poolDescriptor.poolTokenDescriptor.token0.toLowerCase()).to.equal(
        networkDescriptor.tokens.WBTC.address.toLowerCase(),
      );

      expect(poolDescriptor.poolTokenDescriptor.token0Decimals).to.equal(networkDescriptor.tokens.WBTC.decimals);

      expect(poolDescriptor.poolTokenDescriptor.token1.toLowerCase()).to.equal(
        networkDescriptor.tokens.WETH.address.toLowerCase(),
      );

      expect(poolDescriptor.poolTokenDescriptor.token1Decimals).to.equal(networkDescriptor.tokens.WETH.decimals);

      console.log(`\n\n==============================\n`);
      console.log(`Balancer V2 Price Feed deployed at address: ${balancerV2PriceFeed.address}`);
      console.log(`\n==============================\n\n`);
    });

    it('registers WBTC/WETH BPT token aggregated derivative price feed', async function () {
      const addDerivativeTxnReceipt = await aggregatedDerivativePriceFeed.addDerivatives(
        [networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolAddress],
        [balancerV2PriceFeed.address],
      );

      const derivativeAddedEvent = aggregatedDerivativePriceFeed.abi.getEvent('DerivativeAdded');
      assertEvent(addDerivativeTxnReceipt, derivativeAddedEvent);

      expect(
        await aggregatedDerivativePriceFeed.isSupportedAsset(
          networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolAddress,
        ),
      ).to.be.true;

      const event = extractEvent(addDerivativeTxnReceipt, derivativeAddedEvent);

      console.log(`\n\n==============================\n`);
      console.log(
        `Derivative price feed for Balancer WBTC/WETH BPT token ${event[0].args[0]} has been added via transaction: ${addDerivativeTxnReceipt.transactionHash}`,
      );
      console.log(`\n==============================\n\n`);
    });
  });

  describe('calcUnderlyingValues', function () {
    before(async function () {
      balancerV2PriceFeed = (await balancerV2PriceFeedFactory.deploy(
        ...balancerV2PriceFeedArgs,
      )) as BalancerV2PriceFeed;

      await balancerV2PriceFeed.deployed();
    });

    it('returns assets and number of underlying assets per BPT', async function () {
      const underLyingValues = await balancerV2PriceFeed.callStatic.calcUnderlyingValues(
        networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolAddress,
        hre.ethers.utils.parseEther('100'),
      );

      expect(underLyingValues[0][0].toLowerCase()).to.equal(networkDescriptor.tokens.WBTC.address);
      expect(underLyingValues[0][1].toLowerCase()).to.equal(networkDescriptor.tokens.WETH.address);
      expect(parseInt(hre.ethers.utils.formatUnits(underLyingValues[1][0], 8)) === 13471944);
      expect(underLyingValues[1][1] === hre.ethers.BigNumber.from('1896065431266855305'));
    });

    it('should return the value of one bpt in weth', async function () {
      const underLyingValues = await balancerV2PriceFeed.callStatic.calcUnderlyingValues(
        networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolAddress,
        hre.ethers.utils.parseEther('1'),
      );
      const WBTCValue = await balancerV2PriceFeed.callStatic.getCurrentRate(
        networkDescriptor.tokens.WBTC.address,
        underLyingValues[1][0],
        networkDescriptor.tokens.WETH.address,
      );

      expect(
        parseInt(hre.ethers.utils.formatUnits(WBTCValue[0].add(underLyingValues[1][1]), 'ether')) ===
          3.809207772005883305,
      );
    });

    it('returns rate for non-18 decimals underlying assets', async function () {
      const bptValue = await balancerV2PriceFeed.callStatic.getCurrentRate(
        networkDescriptor.tokens.WBTC.address,
        hre.ethers.utils.parseUnits('1', 8),
        networkDescriptor.tokens.WETH.address,
      );
      expect(parseInt(hre.ethers.utils.formatEther(bptValue[0]._hex)) === 14.20093745);
    });
  });

  // describe('calcPercentOfPool', async function () {
  //   before(async function () {
  //     balancerV2PriceFeedArgs = priceFeedDeployArgsFromNetworkDescriptor(networkDescriptor);

  //     balancerV2PriceFeed = (await balancerV2PriceFeedFactory.deploy(
  //       ...balancerV2PriceFeedArgs,
  //     )) as BalancerV2PriceFeed;

  //     await balancerV2PriceFeed.deployed();
  //   });

  //   it('returns correct percentage of pool', async function () {
  //     const decimals = 18;

  //     const poolTotal = ethers.BigNumber.from(4).mul(ethers.BigNumber.from(10).pow(decimals));
  //     const myTotal = ethers.BigNumber.from(1).mul(ethers.BigNumber.from(10).pow(decimals));

  //     const ratio = await balancerV2PriceFeed.calcPercentOfPool(myTotal, poolTotal);
  //     const expectedRatio = ethers.BigNumber.from('250000000000000000');

  //     console.log({ expectedRatio: expectedRatio.toString(), ratio: ratio.toString() });

  //     expect(ratio.eq(expectedRatio)).to.be.true;
  //   });
  // });
});
