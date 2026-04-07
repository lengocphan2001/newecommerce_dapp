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

interface SmtpAccount {
  transporter: Transporter;
  from: string;
  user: string;
}

@Injectable()
export class MailService implements OnModuleDestroy {
  /** Danh sách các SMTP account (tối đa 3). */
  private accounts: SmtpAccount[] = [];
  /**
   * Chỉ bộ SMTP_USER / SMTP_PASS / SMTP_FROM (slot đầu env).
   * Dùng cho mail nhạy cảm (mật khẩu do admin tạo) — không round-robin, không fallback sang _2/_3.
   */
  private primarySmtpAccount: SmtpAccount | null = null;
  /** Con trỏ round-robin — tăng mỗi lần gửi để chia đều tải. */
  private rrIndex = 0;

  constructor(private configService: ConfigService) {
    // Đọc tối đa 3 bộ SMTP credentials từ env
    // Account 1: SMTP_USER / SMTP_PASS / SMTP_FROM
    // Account 2: SMTP_USER_2 / SMTP_PASS_2 / SMTP_FROM_2
    // Account 3: SMTP_USER_3 / SMTP_PASS_3 / SMTP_FROM_3
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT') ?? 587;
    const secure = port === 465;

    const slots = [
      {
        user: this.configService.get<string>('SMTP_USER') ?? '',
        pass: this.configService.get<string>('SMTP_PASS') ?? '',
        from: this.configService.get<string>('SMTP_FROM') ?? '',
      },
      {
        user: this.configService.get<string>('SMTP_USER_2') ?? '',
        pass: this.configService.get<string>('SMTP_PASS_2') ?? '',
        from: this.configService.get<string>('SMTP_FROM_2') ?? '',
      },
      {
        user: this.configService.get<string>('SMTP_USER_3') ?? '',
        pass: this.configService.get<string>('SMTP_PASS_3') ?? '',
        from: this.configService.get<string>('SMTP_FROM_3') ?? '',
      },
    ];

    for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
      const slot = slots[slotIndex];
      if (!host || !slot.user || !slot.pass) continue;
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user: slot.user, pass: slot.pass },
        // Pool: 1 connection per account → chỉ auth 1 lần, không spam AUTH
        pool: true,
        maxConnections: 1,
        maxMessages: Infinity,
        // Mỗi account gửi tối đa 2 email/giây
        rateDelta: 1000,
        rateLimit: 2,
      });
      const account: SmtpAccount = {
        transporter,
        from: slot.from || slot.user,
        user: slot.user,
      };
      this.accounts.push(account);
      if (slotIndex === 0) {
        this.primarySmtpAccount = account;
      }
    }

    if (this.accounts.length > 0) {
      const names = this.accounts.map((a) => a.user).join(', ');
      console.log(`[MailService] ${this.accounts.length} SMTP account(s) loaded: ${names}`);
    } else {
      console.warn('[MailService] No SMTP credentials configured — email disabled.');
    }
  }

  onModuleDestroy() {
    for (const acc of this.accounts) {
      acc.transporter.close();
    }
  }

  isEnabled(): boolean {
    return this.accounts.length > 0;
  }

  /** Có cấu hình đủ SMTP_USER (slot 1) để gửi mail chỉ định từ account đó. */
  isPrimarySmtpConfigured(): boolean {
    return this.primarySmtpAccount !== null;
  }

  /**
   * Gửi chỉ qua SMTP_USER — không dùng SMTP_USER_2 / _3.
   */
  private async sendViaPrimaryOnly(options: SendMailOptions): Promise<boolean> {
    const acc = this.primarySmtpAccount;
    if (!acc) {
      return false;
    }
    try {
      await acc.transporter.sendMail({
        from: acc.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html ?? options.text,
      });
      return true;
    } catch (err) {
      console.error('[MailService] send (SMTP_USER only):', err);
      return false;
    }
  }

  /**
   * Gửi email với round-robin qua các account.
   * Nếu account hiện tại bị EAUTH (block/rate-limit), tự động thử account tiếp theo.
   */
  async send(options: SendMailOptions): Promise<boolean> {
    if (this.accounts.length === 0) return false;

    const startIdx = this.rrIndex % this.accounts.length;
    this.rrIndex = (startIdx + 1) % this.accounts.length;

    for (let attempt = 0; attempt < this.accounts.length; attempt++) {
      const idx = (startIdx + attempt) % this.accounts.length;
      const { transporter, from } = this.accounts[idx];
      try {
        await transporter.sendMail({
          from,
          to: options.to,
          subject: options.subject,
          text: options.text,
          html: options.html ?? options.text,
        });
        return true;
      } catch (err: any) {
        // Nếu bị EAUTH (rate-limit / block) và còn account khác → fallback
        if (err?.code === 'EAUTH' && attempt < this.accounts.length - 1) {
          console.warn(
            `[MailService] Account ${idx + 1} (${this.accounts[idx].user}) bị EAUTH, thử account ${((idx + 1) % this.accounts.length) + 1}...`,
          );
          continue;
        }
        console.error(`[MailService] send error (account ${idx + 1}):`, err);
        return false;
      }
    }
    return false;
  }

  async sendVerificationCode(
    to: string,
    code: string,
    expiresInMinutes: number = 10,
  ): Promise<boolean> {
    const subject = '[2026] Mã xác thực email - Email Verification Code';
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
    const subject = '[2026] Thông tin đăng nhập của bạn - Your Login Credentials';
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
    return this.sendViaPrimaryOnly({ to, subject, text, html });
  }

  /** Mã OTP đăng nhập (Web2 username/password). */
  async sendLoginOtpCode(
    to: string,
    code: string,
    expiresInMinutes: number = 10,
  ): Promise<boolean> {
    const subject = '[2026] Mã đăng nhập - Login code';
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

  async sendPasswordResetLink(
    to: string,
    resetUrl: string,
    expiresInMinutes: number = 15,
  ): Promise<boolean> {
    const subject = '[2026] Password reset link';
    const text = `We received a password reset request for your account. Open this link to set a new password: ${resetUrl}\n\nThis link expires in ${expiresInMinutes} minutes. If you did not request this, you can ignore this email.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color: #333;">Reset your password</h2>
        <p style="color: #555;">
          We received a request to reset your password. Click the button below to continue.
        </p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="background: #7c3aed; color: #fff; text-decoration: none; padding: 12px 18px; border-radius: 8px; display: inline-block; font-weight: 600;">
            Reset password
          </a>
        </p>
        <p style="color: #666;">This link expires in <strong>${expiresInMinutes} minutes</strong> and can only be used once.</p>
        <p style="color: #666;">If you did not request this, you can ignore this email.</p>
      </div>
    `;
    return this.send({ to, subject, text, html });
  }
}
