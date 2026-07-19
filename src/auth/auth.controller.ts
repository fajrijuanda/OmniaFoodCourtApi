import { Body, Controller, Get, Post, Query, Redirect, Req, Request, UseGuards } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import type { Request as ExpressRequest } from "express";
import { getRequestMeta } from "../common/request-meta";
import { AuthService } from "./auth.service";
import { encodeOAuthState } from "./oauth-state";
import { GithubOAuthGuard, GoogleOAuthGuard } from "./oauth.guard";

class LoginDto {
  @Transform(({ value }) => String(value ?? "").trim().toLowerCase())
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;
}

class RegisterTrialDto {
  @Transform(({ value }) => String(value ?? "").trim())
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @Transform(({ value }) => String(value ?? "").trim().toLowerCase())
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @Transform(({ value }) => String(value ?? "").trim())
  @IsOptional()
  @IsString()
  @Matches(/^(\+62|62|0)8[1-9][0-9]{6,11}$/)
  phoneNumber?: string;

  @IsString()
  @MaxLength(80)
  subIndustryId!: string;

  @IsString()
  @MaxLength(80)
  otpChallengeId!: string;

  @IsString()
  @Matches(/^[0-9]{6}$/)
  otpCode!: string;

  @IsOptional()
  @IsString()
  @MinLength(0)
  @MaxLength(4096)
  turnstileToken?: string;
}

class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

class RequestOtpDto {
  @Transform(({ value }) => String(value ?? "").trim().toLowerCase())
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  turnstileToken!: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("otp/request")
  @Throttle({ default: { limit: 3, ttl: 600000 } })
  requestOtp(@Body() body: RequestOtpDto, @Req() request: ExpressRequest) {
    return this.authService.requestRegisterOtp(body.email, body.turnstileToken, getRequestMeta(request));
  }

  @Post("register")
  @Throttle({ default: { limit: 5, ttl: 600000 } })
  register(@Body() body: RegisterTrialDto, @Req() request: ExpressRequest) {
    return this.authService.registerTrial(body, getRequestMeta(request));
  }

  @Post("login")
  @Throttle({ default: { limit: 10, ttl: 600000 } })
  login(@Body() body: LoginDto, @Req() request: ExpressRequest) {
    return this.authService.login(body.email, body.password, getRequestMeta(request));
  }

  @UseGuards(AuthGuard("jwt"))
  @Post("change-password")
  changePassword(@Request() request: { user: any }, @Body() body: ChangePasswordDto) {
    return this.authService.changePassword(request.user.id, body.currentPassword, body.newPassword);
  }

  @UseGuards(AuthGuard("jwt"))
  @Post("logout")
  logout(@Request() request: { user: any }) {
    return this.authService.logout(request.user.id);
  }

  @Get("google")
  @UseGuards(GoogleOAuthGuard)
  google(@Query("subIndustryId") _subIndustryId?: string) {
    return;
  }

  @Get("google/start")
  @Redirect()
  googleStart(@Query("subIndustryId") subIndustryId?: string) {
    const state = encodeOAuthState({ subIndustryId });
    return { url: `/api/auth/google?state=${encodeURIComponent(state)}` };
  }

  @Get("google/callback")
  @UseGuards(GoogleOAuthGuard)
  googleCallback(@Request() request: { user: OAuthProfile }) {
    return this.authService.handleOAuthLogin(request.user);
  }

  @Get("github")
  @UseGuards(GithubOAuthGuard)
  github() {
    return;
  }

  @Get("github/start")
  @Redirect()
  githubStart(@Query("subIndustryId") subIndustryId?: string) {
    const state = encodeOAuthState({ subIndustryId });
    return { url: `/api/auth/github?state=${encodeURIComponent(state)}` };
  }

  @Get("github/callback")
  @UseGuards(GithubOAuthGuard)
  githubCallback(@Request() request: { user: OAuthProfile }) {
    return this.authService.handleOAuthLogin(request.user);
  }

  @UseGuards(AuthGuard("jwt"))
  @Get("me")
  me(@Request() request: { user: unknown }) {
    return request.user;
  }

  @Get("debug/db")
  async debugDb() {
    try {
      const count = await this.authService.countUsers();
      return { success: true, count };
    } catch (e: any) {
      return {
        success: false,
        errorName: e?.name,
        errorMessage: e?.message,
        errorStack: e?.stack
      };
    }
  }
}

type OAuthProfile = {
  provider: "google" | "github";
  providerId: string;
  email?: string;
  name: string;
  state?: string;
};
