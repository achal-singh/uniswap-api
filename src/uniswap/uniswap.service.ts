/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ConfigService } from '@nestjs/config';
import { ethers, Contract, BigNumber } from 'ethers';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import {
  TOKENS,
  ERC20_ABI,
  UNISWAP_V2_FACTORY_ABI,
  UNISWAP_V2_PAIR_ABI,
} from 'src/common/constants/tokens';

interface TokenDetails {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

@Injectable()
export class UniswapService implements OnModuleInit {
  private readonly logger = new Logger(UniswapService.name);
  private tokenCache: Map<string, Partial<TokenDetails>> = new Map();
  private provider: ethers.providers.JsonRpcProvider;
  private uniswapV2Factory: ethers.Contract;
  private readonly uniswapV2FactoryAddress: string;

  constructor(private configService: ConfigService) {
    this.uniswapV2FactoryAddress = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
  }

  onModuleInit() {
    const rpcUrl = this.configService.get<string>('blockchain.rpcUrl');
    if (!rpcUrl) {
      throw new Error('RPC URL is not configured');
    }
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.uniswapV2Factory = new Contract(
      this.uniswapV2FactoryAddress,
      UNISWAP_V2_FACTORY_ABI,
      this.provider,
    );
  }

  /**
   * Fetches basic meta data of an ERC-20 Token from Ethereum.
   * */
  async getTokenInfo(tokenAddress: string): Promise<Partial<TokenDetails>> {
    try {
      if (this.tokenCache.has(tokenAddress)) {
        const data = this.tokenCache.get(tokenAddress)!;
        this.tokenCache.delete(tokenAddress);
        this.tokenCache.set(tokenAddress, data);
        return data;
      }
      const contract = new Contract(tokenAddress, ERC20_ABI, this.provider);
      const [decimals, symbol] = await Promise.all([
        contract.decimals(),
        contract.symbol(),
      ]);

      // Assuming an LRU-cache size of 25
      if (this.tokenCache.size >= 25) {
        const leastUsed = this.tokenCache.keys().next().value;
        this.tokenCache.delete(leastUsed);
      }

      this.tokenCache.set(tokenAddress, { decimals, symbol });
      return { decimals, symbol };
    } catch (error) {
      this.logger.error(error.message);
      throw new Error('Token address(es) are not valid ERC-20 Contracts.');
    }
  }

  /**
   * Fetches the reserves amount in UniswapV2Pair contracts
   * for each pair.
   * @param fromTokenAddress: Source token address
   * @param toTokenAddress: Destination token address
   * */
  async getPairReserves(fromTokenAddress: string, toTokenAddress: string) {
    try {
      const pairAddress: string = await this.uniswapV2Factory.getPair(
        fromTokenAddress,
        toTokenAddress,
      );
      if (pairAddress === ethers.constants.AddressZero) {
        throw new Error('Uniswap V2 Pair does not exist for these tokens.');
      }

      const pairContract = new Contract(
        pairAddress,
        UNISWAP_V2_PAIR_ABI,
        this.provider,
      );
      const [reserve0, reserve1] = await pairContract.getReserves();
      const [token0, token1] = await Promise.all([
        pairContract.token0(),
        pairContract.token1(),
      ]);

      return {
        reserve0,
        reserve1,
        token0,
        token1,
      };
    } catch (error) {
      this.logger.error(error.message);
      throw new Error('Something went wrong in getPairReserves().');
    }
  }

