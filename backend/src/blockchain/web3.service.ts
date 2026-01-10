import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers, JsonRpcProvider, Wallet, Contract } from 'ethers';

/**
 * Web3Service - Handles blockchain interactions
 */
@Injectable()
export class Web3Service implements OnModuleInit {
  private readonly logger = new Logger(Web3Service.name);
  private provider: JsonRpcProvider;
  private wallet: Wallet;
  private readonly network: string;

  constructor(private configService: ConfigService) {
    this.network = this.configService.get<string>('BSC_NETWORK') || 'testnet';
  }

  async onModuleInit() {
    await this.initializeProvider();
    await this.initializeWallet();
  }

  private async initializeProvider() {
    const rpcUrl =
      this.network === 'mainnet'
        ? this.configService.get<string>('BSC_MAINNET_RPC') ||
          'https://bsc-dataseed.binance.org/'
        : this.configService.get<string>('BSC_TESTNET_RPC') ||
          'https://data-seed-prebsc-1-s1.binance.org:8545';

    this.provider = new JsonRpcProvider(rpcUrl);
    this.logger.log(`Initialized provider for ${this.network} at ${rpcUrl}`);
  }

  private async initializeWallet() {
    const privateKey = this.configService.get<string>('BLOCKCHAIN_PRIVATE_KEY');
    if (!privateKey) {
      this.logger.warn('BLOCKCHAIN_PRIVATE_KEY not set. Some features may not work.');
      return;
    }

    this.wallet = new Wallet(privateKey, this.provider);
    const address = await this.wallet.getAddress();
    this.logger.log(`Initialized wallet: ${address}`);
  }

  /**
   * Get the provider instance
   */
  getProvider(): JsonRpcProvider {
    return this.provider;
  }

  /**
   * Get the wallet instance
   */
  getWallet(): Wallet {
    if (!this.wallet) {
      throw new Error('Wallet not initialized. Please set BLOCKCHAIN_PRIVATE_KEY.');
    }
    return this.wallet;
  }

  /**
   * Get contract instance
   */
  getContract(address: string, abi: any[]): Contract {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    return new Contract(address, abi, this.wallet);
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<bigint> {
    const feeData = await this.provider.getFeeData();
    return feeData.gasPrice || BigInt(0);
  }

  /**
   * Get current nonce
   */
  async getNonce(): Promise<number> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    return await this.provider.getTransactionCount(await this.wallet.getAddress(), 'pending');
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(txHash: string, confirmations: number = 1): Promise<any> {
    return await this.provider.waitForTransaction(txHash, confirmations);
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: string): Promise<any> {
    return await this.provider.getTransactionReceipt(txHash);
  }

  /**
   * Get network info
   */
  async getNetworkInfo() {
    const network = await this.provider.getNetwork();
    const blockNumber = await this.provider.getBlockNumber();
    const balance = this.wallet
      ? await this.provider.getBalance(await this.wallet.getAddress())
      : BigInt(0);

    return {
      chainId: Number(network.chainId),
      blockNumber,
      balance: ethers.formatEther(balance),
      network: this.network,
    };
  }

  /**
   * Check if address is valid
   */
  isValidAddress(address: string): boolean {
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  }

  /**
   * Format address (checksum)
   */
  formatAddress(address: string): string {
    return ethers.getAddress(address);
  }
}
