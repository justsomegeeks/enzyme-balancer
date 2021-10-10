import { AggregatedDerivativePriceFeed, IntegrationManager } from '@enzymefinance/protocol';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import type { DeployFunction } from 'hardhat-deploy/types';

import {
  getNetworkDescriptor,
  initializeEnvHelper,
  priceFeedDeployArgsFromNetworkDescriptor,
} from '../utils/env-helper';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {
    deployments: { deploy },
    getNamedAccounts,
  } = hre;

  const { deployer } = await getNamedAccounts();

  initializeEnvHelper(hre);

  const networkDescriptor = await getNetworkDescriptor(hre.ethers.getDefaultProvider());

  const enzymeCouncil = await hre.ethers.getSigner(networkDescriptor.contracts.enzyme.EnzymeCouncil);
  await hre.network.provider.send('hardhat_impersonateAccount', [enzymeCouncil.address]);

  const balancerV2PriceFeed = await deploy('BalancerV2PriceFeed', {
    args: priceFeedDeployArgsFromNetworkDescriptor(networkDescriptor),
    from: deployer,
    log: true,
  });

  // Register all Balancer V2 pool tokens with the derivative price feed.
  if (balancerV2PriceFeed.newlyDeployed) {
    const derivativePriceFeedInstance = new AggregatedDerivativePriceFeed(
      networkDescriptor.contracts.enzyme.AggregatedDerivativePriceFeed,
      enzymeCouncil,
    );

    const pools = [networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolAddress];

    await derivativePriceFeedInstance.addDerivatives(
      pools,
      pools.map(() => balancerV2PriceFeed.address),
    );

    console.log(`Registering BPT pool tokens...`);
    console.log(`  Balancer BPT WBTC/WETH pool: ${networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolAddress}`);

    console.log(
      'derivativePriceFeedInstance address: ',
      await derivativePriceFeedInstance.getPriceFeedForDerivative(
        networkDescriptor.contracts.balancer.BalancerV2WBTCWETHPoolAddress,
      ),
    );
  }

  const balancerV2Adapter = await deploy('BalancerV2Adapter', {
    args: [
      networkDescriptor.contracts.enzyme.IntegrationManager,
      networkDescriptor.contracts.balancer.BalancerV2Vault,
      balancerV2PriceFeed.address,
    ],
    from: deployer,
    log: true,
  });

  const integrationManager = new IntegrationManager(
    networkDescriptor.contracts.enzyme.IntegrationManager,
    enzymeCouncil,
  );

  await integrationManager.registerAdapters([balancerV2Adapter.address]);
};

export default func;
func.tags = ['BalancerV2Adapter'];
