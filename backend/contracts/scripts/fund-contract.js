/**
 * Script to fund CommissionPayout contract with USDT
 * 
 * Usage:
 *   $env:PRIVATE_KEY="your_private_key"
 *   npx hardhat run scripts/fund-contract.js --network bscMainnet
 */

const hre = require("hardhat");
require("dotenv").config();

const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
const CONTRACT_ADDRESS = process.env.COMMISSION_PAYOUT_CONTRACT_ADDRESS || 
  "0xCC5457C8717cd7fc722A012694F7aE388357811f";

// ERC20 ABI for transfer
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

async function main() {
  console.log("💰 Funding CommissionPayout contract with USDT...\n");
  
  // Get signer
  const [signer] = await hre.ethers.getSigners();
  console.log("Funding from:", signer.address);
  
  // Check signer balance
  const signerBalance = await hre.ethers.provider.getBalance(signer.address);
  console.log("Signer BNB balance:", hre.ethers.formatEther(signerBalance), "BNB");
  
  // Get USDT contract
  const usdt = new hre.ethers.Contract(USDT_ADDRESS, ERC20_ABI, signer);
  
  // Check current contract balance
  const currentBalance = await usdt.balanceOf(CONTRACT_ADDRESS);
  console.log("Current contract USDT balance:", hre.ethers.formatEther(currentBalance), "USDT");
  
  // Get amount to transfer (from command line or use default)
  const amountStr = process.env.AMOUNT || "1000"; // Default 1000 USDT
  const decimals = await usdt.decimals();
  const amount = hre.ethers.parseUnits(amountStr, decimals);
  
  console.log(`\nTransferring ${amountStr} USDT to contract...`);
  console.log("Contract address:", CONTRACT_ADDRESS);
  
  // Check signer USDT balance
  const signerUsdtBalance = await usdt.balanceOf(signer.address);
  if (signerUsdtBalance < amount) {
    console.error("❌ Insufficient USDT balance!");
    console.error(`   Required: ${amountStr} USDT`);
    console.error(`   Available: ${hre.ethers.formatEther(signerUsdtBalance)} USDT`);
    process.exit(1);
  }
  
  // Transfer USDT
  console.log("\nSending transaction...");
  const tx = await usdt.transfer(CONTRACT_ADDRESS, amount);
  console.log("Transaction hash:", tx.hash);
  
  console.log("Waiting for confirmation...");
  const receipt = await tx.wait();
  
  console.log("\n✅ Contract funded successfully!");
  console.log("Block number:", receipt.blockNumber);
  console.log("Gas used:", receipt.gasUsed.toString());
  
  // Check new balance
  const newBalance = await usdt.balanceOf(CONTRACT_ADDRESS);
  console.log("\n📊 Contract USDT balance:", hre.ethers.formatEther(newBalance), "USDT");
  
  console.log("\n🔗 View on BSCScan:");
  if (hre.network.name === 'bscMainnet') {
    console.log(`   Transaction: https://bscscan.com/tx/${tx.hash}`);
    console.log(`   Contract: https://bscscan.com/address/${CONTRACT_ADDRESS}`);
  } else {
    console.log(`   Transaction: https://testnet.bscscan.com/tx/${tx.hash}`);
    console.log(`   Contract: https://testnet.bscscan.com/address/${CONTRACT_ADDRESS}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
