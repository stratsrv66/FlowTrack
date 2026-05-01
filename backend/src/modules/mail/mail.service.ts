import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.from = config.get<string>('mail.from', 'FlowTrack <noreply@flowtrack.app>');

    this.transporter = nodemailer.createTransport({
      host: config.get<string>('mail.host'),
      port: config.get<number>('mail.port'),
      secure: config.get<number>('mail.port') === 465,
      auth: {
        user: config.get<string>('mail.user'),
        pass: config.get<string>('mail.password'),
      },
    });
  }

  /**
   * Sends a welcome email to a newly registered user
   * @param to - Recipient email
   * @param displayName - User's display name
   */
  async sendWelcome(to: string, displayName: string): Promise<void> {
    await this.send({
      to,
      subject: 'Welcome to FlowTrack!',
      html: `
        <h2>Welcome, ${displayName}!</h2>
        <p>Your FlowTrack account has been created successfully.</p>
        <p>Start managing your projects at <a href="${this.config.get('app.frontendUrl')}">FlowTrack</a>.</p>
      `,
    });
  }

  /**
   * Sends an issue assignment notification email
   * @param to - Recipient email
   * @param issueKey - e.g., "FT-42"
   * @param issueTitle - Issue title
   * @param projectName - Project name
   */
  async sendAssignment(
    to: string,
    issueKey: string,
    issueTitle: string,
    projectName: string,
  ): Promise<void> {
    const url = `${this.config.get('app.frontendUrl')}/issues/${issueKey}`;
    await this.send({
      to,
      subject: `[${issueKey}] Assigned to you in ${projectName}`,
      html: `
        <h2>You have a new assignment</h2>
        <p><strong>${issueKey}:</strong> ${issueTitle}</p>
        <p>Project: <strong>${projectName}</strong></p>
        <a href="${url}">View Issue</a>
      `,
    });
  }

  private async send(options: { to: string; subject: string; html: string }) {
    try {
      await this.transporter.sendMail({ from: this.from, ...options });
    } catch (err) {
      // Log but never throw — email failures must not break core flows
      this.logger.error(`Failed to send email to ${options.to}: ${(err as Error).message}`);
    }
  }
}
