import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

class EmailService {
  private transporter: nodemailer.Transporter;
  private emailEnabled: boolean;

  constructor() {
    // Check if email is enabled via environment variable
    this.emailEnabled = process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true';
    
    // Set up the transporter even if emails are disabled (to avoid errors)
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } catch (error) {
      logger.error('Failed to create email transporter:', error);
      this.emailEnabled = false;
    }
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    // Skip sending if emails are disabled
    if (!this.emailEnabled) {
      logger.info(`Email sending skipped (disabled): ${subject} to ${to}`);
      return;
    }

    try {
      const mailOptions = {
        from: process.env.SMTP_FROM,
        to,
        subject,
        html,
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${to}`);
    } catch (error) {
      logger.error('Error sending email:', error);
      // Log the error but don't throw it - this allows the application to continue
      logger.warn(`Failed to send email to ${to}, but continuing execution`);
    }
  }

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const html = `
      <h1>Password Reset Request</h1>
      <p>You requested a password reset. Click the link below to reset your password:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>If you didn't request this, please ignore this email.</p>
      <p>This link will expire in 1 hour.</p>
    `;

    await this.sendEmail(to, 'Password Reset Request', html);
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    const html = `
      <h1>Welcome to MIRSAT</h1>
      <p>Dear ${name},</p>
      <p>Welcome to MIRSAT. Your account has been successfully created.</p>
      <p>You can now log in to your account and start using our services.</p>
    `;

    await this.sendEmail(to, 'Welcome to MIRSAT', html);
  }
}

export const emailService = new EmailService();