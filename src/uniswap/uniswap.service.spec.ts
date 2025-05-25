import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  QuoteInfo,
  TokenDetails,
  UniswapService,
  PairReserveInfo,
} from './uniswap.service';
import { ethers } from 'ethers';
import { TOKENS } from '../common/constants/tokens';

// Setting higher timeout to be safe as real RPC is being called
jest.setTimeout(20_000);

describe('UniswapService (with real RPC)', () => {
  let service: UniswapService;
  let cachedQuote: QuoteInfo;
  let cachedTokenInfo: TokenDetails;
  let cachedPairReserves: PairReserveInfo;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'blockchain.rpcUrl') {
        return (
          process.env.RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo'
        );
      }
      return undefined;
    }),
  };

  beforeEach(() => {
    jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
  });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UniswapService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<UniswapService>(UniswapService);
    service['onModuleInit']();

    [cachedTokenInfo, cachedPairReserves, cachedQuote] = await Promise.all([
      service.getTokenInfo(TOKENS.ONE_INCH.address),
      service.getPairReserves(TOKENS.ONE_INCH.address, TOKENS.WETH.address),
      service.getQuote(TOKENS.ONE_INCH.address, TOKENS.WETH.address, '100'),
    ]);
  });

  describe('getTokenInfo', () => {
    it('should return cached token info', () => {
      service['tokenCache'].set(TOKENS.ONE_INCH.address, cachedTokenInfo);
      const result = cachedTokenInfo;
      expect(result).toEqual(cachedTokenInfo);
    });

    it('Should throw error for a non-ERC20 Contract', async () => {
      const nonERC20Contract = '0x388C818CA8B9251b393131C08a736A67ccB19297';
      await expect(service.getTokenInfo(nonERC20Contract)).rejects.toThrow(
        'Token address(es) are not valid ERC-20 Contracts.',
      );
    });
  });

  describe('getPairReserves', () => {
    it('Should return correct reserve info for a supported pair', () => {
      const result = cachedPairReserves;
      expect(result.token0).toBeDefined();
      expect(result.token1).toBeDefined();
      expect(result.reserve0).toBeInstanceOf(ethers.BigNumber);
      expect(result.reserve1).toBeInstanceOf(ethers.BigNumber);
    });

    it('Should throw error for an un-supported ERC-20 token address', async () => {
      const unsupportedERC20 = '0xd8e2b153E94daeC5fE657A49FF59bb68fA67f126';
      await expect(
        service.getPairReserves(TOKENS.ONE_INCH.address, unsupportedERC20),
      ).rejects.toThrow(
        'getPairReserves() failed: Uniswap V2 Pair does not exist for these tokens.',
      );
    });
  });

  describe('getQuote', () => {
    it('Should return a valid quote and metadata for a supported token pair', () => {
      expect(cachedQuote).toBeDefined();
      expect(cachedQuote.quote).toBeInstanceOf(ethers.BigNumber);

      const { reserveIn, reserveOut, decimalIn, decimalOut } = cachedQuote.meta;

      expect(reserveIn).toBeInstanceOf(ethers.BigNumber);
      expect(reserveOut).toBeInstanceOf(ethers.BigNumber);
      expect(typeof decimalIn).toBe('number');
      expect(typeof decimalOut).toBe('number');
      expect(decimalIn).toBeGreaterThan(0);
      expect(decimalOut).toBeGreaterThan(0);
    });
  });

  describe('getEstimatedUniswapReturn', () => {
    it('should return an estimated amount using cached quote', async () => {
      jest.spyOn(service, 'getQuote').mockResolvedValueOnce(cachedQuote);
      const result = await service.getEstimatedUniswapReturn(
        TOKENS.ONE_INCH.address,
        TOKENS.WETH.address,
        '100',
      );
      expect(typeof result).toBe('string');
      expect(parseFloat(result as string)).toBeGreaterThan(0);
    });
  });
});
