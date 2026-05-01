import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EMAIL_QUEUE, NOTIFICATION_QUEUE } from './jobs.constants';

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notificationQueue: Queue,
  ) {}

  /**
   * Queues a welcome email for a new user
   * @param to - Recipient email
   * @param displayName - User's display name
   */
  async queueWelcomeEmail(to: string, displayName: string) {
    return this.emailQueue.add(
      'welcome',
      { to, displayName },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );
  }

  /**
   * Queues an issue assignment email notification
   * @param to - Recipient email
   * @param issueKey - e.g., "FT-42"
   * @param issueTitle - Issue title
   * @param projectName - Project name
   */
  async queueAssignmentEmail(to: string, issueKey: string, issueTitle: string, projectName: string) {
    return this.emailQueue.add(
      'assignment',
      { to, issueKey, issueTitle, projectName },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );
  }

  /**
   * Queues a push notification to be dispatched via WebSocket
   * @param userId - Recipient's user ID
   * @param notification - Notification payload
   */
  async queueRealtimeNotification(userId: string, notification: Record<string, any>) {
    return this.notificationQueue.add(
      'push',
      { userId, notification },
      { attempts: 2, removeOnComplete: true },
    );
  }
}
