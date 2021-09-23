import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import type { DeployFunction } from 'hardhat-deploy/types';

const addresses = {
  BalancerV2Vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
  IntegrationManager: '0x965ca477106476B4600562a2eBe13536581883A6',
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {
    deployments: { deploy },
    getNamedAccounts,
  } = hre;
  const { deployer } = await getNamedAccounts();

  await deploy('BalancerV2Adapter', {
    args: [addresses.IntegrationManager, addresses.BalancerV2Vault],
    from: deployer,
    log: true,
  });
};

export default func;
func.tags = ['BalancerV2Adapter'];
