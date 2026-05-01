import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { EmailProcessor } from './processors/email.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { JobsService } from './jobs.service';
import { MailModule } from '../mail/mail.module';
import { EMAIL_QUEUE, NOTIFICATION_QUEUE } from './jobs.constants';

export { EMAIL_QUEUE, NOTIFICATION_QUEUE } from './jobs.constants';

@Module({
  imports: [
    MailModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('redis.host', 'localhost'),
          port: config.get<number>('redis.port', 6379),
          password: config.get<string>('redis.password') || undefined,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: EMAIL_QUEUE },
      { name: NOTIFICATION_QUEUE },
    ),
  ],
  providers: [EmailProcessor, NotificationProcessor, JobsService],
  exports: [BullModule, JobsService],
})
export class JobsModule {}
