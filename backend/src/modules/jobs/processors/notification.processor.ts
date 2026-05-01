import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NOTIFICATION_QUEUE } from '../jobs.constants';

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly events: EventEmitter2) {}

  /** Dispatches realtime notification via the event system → WebSocket gateway */
  @Process('push')
  async handlePush(job: Job<{ userId: string; notification: any }>) {
    this.logger.debug(`Pushing notification to user ${job.data.userId}`);
    this.events.emit('notification.created', {
      userId: job.data.userId,
      notification: job.data.notification,
    });
  }
}
