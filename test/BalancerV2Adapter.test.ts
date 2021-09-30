import { before } from 'mocha';

// import { ADDRESSES, balancerV2TakeOrderArgs, getNetworkERC20s, getSwap, Networks } from '../utils/sor-helper';

describe('BalancerV2Adapter', async function () {
  // let enzymeCouncil: SignerWithAddress;
  // let integrationManager: IntegrationManager;

  // let balancerV2AdapterFactory: ContractFactory;

  before(async function () {
    // enzymeCouncil = await hre.ethers.getSigner(ADDRESSES.contracts.EnzymeCouncil);
    // await hre.network.provider.send('hardhat_impersonateAccount', [enzymeCouncil.address]);
    // balancerV2AdapterFactory = await hre.ethers.getContractFactory('BalancerV2Adapter');
    // integrationManager = new IntegrationManager(ADDRESSES.contracts.IntegrationManager, enzymeCouncil);
  });

  describe('constructor', async function () {
    // it('deploys correctly', async function () {
    //   const balancerV2Adapter = await balancerV2AdapterFactory.deploy(
    //     ADDRESSES.contracts.IntegrationManager,
    //     ADDRESSES.contracts.BalancerV2Vault,
    //   );
    //   await integrationManager.registerAdapters([balancerV2Adapter.address]);
    //   // Check that the initial values are set in the constructor.
    //   expect(await balancerV2Adapter.getIntegrationManager()).to.equal(ADDRESSES.contracts.IntegrationManager);
    //   expect(await balancerV2Adapter.getBalancerV2Vault()).to.equal(ADDRESSES.contracts.BalancerV2Vault);
    //   // Check that the adapter is registered on the integration manager.
    //   expect(await integrationManager.getRegisteredAdapters()).to.include(balancerV2Adapter.address);
    // });
  });

  describe('takeOrder', async function () {
    // let balancerV2Adapter: Contract;
    // let provider: BaseProvider;
    // let usdcWhale: SignerWithAddress;

    before(async function () {
      // balancerV2Adapter = await balancerV2AdapterFactory.deploy(
      //   ADDRESSES.contracts.IntegrationManager,
      //   ADDRESSES.contracts.BalancerV2Vault,
      // );
      // provider = hre.ethers.getDefaultProvider();
      // await integrationManager.registerAdapters([balancerV2Adapter.address]);
      // usdcWhale = await hre.ethers.getSigner(ADDRESSES.whales.usdc);
      // await hre.network.provider.send('hardhat_impersonateAccount', [usdcWhale.address]);
    });

    it('can only be called via the IntegrationManager', async function () {
      //   const chainId = (await provider.getNetwork()).chainId;
      //   const networkInfo: Networks | undefined = Networks[Networks[chainId] as keyof typeof Networks];
      //   if (typeof networkInfo === 'undefined') {
      //     throw `Invalid chain id: ${chainId}`;
      //   }
      //   const networkERC20s = getNetworkERC20s();
      //   const queryOnChain = true;
      //   const swapType = SwapTypes.SwapExactIn;
      //   const tokenIn = networkERC20s[networkInfo]['ETH'];
      //   const tokenOut = networkERC20s[networkInfo]['USDC'];
      //   const swapAmount = new BigNumber(1);
      //   const outgoingAsset = new StandardToken(ADDRESSES.erc20s.usdc.address, usdcWhale);
      //   const incomingAsset = new StandardToken(ADDRESSES.erc20s.comp.address, provider);
      //   const [swapInfo, cost] = getSwap(provider, networkInfo, queryOnChain, swapType, tokenIn, tokenOut, swapAmount);
      //   const takeOrderArgs = balancerV2TakeOrderArgs({});
      //   const transferArgs = await assetTransferArgs({
      //     adapter: balancerV2Adapter.getInterface(),
      //     encodedCallArgs: takeOrderArgs,
      //     selector: takeOrderSelector,
      //   });
      //   await expect(
      //     balancerV2Adapter.takeOrder(balancerV2Adapter.address, takeOrderSelector, transferArgs),
      //   ).to.be.revertedWith('Only the IntegrationManager can call this function');
    });
  });
});
