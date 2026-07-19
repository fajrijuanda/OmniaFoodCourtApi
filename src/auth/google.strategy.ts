import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Profile, Strategy, VerifyCallback } from "passport-google-oauth20";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>("GOOGLE_CLIENT_ID") || "dummy",
      clientSecret: config.get<string>("GOOGLE_CLIENT_SECRET") || "dummy",
      callbackURL: config.get<string>("GOOGLE_CALLBACK_URL") ?? "http://localhost:4000/api/auth/google/callback",
      scope: ["email", "profile"],
      passReqToCallback: true
    });
  }

  validate(request: { query?: { state?: string } }, _accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback) {
    const email = profile.emails?.[0]?.value;
    done(null, {
      provider: "google",
      providerId: profile.id,
      email,
      name: profile.displayName || email || "Google User",
      state: request.query?.state
    });
  }
}
