import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BigNumber, providers, utils } from 'ethers';

/**
 * The GasService handles fetching and caching of the
 * latest Gas price in real-time on the Ethereum Network.
 * By default the Cron job updates the Gas value in every 5s.
 */
@Injectable()
export class GasService implements OnModuleInit {
  private readonly logger = new Logger(GasService.name);
  private provider: providers.JsonRpcProvider;
  private cachedGasPrice: string | null = null;
  private lastFetchTime: number = 0;
  private CACHE_TTL_MS: number = 0;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const rpcUrl = this.configService.get<string>('blockchain.rpcUrl');
    if (rpcUrl === 'YOUR_ETHEREUM_NODE_RPC_URL') {
      this.logger.error('Please set the Ethereum RPC URL in .env file.');
      process.exit(1);
    }
    const gasCacheTtl = this.configService.get<number>('gasCacheTtl');
    this.provider = new providers.JsonRpcProvider(rpcUrl);
    this.CACHE_TTL_MS = gasCacheTtl!;

    this.fetchAndCacheGasPrice(); // Fetching & Caching Gas Price on startup

    setInterval(() => {
      this.fetchAndCacheGasPrice().catch((error) =>
        this.logger.error('Interval error while fetching gas price:', error),
      );
    }, this.CACHE_TTL_MS);
  }

  private async fetchAndCacheGasPrice() {
    try {
      const feeData = await this.provider.getFeeData();
      if (!feeData?.gasPrice) {
        this.logger.warn('Could not retrieve gas price from RPC.');
        return;
      }
      const gasPriceGwei = utils.formatUnits(feeData.gasPrice, 'gwei');
      this.cachedGasPrice = gasPriceGwei.toString();
      this.lastFetchTime = Date.now();
      this.logger.log(`Gas price cached: ${this.cachedGasPrice}`);
    } catch (error) {
      this.logger.error('Error fetching gas price: ', error);
    }
  }

  async getRecentGasPrice(): Promise<string> {
    // If cache is fresh, return immediately
    if (
      this.cachedGasPrice &&
      Date.now() - this.lastFetchTime < this.CACHE_TTL_MS
    ) {
      return this.cachedGasPrice;
    }

    // Returning the cached value, this value won't be stale for more than 5s (by default).
    if (this.cachedGasPrice) {
      this.logger.warn(
        'Returning stale gas price from cache while new fetch happens in background.',
      );
      return this.cachedGasPrice; // Return stale while awaiting background update
    }

    this.logger.warn(
      'No cached gas price available, performing direct fetch (might be slow).',
    );
    await this.fetchAndCacheGasPrice(); // Ensuring a fresh fetch.
    if (this.cachedGasPrice) {
      return this.cachedGasPrice;
    }
    throw new Error('Failed to retrieve gas price and cache is empty.');
  }
}
