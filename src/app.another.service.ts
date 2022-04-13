import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppAnotherService {
  getHello(): string {
    return 'Hello World!';
  }
  @RabbitSubscribe({
    exchange: 'exchange1',
    routingKey: 'subscribe-route1',
    queue: 'subscribe-queue',
  })
  public async competingPubSubHandler(msg: {}) {
    console.log(`Received message: ${JSON.stringify(msg)}`);
  }

  @RabbitSubscribe({
    exchange: 'exchange1',
    routingKey: 'subscribe-route2',
  })
  public async messagePerInstanceHandler(msg: {}) {
    console.log(`Received message: ${JSON.stringify(msg)}`);
  }
}
