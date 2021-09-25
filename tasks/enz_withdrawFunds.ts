import { task } from 'hardhat/config';

const addresses = {
  assetManager: '0xf5be8b4c82b8a681bacf357cfb712ab9e9296cb2',
  contracts: {
    comptroller: '0x6d38a84ecde417b189ed317420c04fdd0cc4fb5d',
    deployer: '0x7e6d3b1161df9c9c7527f68d651b297d2fdb820b',
    vault: '0x86fb84e92c1eedc245987d28a42e123202bd6701',
  },
  eoas: {
    investor: '0xea09bdeb7d0ce27c39e73251fccdb0a081fece05',
  },
  erc20s: {
    curveErc20addr: '0xd533a949740bb3306d119cc777fa900ba034cd52',
  },
};

task('enz_withdrawFunds', 'Withdraw Enzyme funds', async (args, hre) => {
  const [, whale] = await hre.ethers.getSigners();

  console.log('transfering eth to the investor');
  await whale.sendTransaction({ to: addresses.eoas.investor, value: hre.ethers.utils.parseEther('2.0') });

  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [addresses.eoas.investor],
  });

  const signer = await hre.ethers.getSigner(addresses.eoas.investor);

  const comptrollerABI = ['function redeemShares() external returns (address[],uint256[])'];
  const ierc20abi = ['function balanceOf(address) external view returns (uint256)'];

  const curveToken = await hre.ethers.getContractAt(ierc20abi, addresses.erc20s.curveErc20addr);
  const comptrollerContract = await hre.ethers.getContractAt(comptrollerABI, addresses.contracts.comptroller, signer);

  console.log('Curve Balance before redeeming');

  const balanceBefore = await curveToken.balanceOf(signer.address);

  console.log(hre.ethers.utils.formatEther(balanceBefore));

  const tx = await comptrollerContract.redeemShares();

  console.log('Waiting for tx to mine....');

  await tx.wait();

  console.log('Curve Balance after redeeming');

  const balanceAfter = await curveToken.balanceOf(signer.address);

  console.log(hre.ethers.utils.formatEther(balanceAfter));
});
