export const QUEUE_NAME = 'my-queue'
export const RABBITMQ_EXCHANGE_CONFIG = {
  DELAY_EXCHANGE_NAME : 'exchange1'
};

 const ASYNC_QUEUE = `${process.env.NODE_ENV}-${QUEUE_NAME}`;