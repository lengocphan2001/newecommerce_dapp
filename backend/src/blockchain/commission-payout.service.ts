import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Web3Service } from './web3.service';
import { ethers } from 'ethers';

// CommissionPayout Contract ABI
const COMMISSION_PAYOUT_ABI = [
  'function batchPayout(bytes32 batchId, address[] calldata recipients, uint256[] calldata amounts) external',
  'function getBalance() external view returns (uint256)',
  'function getTotalPayout(address recipient) external view returns (uint256)',
  'function isBatchProcessed(bytes32 batchId) external view returns (bool)',
  'function pause() external',
  'function unpause() external',
  'function emergencyWithdraw(address to, uint256 amount) external',
  'function owner() external view returns (address)',
  'function token() external view returns (address)',
  'event BatchPayout(bytes32 indexed batchId, address indexed executor, address[] recipients, uint256[] amounts, uint256 timestamp)',
  'event SinglePayout(address indexed recipient, uint256 amount, bytes32 indexed batchId, uint256 timestamp)',
];

interface PayoutRecipient {
  address: string;
  amount: string; // Amount in token units (wei-like)
}

interface BatchPayoutResult {
  batchId: string;
  txHash: string;
  recipients: string[];
  amounts: string[];
  gasUsed?: bigint;
  blockNumber?: number;
}

/**
 * Format amount to string with exactly 18 decimal places
 * Fixes floating point precision issues when converting to BigNumber
 */
function formatAmountForParseUnits(amount: string | number): string {
  let amountNum: number;
  if (typeof amount === 'string') {
    amountNum = parseFloat(amount);
  } else {
    amountNum = amount;
  }

  // Format to string with exactly 18 decimal places
  const amountStr = amountNum.toFixed(18);

  // Validate and truncate if needed (shouldn't happen with toFixed, but just in case)
  const parts = amountStr.split('.');
  if (parts.length === 2 && parts[1].length > 18) {
    return parts[0] + '.' + parts[1].substring(0, 18);
  }

  return amountStr;
}

@Injectable()
export class CommissionPayoutService {
  private readonly logger = new Logger(CommissionPayoutService.name);
  private contractAddress: string;
  private contract: ethers.Contract | null = null;

  constructor(
    private web3Service: Web3Service,
    private configService: ConfigService,
  ) {
    this.contractAddress =
      this.configService.get<string>('COMMISSION_PAYOUT_CONTRACT_ADDRESS') || '';
  }

  /**
   * Initialize contract instance
   */
  private getContract(): ethers.Contract {
    if (!this.contractAddress) {
      throw new Error('COMMISSION_PAYOUT_CONTRACT_ADDRESS not configured');
    }

    if (!this.contract) {
      this.contract = this.web3Service.getContract(
        this.contractAddress,
        COMMISSION_PAYOUT_ABI,
      );
      this.logger.log(`Initialized contract at ${this.contractAddress}`);
    }

    return this.contract;
  }

  /**
   * Generate batch ID from timestamp and hash
   */
  generateBatchId(recipients: string[], amounts: string[]): string {
    const data = JSON.stringify({
      recipients,
      amounts,
      timestamp: Date.now(),
    });
    return ethers.keccak256(ethers.toUtf8Bytes(data));
  }

