import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GasModule } from './gas/gas.module';
import { UniswapModule } from './uniswap/uniswap.module';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    GasModule,
    UniswapModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
