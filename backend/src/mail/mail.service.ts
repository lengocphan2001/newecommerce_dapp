import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

@Injectable()
export class MailService {
  private transporter: Transporter | null = null;
  private from: string = '';
  private enabled: boolean = false;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    this.from = this.configService.get<string>('SMTP_FROM') || user || 'noreply@localhost';

    if (host && user && pass) {
      this.enabled = true;
      this.transporter = nodemailer.createTransport({
        host,
        port: port ?? 587,
        secure: port === 465,
        auth: { user, pass },
      });
    }
  }

  isEnabled(): boolean {
    return this.enabled && this.transporter !== null;
  }

  async send(options: SendMailOptions): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html ?? options.text,
      });
      return true;
    } catch (err) {
      console.error('[MailService] send error:', err);
      return false;
    }
  }

  async sendVerificationCode(to: string, code: string, expiresInMinutes: number = 10): Promise<boolean> {
    const subject = 'Mã xác thực email - Email Verification Code';
    const text = `Mã xác thực của bạn là: ${code}. Mã có hiệu lực ${expiresInMinutes} phút. / Your verification code is: ${code}. It expires in ${expiresInMinutes} minutes.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #333;">Mã xác thực email</h2>
        <p style="font-size: 24px; letter-spacing: 4px; font-weight: bold; color: #7c3aed;">${code}</p>
        <p style="color: #666;">Mã có hiệu lực <strong>${expiresInMinutes} phút</strong>. Không chia sẻ mã này với bất kỳ ai.</p>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <h2 style="color: #333;">Email Verification Code</h2>
        <p style="font-size: 24px; letter-spacing: 4px; font-weight: bold; color: #7c3aed;">${code}</p>
        <p style="color: #666;">This code expires in <strong>${expiresInMinutes} minutes</strong>. Do not share it with anyone.</p>
      </div>
    `;
    return this.send({ to, subject, text, html });
  }
}
