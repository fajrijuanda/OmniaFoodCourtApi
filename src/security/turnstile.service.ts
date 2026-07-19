import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type TurnstileResponse = {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
};

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(private readonly config: ConfigService) {}

  async verify(token: string, remoteIp?: string) {
    const enabled = this.config.get<string>("TURNSTILE_ENABLED") !== "false";
    if (!enabled) return;

    const secret = this.config.get<string>("TURNSTILE_SECRET_KEY");
    if (!secret) {
      throw new BadRequestException("Konfigurasi anti-bot belum tersedia.");
    }
    if (!token || token.trim().length < 20) {
      throw new BadRequestException("Verifikasi anti-bot wajib diisi.");
    }

    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    if (remoteIp) form.set("remoteip", remoteIp);

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form
    });

    if (!response.ok) {
      this.logger.warn(`Turnstile verification failed with HTTP ${response.status}`);
      throw new BadRequestException("Verifikasi anti-bot gagal.");
    }

    const result = (await response.json()) as TurnstileResponse;
    if (!result.success) {
      this.logger.warn(`Turnstile rejected token: ${(result["error-codes"] ?? []).join(",")}`);
      throw new BadRequestException("Verifikasi anti-bot gagal.");
    }

    const allowedHostnames = (this.config.get<string>("TURNSTILE_ALLOWED_HOSTNAMES") ?? "")
      .split(",")
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean);

    if (allowedHostnames.length && result.hostname && !allowedHostnames.includes(result.hostname.toLowerCase())) {
      this.logger.warn(`Turnstile hostname mismatch: ${result.hostname}`);
      throw new BadRequestException("Verifikasi anti-bot tidak valid untuk domain ini.");
    }
  }
}
