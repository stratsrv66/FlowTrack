import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAdapter } from '@socket.io/redis-adapter';
import { ServerOptions } from 'socket.io';
import Redis from 'ioredis';

/** Custom Socket.IO adapter that attaches a Redis pub/sub adapter for horizontal scaling */
export class RedisIoAdapter extends IoAdapter {
  private readonly pubClient: Redis;
  private readonly subClient: Redis;

  constructor(app: INestApplication) {
    super(app);
    const config = app.get(ConfigService);
    const options = {
      host: config.get<string>('redis.host', 'localhost'),
      port: config.get<number>('redis.port', 6379),
      password: config.get<string>('redis.password') || undefined,
      lazyConnect: true,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
    };
    this.pubClient = new Redis(options);
    this.subClient = this.pubClient.duplicate();
  }

  /** Creates the Socket.IO server and attaches the Redis adapter before any connections */
  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    server.adapter(createAdapter(this.pubClient, this.subClient));
    return server;
  }
}
