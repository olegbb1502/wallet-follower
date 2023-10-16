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
    checkTokenTransactions,
    checkContractSecurity
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

// const abi = [
//     {
//       "anonymous": false,
//       "inputs": [
//         {
//           "indexed": true,
//           "internalType": "address",
//           "name": "from",
//           "type": "address"
//         },
//         {
//           "indexed": true,
//           "internalType": "address",
//           "name": "to",
//           "type": "address"
//         },
//         {
//           "indexed": false,
//           "internalType": "uint256",
//           "name": "value",
//           "type": "uint256"
//         }
//       ],
//       "name": "Transfer",
//       "type": "event"
      
//     },
//     {
//         "inputs": [
//             {
//                 "internalType": "address",
//                 "name": "token",
//                 "type": "address"
//             },
//             {
//                 "internalType": "uint256",
//                 "name": "amountTokenDesired",
//                 "type": "uint256"
//             },
//             {
//                 "internalType": "uint256",
//                 "name": "amountTokenMin",
//                 "type": "uint256"
//             },
//             {
//                 "internalType": "uint256",
//                 "name": "amountETHMin",
//                 "type": "uint256"
//             },
//             {
//                 "internalType": "address",
//                 "name": "to",
//                 "type": "address"
//             },
//             {
//                 "internalType": "uint256",
//                 "name": "deadline",
//                 "type": "uint256"
//             }
//         ],
//         "name": "addLiquidityETH",
//         "outputs": [],
//         "stateMutability": "payable",
//         "type": "function"
//     },
//     // {
//     //     "inputs": [
//     //         {
//     //             "internalType": "address",
//     //             "name": "tokenA",
//     //             "type": "address"
//     //         },
//     //         {
//     //             "internalType": "address",
//     //             "name": "tokenB",
//     //             "type": "address"
//     //         },
//     //         {
//     //             "internalType": "uint256",
//     //             "name": "amountADesired",
//     //             "type": "uint256"
//     //         },
//     //         {
//     //             "internalType": "uint256",
//     //             "name": "amountBDesired",
//     //             "type": "uint256"
//     //         },
//     //         {
//     //             "internalType": "uint256",
//     //             "name": "amountAMin",
//     //             "type": "uint256"
//     //         },
//     //         {
//     //             "internalType": "uint256",
//     //             "name": "amountBMin",
//     //             "type": "uint256"
//     //         },
//     //         {
//     //             "internalType": "address",
//     //             "name": "to",
//     //             "type": "address"
//     //         },
//     //         {
//     //             "internalType": "uint256",
//     //             "name": "deadline",
//     //             "type": "uint256"
//     //         }
//     //     ],
//     //     "name": "addLiquidity",
//     //     "outputs": [],
//     //     "stateMutability": "payable",
//     //     "type": "function"
//     // },
//     // {
//     //     "inputs": [],
//     //     "name": "addLiquidity",
//     //     "outputs": [],
//     //     "stateMutability": "payable",
//     //     "type": "function"
//     // },
//     // {
//     //     "inputs": [],
//     //     "name": "openTrading",
//     //     "outputs": [],
//     //     "stateMutability": "nonpayable",
//     //     "type": "function"
//     // },
// ];


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

// FOR TESTING
// provider.getTransaction('0xcdead78a06d4951b8333bf6119633e83fcccdcbe5dd81d06d2380d0f34dd4332')
//     .then(res => console.log(JSON.stringify(res)));

const tokenStorage = [];

