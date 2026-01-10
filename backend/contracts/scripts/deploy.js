const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("Deploying CommissionPayout contract...");
  
  // Check if we have a signer
  const signers = await hre.ethers.getSigners();
  if (signers.length === 0) {
    console.error("❌ No signers found. Please set PRIVATE_KEY in environment or hardhat.config.js");
    console.error("   Example: export PRIVATE_KEY=your_private_key");
    process.exit(1);
  }
  
  const deployer = signers[0];
  console.log("Deploying with account:", deployer.address);
  
  // Get the token address from environment
  // Default to USDT BEP20 Mainnet if not specified
  const tokenAddress = process.env.TOKEN_ADDRESS || 
    (hre.network.name === 'bscMainnet' 
      ? "0x55d398326f99059fF775485246999027B3197955" // USDT BEP20 Mainnet
      : "0x0000000000000000000000000000000000000000");
  
  if (tokenAddress === "0x0000000000000000000000000000000000000000") {
    console.error("Please set TOKEN_ADDRESS environment variable");
    console.error("For mainnet, USDT BEP20 address: 0x55d398326f99059fF775485246999027B3197955");
    process.exit(1);
  }
  
  console.log("Token address:", tokenAddress);
  console.log("Network:", hre.network.name);
  
  if (hre.network.name === 'bscMainnet') {
    console.log("Using USDT BEP20 Mainnet (18 decimals)");
  }
  
  // Check balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const balanceBNB = parseFloat(hre.ethers.formatEther(balance));
  console.log("Account balance:", balanceBNB.toFixed(8), "BNB");
  
  // Get current gas price
  const feeData = await hre.ethers.provider.getFeeData();
  const currentGasPrice = feeData.gasPrice || 5000000000n; // 5 gwei default
  console.log("Current gas price:", hre.ethers.formatUnits(currentGasPrice, "gwei"), "gwei");
  
  // Estimate gas cost
  const CommissionPayoutFactory = await hre.ethers.getContractFactory("CommissionPayout");
  const deployTx = CommissionPayoutFactory.getDeployTransaction(tokenAddress);
  const gasEstimate = await deployer.estimateGas(deployTx);
  const estimatedCost = gasEstimate * currentGasPrice;
  const estimatedCostBNB = parseFloat(hre.ethers.formatEther(estimatedCost));
  
  console.log("Estimated gas:", gasEstimate.toString());
  console.log("Estimated cost:", estimatedCostBNB.toFixed(8), "BNB");
  
  const requiredBNB = estimatedCostBNB * 1.2; // 20% buffer
  if (balanceBNB < requiredBNB) {
    console.error("\n❌ Insufficient BNB balance!");
    console.error(`   Current balance: ${balanceBNB.toFixed(8)} BNB`);
    console.error(`   Estimated cost: ${estimatedCostBNB.toFixed(8)} BNB`);
    console.error(`   Required (with buffer): ${requiredBNB.toFixed(8)} BNB`);
    console.error(`   Missing: ${(requiredBNB - balanceBNB).toFixed(8)} BNB`);
    console.error("\n💡 Solution: Fund wallet with more BNB");
    console.error(`   Wallet address: ${deployer.address}`);
    if (hre.network.name === 'bscTestnet') {
      console.error("   Testnet faucet: https://testnet.binance.org/faucet-smart");
    } else {
      console.error("   Mainnet: Transfer BNB from another wallet or buy on Binance");
      console.error(`   View on BSCScan: https://bscscan.com/address/${deployer.address}`);
    }
    process.exit(1);
  }
  
  // Deploy contract
  console.log("\n✅ Sufficient balance. Deploying contract...");
  const commissionPayout = await CommissionPayoutFactory.deploy(tokenAddress, {
    gasPrice: currentGasPrice,
  });
  
  console.log("Waiting for deployment...");
  await commissionPayout.waitForDeployment();
  const address = await commissionPayout.getAddress();
  
  console.log("\n✅ CommissionPayout deployed successfully!");
  console.log("Contract address:", address);
  console.log("Network:", hre.network.name);
  console.log("Block number:", await hre.ethers.provider.getBlockNumber());
  
  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: address,
    tokenAddress: tokenAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };
  
  console.log("\n📋 Deployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  
  console.log("\n🔗 View on BSCScan:");
  if (hre.network.name === 'bscMainnet') {
    console.log(`   https://bscscan.com/address/${address}`);
  } else {
    console.log(`   https://testnet.bscscan.com/address/${address}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
