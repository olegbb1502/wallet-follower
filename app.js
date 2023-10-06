const path = require('path');
const fs = require('fs');
const { ethers } = require('ethers');
const TelegramBot = require('node-telegram-bot-api');
// const { serialize } = require('v8')
const UniswapTrader = require('./uniswapTrader/v2/uniswapTrader');

const { 
    appendStorage,
    getStorage
} = require('./helpers/file');
const { 
    checkContractForWords,
    checkContractTransactions
} = require('./helpers/checkContract');

require('dotenv').config();

const {
    TELEGRAM_API,
    GROUP_ID,
    COUNTER_LIMIT,
    TIMEOUT_LIMIT_MINS
  } = process.env;

const storagePath = path.join(__dirname, 'tokens.txt');

const logFilePath = 'log.txt';
const logErrorFilePath = 'error.log.txt';

// Infura WebSocket endpoint for Ethereum mainnet
// const wsURL = `wss://mainnet.infura.io/ws/v3/${INFURA_KEY}`;
const wsURL = `wss://bold-solitary-putty.discover.quiknode.pro/f5cb7708aa3d067875945087ac9c9c9467f6cd73/`;

const provider = new ethers.providers.WebSocketProvider(wsURL);

const validEvents = [
    '0xfb3bdb41', // swapETHForExactTokens
    '0xb6f9de95', // swapExactETHForTokensSupportingFeeOnTransferTokens
    '0x0162e2d0',
    '0x7ff36ab5',
    '0x5ae401dc',
    '0x19948479',
    '0x3593564c',
    '0x5dd1acf4',
    // '0xc9567bf9', // openTrading
    // '0xf305d719', // addLiquidityETH
    // '0xe8078d94', // addLiquidity
    // '0xe8e33700', // addLiquidity
];

const exchangeAddressesList = fs.readFileSync('./exchangeAddresses.txt', 'utf8');
const exchangeAddresses = exchangeAddressesList.split('\n');

const abi = [
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "from",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "Transfer",
      "type": "event"
    }
];

// Create the ethers.js Interface using the contract ABI
// const contractInterface = new ethers.utils.Interface(abi);

function getCurrentTimestamp() {
    var tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
    var localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
    return localISOTime;
}

function writeToLogFile(message, type) {
    const timestamp = getCurrentTimestamp();
    const logEntry = `[${timestamp}] ${message}`;
    let file = logFilePath;
    switch (type) {
        case 'error': 
            file = logErrorFilePath; 
            break;
        default:
            break;
    }
    fs.appendFile(file, `${logEntry}\n`, (error) => {
      if (error) {
        console.error('Error writing to log file:', error);
      }
    });
}

const trader = new UniswapTrader();
const bot = new TelegramBot(TELEGRAM_API);

const walletsList = fs.readFileSync('./addresses.txt', 'utf8');
const validWallets = walletsList.split('\n');

// FOR TESTING
// provider.getTransaction('0xcdead78a06d4951b8333bf6119633e83fcccdcbe5dd81d06d2380d0f34dd4332')
//     .then(res => console.log(JSON.stringify(res)));

const tokenStorage = [];

