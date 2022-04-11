/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import * as amqpcon from 'amqp-connection-manager';
import * as ChannelWrapper from 'amqp-connection-manager/dist/cjs/ChannelWrapper';

import { Connection, Message, Options, Replies } from 'amqplib';
import { EventEmitter, once } from 'events';
const queues = {};
const exchanges = {};
const eventListeners = [];
const bindings = [];
const createQueue = () => {
  let messages = [];
  let subscriber = null;

  return {
    add: item => {
      if (subscriber) {
        subscriber(item);
      } else {
        messages.push(item);
      }
    },
    get: () => messages.shift() || false,
    addConsumer: consumer => {
      messages.forEach(item => consumer(item));
      messages = [];
      subscriber = consumer;
    },
    stopConsume: () => (subscriber = null),
    getMessageCount: () => messages.length,
    purge: () => (messages = [])
  };
};
const generateRandomQueueName = () => {
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_';
  let res = 'amq.gen-';
  for( let i=0; i<22; i++ ){
    res += ABC[(Math.floor(Math.random() * ABC.length))];
  }
  return res;
};
const createFanoutExchange = () => {
  const bindings = [];
  return {
    bindQueue: (queueName, pattern, options) => {
      bindings.push({
        targetQueue: queueName,
        options,
        pattern
      });
    },
    getTargetQueues: (routingKey, options = {}) => {
      return [...bindings.map(binding => binding.targetQueue)];
    }
  };
};
const createDirectExchange = () => {
  const bindings = [];
  return {
    bindQueue: (queueName, pattern, options) => {
      bindings.push({
        targetQueue: queueName,
        options,
        pattern
      });
    },
    getTargetQueues: (routingKey, options = {}) => {
      const matchingBinding = bindings.find(binding => binding.pattern === routingKey);
      return [matchingBinding.targetQueue];
    }
  };
};
const createHeadersExchange = () => {
  const bindings = [];
  return {
    bindQueue: (queueName, pattern, options) => {
      bindings.push({
        targetQueue: queueName,
        options,
        pattern
      });
    },
    getTargetQueues: (routingKey, options:any = {}) => {
      const isMatching = (binding, headers) =>
        Object.keys(binding.options).every(key => binding.options[key] === headers[key]);
      const matchingBinding = bindings.find(binding => isMatching(binding, options?.headers || {}));
      return [matchingBinding.targetQueue];
    }
  };
};


export class FakeAmqp {
  public connection: Connection | undefined;
  public url: string | undefined;
  public failConnections = false;
  public deadServers: string[] = [];
  public connect: (url: string) => Promise<Connection> = async () => {
    throw new Error('Not setup');
  };

  constructor() {
    this.reset();
  }

  kill() {
    const err = new Error('Died in a fire');
    this.connection?.emit('error', err);
    this.connection?.emit('close', err);
  }

  simulateRemoteClose() {
    this.connection?.emit('close', new Error('Connection closed'));
  }

  simulateRemoteBlock() {
    this.connection?.emit('blocked', new Error('Connection blocked'));
  }

  simulateRemoteUnblock() {
    this.connection?.emit('unblocked');
  }

  reset() {
    this.connection = undefined;
    this.url = undefined;
    this.failConnections = false;
    this.deadServers = [];
    this.connect = jest.fn().mockImplementation((url) => {
      if (this.failConnections) {
        return Promise.reject(new Error('No'));
      }

      let allowConnection = true;
      this.deadServers.forEach((deadUrl) => {
        if (url.startsWith(deadUrl)) {
          allowConnection = false;
        }
      });
      if (!allowConnection) {
        return Promise.reject(new Error(`Dead server ${url}`));
      }

      const connection = (this.connection = new exports.FakeConnection(url));

      return Promise.resolve(connection);
    });
  }
}
export class FakeChannel extends EventEmitter {
  publish = jest
    .fn()
    .mockImplementation(
      (
        _exchange: string,
        _routingKey: string,
        content: Buffer,
        _options?: Options.Publish,
      ): boolean => {

        this.emit('publish', content);
        const exchange = exchanges[_exchange];
        const queueNames = exchange.getTargetQueues(_routingKey, _options);
        const message = {
          content,
          fields: {
            exchange: _exchange,
            _routingKey
          },
          properties: _options
        };

        for(const queueName of queueNames) {
          queues[queueName].add(message);
        }

        return true;
      },
    );

  sendToQueue = jest
    .fn()
    .mockImplementation(
      (
        _queue: string,
        content: Buffer,
        _options?: Options.Publish,
      ): boolean => {
        this.emit('sendToQueue', content);

        queues[_queue].add({
          content,
          fields: {
            exchange: '',
            routingKey: _queue
          },
          properties: { headers: _options?.headers || {} }
        });

        return true;
      },
    );

  ack = jest
    .fn()
    .mockImplementation(function (
      _message: Message,
      _allUpTo?: boolean,
    ): void {});

  ackAll = jest.fn().mockImplementation(function (): void {});

  nack = jest
    .fn()
    .mockImplementation(function (
      _message: Message,
      _allUpTo?: boolean,
      _requeue?: boolean,
    ): void {
      if (_requeue) {

        queues[_message.fields.routingKey].add(_message);
      }
    });

  nackAll = jest
    .fn()
    .mockImplementation(function (_requeue?: boolean): void {});

  assertQueue = jest
    .fn()
    .mockImplementation(async function (
      queue: string,
      _options?: Options.AssertQueue,
    ): Promise<Replies.AssertQueue> {
      if (!queue) {
        queue = generateRandomQueueName();
      }
      queues[queue] = createQueue();

      return {
        queue,
        messageCount: 0,
        consumerCount: 0,
      };
    });

