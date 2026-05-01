import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EMAIL_QUEUE } from '../jobs.constants';
import { MailService } from '../../mail/mail.service';

@Processor(EMAIL_QUEUE)
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly mailService: MailService) {}

  /** Processes welcome email jobs */
  @Process('welcome')
  async handleWelcome(job: Job<{ to: string; displayName: string }>) {
    this.logger.debug(`Sending welcome email to ${job.data.to}`);
    await this.mailService.sendWelcome(job.data.to, job.data.displayName);
  }

  /** Processes issue assignment email jobs */
  @Process('assignment')
  async handleAssignment(
    job: Job<{ to: string; issueKey: string; issueTitle: string; projectName: string }>,
  ) {
    this.logger.debug(`Sending assignment email to ${job.data.to}`);
    await this.mailService.sendAssignment(
      job.data.to,
      job.data.issueKey,
      job.data.issueTitle,
      job.data.projectName,
    );
  }
}
