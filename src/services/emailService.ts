import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    try {
      const smtpHost = process.env['SMTP_HOST'];
      const smtpPort = process.env['SMTP_PORT'];
      const smtpUser = process.env['SMTP_USER'];
      const smtpPass = process.env['SMTP_PASS'];

      if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
        logger.warn('⚠️ SMTP configuration incomplete - Email service disabled');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: false, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      logger.info('✅ Email service initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize email service:', error);
      this.transporter = null;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      logger.error('Email service not available - transporter not initialized');
      return false;
    }

    try {
      const fromEmail = process.env['FROM_EMAIL'] || process.env['SMTP_USER'];
      
      const mailOptions = {
        from: `"ÉBENOR CRÉATION" <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`✅ Email sent successfully: ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error('❌ Failed to send email:', error);
      return false;
    }
  }

  async sendReplyEmail(to: string, subject: string, originalMessage: string, replyText: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #C9A14A; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">ÉBENOR CRÉATION</h1>
        </div>
        
        <div style="padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 20px; border-radius: 8px;">
            ${replyText.split('\n').map(line => `<p>${line}</p>`).join('')}
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #f5f5f5; border-left: 4px solid #C9A14A;">
            <p style="margin: 0; color: #666; font-size: 12px;"><strong>Message original :</strong></p>
            <p style="margin: 10px 0 0 0; color: #666;">${originalMessage}</p>
          </div>
        </div>
        
        <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
          <p>ÉBENOR CRÉATION - Ébénisterie de qualité</p>
          <p style="margin: 5px 0;">📧 ${process.env['FROM_EMAIL']} | 📱 ${process.env['WHATSAPP_NUMBER'] || '+216 XX XXX XXX'}</p>
        </div>
      </div>
    `;

    const text = `${replyText}\n\n---\nMessage original :\n${originalMessage}`;

    return this.sendEmail({
      to,
      subject,
      text,
      html,
    });
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      logger.info('✅ Email service connection verified');
      return true;
    } catch (error) {
      logger.error('❌ Email service connection failed:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
