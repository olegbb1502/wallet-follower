const { ethers } = require('ethers')
// Uniswap
const { abi: UniswapV2Pair } = require('@uniswap/v2-core/build/IUniswapV2Pair.json')
const { abi: UniswapV2Factory } = require('@uniswap/v2-core/build/UniswapV2Factory.json')
const { abi: SwapRouterABI} = require('@uniswap/v2-periphery/build/UniswapV2Router02.json')
// helpers
const { getTokenBalance, getTokenDecimals } = require('./helpers')
// ERC20 ETH ABI settings
const ERC20ABI = require('../../abi.json')
const { abi: wethAbi } = require('../../weth.json')

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

require('dotenv').config()

const filteredTokens = [
  '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  '0x4fabb145d64652a948d72533023f6e7a623c7c53',
  '0x0000000000085d4780B73119b644AE5ecd22b376',
  '0x8e870d67f660d95d5be530380d0ec0bd388289e1',
  '0x0c10bf8fcb7bf5412187a595ab97a3609160b5c6',
  '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
  '0x8e870d67f660d95d5be530380d0ec0bd388289e1',
  '0x6b175474e89094c44da98b954eedeac495271d0f',
  '0x70997970c51812dc3a010c7d01b50e0d17dc79c8'
];

class UniswapTrader {
  constructor() {
    const {
      TEST_RPC_URL,
      WALLET_ADDRESS,
      WALLET_SECRET,
      UNISWAP_SWAP_ROUTER_ADDRESS_V2: UNISWAP_SWAP_ROUTER_ADDRESS,
      UNISWAP_FACTORY_ADDRESS,
      INFURA_KEY
    } = process.env;

    this.WALLET_ADDRESS = WALLET_ADDRESS;
    this.WALLET_SECRET = WALLET_SECRET;

    this.provider = new ethers.providers.JsonRpcProvider(TEST_RPC_URL || `https://mainnet.infura.io/v3/${INFURA_KEY}`);
    this.UNISWAP_SWAP_ROUTER_ADDRESS = UNISWAP_SWAP_ROUTER_ADDRESS;
    this.UNISWAP_FACTORY_ADDRESS = UNISWAP_FACTORY_ADDRESS;

    // Methods
    this.getPoolAddress = this.getPoolAddress.bind(this);
    this.buyTokens = this.buyTokens.bind(this);
    this.soldTokens = this.soldTokens.bind(this);
  }

  async getPoolAddress() {
    const factoryContract = new ethers.Contract(
      this.UNISWAP_FACTORY_ADDRESS,
      UniswapV2Factory,
      this.provider
    );
    const pairAddress = await factoryContract.getPair(this.address0, this.address1);
    if (pairAddress === '0x0000000000000000000000000000000000000000') return 405;
    const poolContract = new ethers.Contract(
        pairAddress,
        UniswapV2Pair,
        this.provider
    );
    return poolContract;
  }

  async buyTokens(address) {
    const provider = this.provider;

    const wallet = new ethers.Wallet(this.WALLET_SECRET);
    const connectedWallet = wallet.connect(provider);

    let tokenOutBalance = 0.02;
    let tokenOutDecimals = 18;
    let tokenInDecimals = 18;

    let wethContract = null;

    const balance = await connectedWallet.getBalance();
    tokenOutBalance = ethers.utils.formatEther(balance);
    wethContract = new ethers.Contract(
      WETH,
      wethAbi,
      provider
    );
    const tokenContract = new ethers.Contract(
        address.toLowerCase(),
        ERC20ABI,
        provider
    );
    
    tokenInDecimals = await getTokenDecimals(tokenContract);
    // if (tokenOutBalance <= 0.01) return {status: 404};
    
    const swapRouterContract = new ethers.Contract(
        this.UNISWAP_SWAP_ROUTER_ADDRESS,
        SwapRouterABI,
        provider
    );

    const approvalResponse = await wethContract.connect(connectedWallet).approve(
      this.UNISWAP_SWAP_ROUTER_ADDRESS,
      ethers.utils.parseUnits(tokenOutBalance.toString(), tokenOutDecimals)
    );
    await approvalResponse.wait();
    try {
      const swap = await swapRouterContract.connect(connectedWallet).swapExactETHForTokens(
        ethers.utils.parseUnits('10', tokenInDecimals),
        [WETH, address],
        connectedWallet.address,
        Math.floor(Date.now() / 1000) + (60 * 10),
        // change 0.01 ETH for your PRICE
        { value: ethers.utils.parseUnits('0.01', tokenOutDecimals), gasLimit: 500000  }
      );
      const wait = await swap.wait();
      return {
          status: wait.status,
          value: parseFloat(swap.value)
      };
    } catch (e) {
      return e;
    }
  }

  async soldTokens(token) {
    const provider = this.provider;

    const wallet = new ethers.Wallet(this.WALLET_SECRET);
    const connectedWallet = wallet.connect(provider);

    let tokenOutBalance = 0.02;
    let tokenOutDecimals = 18;

    const tokenContract0 = new ethers.Contract(
      token,
      ERC20ABI,
      provider
    );
    tokenOutBalance = await getTokenBalance(tokenContract0, connectedWallet);
    tokenOutDecimals = await getTokenDecimals(tokenContract0);
    // if (tokenOutBalance <= 0.01) return {status: 404};
    
    const swapRouterContract = new ethers.Contract(
        this.UNISWAP_SWAP_ROUTER_ADDRESS,
        SwapRouterABI,
        provider
    );

    const approvalResponse = await tokenContract0.connect(connectedWallet).approve(
      this.UNISWAP_SWAP_ROUTER_ADDRESS,
      ethers.utils.parseUnits(tokenOutBalance.toString(), tokenOutDecimals)
    );
    await approvalResponse.wait();
    try {
      const swap = await swapRouterContract.connect(connectedWallet).swapExactTokensForETHSupportingFeeOnTransferTokens(
        ethers.utils.parseUnits((tokenOutBalance-(tokenOutBalance*0.9)).toString(), tokenOutDecimals),
        0,
        [token, WETH],
        connectedWallet.address,
        Math.floor(Date.now() / 1000) + (60 * 10),
        { gasLimit: 500000 }
    )
      const wait = await swap.wait();
      return {
          status: wait.status
      };
    } catch (e) {
      return e;
    }
  }
}

module.exports = UniswapTrader;