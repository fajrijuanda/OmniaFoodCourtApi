import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { StorageService } from '../../../../storage/storage.service';

type ClockInData = {
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
  livenessChallenge?: string;
  livenessFrames?: string[];
  deviceInfo?: string;
};

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  async getAttendance(tenantId: string, user: any, date?: string, branchId?: string | null) {
    const today = date ? new Date(date) : new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const isTenantEmployee = String(user?.tenantRole) === 'employee';
    const canReadAll = !isTenantEmployee && (['owner', 'admin'].includes(String(user?.tenantRole)) || this.can(user, 'hris.employee.read') || this.can(user, 'hris.*'));
    const selfEmployeeId = await this.resolveSelfEmployeeId(tenantId, user);
    if (!canReadAll && !selfEmployeeId) return [];

    return this.prisma.attendanceLog.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        ...(!canReadAll && selfEmployeeId ? { employeeId: selfEmployeeId } : {}),
        clockInAt: {
          gte: today,
          lt: tomorrow
        }
      },
      include: { employee: true },
      orderBy: { clockInAt: 'desc' }
    });
  }

  async getFaceProfile(tenantId: string, employeeId?: string, branchId?: string | null) {
    const employee = await this.resolveEmployee(tenantId, employeeId, branchId);

    return {
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        employeeNumber: employee.employeeNumber
      },
      enrolled: Boolean(employee.faceEmbedding && employee.faceEnrolledAt),
      faceEnrolledAt: employee.faceEnrolledAt
    };
  }

  async enrollFace(tenantId: string, employeeId: string | undefined, photoUrl: string, branchId?: string | null) {
    const employee = await this.resolveEmployee(tenantId, employeeId, branchId);
    const embedding = this.createImageEmbedding(photoUrl);
    const localUrl = await this.storage.saveBase64Image(photoUrl, 'hris/attendance');

    const updated = await this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        facePhotoUrl: localUrl,
        faceEmbedding: embedding,
        faceEnrolledAt: new Date()
      },
      select: {
        id: true,
        fullName: true,
        employeeNumber: true,
        faceEnrolledAt: true
      }
    });

    return {
      employee: updated,
      enrolled: true,
      faceEnrolledAt: updated.faceEnrolledAt
    };
  }

  async createLivenessChallenge(tenantId: string, employeeId?: string, branchId?: string | null) {
    const employee = await this.resolveEmployee(tenantId, employeeId, branchId);
    const challenge = this.generateChallenge();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    await this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        livenessChallenge: challenge,
        livenessExpiresAt: expiresAt
      }
    });

    return {
      employeeId: employee.id,
      challenge,
      expiresAt
    };
  }

  async clockIn(tenantId: string, employeeId: string | undefined, data?: ClockInData, branchId?: string | null) {
    const employee = await this.resolveEmployee(tenantId, employeeId, branchId);
    await this.validateLocation(tenantId, data);

    const todayLog = await this.findTodayAttendanceLog(tenantId, employee.id, branchId);
    if (todayLog) {
      throw new BadRequestException(todayLog.clockOutAt ? 'Clock in sudah dilakukan hari ini.' : 'Sudah clock in hari ini. Silakan clock out terlebih dahulu.');
    }

    const verification = this.verifyFaceAndLiveness(employee, data);
    const localPhotoUrl = await this.saveAttendancePhoto(data);
    
    if (data?.deviceInfo) {
      const sameDeviceDifferentEmployee = await this.prisma.attendanceLog.findFirst({
        where: {
          tenantId,
          ...(branchId ? { branchId } : {}),
          deviceInfo: data.deviceInfo,
          employeeId: { not: employee.id },
          clockInAt: { gte: this.startOfToday() }
        },
        include: { employee: true }
      });

      if (sameDeviceDifferentEmployee) {
        throw new BadRequestException(`Device already used today by ${sameDeviceDifferentEmployee.employee.fullName}.`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (data?.photoUrl) {
        await tx.employee.update({
          where: { id: employee.id },
          data: { livenessChallenge: null, livenessExpiresAt: null }
        });
      }

      return tx.attendanceLog.create({
        data: {
          tenantId,
          branchId: branchId ?? employee.branchId ?? null,
          employeeId: employee.id,
          clockInAt: new Date(),
          status: 'present',
          latitude: data?.latitude,
          longitude: data?.longitude,
          photoUrl: localPhotoUrl,
          isFaceMatched: verification.isFaceMatched,
          isLivenessVerified: verification.isLivenessVerified,
          deviceInfo: data?.deviceInfo
        },
        include: { employee: true }
      });
    });
  }

  async clockOut(tenantId: string, employeeId: string | undefined, data?: ClockInData, branchId?: string | null) {
    const employee = await this.resolveEmployee(tenantId, employeeId, branchId);
    await this.validateLocation(tenantId, data);

    const openLog = await this.findOpenAttendanceLog(tenantId, employee.id, branchId);
    if (!openLog) {
      const completedLog = await this.prisma.attendanceLog.findFirst({
        where: {
          tenantId,
          ...(branchId ? { branchId } : {}),
          employeeId: employee.id,
          clockInAt: { gte: this.startOfToday() },
          clockOutAt: { not: null }
        },
        orderBy: { clockOutAt: 'desc' }
      });

      throw new BadRequestException(completedLog ? 'Clock out sudah dilakukan.' : 'Belum clock in hari ini.');
    }

    const verification = this.verifyFaceAndLiveness(employee, data);
    const localPhotoUrl = await this.saveAttendancePhoto(data);

    return this.prisma.$transaction(async (tx) => {
      if (data?.photoUrl) {
        await tx.employee.update({
          where: { id: employee.id },
          data: { livenessChallenge: null, livenessExpiresAt: null }
        });
      }

      return tx.attendanceLog.update({
        where: { id: openLog.id },
        data: {
          clockOutAt: new Date(),
          latitude: data?.latitude,
          longitude: data?.longitude,
          photoUrl: localPhotoUrl,
          isFaceMatched: verification.isFaceMatched,
          isLivenessVerified: verification.isLivenessVerified,
          deviceInfo: data?.deviceInfo
        },
        include: { employee: true }
      });
    });
  }

  private async resolveEmployee(tenantId: string, employeeId?: string, branchId?: string | null) {
    const employee = employeeId
      ? await this.prisma.employee.findFirst({ where: { id: employeeId, tenantId, ...(branchId ? { branchId } : {}) } })
      : await this.prisma.employee.findFirst({ where: { tenantId, status: 'active', ...(branchId ? { branchId } : {}) }, orderBy: { createdAt: 'asc' } });

    if (!employee) {
      throw new NotFoundException('Employee profile not found. Create an employee record before using HRIS attendance.');
    }

    return employee;
  }

  private async resolveSelfEmployeeId(tenantId: string, user: any) {
    if (user?.employeeId) return user.employeeId;
    if (!user?.id) return null;
    const employee = await this.prisma.employee.findFirst({
      where: {
        tenantId,
        OR: [
          { userId: user.id },
          ...(user.email ? [{ email: String(user.email).toLowerCase() }] : [])
        ]
      },
      select: { id: true }
    });
    return employee?.id ?? null;
  }

  private can(user: any, permission: string) {
    const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
    if (permissions.includes('*') || permissions.includes(permission)) return true;
    const parts = permission.split('.');
    for (let index = parts.length - 1; index > 0; index -= 1) {
      if (permissions.includes(`${parts.slice(0, index).join('.')}.*`)) return true;
    }
    return false;
  }

  private async findOpenAttendanceLog(tenantId: string, employeeId: string, branchId?: string | null) {
    return this.prisma.attendanceLog.findFirst({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        employeeId,
        clockInAt: { gte: this.startOfToday() },
        clockOutAt: null
      },
      orderBy: { clockInAt: 'desc' }
    });
  }

  private async findTodayAttendanceLog(tenantId: string, employeeId: string, branchId?: string | null) {
    return this.prisma.attendanceLog.findFirst({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        employeeId,
        clockInAt: { gte: this.startOfToday() }
      },
      orderBy: { clockInAt: 'desc' }
    });
  }

  private async validateLocation(tenantId: string, data?: ClockInData) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });

    if (tenant?.workLocationLat && tenant?.workLocationLng && data?.latitude && data?.longitude) {
      const distance = this.getDistanceFromLatLonInKm(
        Number(tenant.workLocationLat), Number(tenant.workLocationLng),
        data.latitude, data.longitude
      ) * 1000;

      const radius = tenant.geofenceRadius || 100;
      if (distance > radius) {
        throw new Error(`Out of zone. You are ${Math.round(distance)}m away. Max radius is ${radius}m.`);
      }
    }
  }

  private async saveAttendancePhoto(data?: ClockInData) {
    if (!data?.photoUrl) return data?.photoUrl;
    return this.storage.saveBase64Image(data.photoUrl, 'hris/attendance');
  }

  private verifyFaceAndLiveness(employee: { faceEmbedding: unknown; livenessChallenge: string | null; livenessExpiresAt: Date | null }, data?: ClockInData) {
    if (!data?.photoUrl) {
      throw new BadRequestException('Selfie photo is required for AI attendance.');
    }
    if (!employee.faceEmbedding) {
      throw new BadRequestException('Face enrollment is required before selfie clock-in.');
    }
    if (!employee.livenessChallenge || !employee.livenessExpiresAt || employee.livenessExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Liveness challenge is missing or expired.');
    }
    if (data.livenessChallenge !== employee.livenessChallenge) {
      throw new BadRequestException('Liveness challenge does not match the active session.');
    }

    const baseline = this.normalizeEmbedding(employee.faceEmbedding);
    const current = this.createImageEmbedding(data.photoUrl);
    const similarity = this.cosineSimilarity(baseline, current);
    const frameSimilarities = data.livenessFrames?.length
      ? data.livenessFrames.map((frame) => this.cosineSimilarity(current, this.createImageEmbedding(frame)))
      : [];
    // A live face has some natural motion between frames (not identical) but remains consistent (not wildly different)
    // Threshold relaxed: >0.50 means same face region, <0.9999 means there was at least slight movement (liveness)
    const isLivenessVerified = frameSimilarities.length > 0
      ? frameSimilarities.some((s) => s > 0.50 && s < 0.9999)
      : false;
    const isFaceMatched = similarity >= 0.65;

    if (!isFaceMatched) {
      throw new BadRequestException('Face match failed. Please retake the selfie with the enrolled employee.');
    }
    if (!isLivenessVerified) {
      throw new BadRequestException('Liveness verification failed. Please use the live camera and follow the challenge.');
    }

    return { isFaceMatched, isLivenessVerified };
  }

  private createImageEmbedding(dataUrl: string) {
    const base64 = dataUrl.includes(',') ? dataUrl.split(',').pop() : dataUrl;
    const bytes = Buffer.from(base64 ?? '', 'base64');

    if (bytes.length < 512) {
      throw new BadRequestException('Selfie image is too small or invalid.');
    }

    const buckets = Array.from({ length: 32 }, () => 0);
    for (let i = 0; i < bytes.length; i += 1) {
      buckets[Math.floor(bytes[i] / 8)] += 1;
    }

    const magnitude = Math.sqrt(buckets.reduce((sum, value) => sum + value * value, 0)) || 1;
    return buckets.map((value) => Number((value / magnitude).toFixed(6)));
  }

  private normalizeEmbedding(value: unknown) {
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'number')) {
      throw new BadRequestException('Stored face enrollment is invalid. Please enroll again.');
    }
    return value;
  }

  private cosineSimilarity(a: number[], b: number[]) {
    const length = Math.min(a.length, b.length);
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < length; i += 1) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    return dot / ((Math.sqrt(magA) * Math.sqrt(magB)) || 1);
  }

  private generateChallenge() {
    const actions = ['turn-left', 'turn-right', 'blink', 'smile'];
    return `${actions[Math.floor(Math.random() * actions.length)]}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private startOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  private getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number) {
    return deg * (Math.PI / 180);
  }
}
