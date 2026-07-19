import { Global, Module } from "@nestjs/common";
import { EncryptionService } from "./encryption.service";
import { TurnstileService } from "./turnstile.service";
import { EmailOtpService } from "./email-otp.service";

@Global()
@Module({
  providers: [EncryptionService, TurnstileService, EmailOtpService],
  exports: [EncryptionService, TurnstileService, EmailOtpService]
})
export class SecurityModule {}
