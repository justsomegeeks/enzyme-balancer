import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import type { DeployFunction } from 'hardhat-deploy/types';

const addresses = {
  BalancerV2Swapper: '0x1bD435F3C054b6e901B7b108a0ab7617C808677b',
  IntegrationManager: '0x965ca477106476B4600562a2eBe13536581883A6',
  TokenTransferProxy: '0xb70Bc06D2c9Bf03b3373799606dc7d39346c06B3',
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {
    deployments: { deploy },
    getNamedAccounts,
  } = hre;
  const { deployer } = await getNamedAccounts();

  await deploy('BalancerV2Adapter', {
    args: [addresses.IntegrationManager, addresses.BalancerV2Swapper, addresses.TokenTransferProxy],
    from: deployer,
    log: true,
  });
};

export default func;
func.tags = ['BalancerV2Adapter'];
