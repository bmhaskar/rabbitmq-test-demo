import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from "@nestjs/config";
import { Transport } from "@nestjs/microservices";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService: ConfigService = app.get(ConfigService);
  const queueUrl = configService.get<string>('QUEUE_URL');
  app.connectMicroservice(
    {
      transport: Transport.RMQ,
      options: {
        urls: [queueUrl],
        queue: 'rabbitmq-test-demo',
        queueOptions: {
          durable: true,
        },
      },
      logger: ['error', 'warn', 'debug', 'log'],
    },
    { inheritAppConfig: true },
  );
  app.startAllMicroservices();
  await app.listen(3000);
}
bootstrap();
