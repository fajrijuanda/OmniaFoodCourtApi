import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Profile, Strategy } from "passport-github2";

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, "github") {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>("GITHUB_CLIENT_ID") || "dummy",
      clientSecret: config.get<string>("GITHUB_CLIENT_SECRET") || "dummy",
      callbackURL: config.get<string>("GITHUB_CALLBACK_URL") ?? "http://localhost:4000/api/auth/github/callback",
      scope: ["user:email"],
      passReqToCallback: true
    });
  }

  validate(request: { query?: { state?: string } }, _accessToken: string, _refreshToken: string, profile: Profile, done: (error: unknown, user?: unknown) => void) {
    const email = profile.emails?.[0]?.value;
    done(null, {
      provider: "github",
      providerId: profile.id,
      email,
      name: profile.displayName || profile.username || email || "GitHub User",
      state: request.query?.state
    });
  }
}
