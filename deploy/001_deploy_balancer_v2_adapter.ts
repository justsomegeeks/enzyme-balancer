import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import type { DeployFunction } from 'hardhat-deploy/types';

import { getNetworkDescriptor, initializeEnvHelper } from '../utils/env-helper';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {
    deployments: { deploy },
    getNamedAccounts,
  } = hre;
  const { deployer } = await getNamedAccounts();

  initializeEnvHelper(hre);

  const networkDescriptor = await getNetworkDescriptor(hre.ethers.getDefaultProvider());

  const balancerV2PriceFeed = await deploy('BalancerV2PriceFeed', {
    args: [networkDescriptor.contracts.BalancerV2WBTCWETHVault],
    from: deployer,
    log: true,
  });

  await deploy('BalancerV2Adapter', {
    args: [
      networkDescriptor.contracts.IntegrationManager,
      networkDescriptor.contracts.BalancerV2WBTCWETHVault,
      balancerV2PriceFeed.address,
    ],
    from: deployer,
    log: true,
  });
};

export default func;
func.tags = ['BalancerV2Adapter'];
