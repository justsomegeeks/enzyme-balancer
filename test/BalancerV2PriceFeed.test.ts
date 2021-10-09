import { AggregatedDerivativePriceFeed } from '@enzymefinance/protocol';
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

  before(async function () {
    initializeEnvHelper(hre);

    provider = hre.ethers.getDefaultProvider();

    networkDescriptor = await getNetworkDescriptor(provider);
    balancerV2PriceFeedArgs = priceFeedDeployArgsFromNetworkDescriptor(networkDescriptor);

    balancerV2PriceFeedFactory = await hre.ethers.getContractFactory('BalancerV2PriceFeed');

    enzymeCouncil = await hre.ethers.getSigner(networkDescriptor.contracts.enzyme.EnzymeCouncil);
    await hre.network.provider.send('hardhat_impersonateAccount', [enzymeCouncil.address]);
  });

  describe('constructor', function () {
    it('deploys correctly', async function () {
      balancerV2PriceFeedArgs = priceFeedDeployArgsFromNetworkDescriptor(networkDescriptor);

      balancerV2PriceFeed = (await balancerV2PriceFeedFactory.deploy(
        ...balancerV2PriceFeedArgs,
      )) as BalancerV2PriceFeed;

      await balancerV2PriceFeed.deployed();

      const derivativePriceFeedInstance = new AggregatedDerivativePriceFeed(
        networkDescriptor.contracts.enzyme.AggregatedDerivativePriceFeed,
        enzymeCouncil,
      );

      expect((await balancerV2PriceFeed.getVault()).toLowerCase()).to.equal(
        networkDescriptor.contracts.balancer.BalancerV2Vault.toLowerCase(),
      );

      const pools = [networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolAddress];

      await derivativePriceFeedInstance.addDerivatives(
        pools,
        pools.map(() => balancerV2PriceFeed.address),
      );

      console.log(`Registering BPT pool tokens...`);
      console.log(
        `  Balancer BPT WBTC/WETH pool: ${networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolAddress}`,
      );

      console.log(
        'derivativePriceFeedInstance address: ',
        await derivativePriceFeedInstance.getPriceFeedForDerivative(
          networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolAddress,
        ),
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

      const balancerV2WBTCWETHPoolId = balancerV2PriceFeedArgs[5][0];
      const poolDescriptor = await balancerV2PriceFeed.getPoolDescriptor(
        networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolAddress,
      );

      expect(poolDescriptor.poolId).to.equal(balancerV2WBTCWETHPoolId);

      expect(poolDescriptor.poolTokenDescriptor.token0.toLowerCase()).to.equal(
        networkDescriptor.tokens.WBTC.address.toLowerCase(),
      );

      expect(poolDescriptor.poolTokenDescriptor.token0Decimals).to.equal(networkDescriptor.tokens.WBTC.decimals);

      expect(poolDescriptor.poolTokenDescriptor.token1.toLowerCase()).to.equal(
        networkDescriptor.tokens.WETH.address.toLowerCase(),
      );

      expect(poolDescriptor.poolTokenDescriptor.token1Decimals).to.equal(networkDescriptor.tokens.WETH.decimals);
    });
  });

  describe('calcUnderlyingValues', function () {
    before(async function () {
      initializeEnvHelper(hre);

      provider = hre.ethers.getDefaultProvider();

      networkDescriptor = await getNetworkDescriptor(provider);
      balancerV2PriceFeedArgs = priceFeedDeployArgsFromNetworkDescriptor(networkDescriptor);

      balancerV2PriceFeedFactory = await hre.ethers.getContractFactory('BalancerV2PriceFeed');

      enzymeCouncil = await hre.ethers.getSigner(networkDescriptor.contracts.enzyme.EnzymeCouncil);
      await hre.network.provider.send('hardhat_impersonateAccount', [enzymeCouncil.address]);
      balancerV2PriceFeedArgs = priceFeedDeployArgsFromNetworkDescriptor(networkDescriptor);
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
      underLyingValues.forEach((el, i) => console.log(`at index ${i}: ${el}`));
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
        // '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        networkDescriptor.tokens.WETH.address,
      );
      console.log(
        'value of one BPT in WETH',
        hre.ethers.utils.formatUnits(WBTCValue[0].add(underLyingValues[1][1]), 'ether'),
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
      console.log(hre.ethers.utils.formatUnits(bptValue[0]._hex, 'ether'));
      expect(parseInt(hre.ethers.utils.formatEther(bptValue[0]._hex)) > 0);
    });
  });
});
