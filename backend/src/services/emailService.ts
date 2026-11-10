import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { getEnvConfig, SmtpConfig } from '../config/env';
import { DomainError } from '../types';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface IEmailTransport {
  sendMail(message: EmailMessage): Promise<void>;
}

/**
 * In-memory development email transport for local testing and automated verification.
 * Captures sent emails so tests can retrieve the generated OTP without leaking
 * secrets in production logs or public API responses.
 */
export class DevelopmentEmailTransport implements IEmailTransport {
  private sentMails: { to: string; subject: string; text: string; sentAt: Date; otp?: string }[] = [];

  public async sendMail(message: EmailMessage): Promise<void> {
    // Extract OTP if present (6 consecutive digits in text)
    const match = message.text.match(/\b\d{6}\b/);
    const otp = match ? match[0] : undefined;

    this.sentMails.push({
      to: message.to.toLowerCase(),
      subject: message.subject,
      text: message.text,
      sentAt: new Date(),
      otp,
    });

    // Safe sanitized logging without disclosing the raw OTP
    const maskedEmail = message.to.replace(/(?<=^.{2}).(?=.*@)/g, '*');
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[EmailTransport:DEV] Dispatched email to ${maskedEmail} | Subject: "${message.subject}"`);
    }
  }

  /**
   * Helper for automated test assertions to retrieve the latest dispatched OTP for an email.
   */
  public getLatestOtp(email: string): string | undefined {
    const clean = email.toLowerCase().trim();
    for (let i = this.sentMails.length - 1; i >= 0; i--) {
      if (this.sentMails[i].to === clean && this.sentMails[i].otp) {
        return this.sentMails[i].otp;
      }
    }
    return undefined;
  }

  public clear(): void {
    this.sentMails = [];
  }
}

/**
 * Real SMTP email transport for production and live email dispatch.
 * Sends OTP messages to real student mailboxes via configured SMTP server.
 */
export class SmtpEmailTransport implements IEmailTransport {
  private transporter: Transporter;
  private fromAddress: string;

  constructor(config: SmtpConfig, customTransporter?: Transporter) {
    if (!config.host && !customTransporter) {
      throw new DomainError(
        'INTERNAL_ERROR',
        500,
        'SMTP transport misconfiguration: SMTP_HOST is required.'
      );
    }

    this.fromAddress = config.from || 'Campus Duo IITK <noreply@campusduo.iitk.ac.in>';

    if (customTransporter) {
      this.transporter = customTransporter;
    } else {
      const auth = (config.user && config.pass)
        ? { user: config.user, pass: config.pass }
        : undefined;

      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });
    }
  }

  public async sendMail(message: EmailMessage): Promise<void> {
    const maskedEmail = message.to.replace(/(?<=^.{2}).(?=.*@)/g, '*');
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      if (process.env.NODE_ENV !== 'test') {
        console.log(`[EmailTransport:SMTP] Dispatched email to ${maskedEmail} | Subject: "${message.subject}"`);
      }
    } catch (err: any) {
      console.error(`[EmailTransport:SMTP] Failed to deliver email to ${maskedEmail}: ${err.message || err}`);
      throw new DomainError(
        'SERVICE_UNAVAILABLE',
        503,
        'Email delivery failed. The verification email could not be delivered to your inbox at this time. Please try again later.'
      );
    }
  }

  public getTransporter(): Transporter {
    return this.transporter;
  }
}

export class EmailService {
  private transport: IEmailTransport;

  constructor(transport?: IEmailTransport) {
    if (transport) {
      this.transport = transport;
      return;
    }

    const env = getEnvConfig();
        if (process.env.EMAIL_TRANSPORT === 'resend') {
      const apiKey = process.env.RESEND_API_KEY?.trim();
      const from = process.env.EMAIL_FROM?.trim();

      if (!apiKey || !from) {
        throw new Error('Resend requires RESEND_API_KEY and EMAIL_FROM.');
      }

      this.transport = {
        async sendMail(message: EmailMessage): Promise<void> {
          try {
            const response = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from,
                to: [message.to],
                subject: message.subject,
                text: message.text,
                html: message.html,
              }),
              signal: AbortSignal.timeout(10000),
            });

            if (response.ok) return;
            console.error(`[EmailTransport:Resend] Request failed with HTTP ${response.status}`);
          } catch {
            console.error('[EmailTransport:Resend] Could not reach Resend.');
          }

          throw new DomainError(
            'SERVICE_UNAVAILABLE',
            503,
            'Email delivery failed. Please try again later.'
          );
        },
      };
      return;
    }

    // 1. Explicit SMTP configuration or EMAIL_TRANSPORT=smtp
    if (env.emailTransport === 'smtp' || (env.smtp.host && env.emailTransport !== 'inmemory')) {
      if (!env.smtp.host) {
        throw new Error(
          'SMTP email transport requested (EMAIL_TRANSPORT=smtp) but SMTP_HOST is not configured in environment.'
        );
      }
      this.transport = new SmtpEmailTransport(env.smtp);
      return;
    }

    // 2. Production safety guard: In-memory transport is strictly forbidden in production
    if (env.nodeEnv === 'production') {
      throw new Error(
        'Production email transport not configured. In-memory DevelopmentEmailTransport is forbidden in production environments. Please configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.'
      );
    }

    // 3. Real delivery explicitly required in development/test
    if (env.emailDeliveryRequired) {
      throw new Error(
        'Real email delivery required (EMAIL_DELIVERY_REQUIRED=true) but no valid SMTP provider is configured.'
      );
    }

    // 4. Default for local testing and offline development
    this.transport = new DevelopmentEmailTransport();
    if (env.nodeEnv !== 'test') {
      console.warn(
        '[EmailService:WARN] Running with in-memory DevelopmentEmailTransport (SMTP_HOST is not set). OTPs will not reach actual mailboxes.'
      );
    }
  }

  public setTransport(transport: IEmailTransport): void {
    this.transport = transport;
  }

  public getTransport(): IEmailTransport {
    return this.transport;
  }

  public async sendOtpChallenge(email: string, otp: string, purpose: 'REGISTRATION' | 'LOGIN'): Promise<void> {
    const subject = purpose === 'REGISTRATION'
      ? 'Campus Duo — Your Registration Verification Code'
      : 'Campus Duo — Your Login Verification Code';

    const text = `Hello,

Your 6-digit Campus Duo email ownership verification code is: ${otp}

This code will expire in 10 minutes. If you did not request this verification code, please ignore this message.

— Campus Duo IIT Kanpur Team`;

    await this.transport.sendMail({
      to: email,
      subject,
      text,
    });
  }
}

export const defaultEmailService = new EmailService();