  /**
   * Computes the quote value for the input amount and reserve values
   * ignoring the fees impact.
   * @param fromTokenAddress: Source token address
   * @param toTokenAddress: Destination token address
   * @param amountIn: Input amount of source/from token
   * */
  async getQuote(
    fromTokenAddress: string,
    toTokenAddress: string,
    amountIn: string,
  ) {
    try {
      const { reserve0, reserve1, token0, token1 } = await this.getPairReserves(
        fromTokenAddress.toLowerCase(),
        toTokenAddress.toLowerCase(),
      );

      const [token0Info, token1Info] = await Promise.all([
        this.getTokenInfo(token0),
        this.getTokenInfo(token1),
      ]);

      let reserveIn: BigNumber;
      let reserveOut: BigNumber;
      let decimalIn: number;
      let decimalOut: number;

      // Determine which reserve corresponds to which token
      if (token0.toLowerCase() === fromTokenAddress.toLowerCase()) {
        reserveIn = reserve0;
        reserveOut = reserve1;
        decimalIn = token0Info.decimals as number;
        decimalOut = token1Info.decimals as number;
      } else if (token1.toLowerCase() === fromTokenAddress.toLowerCase()) {
        reserveIn = reserve1;
        reserveOut = reserve0;
        decimalIn = token1Info.decimals as number;
        decimalOut = token0Info.decimals as number;
      } else {
        throw new Error('Token addresses do not match the pair contract.');
      }

      const amountInWei = parseUnits(
        parseFloat(amountIn).toFixed(6),
        decimalIn,
      );
      const quote = amountInWei.mul(reserveOut).div(reserveIn);
      return { quote, meta: { reserveOut, reserveIn, decimalIn, decimalOut } };
    } catch (error) {
      this.logger.error(error.message);
      throw new Error('Something went wrong in getQuote().');
    }
  }

  /**
   * Computes the overall approximate amount of destination tokens
   * received against the given amount of source tokens
   * including the 0.3% fees charged by Uniswap.
   * @param fromTokenAddress: Source token address
   * @param toTokenAddress: Destination token address
   * @param amountIn: Input amount of source/from token
   * */
  async getEstimatedUniswapReturn(
    fromTokenAddress: string,
    toTokenAddress: string,
    amountIn: string,
  ): Promise<string | void> {
    const [fromToken, toToken] = await Promise.all([
      this.getTokenInfo(fromTokenAddress),
      this.getTokenInfo(toTokenAddress),
    ]);

    this.logger.debug(
      `Getting quote for ${amountIn} ${fromToken.symbol} --> ${toToken.symbol} ...`,
    );
    /* Getting quote for Direct Swap */
    const { quote, meta } = await this.getQuote(
      fromTokenAddress,
      toTokenAddress,
      amountIn,
    );

    /*
     * --->>> ### Swapping via WETH ### <<<---
     * Switching path (From_Token -> WETH -> To_Token) if "quote" is greater or equal
     * to 90% of the destination token's reserve */
    if (quote.mul(100).div(meta.reserveOut).gte(90)) {
      if (fromTokenAddress === TOKENS.WETH.address) {
        throw new Error('Unexpected Error with WETH Reserve.');
      }

      this.logger.log(
        `Getting swap quote for ${fromToken.symbol} --> WETH ...`,
      );

      const { quote, meta } = await this.getQuote(
        fromTokenAddress,
        TOKENS.WETH.address,
        amountIn,
      );

      if (quote.mul(100).div(meta.reserveOut).gte(90)) {
        throw new Error('Cannot process quote for this pair.');
      }

      const {
        reserveOut: reserveWETH,
        reserveIn,
        decimalIn,
        decimalOut: decimalWETH,
      } = meta;

      const amountInRaw = parseUnits(amountIn, decimalIn);
      const amountInWithFee = amountInRaw.mul(997);
      const numerator = amountInWithFee.mul(reserveWETH);
      const denominator = reserveIn.mul(1000).add(amountInWithFee);

      const amountOutWETH = formatUnits(
        numerator.div(denominator),
        decimalWETH,
      );

      const finalAmountOut = await this.getEstimatedUniswapReturn(
        TOKENS.WETH.address,
        toTokenAddress,
        parseFloat(amountOutWETH).toFixed(decimalWETH),
      );

      return finalAmountOut;
    }

    // Computing the resulting amount including the swap fees of 0.3% by Uniswap
    const { reserveOut, reserveIn, decimalIn, decimalOut } = meta;
    const amountInWei = parseUnits(
      parseFloat(amountIn).toFixed(decimalIn),
      decimalIn,
    );
    const amountInWithFee = amountInWei.mul(997);
    const numerator = amountInWithFee.mul(reserveOut);
    const denominator = reserveIn.mul(1000).add(amountInWithFee);

    const formattedAmountOut = formatUnits(
      numerator.div(denominator),
      decimalOut,
    );
    return formattedAmountOut;
  }
}
