import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppAnotherService } from './app.another.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RABBITMQ_EXCHANGE_CONFIG } from './constants';
import { MicroservicesModule } from '@nestjs/microservices/microservices-module';

@Module({
  imports: [
    MicroservicesModule,
    ConfigModule.forRoot({
      envFilePath: `${process.cwd()}/env/${process.env.NODE_ENV}.env`,
    }),
    RabbitMQModule.forRootAsync(RabbitMQModule, {
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        console.log(
          'Logging queue URL',
          configService.get<string>('QUEUE_URL'),
        );
        return {
          exchanges: [
            {
              name:
                process.env.NODE_ENV +
                '-' +
                RABBITMQ_EXCHANGE_CONFIG.DELAY_EXCHANGE_NAME,
              type: 'direct',
            },
          ],
          uri: 'amqp://test:test@localhost:5672/',
          connectionInitOptions: { wait: true, reject: true, timeout: 3000 },
          enableControllerDiscovery: true,
        };
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService, AppAnotherService, AppController],
})
export class AppModule {}
