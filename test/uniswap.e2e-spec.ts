import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ethers } from 'ethers';
import * as request from 'supertest';
import { AppModule } from './../src/app.module'; // Adjust path as per your project structure

describe('AppController (e2e)', () => {
  let app: INestApplication;

  const REAL_WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // Mainnet WETH
  const REAL_USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // Mainnet USDC

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0); // Listen on a random available port
  });

  afterAll(async () => {
    await app.close();
  });

  // --- E2E Test Cases for /gasPrice endpoint ---
  describe('/gasPrice (GET)', () => {
    it('should return the current gas price as a positive number string', () => {
      return request(app.getHttpServer())
        .get('/gasPrice')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('gasPriceInGwei');
          expect(typeof res.body.gasPriceInGwei).toBe('string');
          const gasPriceGwei = parseFloat(res.body.gasPriceInGwei);

          expect(gasPriceGwei).toBeGreaterThan(0);
          expect(gasPriceGwei).toBeLessThan(
            ethers.BigNumber.from('1000')
              .mul(ethers.BigNumber.from('10').pow(9))
              .toNumber(),
          );
        });
    });
  });

  // --- E2E Test Cases for /return/:fromTokenAddress/:toTokenAddress/:amountIn endpoint ---
  describe('/return/:fromTokenAddress/:toTokenAddress/:amountIn (GET)', () => {
    it('should return an estimated output amount for a valid WETH to USDC swap', async () => {
      const amountIn = '1';

      return request(app.getHttpServer())
        .get(`/return/${REAL_WETH_ADDRESS}/${REAL_USDC_ADDRESS}/${amountIn}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('estimatedAmountOut');
          expect(typeof res.body.estimatedAmountOut).toBe('string');
          const estimatedAmountOut = parseFloat(res.body.estimatedAmountOut);

          expect(estimatedAmountOut).toBeGreaterThan(0);
          expect(estimatedAmountOut).toBeGreaterThan(1000);
          expect(estimatedAmountOut).toBeLessThan(10000);
        });
    });

    it('should return 0 if amountIn is 0', () => {
      const amountIn = '0.0';
      return request(app.getHttpServer())
        .get(`/return/${REAL_WETH_ADDRESS}/${REAL_USDC_ADDRESS}/${amountIn}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('estimatedAmountOut');
          expect(res.body.estimatedAmountOut).toBe('0');
        });
    });

    it('should return an error for invalid token address format', () => {
      const invalidAddress = '0xinvalid'; // Malformed address
      const amountIn = '1.0';

      return request(app.getHttpServer())
        .get(`/return/${invalidAddress}/${REAL_USDC_ADDRESS}/${amountIn}`)
        .expect(400) // Expect Bad Request from NestJS validation pipe
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toContain('Invalid token address format.');
        });
    });

    it('should return an error if any of the token addresses is not a valid ERC-20 address', () => {
      const tokenA = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
      const tokenB = '0x73f7b1184B5cD361cC0f7654998953E2a251dd58';
      const amountIn = '1.0';

      return request(app.getHttpServer())
        .get(`/return/${tokenA}/${tokenB}/${amountIn}`)
        .expect(500)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toContain(
            'Token address(es) are not valid ERC-20 Contracts.',
          );
        });
    });

    it('should return an error for invalid amountIn format', () => {
      const amountIn = 'not-a-number';
      return request(app.getHttpServer())
        .get(`/return/${REAL_WETH_ADDRESS}/${REAL_USDC_ADDRESS}/${amountIn}`)
        .expect(400) // Bad Request from validation pipe
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toContain(
            'Invalid amountIn: must be a positive number string.',
          );
        });
    });
  });
});