  checkQueue = jest
    .fn()
    .mockImplementation(async function (
      _queue: string,
    ): Promise<Replies.Empty> {

      return {};
      return {
        queue: _queue,
        messageCount: queues[_queue].getMessageCount()
      };
    });

  bindQueue = jest
    .fn()
    .mockImplementation(async function (
      _queue: string,
      _source: string,
      _pattern: string,
      _args?: any,
    ): Promise<Replies.Empty> {
      const exchange = exchanges[_source];
      exchange?.bindQueue(_queue, _pattern, _args);

      return {};
    });

  assertExchange = jest
    .fn()
    .mockImplementation(async function (
      exchangeName: string,
      _type: 'direct' | 'topic' | 'headers' | 'fanout' | 'match' | string,
      _options?: Options.AssertExchange,
    ): Promise<Replies.AssertExchange> {

      let exchange;

      switch(_type) {
        case 'fanout':
          exchange = createFanoutExchange();
          break;
        case 'topic':
        case 'direct':
        case 'x-delayed-message':
          exchange = createDirectExchange();
          break;
        case 'headers':
          exchange = createHeadersExchange();
          break;
      }

      exchanges[exchangeName] = exchange;

      return { exchange: exchangeName };
    });

  bindExchange = jest
    .fn()
    .mockImplementation(async function (
      _destination: string,
      _source: string,
      _pattern: string,
      _args?: any,
    ): Promise<Replies.Empty> {
      return {};
    });

  checkExchange = jest
    .fn()
    .mockImplementation(async function (
      _exchange: string,
    ): Promise<Replies.Empty> {
      return {};
    });

  deleteExchange = jest
    .fn()
    .mockImplementation(async function (
      _exchange: string,
      _options?: Options.DeleteExchange,
    ): Promise<Replies.Empty> {
      return {};
    });

  unbindExchange = jest
    .fn()
    .mockImplementation(async function (
      _destination: string,
      _source: string,
      _pattern: string,
      _args?: any,
    ): Promise<Replies.Empty> {
      return {};
    });

  close = jest.fn().mockImplementation(async (): Promise<void> => {
    this.emit('close');
  });

  consume = jest
    .fn()
    .mockImplementation(
      async (queueName, consumer): Promise<Replies.Consume> => {
        queues[queueName]?.addConsumer(consumer);
        return { consumerTag: queueName };
      },
    );

  prefetch = jest
    .fn()
    .mockImplementation((_prefetch: number, _isGlobal: boolean): void => {});
}



export class FakeConfirmChannel extends FakeChannel {
  publish = jest
    .fn()
    .mockImplementation(
      (
        _exchange: string,
        _routingKey: string,
        content: Buffer,
        _options?: Options.Publish,
        callback?: (err: any, ok: Replies.Empty) => void,
      ): boolean => {

        this.emit('publish', content);
        const exchange = exchanges[_exchange];
        const queueNames = exchange.getTargetQueues(_routingKey, _options);
        const message = {
          content,
          fields: {
            exchange: _exchange,
            routingKey: _routingKey
          },
          properties: _options
        };

        for(const queueName of queueNames) {
          queues[queueName].add(message);
        }

        callback?.(null, {});
        return true;
      },
    );

  sendToQueue = jest
    .fn()
    .mockImplementation(
      (
        _queue: string,
        content: Buffer,
        _options?: Options.Publish,
        callback?: (err: any, ok: Replies.Empty) => void,
      ): boolean => {
        this.emit('sendToQueue', content);
        callback?.(null, {});
        return true;
      },
    );
}
export class FakeConnection extends EventEmitter {
  url: string;
  _closed = false;

  constructor(url: string) {
    super();
    this.url = url;
    this._closed = false;
  }

  createChannel() {
    return Promise.resolve(new exports.FakeChannel());
  }

  createConfirmChannel() {
    return Promise.resolve(new exports.FakeConfirmChannel());
  }

  close() {
    this._closed = true;
    return Promise.resolve();
  }
}

export class FakeAmqpConnectionManager
  extends EventEmitter
  implements amqpcon.AmqpConnectionManager
{
  connected: boolean;
  private _connection: FakeConnection | undefined;

  heartbeatIntervalInSeconds = 5;
  reconnectTimeInSeconds = 10;

  constructor() {
    super();
    this.connected = false;
  }

  get connection() {
    return this._connection as any as Connection | undefined;
  }

  get channelCount(): number {
    return 0;
  }

  async connect(): Promise<void> {
    await Promise.all([once(this, 'connect'), this.simulateConnect()]);
  }

  reconnect(): void {
    this.simulateDisconnect();
    this.simulateConnect();
  }

  isConnected() {
    return this.connected;
  }

  createChannel(options?: amqpcon.CreateChannelOpts): amqpcon.ChannelWrapper {
    return new ChannelWrapper(this, options);
  }

  simulateConnect() {
    console.log('hertertert simulation');
    const url = 'amqp://localhost';
    this._connection = new exports.FakeConnection(url);
    this.connected = true;
    this.emit('connect', {
      connection: this.connection,
      url,
    });
  }

  simulateRemoteCloseEx(err: Error) {
    this.emit('disconnect', { err });
    this.emit('close', err);
  }

  simulateDisconnect() {
    this._connection = undefined;
    this.connected = false;
    this.emit('disconnect', {
      err: new Error('Boom!'),
    });
  }

  async close() {}
}