provider.on("block", (blockNumber) => {
    const todayDate = new Date().toJSON().slice(0, 10);
    const todayAddressesPath = `./${todayDate}-addresses.txt`;
    if(!fs.existsSync(todayAddressesPath)) {
        fs.writeFileSync(todayAddressesPath, '', (err) => {
            console.error(err);
        });
    }
    const todayWalletsList = fs.readFileSync(todayAddressesPath, 'utf8');
    const todayWallets = todayWalletsList.split('\n');
    provider.getBlockWithTransactions(blockNumber).then(tx => {
        if (tx) {
            const blockTokens = [];
            let reviewCounter = 0;
            console.time(`Review for block #: ${blockNumber}`);
            const promises = tx.transactions.map(element => {
                const { data, from, hash, to } = element;
                if (data.includes('0xa9059cbb') && exchangeAddresses.indexOf(from) !== -1) {
                    checkContractTransactions(to)
                        .then(length => {
                            if (length <= 2) {
                                fs.appendFileSync(todayAddressesPath, to);
                            }
                        })
                }
                const isValid = validEvents.some(e => data.includes(e))
                    && (validWallets.some(w => w === from) || todayWallets.some(w => w === from));
                const event = data.slice(0, 9);
                const tokenAddress = data.substring(data.length - 40);
                const isChecked = blockTokens.indexOf(tokenAddress);
                if (isValid && isChecked === -1) {
                    try {
                        const storageUsedTokens = getStorage(storagePath, 'txt');
                        buyTokenHandler(hash, from, storageUsedTokens, event)
                        blockTokens.push(tokenAddress);
                        reviewCounter++;
                    } catch (err) {
                        console.log('Buy token Error: '+err);
                        // bot.sendMessage(GROUP_ID, `🪛 Buy token error: *${JSON.stringify(err)}*`, {parse_mode: 'MarkdownV2'});
                    }
                }
                return false;
            });
            Promise.all(promises);
            console.timeEnd(`Review for block #: ${blockNumber}`);
            const {heapTotal} = process.memoryUsage();
            console.log(`End review: ${reviewCounter} TX; Memory usage: ${(heapTotal / 1024 / 1024 * 100)/100} MB;`);
        }
    })
});

// function filterObjectsByAddress(array, targetAddress, type) {
//     if (type === 'csv') {
//         return array.filter((object) => object.address !== targetAddress);
//     } else {
//         return array.indexOf(targetAddress) === -1;
//     }
// }

const removeFromObj = (arr, filter) => {
    const index = arr.findIndex(object => {
        return object.address === filter;
    });

    arr.splice(index, 1);
}

const proccessToken = async address => {
    const findInStorage = tokenStorage.find(item => item.address === address);
    if (!findInStorage) {
        tokenStorage.push({
            address: address,
            counter: 1,
            time: Date.now()
        });
    } else {
        const {time, counter} = findInStorage;
        const timeDif = Math.floor((Date.now() - time) / 60 / 1000);
        if (timeDif < TIMEOUT_LIMIT_MINS || TIMEOUT_LIMIT_MINS === 0) {
            findInStorage.counter = counter + 1;
            console.log(`Address: ${address}. Time: ${timeDif}. Counter: ${findInStorage.counter}`);
            if (findInStorage.counter == COUNTER_LIMIT) {
                return true;
            }
        } else {
            writeToLogFile(`Skip token: ${address}: TIME LIMITS ${timeDif}mins. Counter: ${counter}`);
            removeFromObj(tokenStorage, address);
        }
    }
}

const report = async (address, from) => {
    const message = `📥 Buy token [${address}](https://dexscreener.com/ethereum/${address}) follow to ${from}`;
    await bot.sendMessage(GROUP_ID, message, {parse_mode: 'MarkdownV2'});
    writeToLogFile(message);
    removeFromObj(tokenStorage, address);
    await appendStorage(storagePath, address+'\n');
}

const buyTokenHandler = async (hash, from, buyedTokens) => {
    const { logs } = await provider.getTransactionReceipt(hash);
    if (logs.length > 0) {
        const { address } = logs.find(log => log.address.toLowerCase() !== '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2');
        // THIS CODE FOR FUTURE DON`T TUCH
        // const checkWords = await checkContractForWords(address, 'rebase');
        // THIS CODE FOR FUTURE DON`T TUCH
        if (buyedTokens.indexOf(address) === -1) {
            // THIS CODE FOR FUTURE DON`T TUCH
            // const  proccessTokenHandler  = await proccessToken(address);
            // console.log(proccessTokenHandler);
            // if (proccessTokenHandler) {
            //     await report(address);
            // }
            // THIS CODE FOR FUTURE DON`T TUCH

            await report(address, from);
            // WHEN START BUY UNCOMMENT THIS 213-216 AND COMMENT TOP LINE ↑
            // const buyTokenHandler = await trader.buyTokens(address);
            // if (buyTokenHandler?.status === 1) {
            //     await report(address);
            // }
        } else {
            const message = `${address} skip! ${buyedTokens.indexOf(address) !== -1 ? 'Was buyed.' : ''}. Follow to ${from}`;
            writeToLogFile(message);
        }
    }
}
