require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      chainId: 80002, // Mimics Polygon Amoy
      gasPrice: 30000000000, // 30 gwei
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        count: 10,
      },
    },
  },
  etherscan: {
    customChains: [
      {
        network: "hardhat",
        chainId: 80002,
        urls: {
          apiURL: "https://amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com",
        },
      },
    ],
  },
};