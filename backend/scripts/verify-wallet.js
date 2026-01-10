/**
 * Script to verify wallet private key and check balance
 * 
 * Usage:
 *   node scripts/verify-wallet.js
 * 
 * This will:
 *   - Verify private key is valid
 *   - Show wallet address
 *   - Check BNB balance on BSC
 */

require("dotenv").config();
const { ethers } = require("ethers");

async function verifyWallet() {
  console.log("🔍 Verifying wallet...\n");
  
  const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
  
  if (!privateKey) {
    console.error("❌ BLOCKCHAIN_PRIVATE_KEY not found in .env file");
    console.log("\n💡 Please add to backend/.env:");
    console.log("   BLOCKCHAIN_PRIVATE_KEY=0x...");
    process.exit(1);
  }
  
  // Normalize private key (add 0x if missing)
  let normalizedKey = privateKey;
  if (!privateKey.startsWith("0x")) {
    normalizedKey = "0x" + privateKey;
    console.log("ℹ️  Added 0x prefix to private key");
  }

  // Validate private key format
  if (normalizedKey.length !== 66 || !/^0x[0-9a-fA-F]{64}$/.test(normalizedKey)) {
    console.error("❌ Invalid private key format");
    console.log("   Expected: 64 hex characters (with or without 0x prefix)");
    console.log(`   Got: ${privateKey.length} characters`);
    process.exit(1);
  }
  
  try {
    // Create wallet from normalized private key
    const wallet = new ethers.Wallet(normalizedKey);
    console.log("✅ Private key is valid");
    console.log("📋 Wallet Address:", wallet.address);
    
    // Check network
    const network = process.env.BSC_NETWORK || "testnet";
    const rpcUrl = network === "mainnet"
      ? process.env.BSC_MAINNET_RPC || "https://bsc-dataseed.binance.org/"
      : process.env.BSC_TESTNET_RPC || "https://data-seed-prebsc-1-s1.binance.org:8545";
    
    console.log("\n🌐 Network:", network);
    console.log("🔗 RPC URL:", rpcUrl);
    
    // Connect to provider
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Check balance
    console.log("\n💰 Checking balance...");
    const balance = await provider.getBalance(wallet.address);
    const balanceBNB = ethers.formatEther(balance);
    
    console.log("   Balance:", balanceBNB, "BNB");
    
    if (parseFloat(balanceBNB) === 0) {
      console.log("\n⚠️  WARNING: Wallet has 0 BNB");
      console.log("   You need BNB to pay for gas fees");
      console.log("\n💡 How to fund:");
      if (network === "testnet") {
        console.log("   1. Visit: https://testnet.binance.org/faucet-smart");
        console.log("   2. Enter address:", wallet.address);
        console.log("   3. Request testnet BNB");
      } else {
        console.log("   1. Transfer BNB from another wallet");
        console.log("   2. Or buy BNB on Binance and withdraw");
        console.log("   3. Send to address:", wallet.address);
      }
    } else {
      console.log("✅ Wallet has sufficient balance for gas fees");
    }
    
    // Check network info
    const networkInfo = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    
    console.log("\n📊 Network Info:");
    console.log("   Chain ID:", Number(networkInfo.chainId));
    console.log("   Block Number:", blockNumber);
    
    // BSCScan links
    const bscscanBase = network === "mainnet"
      ? "https://bscscan.com"
      : "https://testnet.bscscan.com";
    
    console.log("\n🔗 View on BSCScan:");
    console.log(`   ${bscscanBase}/address/${wallet.address}`);
    
    console.log("\n✅ Wallet verification complete!");
    
  } catch (error) {
    console.error("❌ Error verifying wallet:", error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  verifyWallet()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Fatal error:", error);
      process.exit(1);
    });
}

module.exports = { verifyWallet };
