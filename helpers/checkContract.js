const fetch = require('node-fetch');
// const {ethers} = require('ethers');
// const { log } = require('console');
// const { Token } = require('@uniswap/sdk-core');

const api_key = "R2HE1IXVWRQGR6Z9IM5BRXW5G3MQKHFNJ6";
const etherscan_url = "https://api.etherscan.io/api";

const checkContractForWords = async (address, words) => {
    const params = new URLSearchParams({
        "module": "contract",
        "action": "getsourcecode",
        "address": address,
        "apikey": api_key,
    });

    const response = await fetch(`${etherscan_url}?${params}`);
    const data = await response.json();

    if (data.status === "1") {
        const source_code = data.result[0].SourceCode;

        const contract_lines = source_code.split("\n");
        for (const line of contract_lines) {
            if (words instanceof RegExp) {
                if (line.match(words)) return line;
                else return false;
            } else {
                const keywords = words.split(",");
                if (keywords.some(word => line.toLowerCase().includes(word.toLowerCase()))) {
                    return line;
                } else return false;
            }
        }
    } else {
        return false;
    }
}

const checkContractTransactions = async (address) => {
    const params = new URLSearchParams({
        "module": "account",
        "action": "txlist",
        "address": address,
        "apikey": api_key
    });

    const response = await fetch(`${etherscan_url}?${params}`);
    const {status, result} = await response.json();
    // console.log(`${etherscan_url}?${params}`, result.length, typeof result === 'string' ? result : '');
    if (status === '1') {
        return result.length;
    }
}

const checkContractSecurity = async (address) => {
    const checkForAddress = [
        '0x0000000000000000000000000000000000000000',
        '0x000000000000000000000000000000000000dEaD',
        '0x663A5C229c09b049E36dCc11a9B0d4a8Eb9db214'
    ];
    if (typeof address === 'string' && address.includes('0x')) {
        // console.time(`Timeout 5mins for ${address}`);
        const response = await fetch(`https://api.gopluslabs.io/api/v1/token_security/1?contract_addresses=${address}`);
        // console.timeEnd(`Timeout 5mins for ${address}`);
        const {result} = await response.json();
        if (result[address.toLowerCase()]) {
            const {lp_holders} = result[address.toLowerCase()];
            if (lp_holders && lp_holders.length > 0) {
                const deadAddress = lp_holders.find(lp_holder => checkForAddress.includes(lp_holder.address));
                if (deadAddress && parseFloat(deadAddress.percent) > 0.6) {
                    return true;
                }
            }
        }
        return false;
    }
}

checkContractSecurity('0xeb31bA344310Bc4872C6188ff210D7341A301ea9')
    .then((response) => {console.log(response)})

module.exports = {
    checkContractForWords,
    checkContractTransactions,
    checkContractSecurity
}