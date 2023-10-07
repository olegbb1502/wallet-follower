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

module.exports = {
    checkContractForWords,
    checkContractTransactions
}