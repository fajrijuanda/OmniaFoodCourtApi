import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const PREFIX = "v1:";

@Injectable()
export class EncryptionService {
  constructor(private readonly config: ConfigService) {}

  encrypt(value: string | null | undefined) {
    if (value === null || value === undefined || value === "") return value ?? null;
    if (value.startsWith(PREFIX)) return value;

    const key = this.getKey();
    if (!key) return value;

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
  }

  decrypt(value: string | null | undefined) {
    if (value === null || value === undefined || value === "") return value ?? null;
    if (!value.startsWith(PREFIX)) return value;

    const key = this.getKey();
    if (!key) return value;

    const [ivText, tagText, ciphertextText] = value.slice(PREFIX.length).split(":");
    if (!ivText || !tagText || !ciphertextText) return value;

    try {
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64url"));
      decipher.setAuthTag(Buffer.from(tagText, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextText, "base64url")),
        decipher.final()
      ]).toString("utf8");
    } catch {
      return value;
    }
  }

  private getKey() {
    const raw = this.config.get<string>("FIELD_ENCRYPTION_KEY");
    if (!raw) return null;
    const key = Buffer.from(raw, "base64");
    if (key.length !== 32) return null;
    return key;
  }
}
