import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { TurnstileService } from "../security/turnstile.service";
import { EmailOtpService } from "../security/email-otp.service";
import { decodeOAuthState } from "./oauth-state";

type RegisterTrialInput = {
  name: string;
  email: string;
  password: string;
  phoneNumber?: string;
  subIndustryId: string;
  otpChallengeId: string;
  otpCode: string;
  turnstileToken?: string;
};

type RequestMeta = {
  ip?: string;
  userAgent?: string;
};

type OAuthProfile = {
  provider: "google" | "github";
  providerId: string;
  email?: string;
  name: string;
  state?: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly otpResendCooldownMs = 120 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly turnstile: TurnstileService,
    private readonly emailOtp: EmailOtpService
  ) {}

  countUsers() {
    return this.prisma.user.count();
  }

  async requestRegisterOtp(email: string, turnstileToken: string, meta?: RequestMeta) {
    await this.turnstile.verify(turnstileToken, meta?.ip);

    const targetEmail = email.toLowerCase();
    const recentChallenge = await this.prisma.otpChallenge.findFirst({
      where: {
        phoneNumber: targetEmail,
        purpose: "register",
        createdAt: { gt: new Date(Date.now() - this.otpResendCooldownMs) }
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true }
    });
    if (recentChallenge) {
      const elapsedMs = Date.now() - recentChallenge.createdAt.getTime();
      const retryAfterSeconds = Math.max(1, Math.ceil((this.otpResendCooldownMs - elapsedMs) / 1000));
      throw new HttpException({
        message: `Tunggu ${retryAfterSeconds} detik sebelum mengirim ulang OTP.`,
        retryAfterSeconds
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = this.generateOtpCode();
    const codeHash = await bcrypt.hash(code, 12);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const challenge = await this.prisma.otpChallenge.create({
      data: {
        phoneNumber: targetEmail,
        codeHash,
        purpose: "register",
        expiresAt,
        ip: meta?.ip,
        userAgent: meta?.userAgent?.slice(0, 240)
      },
      select: { id: true, expiresAt: true }
    });

    await this.emailOtp.sendOtp(targetEmail, code);
    return {
      challengeId: challenge.id,
      email: targetEmail,
      expiresAt: challenge.expiresAt,
      resendAfterSeconds: 120
    };
  }

  async login(email: string, password: string, meta?: RequestMeta) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        include: this.sessionInclude()
      });
      if (!user || user.status !== "active") {
        this.audit("login", email, "failed", meta);
        throw new UnauthorizedException("Email atau password tidak valid.");
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        this.audit("login", email, "failed", meta);
        throw new UnauthorizedException("Email atau password tidak valid.");
      }

      this.audit("login", email, "success", meta);
      return this.issueSession(user);
    } catch (error) {
      if (!(error instanceof UnauthorizedException)) this.audit("login", email, "failed", meta);
      throw error;
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (currentPassword === newPassword) {
      throw new BadRequestException("Password baru tidak boleh sama dengan password lama.");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: this.sessionInclude()
    });
    if (!user || user.status !== "active") {
      throw new UnauthorizedException("Session tidak valid.");
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException("Password lama tidak valid.");
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 12),
        mustChangePassword: false
      },
      include: this.sessionInclude()
    });

    return this.issueSession(updated);
  }

  async registerTrial(input: RegisterTrialInput, meta?: RequestMeta) {
    if (input.turnstileToken) await this.turnstile.verify(input.turnstileToken, meta?.ip);
    const email = input.email.toLowerCase();
    const phoneNumber = input.phoneNumber ? this.normalizePhoneNumber(input.phoneNumber) : undefined;
    await this.verifyRegisterOtp(input.otpChallengeId, email, input.otpCode);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      this.audit("register", email, "failed", meta);
      throw new ConflictException("Email sudah terdaftar. Silakan login.");
    }

    const starterTier = await this.findStarterTier(input.subIndustryId);
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    // Create User, Tenant, TenantUser, TenantSubscription in a transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          name: input.name,
          phoneNumber,
          passwordHash: await bcrypt.hash(input.password, 12),
          role: "owner",
          status: "active"
        }
      });

      const tenant = await tx.tenant.create({
        data: {
          name: `Workspace ${input.name}`
        }
      });

      const tenantUser = await tx.tenantUser.create({
        data: {
          userId: newUser.id,
          tenantId: tenant.id,
          role: "owner"
        }
      });

      const branch = await tx.tenantBranch.create({
        data: { tenantId: tenant.id, name: "Main Branch", code: "MAIN", status: "active" }
      });

      await tx.tenantUserBranch.create({
        data: { tenantUserId: tenantUser.id, branchId: branch.id }
      });

      await tx.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          subIndustryId: input.subIndustryId,
          tierId: starterTier.id,
          status: "trial",
          startedAt: now,
          currentPeriodEnd: trialEndsAt,
          price: 0
        }
      });

      return tx.user.findUniqueOrThrow({
        where: { id: newUser.id },
        include: this.sessionInclude()
      });
    });

    await this.prisma.otpChallenge.update({
      where: { id: input.otpChallengeId },
      data: { verifiedAt: now, consumedAt: now }
    });

    this.audit("register", email, "success", meta);
    return this.issueSession(user);
  }

  async handleOAuthLogin(profile: OAuthProfile) {
    if (!profile.email) {
      throw new BadRequestException("Akun OAuth tidak mengembalikan email publik.");
    }

    const email = profile.email.toLowerCase();
    const state = decodeOAuthState(profile.state);
    const existing = await this.prisma.user.findUnique({
      where: { email },
      include: this.sessionInclude()
    });
    
    const user = existing ?? await this.createOAuthUser(email, profile, state.subIndustryId);

    if (existing && (!existing.oauthProvider || !existing.oauthProviderId)) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: { oauthProvider: profile.provider, oauthProviderId: profile.providerId }
      });
    }

    const session = await this.issueSession(user);
    const portalUrl = this.config.get<string>("PORTAL_URL") ?? "http://localhost:3001";
    const redirectUrl = new URL("/oauth/callback", portalUrl);
    redirectUrl.searchParams.set("token", session.accessToken);
    redirectUrl.searchParams.set("user", Buffer.from(JSON.stringify(session.user), "utf8").toString("base64url"));
    return { url: redirectUrl.toString() };
  }

  private async createOAuthUser(email: string, profile: OAuthProfile, subIndustryId?: string) {
    const passwordHash = await bcrypt.hash(`${profile.provider}:${profile.providerId}:${Date.now()}`, 12);
    
    if (!subIndustryId) {
      return this.prisma.user.create({
        data: {
          email,
          name: profile.name,
          passwordHash,
          role: "owner",
          status: "active",
          oauthProvider: profile.provider,
          oauthProviderId: profile.providerId
        },
        include: this.sessionInclude()
      });
    }

    const starterTier = await this.findStarterTier(subIndustryId);
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          name: profile.name,
          passwordHash,
          role: "owner",
          status: "active",
          oauthProvider: profile.provider,
          oauthProviderId: profile.providerId
        }
      });

      const tenant = await tx.tenant.create({
        data: { name: `Workspace ${profile.name}` }
      });

      const tenantUser = await tx.tenantUser.create({
        data: { userId: newUser.id, tenantId: tenant.id, role: "owner" }
      });

      const branch = await tx.tenantBranch.create({
        data: { tenantId: tenant.id, name: "Main Branch", code: "MAIN", status: "active" }
      });

      await tx.tenantUserBranch.create({
        data: { tenantUserId: tenantUser.id, branchId: branch.id }
      });

      await tx.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          subIndustryId,
          tierId: starterTier.id,
          status: "trial",
          startedAt: now,
          currentPeriodEnd: trialEndsAt,
          price: 0
        }
      });

      return tx.user.findUniqueOrThrow({
        where: { id: newUser.id },
        include: this.sessionInclude()
      });
    });
  }

  private async findStarterTier(subIndustryId: string) {
    const starterTier = await this.prisma.tier.findFirst({
      where: {
        subIndustryId,
        isActive: true,
        OR: [{ slug: { endsWith: "-starter" } }, { name: { contains: "Starter", mode: "insensitive" } }]
      },
      include: { subIndustry: { include: { industry: true } } },
      orderBy: { sortOrder: "asc" }
    });

    if (!starterTier) {
      throw new NotFoundException("Tier Starter untuk sub-industri ini belum tersedia.");
    }
    return starterTier;
  }

  private async issueSession(user: any) {
    // For simplicity, we just pass the user object, but map tenant logic for the frontend
    const tenantUser = user.tenantUsers?.[0]; // Assume first tenant for now
    const sub = tenantUser?.tenant?.subscriptions?.[0];
    const role = user.role === "super_admin"
      ? "super_admin"
      : tenantUser?.role === "employee"
        ? "employee"
        : "owner";
    
    const payload = { sub: user.id, email: user.email, name: user.name, tokenVersion: user.tokenVersion };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: (() => {
        const secret = this.config.get<string>("JWT_SECRET");
        if (!secret && process.env.NODE_ENV === "production") {
          throw new Error("JWT_SECRET is missing in production environment");
        }
        return secret ?? "dev-secret";
      })(),
      expiresIn: this.config.get<string>("JWT_EXPIRES_IN") ?? "7d"
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phoneNumber: user.phoneNumber ?? null,
        phoneVerifiedAt: user.phoneVerifiedAt?.toISOString?.() ?? null,
        mustChangePassword: Boolean(user.mustChangePassword),
        role,
        tenantRole: tenantUser?.role ?? null,
        permissions: this.permissionsFor(tenantUser),
        employeeId: await this.employeeIdFor(user.id, user.email, tenantUser?.tenantId ?? tenantUser?.tenant?.id),
        status: user.status,
        subscriptionStatus: sub?.status ?? undefined,
        effectiveSubscriptionStatus: sub?.status === "trial" && new Date(sub.currentPeriodEnd).getTime() < Date.now() ? "unsubscribed" : sub?.status,
        trialExpired: sub?.status === "trial" ? new Date(sub.currentPeriodEnd).getTime() < Date.now() : false,
        trialStartedAt: sub?.startedAt?.toISOString?.() ?? null,
        trialEndsAt: sub?.currentPeriodEnd?.toISOString?.() ?? null,
        trialSubIndustry: sub?.subIndustry
          ? {
              id: sub.subIndustry.id,
              name: sub.subIndustry.name,
              industry: sub.subIndustry.industry
                ? { id: sub.subIndustry.industry.id, name: sub.subIndustry.industry.name }
                : undefined
            }
          : null,
        trialTier: sub?.tier ? { id: sub.tier.id, name: sub.tier.name } : null,
        tenants: (user.tenantUsers ?? []).map((membership: any) => ({
          id: membership.tenantId,
          name: membership.tenant?.name ?? "Workspace",
          role: membership.role,
          roleProfile: membership.roleProfile ? {
            id: membership.roleProfile.id,
            name: membership.roleProfile.name,
            slug: membership.roleProfile.slug,
            permissions: membership.roleProfile.permissions
          } : null,
          branches: (membership.tenant?.branches ?? []).map((branch: any) => ({
            id: branch.id,
            name: branch.name,
            code: branch.code,
            status: branch.status
          })),
          subscriptions: (membership.tenant?.subscriptions ?? []).map((subscription: any) => ({
            id: subscription.id,
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd?.toISOString?.() ?? null,
            tier: subscription.tier ? { id: subscription.tier.id, name: subscription.tier.name, slug: subscription.tier.slug } : null,
            subIndustry: subscription.subIndustry ? {
              id: subscription.subIndustry.id,
              name: subscription.subIndustry.name,
              slug: subscription.subIndustry.slug,
              industry: subscription.subIndustry.industry ? {
                id: subscription.subIndustry.industry.id,
                name: subscription.subIndustry.industry.name,
                slug: subscription.subIndustry.industry.slug
              } : null
            } : null
          }))
        }))
      }
    };
  }

    async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } }
    });
    return { success: true, message: 'Logged out successfully' };
  }

  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    
    const anonymizedEmail = `deleted_${Date.now()}_${user.id}@deleted.local`;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: anonymizedEmail,
        name: 'Deleted User',
        passwordHash: '',
        phoneNumber: null,
        status: 'inactive',
        tokenVersion: { increment: 1 }
      }
    });

    return { success: true, message: 'Account deleted successfully' };
  }

  private sessionInclude() {
    return {
      tenantUsers: {
        include: {
          roleProfile: true,
          branchAccess: { include: { branch: true } },
          tenant: {
            include: {
              branches: { orderBy: { createdAt: "asc" as const } },
              subscriptions: { include: { tier: true, subIndustry: { include: { industry: true } } } }
            }
          }
        }
      }
    };
  }

  private permissionsFor(tenantUser: any) {
    if (!tenantUser) return [];
    if (tenantUser.role === "owner") return ["*"];
    const permissions = tenantUser.roleProfile?.permissions;
    if (Array.isArray(permissions)) return permissions;
    if (tenantUser.role === "admin") return ["tenant.manage", "branch.manage", "member.manage", "role.manage", "audit.read", "billing.manage", "clinic.*", "hris.*"];
    if (tenantUser.role === "employee") return ["portal.read", "hris.self.read", "hris.self.write", "hris.loan.request"];
    return [];
  }

  private async employeeIdFor(userId: string, email: string | null | undefined, tenantId?: string | null) {
    if (!tenantId) return null;
    const employee = await this.prisma.employee.findFirst({
      where: {
        tenantId,
        OR: [
          { userId },
          ...(email ? [{ email: email.toLowerCase() }] : [])
        ]
      },
      select: { id: true }
    });
    return employee?.id ?? null;
  }

  private audit(action: "login" | "register", email: string, status: "success" | "failed", meta?: RequestMeta) {
    this.logger.log(JSON.stringify({
      type: "auth_audit",
      action,
      email: email.toLowerCase(),
      status,
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent?.slice(0, 240) ?? null,
      at: new Date().toISOString()
    }));
  }

  private normalizePhoneNumber(phoneNumber: string) {
    const digits = phoneNumber.replace(/[^\d+]/g, "");
    if (digits.startsWith("+62")) return digits;
    if (digits.startsWith("62")) return `+${digits}`;
    if (digits.startsWith("0")) return `+62${digits.slice(1)}`;
    throw new BadRequestException("Nomor WhatsApp tidak valid.");
  }

  private generateOtpCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private async verifyRegisterOtp(challengeId: string, email: string, otpCode: string) {
    const challenge = await this.prisma.otpChallenge.findUnique({ where: { id: challengeId } });
    if (!challenge || challenge.purpose !== "register" || challenge.phoneNumber !== email) {
      throw new BadRequestException("Kode OTP tidak valid.");
    }
    if (challenge.consumedAt) {
      throw new BadRequestException("Kode OTP sudah digunakan.");
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Kode OTP sudah kedaluwarsa.");
    }
    if (challenge.attempts >= 5) {
      throw new BadRequestException("Percobaan OTP sudah terlalu banyak.");
    }

    const valid = await bcrypt.compare(otpCode, challenge.codeHash);
    if (!valid) {
      await this.prisma.otpChallenge.update({
        where: { id: challengeId },
        data: { attempts: { increment: 1 } }
      });
      throw new BadRequestException("Kode OTP tidak valid.");
    }
  }
}
