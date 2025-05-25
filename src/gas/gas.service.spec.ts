import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GasService } from './gas.service';
import { providers, BigNumber } from 'ethers';

jest.useFakeTimers();

describe('GasService', () => {
  let service: GasService;

  let mockProvider: providers.JsonRpcProvider;

  const mockRpcUrl = 'https://mock-rpc-url';
  const mockGasPrice = BigNumber.from('1000000000'); // 1 gwei

  beforeEach(async () => {
    const mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'blockchain.rpcUrl') return mockRpcUrl;
        if (key === 'gasCacheTtl') return 5000;
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GasService,
        {
          provide: ConfigService,
          useValue: mockConfig,
        },
      ],
    }).compile();

    service = module.get<GasService>(GasService);

    // Patch provider and spy logger
    mockProvider = {
      getFeeData: jest.fn().mockResolvedValue({ gasPrice: mockGasPrice }),
    } as unknown as providers.JsonRpcProvider;

    service['provider'] = mockProvider;
    service['CACHE_TTL_MS'] = 5000;
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
  });

  describe('onModuleInit', () => {
    it('Should throw if rpcUrl is not configured properly', () => {
      const badConfig = new ConfigService({
        blockchain: { rpcUrl: 'YOUR_ETHEREUM_NODE_RPC_URL' },
      });

      const badService = new GasService(badConfig);
      const loggerSpy = jest
        .spyOn(badService['logger'], 'error')
        .mockImplementation(() => {});
      const exitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);

      expect(() => badService.onModuleInit()).not.toThrow();
      expect(loggerSpy).toHaveBeenCalledWith(
        'Please set the Ethereum RPC URL in .env file.',
      );
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
    });
  });

  describe('fetchAndCacheGasPrice', () => {
    it('Should cache Gas price on success', async () => {
      await service['fetchAndCacheGasPrice']();

      expect(service['cachedGasPrice']).toBe('1.0'); // 1 gwei
      expect(service['lastFetchTime']).toBeGreaterThan(0);
    });

    it('Should log warning if gasPrice is null', async () => {
      // Override mock before call
      (mockProvider.getFeeData as jest.Mock).mockResolvedValueOnce({
        gasPrice: null,
      });
      await service['fetchAndCacheGasPrice']();

      expect(service['logger'].warn).toHaveBeenCalledWith(
        'Could not retrieve gas price from RPC.',
      );
    });

    it('Should log error on failure', async () => {
      (mockProvider.getFeeData as jest.Mock).mockRejectedValueOnce(
        new Error('RPC failed'),
      );
      await service['fetchAndCacheGasPrice']();
      expect(service['logger'].error).toHaveBeenCalledWith(
        'Error fetching gas price: ',
        expect.any(Error),
      );
    });
  });

  describe('getRecentGasPrice', () => {
    it('Should return fresh cached Gas price', async () => {
      service['cachedGasPrice'] = '1.0';
      service['lastFetchTime'] = Date.now();
      const result = await service.getRecentGasPrice();
      expect(result).toBe('1.0');
    });

    it('Should return stale cached Gas price if still available', async () => {
      service['cachedGasPrice'] = '1.0';
      service['lastFetchTime'] = Date.now() - 10000;
      const result = await service.getRecentGasPrice();
      expect(result).toBe('1.0');
      expect(service['logger'].warn).toHaveBeenCalledWith(
        'Returning stale gas price from cache while new fetch happens in background.',
      );
    });

    it('Should fetch fresh Gas price if cache is empty', async () => {
      service['cachedGasPrice'] = null;
      const result = await service.getRecentGasPrice();
      expect(result).toBe('1.0');
    });

    it('Should throw if no Gas price is available after fetch', async () => {
      (mockProvider.getFeeData as jest.Mock).mockResolvedValueOnce({
        gasPrice: null,
      });
      service['cachedGasPrice'] = null;

      await expect(service.getRecentGasPrice()).rejects.toThrow(
        'Failed to retrieve gas price and cache is empty.',
      );
    });
  });
});
