const fs = require('fs');
const { ethers } = require('ethers');
const {
    checkContractTransactions,
} = require('./helpers/checkContract');

// Infura WebSocket endpoint for Ethereum mainnet
// const wsURL = `wss://mainnet.infura.io/ws/v3/${INFURA_KEY}`;
const wsURL = `wss://bold-solitary-putty.discover.quiknode.pro/f5cb7708aa3d067875945087ac9c9c9467f6cd73/`;

const provider = new ethers.providers.WebSocketProvider(wsURL);

const todayAddressesPath = `./addresses.txt`;

const exchangeAddressesList = fs.readFileSync('./exchangeAddresses.txt', 'utf8');
const exchangeAddresses = exchangeAddressesList.split('\n');

const filterByDate = async (wallets, todayDate) => {
    const validWallets = wallets.split('\n').map(wallet => {
        const [date, address] = wallet.split('\t');
        if (date === todayDate) {
            return date+'\t'+address+'\n';
        }
    });
    fs.writeFileSync(todayAddressesPath, validWallets.join(''), (err) => {
        console.error(err);
    });
}

provider.on("block", async (blockNumber) => {
    const todayDate = new Date().toJSON().slice(0, 10);
    if(!fs.existsSync(todayAddressesPath)) {
        fs.writeFileSync(todayAddressesPath, '', (err) => {
            console.error(err);
        });
    }
    await provider.getBlockWithTransactions(blockNumber).then(async (tx) => {
        if (tx) {
            const walletsList = fs.readFileSync(todayAddressesPath, 'utf8');
            await filterByDate(walletsList, todayDate);
            const validWallets = walletsList.split('\n').map(wallet => {
                const [date, address] = wallet.split('\t');
                if (date === todayDate) {
                    return address;
                }
            });
            const addresses = [];
            tx.transactions.forEach(element => {
                const { data,hash, from, to, value} = element;
                const decimalPlaces = 18;
                const txValue = ethers.BigNumber.from(value);
                const realvalue = (txValue / Math.pow(10, decimalPlaces)).toFixed(decimalPlaces);
                if (
                    data === '0x' 
                    && parseFloat(realvalue.toString()) > 0.01 
                    && exchangeAddresses.indexOf(from)  !== -1 
                    && !validWallets.includes(to)
                ) {//a9059cbb
                    addresses.push(to);
                }
            });
            
            const delayBetweenRequests = 210; // 2 seconds delay
            
            for (const address of addresses) {
                //console.log(addresses.length);
                try {
                    const length = await checkContractTransactions(address);
                    // console.log('write exchange address:', address, length);
                    if (length <= 10) {
                        // console.log('write exchange address:', address, length);
                        fs.appendFileSync(todayAddressesPath, todayDate+'\t'+address+'\n');
                    }
                    await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
                } catch (error) {
                    console.error(`Error fetching data from ${address}:`, error);
                }
            }
        }
    });
});