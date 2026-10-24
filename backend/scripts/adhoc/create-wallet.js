/**
 * Script to create a new wallet for backend use
 * 
 * Usage:
 *   node scripts/create-wallet.js
 * 
 * This will generate:
 *   - New wallet address
 *   - Private key (for .env file)
 *   - Mnemonic phrase (backup)
 */

const { ethers } = require("ethers");

function createWallet() {
  console.log("🔐 Creating new wallet for backend...\n");
  
  // Create random wallet
  const wallet = ethers.Wallet.createRandom();
  
  console.log("=".repeat(60));
  console.log("✅ WALLET CREATED SUCCESSFULLY");
  console.log("=".repeat(60));
  console.log("\n📋 WALLET INFORMATION:");
  console.log("-".repeat(60));
  console.log("Address:     ", wallet.address);
  console.log("Private Key: ", wallet.privateKey);
  console.log("Mnemonic:    ", wallet.mnemonic.phrase);
  console.log("-".repeat(60));
  
  console.log("\n⚠️  SECURITY WARNINGS:");
  console.log("   ❌ DO NOT share this information with anyone");
  console.log("   ❌ DO NOT commit to Git");
  console.log("   ❌ DO NOT send via email/messaging");
  console.log("   ✅ Save in secure location (offline backup)");
  console.log("   ✅ Use only in .env file (not in code)");
  
  console.log("\n📝 ADD TO .env FILE:");
  console.log("-".repeat(60));
  console.log(`BLOCKCHAIN_PRIVATE_KEY=${wallet.privateKey}`);
  console.log("-".repeat(60));
  
  console.log("\n💰 NEXT STEPS:");
  console.log("   1. Copy private key to backend/.env file");
  console.log("   2. Fund wallet with BNB (for gas fees)");
  console.log("   3. Test on testnet first");
  console.log("   4. Verify wallet balance before using");
  
  console.log("\n🔍 VERIFY WALLET:");
  console.log("   Check balance on BSCScan:");
  console.log(`   https://bscscan.com/address/${wallet.address}`);
  console.log(`   (Testnet: https://testnet.bscscan.com/address/${wallet.address})`);
  
  console.log("\n" + "=".repeat(60));
  console.log("⚠️  SAVE THIS INFORMATION SECURELY!");
  console.log("=".repeat(60));
  
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic.phrase,
  };
}

// Run if executed directly
if (require.main === module) {
  try {
    createWallet();
  } catch (error) {
    console.error("❌ Error creating wallet:", error.message);
    process.exit(1);
  }
}

module.exports = { createWallet };
