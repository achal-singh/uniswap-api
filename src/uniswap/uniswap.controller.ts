import {
  Controller,
  Get,
  Param,
  Res,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { isAddress } from 'ethers/lib/utils';
import { Response } from 'express';
import { UniswapService } from './uniswap.service';
import { ApiParam, ApiTags, ApiProperty, ApiOkResponse } from '@nestjs/swagger';

class SwapEstimateResponse {
  @ApiProperty({
    example: '41.729090866854752014',
    description: 'Estimated value of the destination token',
  })
  estimatedAmountOut: string;
}

@ApiTags('Uniswap V2')
@Controller('return')
export class UniswapController {
  private readonly logger = new Logger(UniswapController.name);
  constructor(private readonly uniswapService: UniswapService) {}

  @Get(':fromTokenAddress/:toTokenAddress/:amountIn')
  @ApiParam({
    name: 'fromTokenAddress',
    type: 'string',
    description: 'The source token address',
  })
  @ApiParam({
    name: 'toTokenAddress',
    type: 'string',
    description: 'The destination token address',
  })
  @ApiParam({
    name: 'amountIn',
    type: 'string',
    description: 'The amount of input token (eg: 10.5, 999)',
  })
  @ApiOkResponse({
    description: 'Current gas price in Gwei',
    type: SwapEstimateResponse,
  })
  async getEstimatedReturn(
    @Param('fromTokenAddress') fromTokenAddress: string,
    @Param('toTokenAddress') toTokenAddress: string,
    @Param('amountIn') amountIn: string,

    @Res()
    res: Response,
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
      this.logger.error('Error getting Uniswap return:', error);
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
