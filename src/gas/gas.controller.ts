import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { GasService } from './gas.service';

@Controller('gasPrice')
export class GasController {
  constructor(private readonly gasService: GasService) {}

  @Get()
  async getGasPrice(@Res() res: Response) {
    try {
      const gasPrice = await this.gasService.getRecentGasPrice();
      return res.status(HttpStatus.OK).json({ gasPrice });
    } catch (error) {
      console.error('Error fetching gas price:', error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ message: 'Failed to retrieve gas price.' });
    }
  }
}
