import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";

@Injectable()
export class EmailOtpService {
  private readonly logger = new Logger(EmailOtpService.name);

  constructor(private readonly config: ConfigService) {}

  async sendOtp(email: string, code: string): Promise<void> {
    const enabled = this.config.get<string>("EMAIL_OTP_ENABLED") === "true";
    if (!enabled) {
      this.logger.warn(`EMAIL_OTP_ENABLED=false. OTP for ${email} is ${code}`);
      return;
    }

    const host = this.config.get<string>("SMTP_HOST");
    const user = this.config.get<string>("SMTP_USER");
    const pass = this.config.get<string>("SMTP_PASS");
    const port = Number(this.config.get<string>("SMTP_PORT") ?? 587);
    const secure = this.config.get<string>("SMTP_SECURE") === "true" || port === 465;
    const from = this.config.get<string>("SMTP_FROM") ?? (user ? `Omnia Digital <${user}>` : undefined);

    if (!host || !user || !pass || !from) {
      throw new Error("SMTP email OTP is enabled, but SMTP_HOST, SMTP_USER, SMTP_PASS, or SMTP_FROM is missing.");
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });

    await transporter.sendMail({
      from,
      to: email,
      subject: "Kode OTP registrasi Omnia",
      text: `Kode OTP registrasi Omnia kamu adalah ${code}. Kode ini akan kedaluwarsa dalam beberapa menit.`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #172033; line-height: 1.6;">
          <h2 style="margin: 0 0 12px;">Kode OTP registrasi Omnia</h2>
          <p>Gunakan kode berikut untuk melanjutkan registrasi:</p>
          <p style="font-size: 28px; font-weight: 800; letter-spacing: 6px; margin: 16px 0;">${code}</p>
          <p>Kode ini akan kedaluwarsa dalam beberapa menit. Abaikan email ini jika kamu tidak meminta OTP.</p>
        </div>
      `
    });
  }
}