  /**
   * Batch payout commissions
   */
  async batchPayout(
    recipients: PayoutRecipient[],
    batchId?: string,
  ): Promise<BatchPayoutResult> {
    if (recipients.length === 0) {
      throw new Error('Recipients array cannot be empty');
    }

    if (recipients.length > 100) {
      throw new Error('Batch size cannot exceed 100 recipients');
    }

    const contract = this.getContract();

    // Prepare data
    const addresses = recipients.map((r) => this.web3Service.formatAddress(r.address));
    const amounts = recipients.map((r) => {
      // Convert amount to BigNumber
      // USDT BEP20 uses 18 decimals
      // Fix floating point precision issues by formatting to string with exactly 18 decimals
      const formattedAmount = formatAmountForParseUnits(r.amount);
      return ethers.parseUnits(formattedAmount, 18);
    });

    // Generate batch ID if not provided
    const finalBatchId = batchId || this.generateBatchId(addresses, amounts.map(String));

    // Check if batch already processed
    const isProcessed = await contract.isBatchProcessed(finalBatchId);
    if (isProcessed) {
      throw new Error(`Batch ${finalBatchId} has already been processed`);
    }

    // Check contract balance
    const balance = await contract.getBalance();
    const totalAmount = amounts.reduce((sum, amount) => sum + amount, BigInt(0));
    if (balance < totalAmount) {
      throw new Error(
        `Insufficient contract balance. Required: ${ethers.formatEther(totalAmount)}, Available: ${ethers.formatEther(balance)}`,
      );
    }

    this.logger.log(
      `Executing batch payout: ${recipients.length} recipients, total: ${ethers.formatEther(totalAmount)} tokens`,
    );

    try {
      // Get gas price
      const gasPrice = await this.web3Service.getGasPrice();
      const gasPriceWithBuffer = (gasPrice * BigInt(120)) / BigInt(100); // 20% buffer

      // Estimate gas
      let gasLimit: bigint;
      try {
        gasLimit = await contract.batchPayout.estimateGas(finalBatchId, addresses, amounts);
        gasLimit = (gasLimit * BigInt(120)) / BigInt(100); // 20% buffer
      } catch (error) {
        this.logger.warn('Gas estimation failed, using default', error);
        // Default gas limit for batch (adjust based on batch size)
        gasLimit = BigInt(500000 + recipients.length * 50000);
      }

      // Execute transaction
      const tx = await contract.batchPayout(finalBatchId, addresses, amounts, {
        gasLimit,
        gasPrice: gasPriceWithBuffer,
      });

      this.logger.log(`Transaction sent: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await this.web3Service.waitForTransaction(tx.hash, 1);

      if (!receipt || !receipt.status) {
        throw new Error('Transaction failed');
      }

      this.logger.log(
        `Batch payout successful. Gas used: ${receipt.gasUsed.toString()}, Block: ${receipt.blockNumber}`,
      );

      return {
        batchId: finalBatchId,
        txHash: tx.hash,
        recipients: addresses,
        amounts: amounts.map((a) => ethers.formatEther(a)),
        gasUsed: receipt.gasUsed,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      this.logger.error('Batch payout failed', error);
      throw new Error(`Batch payout failed: ${error.message}`);
    }
  }

  /**
   * Get contract balance
   */
  async getContractBalance(): Promise<string> {
    const contract = this.getContract();
    const balance = await contract.getBalance();
    return ethers.formatEther(balance);
  }

  /**
   * Get total payout for a recipient
   */
  async getTotalPayout(recipientAddress: string): Promise<string> {
    const contract = this.getContract();
    const address = this.web3Service.formatAddress(recipientAddress);
    const total = await contract.getTotalPayout(address);
    return ethers.formatEther(total);
  }

  /**
   * Check if batch is processed
   */
  async isBatchProcessed(batchId: string): Promise<boolean> {
    const contract = this.getContract();
    return await contract.isBatchProcessed(batchId);
  }

  /**
   * Get contract info
   */
  async getContractInfo() {
    const contract = this.getContract();
    const [owner, tokenAddress, balance] = await Promise.all([
      contract.owner(),
      contract.token(),
      contract.getBalance(),
    ]);

    return {
      contractAddress: this.contractAddress,
      owner,
      tokenAddress,
      balance: ethers.formatEther(balance),
    };
  }

  /**
   * Listen to payout events
   */
  async listenToPayoutEvents(
    callback: (event: any) => void,
    fromBlock?: number,
  ) {
    const contract = this.getContract();
    const filter = contract.filters.BatchPayout();

    contract.on(filter, (batchId, executor, recipients, amounts, timestamp, event) => {
      callback({
        batchId,
        executor,
        recipients,
        amounts,
        timestamp,
        blockNumber: event.blockNumber,
        txHash: event.transactionHash,
      });
    });

    this.logger.log('Listening to payout events...');
  }

  /**
   * Emergency withdraw funds from contract
   */
  async emergencyWithdraw(
    recipientAddress: string,
    amountStr: string,
  ): Promise<{ txHash: string; blockNumber: number }> {
    const contract = this.getContract();
    const address = this.web3Service.formatAddress(recipientAddress);

    // Parse amount using 18 decimals (USDT/Token standard)
    const amount = ethers.parseUnits(amountStr, 18);

    // Get gas price
    const gasPrice = await this.web3Service.getGasPrice();
    const gasPriceWithBuffer = (gasPrice * BigInt(120)) / BigInt(100);

    // Execute transaction
    this.logger.log(`Executing emergency withdraw to ${address}, amount: ${amountStr}`);

    try {
      const tx = await contract.emergencyWithdraw(address, amount, {
        gasLimit: 300000,
        gasPrice: gasPriceWithBuffer,
      });

      this.logger.log(`Withdraw transaction sent: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await this.web3Service.waitForTransaction(tx.hash, 1);

      if (!receipt || !receipt.status) {
        throw new Error('Withdraw transaction failed');
      }

      return {
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      this.logger.error('Emergency withdraw failed', error);
      throw new Error(`Withdraw failed: ${error.message}`);
    }
  }
}
