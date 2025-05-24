import { Controller, Get, Param, Res, HttpStatus } from '@nestjs/common';
import { isAddress } from 'ethers/lib/utils';
import { Response } from 'express';
import { UniswapService } from './uniswap.service';

@Controller('return')
export class UniswapController {
  constructor(private readonly uniswapService: UniswapService) {}

  @Get(':fromTokenAddress/:toTokenAddress/:amountIn')
  async getEstimatedReturn(
    @Param('fromTokenAddress') fromTokenAddress: string,
    @Param('toTokenAddress') toTokenAddress: string,
    @Param('amountIn') amountIn: string,
    @Res() res: Response,
  ) {
    try {
      if (!isAddress(fromTokenAddress) || !isAddress(toTokenAddress)) {
        return res
          .status(HttpStatus.BAD_REQUEST)
          .json({ message: 'Invalid token address format.' });
      }

      const parsedAmount = parseFloat(amountIn);
      if (parsedAmount === 0)
        return res.status(HttpStatus.OK).json({ estimatedAmountOut: '0' });
      if (!amountIn || isNaN(parsedAmount) || parsedAmount < 0) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          message: 'Invalid amountIn: must be a positive number string.',
        });
      }

      const estimatedAmountOut =
        await this.uniswapService.getEstimatedUniswapReturn(
          fromTokenAddress,
          toTokenAddress,
          amountIn,
        );
      return res.status(HttpStatus.OK).json({ estimatedAmountOut });
    } catch (error) {
      console.error('Error getting Uniswap return:', error);
      if (error instanceof Error) {
        return res
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .json({ message: error.message });
      }
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ message: 'Failed to estimate Uniswap return.' });
    }
  }
}
