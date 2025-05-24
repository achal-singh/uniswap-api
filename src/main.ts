import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3000;

  const config = new DocumentBuilder()
    .setTitle('1Inch Assignment API')
    .setDescription(
      'A couple of APIs to fetch gas price and estimate swap returns via UniswapV2.',
    )
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document); // http://localhost:3000/docs
  await app.listen(port);
  new Logger(AppModule.name).debug(`Server Listening on Port: ${port}`);
}
bootstrap();
