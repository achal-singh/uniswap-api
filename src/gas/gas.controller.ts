import { Controller, Get, Res, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { GasService } from './gas.service';
import { ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';

class GasPriceResponse {
  @ApiProperty({
    example: '0.720739878',
    description: 'Current gas price in Gwei as a string',
  })
  gasPriceInGwei: string;
}
@ApiTags('GasPrice')
@Controller('gasPrice')
export class GasController {
  private readonly logger = new Logger(GasController.name);
  constructor(private readonly gasService: GasService) {}

  @Get()
  @ApiOkResponse({
    description: 'Current gas price in Gwei',
    type: GasPriceResponse,
  })
  async getGasPrice(@Res() res: Response) {
    try {
      const gasPriceInGwei = await this.gasService.getRecentGasPrice();
      return res.status(HttpStatus.OK).json({ gasPriceInGwei });
    } catch (error) {
      this.logger.error('Error fetching gas price:', error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ message: 'Failed to retrieve gas price.' });
    }
  }
}
