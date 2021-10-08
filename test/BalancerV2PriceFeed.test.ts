import type { BaseProvider } from '@ethersproject/providers';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import type { ContractFactory } from 'ethers';
import hre, { ethers } from 'hardhat';

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
  it('should deploy correctly', async function () {
    balancerV2PriceFeedArgs = priceFeedDeployArgsFromNetworkDescriptor(networkDescriptor);
    balancerV2PriceFeed = (await balancerV2PriceFeedFactory.deploy(...balancerV2PriceFeedArgs)) as BalancerV2PriceFeed;
    await balancerV2PriceFeed.deployed();

    //TODO: Balancerify the uniswapV2PriceFeed test code below
    const PriceFeedVault = await balancerV2PriceFeed.getBalancerV2Vault();

    expect(ethers.utils.getAddress(PriceFeedVault)).to.equal(
      ethers.utils.getAddress(networkDescriptor.contracts.balancer.BalancerV2Vault),
      'incorect Vault Address',
    );
    const derivativeAddress = await balancerV2PriceFeed.getDerivativePriceFeed();
    expect(ethers.utils.getAddress(derivativeAddress)).to.equal(
      ethers.utils.getAddress(networkDescriptor.contracts.enzyme.DerivativePriceFeedAddress),
      'incorrect Derivative',
    );
    const primativeAddress = await balancerV2PriceFeed.getPrimitivePriceFeed();
    expect(ethers.utils.getAddress(primativeAddress)).to.equal(
      ethers.utils.getAddress(networkDescriptor.contracts.enzyme.PrimitivePriceFeedAddress),
      'incorrect Primitive',
    );
    const valueIntAddress = await balancerV2PriceFeed.getValueInterpreter();
    expect(ethers.utils.getAddress(valueIntAddress)).to.equal(
      ethers.utils.getAddress(networkDescriptor.contracts.enzyme.ValueInterpreter),
    );

    // const poolContract = new IBalancerV2Pool(
    //   networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolAddress,
    //   provider,
    // );
    // const BalancerV2Vault = new IBalancerV2Vault(
    //   networkDescriptor.contracts.balancer.BalancerV2Vault,
    //   provider,
    // );
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
    });

    it('returns rate for 18 decimals underlying assets', async function () {
      let underlyings,
        underlyingAmounts = await balancerV2PriceFeed.calcUnderlyingValues(
          networkDescriptor.contracts.balancer.BalancerV2PoolAddress,
          1000,
        );
      console.log(underlyings, underlyingAmounts);
    });

    // xit('returns rate for non-18 decimals underlying assets', function () {
    //   return;
    // });
  });

  describe('addPoolTokens', function () {
    xit('does not allow a random caller', function () {
      return;
    });

    xit('does not allow an empty _poolTokens param', function () {
      return;
    });

    xit('does not allow an already-set poolToken', function () {
      return;
    });

    xit('does not allow unsupportable pool tokens', function () {
      return;
    });

    xit('adds pool tokens and emits an event per added pool token', function () {
      return;
    });
  });
});
