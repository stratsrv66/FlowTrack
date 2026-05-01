import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        stores: [
          createKeyv(`redis://${config.get('redis.host')}:${config.get('redis.port')}`),
        ],
        ttl: config.get<number>('redis.ttl', 3600) * 1000,
      }),
    }),
  ],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis({
          host: config.get<string>('redis.host', 'localhost'),
          port: config.get<number>('redis.port', 6379),
          password: config.get<string>('redis.password') || undefined,
          lazyConnect: true,
          retryStrategy: (times) => Math.min(times * 50, 2000),
        }),
    },
  ],
  exports: [CacheModule, REDIS_CLIENT],
})
export class RedisModule {}
