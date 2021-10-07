import type { BaseProvider } from '@ethersproject/providers';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import type { ContractFactory } from 'ethers';
import hre from 'hardhat';
import { expect } from 'chai';
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
    xit('sets state vars', async function () {
      provider = hre.ethers.getDefaultProvider();

      networkDescriptor = await getNetworkDescriptor(provider);

      balancerV2PriceFeedFactory = await hre.ethers.getContractFactory('BalancerV2PriceFeed');

      balancerV2PriceFeedArgs = priceFeedDeployArgsFromNetworkDescriptor(networkDescriptor);
      balancerV2PriceFeed = (await balancerV2PriceFeedFactory.deploy(
        ...balancerV2PriceFeedArgs,
      )) as BalancerV2PriceFeed;
      await balancerV2PriceFeed.deployed();

      //TODO: Balancerify the uniswapV2PriceFeed test code below
      describe('constructor', function () {
        it('deploys correctly', async function () {
          await integrationManager.registerAdapters([balancerV2Adapter.address]);

          expect(await balancerV2PriceFeed.getFactory()).to.equal(
            networkDescriptor.contracts.enzyme.AggregatedDerivativePriceFeed,
          );
          expect(await balancerV2PriceFeed.getDerivativePriceFeed()).toMatchAddress(aggregatedDerivativePriceFeed);
          expect(await balancerV2PriceFeed.getPrimitivePriceFeed()).toMatchAddress(chainlinkPriceFeed);
          expect(await balancerV2PriceFeed.getValueInterpreter()).toMatchAddress(valueInterpreter);
        });

        const poolContract = new IBalancerV2Pool(
          networkDescriptor.mainnet.contracts.balancer.BalancerV2WBTCWETHPoolAddress,
          provider,
        );
        const BalancerV2Vault = new IBalancerV2Vault(
          networkDescriptor.mainnet.contracts.balancer.BalancerV2Vault,
          provider,
        );
        const token0 = await pairContract.token0();
        const token1 = await pairContract.token1();
        expect(await uniswapV2PoolPriceFeed.getPoolTokenInfo(poolToken)).toMatchFunctionOutput(
          uniswapV2PoolPriceFeed.getPoolTokenInfo,
          {
            token0,
            token1,
            token0Decimals: await new StandardToken(token0, provider).decimals(),
            token1Decimals: await new StandardToken(token1, provider).decimals(),
          },
        );
      });
    });
  });

  describe('calcUnderlyingValues', function () {
    xit('returns rate for 18 decimals underlying assets', function () {
      return;
    });

    xit('returns rate for non-18 decimals underlying assets', function () {
      return;
    });
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
