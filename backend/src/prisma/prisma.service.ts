import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
        ...(process.env.NODE_ENV === 'development'
          ? [{ level: 'query' as const, emit: 'event' as const }]
          : []),
      ],
    });
  }

  async onModuleInit() {
    // Log slow queries in development
    if (process.env.NODE_ENV === 'development') {
      (this as any).$on('query', (e: any) => {
        if (e.duration > 100) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
        }
      });
    }

    (this as any).$on('error', (e: any) => {
      this.logger.error(`Prisma error: ${e.message}`);
    });

    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** Soft-delete helper: sets deletedAt to now */
  async softDelete(model: string, id: string) {
    return (this as any)[model].update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
