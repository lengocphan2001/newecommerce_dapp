import { Injectable, OnModuleDestroy } from '@nestjs/common';
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
export class MailService implements OnModuleDestroy {
  private transporter: Transporter | null = null;
  private from: string = '';
  private enabled: boolean = false;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    this.from =
      this.configService.get<string>('SMTP_FROM') ||
      user ||
      'noreply@localhost';

    if (host && user && pass) {
      this.enabled = true;
      this.transporter = nodemailer.createTransport({
        host,
        port: port ?? 587,
        secure: port === 465,
        auth: { user, pass },
        // Pool: dùng chung kết nối SMTP, chỉ auth MỘT LẦN
        // → tránh lỗi "Too many login attempts" khi gửi bulk email
        pool: true,
        maxConnections: 2,
        maxMessages: Infinity,
        // Rate limit: tối đa 3 email/giây — Gmail cho phép ~100/phút
        rateDelta: 1000,
        rateLimit: 3,
      });
    }
  }

  /** Đóng pool kết nối SMTP khi ứng dụng shutdown. */
  onModuleDestroy() {
    if (this.transporter) {
      this.transporter.close();
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

  async sendVerificationCode(
    to: string,
    code: string,
    expiresInMinutes: number = 10,
  ): Promise<boolean> {
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

  /** Gửi thông tin đăng nhập (username + password) mới do admin tạo. */
  async sendLoginCredentials(
    to: string,
    username: string,
    password: string,
  ): Promise<boolean> {
    const subject = 'Thông tin đăng nhập của bạn - Your Login Credentials';
    const text = `Tên đăng nhập: ${username}\nMật khẩu: ${password}\nVui lòng đăng nhập và đổi mật khẩu ngay sau khi nhận được email này.\n\nUsername: ${username}\nPassword: ${password}\nPlease log in and change your password immediately.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background: #7c3aed; padding: 24px 32px;">
          <h2 style="color: #fff; margin: 0; font-size: 20px;">Thông tin đăng nhập</h2>
        </div>
        <div style="padding: 24px 32px;">
          <p style="color: #374151; margin-bottom: 20px;">
            Quản trị viên đã cấp tài khoản đăng nhập cho bạn. Vui lòng sử dụng thông tin dưới đây để đăng nhập và <strong>đổi mật khẩu ngay sau khi đăng nhập lần đầu</strong>.
          </p>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 10px 16px; background: #f3f4f6; border-radius: 4px; font-weight: bold; color: #374151; width: 140px;">Tên đăng nhập</td>
              <td style="padding: 10px 16px; font-size: 18px; font-weight: bold; color: #7c3aed; letter-spacing: 1px;">${username}</td>
            </tr>
            <tr>
              <td style="padding: 10px 16px; background: #f3f4f6; border-radius: 4px; font-weight: bold; color: #374151;">Mật khẩu</td>
              <td style="padding: 10px 16px; font-size: 18px; font-weight: bold; color: #7c3aed; letter-spacing: 2px;">${password}</td>
            </tr>
          </table>
          <p style="color: #ef4444; font-size: 13px;">⚠️ Không chia sẻ thông tin này với bất kỳ ai. Do not share these credentials with anyone.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <h3 style="color: #374151; font-size: 16px;">Your Login Credentials</h3>
          <p style="color: #6b7280; font-size: 14px;">An administrator has set up your account. Use the credentials above to log in and <strong>change your password immediately</strong>.</p>
        </div>
      </div>
    `;
    return this.send({ to, subject, text, html });
  }

  /** Mã OTP đăng nhập (Web2 username/password). */
  async sendLoginOtpCode(
    to: string,
    code: string,
    expiresInMinutes: number = 10,
  ): Promise<boolean> {
    const subject = 'Mã đăng nhập - Login code';
    const text = `Mã đăng nhập của bạn là: ${code}. Mã có hiệu lực ${expiresInMinutes} phút. Không chia sẻ mã này. / Your login code is: ${code}. It expires in ${expiresInMinutes} minutes. Do not share this code.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #333;">Mã đăng nhập</h2>
        <p style="font-size: 24px; letter-spacing: 4px; font-weight: bold; color: #7c3aed;">${code}</p>
        <p style="color: #666;">Mã có hiệu lực <strong>${expiresInMinutes} phút</strong>. Không chia sẻ mã này với bất kỳ ai.</p>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <h2 style="color: #333;">Login code</h2>
        <p style="font-size: 24px; letter-spacing: 4px; font-weight: bold; color: #7c3aed;">${code}</p>
        <p style="color: #666;">This code expires in <strong>${expiresInMinutes} minutes</strong>. Do not share it with anyone.</p>
      </div>
    `;
    return this.send({ to, subject, text, html });
  }
}
