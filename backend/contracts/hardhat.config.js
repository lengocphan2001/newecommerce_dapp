require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
const path = require("path");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC || "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: process.env.PRIVATE_KEY 
        ? (process.env.PRIVATE_KEY.startsWith('0x') 
            ? [process.env.PRIVATE_KEY] 
            : ['0x' + process.env.PRIVATE_KEY])
        : [],
      gasPrice: 10000000000, // 10 gwei
    },
    bscMainnet: {
      url: process.env.BSC_MAINNET_RPC || "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: process.env.PRIVATE_KEY 
        ? (process.env.PRIVATE_KEY.startsWith('0x') 
            ? [process.env.PRIVATE_KEY] 
            : ['0x' + process.env.PRIVATE_KEY])
        : [],
      gasPrice: 5000000000, // 5 gwei
    },
  },
  paths: {
    sources: path.resolve(__dirname, "contracts"),
    tests: path.resolve(__dirname, "test"),
    cache: path.resolve(__dirname, "cache"),
    artifacts: path.resolve(__dirname, "artifacts"),
  },
};
