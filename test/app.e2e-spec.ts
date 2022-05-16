import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, INestMicroservice } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { FakeAmqp } from './fixtures';
import * as origAmpq from 'amqplib';
import { ClientProxy, ClientRMQ, ClientsModule, ReadPacket, RmqOptions, Transport } from "@nestjs/microservices";
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAME, RABBITMQ_EXCHANGE_CONFIG } from '../src/constants';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const amqplib = new FakeAmqp();

jest.setTimeout(20000000)

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let server;
  let amqpConnection: AmqpConnection;
  const asyncQueue = `${process.env.NODE_ENV}-${QUEUE_NAME}`;
  const expectedResponseBody = 'Hello World!';

  beforeEach(async () => {
    jest.spyOn(origAmpq, 'connect').mockImplementation(((url: string) => {
      console.log('Intercepted ', url);
      return amqplib.connect(url);
    }) as any);
    amqplib.reset();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });


});

describe('Microservice e2e', () => {
  let appMicroservice: INestApplication;
  let server;
  let amqpConnection: AmqpConnection;
  const asyncQueue = `${process.env.NODE_ENV}-${QUEUE_NAME}`;
  const expectedResponseBody = 'Hello World!';
  let client: ClientProxy;
  beforeEach(async () => {

    jest.spyOn(origAmpq, 'connect').mockImplementation(((url: string) => {
      console.log('Intercepted ', url);
      return amqplib.connect(url);
    }) as any);
    amqplib.reset();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AppModule,
        ClientsModule.register([
          { name: 'testClient', transport: Transport.RMQ, options: {
              urls: [`amqp://0.0.0.0:5672`],
              queue: 'test',
              queueOptions: { durable: false },
              socketOptions: { noDelay: true },
            } },

        ]),
      ],
    }).compile();

    appMicroservice = moduleFixture.createNestApplication();
    server = appMicroservice.getHttpAdapter().getInstance();
    appMicroservice.connectMicroservice({
      transport: Transport.RMQ,
      options: {
        urls: [`amqp://0.0.0.0:5672`],
        queue: 'test',
        queueOptions: { durable: false },
        socketOptions: { noDelay: true },
      },
    });
    await appMicroservice.startAllMicroservices();
    await appMicroservice.init();
    amqpConnection = appMicroservice.get<AmqpConnection>(AmqpConnection);
    client = appMicroservice.get<ClientRMQ>('testClient');

  });
  afterEach(async () => {
    await appMicroservice.close();
  });
  it('Receives message', async () => {

    const response = await client.send( 'hello', {test: 'test'}).toPromise()
    console.log(response);
  });
});