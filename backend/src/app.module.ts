import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';
import appConfig from './config/app.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import mailConfig from './config/mail.config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './config/redis.module';
import { RichTextModule } from './common/services/rich-text.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { IssuesModule } from './modules/issues/issues.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { CommentsModule } from './modules/comments/comments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ActivityModule } from './modules/activity/activity.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { MailModule } from './modules/mail/mail.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, jwtConfig, redisConfig, mailConfig],
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            ttl: parseInt(process.env.THROTTLE_TTL ?? '60') * 1000,
            limit: parseInt(process.env.THROTTLE_LIMIT ?? '100'),
          },
        ],
      }),
    }),

    // Event emitter for domain events
    EventEmitterModule.forRoot({ wildcard: true }),

    // Core infrastructure
    PrismaModule,
    RedisModule,
    RichTextModule,

    // Feature modules
    AuthModule,
    UsersModule,
    ProjectsModule,
    IssuesModule,
    WorkflowModule,
    CommentsModule,
    NotificationsModule,
    ActivityModule,
    RealtimeModule,
    JobsModule,
    MailModule,
  ],
  providers: [
    // Global rate limit guard
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