provider.on("block", async (blockNumber) => {
    const walletsList = fs.readFileSync('./addresses.txt', 'utf8');
    const validWallets = walletsList.split('\n').map(wallet => wallet.split('\t')[1]);
    await provider.getBlockWithTransactions(blockNumber).then(async (tx) => {
        if (tx) {
            const blockTokens = [];
            let reviewCounter = 0;
            console.time(`Review for block #: ${blockNumber}`);
            const promises = tx.transactions.map(async (element) => {
                const { data, from, hash} = element;
                // const txValue = ethers.BigNumber.from(value);
                // if (data === '0x' && parseFloat(txValue.toString()) > 0.01 && exchangeAddresses.indexOf(from) !== -1) {//a9059cbb
                //     //console.log(data)
                //     checkContractTransactions(to)
                //         .then(length => {
                //             if (length <= 1) {
                //                  fs.appendFileSync(todayAddressesPath, to+'\n')
                //                 //  console.log(to, length, parseFloat(txValue.toString()));
                //             }
                //         })
                // }
                const isValid = validEvents.some(e => data.includes(e))
                    && validWallets.some(w => w === from);
                const event = data.slice(0, 9);
                const tokenAddress = data.substring(data.length - 40);
                const isChecked = blockTokens.indexOf(tokenAddress);
                // const sniperIsValid = sniperValidEvents.some(e => data.includes(e));
                if (isValid && isChecked === -1) {
                    try {
                        const storageUsedTokens = getStorage(storagePath, 'txt');
                        const handler = await buyTokenHandler(hash, from, storageUsedTokens, event);
                        if (handler) {
                            blockTokens.push(tokenAddress);
                            reviewCounter++;
                        }
                        return handler;
                    } catch (err) {
                        console.log('Buy token Error: '+err);
                        // bot.sendMessage(GROUP_ID, `🪛 Buy token error: *${JSON.stringify(err)}*`, {parse_mode: 'MarkdownV2'});
                    }
                // if (sniperIsValid) {
                //     try {
                //         const storageUsedTokens = getStorage(storagePath, 'txt');
                //         buyTokenSniperHandler(hash, from, storageUsedTokens, event, element)
                //         blockTokens.push(tokenAddress);
                //         reviewCounter++;
                //     } catch (err) {
                //         console.log('Buy token Error: '+err);
                //         // bot.sendMessage(GROUP_ID, `🪛 Buy token error: *${JSON.stringify(err)}*`, {parse_mode: 'MarkdownV2'});
                //     }
                // }
                }
                return false;
            });
            await new Promise(resolve => setTimeout(resolve, 3*60*1000));
            await Promise.all(promises);
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
    console.log('start buyTokenHandler', logs.length);
    if (logs.length > 0) {
        const { address } = logs.find(log => log.address.toLowerCase() !== '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2');
        const length = await checkTokenTransactions(address);
        console.log('step 1 buyTokenHandler', address, length);
        // THIS CODE FOR FUTURE DON`T TUCH
        // const checkWords = await checkContractForWords(address, 'rebase');
        // THIS CODE FOR FUTURE DON`T TUCH
        if (buyedTokens.indexOf(address) === -1 && length <= 100) {
            // await new Promise(resolve => setTimeout(resolve, 3 * 60 * 1000));
            const isdeadAddress = await checkContractSecurity(address);
            const checkContractEventRemoveLiquidityETH = await checkContractForWords(address, 'removeliquidity');
            console.log('step 2 buyTokenHandler', checkContractEventRemoveLiquidityETH, isdeadAddress, address);
            // process.exit(0);
            if (isdeadAddress && !checkContractEventRemoveLiquidityETH) {
                // THIS CODE FOR FUTURE DON`T TUCH
                // const  proccessTokenHandler  = await proccessToken(address);
                // console.log(address, length1);
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
            }
            if (!isdeadAddress) {
                console.log('isdeadAddress', isdeadAddress);
                const message = `${address} skip! Найобщики ліквідності. Follow to ${from}`;
                writeToLogFile(message);
            }
        } else if (length > 100) {
            console.log('length', length);
            const message = `${address} skip! Стара хуйня. Follow to ${from}`;
            writeToLogFile(message);
        } else {
            const message = `${address} skip! ${buyedTokens.indexOf(address) !== -1 ? 'Куплений уже.' : ''}. Follow to ${from}`;
            writeToLogFile(message);
        }
    }
}
// const buyTokenSniperHandler = async (transaction) => {
//     const txData = contractInterface.parseTransaction({ data: transaction.data });
//     // let amountEth = 0;
//     // const amountETHMin = txData?.args.amountETHMin;

//     // if (amountETHMin) 
//     //     amountEth = ethers.utils.formatUnits(amountETHMin, 18);

//     const token = txData.args[0] || transaction.to;

//     if (token) {
//         let checkTxLength = await checkTokenTransactions(token, 20);
//         const tokensStorage = await getStorage(storagePath, 'txt');
//         const isValidToken = filterObjectsByAddress(tokensStorage, token);
//         const isdeadAddress = await checkContractSecurity(token);
//         if (isValidToken && checkTxLength.valid ){ //&& (amountEth > 0.9 ) || amountEth === 0) //
            
//             // const checkFirstEvent = await checkContractFirstEvents(token, 'addLiquidityETH(address,uint256,uint256,uint256,address,uint256)');
            
//             //const checkContractPartSolidity = await checkContractForWords(token, 'rebase');
//             await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
//             // const checkContractEventRemoveLiquidityETH = await checkContractForWords(token, 'removeliquidity');
//             // const checkContractForAddressesHandler = await checkContractForAddresses(token);
//             // const checkContractTxnsPercentHandler = await checkContractTxnsPercent(token);
//             // checkTxLength = await checkContractTransactions(token, 0, true);
//             // const { validationPercent, rules } = await checkContractSecurity(token);
//             // const contractABI = await checkContractABI(token, 'maxWalletSize,taxSwapThreshold,manual,MaxTxAmount');
            
//             // If security works fine coment rows 185-188 and uncomment 191-201
//             console.log(`Review ${token}. View log.txt file`);
//             if (
//                 // checkTxLength.valid
//                 isdeadAddress 
//                 //  && validationPercent > 0 
//                 // && checkContractForAddressesHandler
//                 // && checkContractTxnsPercentHandler < 50
//                 // && !checkContractEventRemoveLiquidityETH 
//                // && checkContractPartSolidity
//                 // && contractABI > 0.44
//             ) {
//                 const message = `SNIPER.You can buy token [${token}](https://etherscan.io/token/${token})`; 
//                 console.log(message);
//                 await bot.sendMessage(GROUP_ID, `📥 SNIPER Buy token [${token}](https://dexscreener.com/ethereum/${token})`, {parse_mode: 'MarkdownV2'});
//                 writeToLogFile(message+'\n');
//                // Uncomment for BUY TOKENS
//             //     const buyToken = await trader.buyTokens(token);
//             //     if (buyToken?.status === 1) {
//             //         const currentDate = new Date();
//             //         const timestamp = currentDate.getTime();
//             //         const buyTokenData = `\n${timestamp},${token},${buyToken.value},false`;
//             //         await bot.sendMessage(GROUP_ID, `📥 Buy token [${token}](https://etherscan.io/token/${token})`, {parse_mode: 'MarkdownV2'});
//             //     }
//             //     await appendStorage(storagePath, token);
//             } else {
//                 const message = `Skip token: ${token}`;
//                 writeToLogFile(message);
//                 // await bot.sendMessage(GROUP_ID, `Token is BAD. Skip them [${token}](https://etherscan.io/token/${token})`, {parse_mode: 'MarkdownV2'});
//             }
//         } else {
//             writeToLogFile(`Skip token: ${token}:\nTx lenght: ${checkTxLength.length}`);
//         }
//     }
// }
