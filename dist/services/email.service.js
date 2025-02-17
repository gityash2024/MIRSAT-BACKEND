"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const logger_1 = require("../utils/logger");
class EmailService {
    constructor() {
        this.transporter = nodemailer_1.default.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }
    async sendEmail(to, subject, html) {
        try {
            const mailOptions = {
                from: process.env.SMTP_FROM,
                to,
                subject,
                html,
            };
            await this.transporter.sendMail(mailOptions);
            logger_1.logger.info(`Email sent successfully to ${to}`);
        }
        catch (error) {
            logger_1.logger.error('Error sending email:', error);
            throw new Error('Failed to send email');
        }
    }
    async sendPasswordResetEmail(to, resetToken) {
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
    async sendWelcomeEmail(to, name) {
        const html = `
      <h1>Welcome to MIRSAT</h1>
      <p>Dear ${name},</p>
      <p>Welcome to MIRSAT. Your account has been successfully created.</p>
      <p>You can now log in to your account and start using our services.</p>
    `;
        await this.sendEmail(to, 'Welcome to MIRSAT', html);
    }
}
exports.emailService = new EmailService();
//# sourceMappingURL=email.service.js.map