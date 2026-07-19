import { Subject } from 'rxjs';
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PosInventoryService } from './pos-inventory.service';
import { Prisma } from '@prisma/client';
import { CreateOrderDto } from '../dto/create-order.dto';
import { StorageService } from '../../../storage/storage.service';

type FnbPaymentProvider = 'XENDIT' | 'BTN_QRIS';
type FnbPaymentMethods = {
  cash: boolean;
  qris: boolean;
  eWallet: boolean;
  debit: boolean;
  transfer: boolean;
};

@Injectable()
export class PosOrderService {
  public readonly orderEvents$ = new Subject<any>();
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: PosInventoryService,
    private readonly storageService: StorageService,
  ) {}

  async resolveTenantId(user: any) {
    let tenantId = user?.tenantId ?? user?.activeTenantId ?? user?.tenantUsers?.[0]?.tenantId;
    if (!tenantId && user?.id) {
      tenantId = user.id;
      const existing = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!existing) {
        await this.prisma.tenant.create({
          data: {
            id: tenantId,
            name: `Personal Sandbox - ${user.name || 'User'}`,
            status: 'active',
          },
        });
      }
    }
    if (!tenantId) throw new UnauthorizedException('Tenant ID not found in context.');
    return tenantId;
  }

  private defaultFnbSettings() {
    return {
      taxRate: 10,
      serviceChargeRate: 5,
      rounding: 'NEAREST_100',
      refundPolicy: 'NO_REFUND',
      payment: {
        provider: 'XENDIT' as FnbPaymentProvider,
        methods: {
          cash: true,
          qris: true,
          eWallet: true,
          debit: true,
          transfer: true,
        },
        xendit: {
          status: 'READY_TO_CONNECT',
          accountName: '',
          apiKeyConfigured: false,
          settlementNotes: 'Settlement mengikuti konfigurasi akun Xendit tenant.',
        },
        btnQris: {
          status: 'NOT_CONNECTED',
          merchantId: '',
          terminalId: '',
          apiBaseUrl: '',
          apiClientId: '',
          apiSecretConfigured: false,
          qrisImageUrl: '',
          qrisPayload: '',
          notes: 'Gunakan QRIS milik sendiri yang terhubung ke API Bank BTN.',
        },
        receiverAccounts: [
          {
            id: 'primary',
            label: 'Rekening utama outlet',
            bankName: 'BTN',
            accountNumber: '',
            accountHolder: '',
            percentage: 100,
            isPrimary: true,
            notes: '',
          },
        ],
      },
    };
  }

  private normalizeReceiverAccounts(input: unknown) {
    const rows = Array.isArray(input) ? input : this.defaultFnbSettings().payment.receiverAccounts;
    const accounts = rows
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null;
        const source = item as any;
        const percentage = Number(source.percentage ?? 0);
        return {
          id: String(source.id ?? `receiver-${index + 1}`).trim() || `receiver-${index + 1}`,
          label: String(source.label ?? `Rekening ${index + 1}`).trim() || `Rekening ${index + 1}`,
          bankName: String(source.bankName ?? 'BTN').trim() || 'BTN',
          accountNumber: String(source.accountNumber ?? '').trim(),
          accountHolder: String(source.accountHolder ?? '').trim(),
          percentage: Number.isFinite(percentage) ? Math.max(0, Math.min(100, percentage)) : 0,
          isPrimary: Boolean(source.isPrimary),
          notes: String(source.notes ?? '').trim(),
        };
      })
      .filter((item: any): item is NonNullable<typeof item> => Boolean(item));

    if (accounts.length === 0) {
      throw new BadRequestException('At least one receiver account is required');
    }

    const totalPercentage = accounts.reduce((sum, account) => sum + account.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new BadRequestException('Receiver account percentages must total 100%');
    }

    if (!accounts.some((account) => account.isPrimary)) {
      accounts[0].isPrimary = true;
    }

    return accounts.map((account, index) => ({ ...account, isPrimary: index === accounts.findIndex((row) => row.isPrimary) }));
  }

  private normalizeFnbSettings(input: unknown) {
    const defaults = this.defaultFnbSettings();
    const source = input && typeof input === 'object' ? input as Record<string, any> : {};
    const paymentSource = source.payment && typeof source.payment === 'object' ? source.payment as Record<string, any> : {};
    const provider = String(paymentSource.provider ?? defaults.payment.provider).toUpperCase() === 'BTN_QRIS' ? 'BTN_QRIS' : 'XENDIT';
    const methods = paymentSource.methods && typeof paymentSource.methods === 'object' ? paymentSource.methods : {};
    const xendit = paymentSource.xendit && typeof paymentSource.xendit === 'object' ? paymentSource.xendit : {};
    const btnQris = paymentSource.btnQris && typeof paymentSource.btnQris === 'object' ? paymentSource.btnQris : {};

    return {
      ...defaults,
      ...source,
      taxRate: Number.isFinite(Number(source.taxRate)) ? Number(source.taxRate) : defaults.taxRate,
      serviceChargeRate: Number.isFinite(Number(source.serviceChargeRate)) ? Number(source.serviceChargeRate) : defaults.serviceChargeRate,
      payment: {
        provider,
        methods: {
          cash: methods.cash !== false,
          qris: methods.qris !== false,
          eWallet: methods.eWallet !== false,
          debit: methods.debit !== false,
          transfer: methods.transfer !== false,
        },
        xendit: {
          ...defaults.payment.xendit,
          ...xendit,
          status: String(xendit.status ?? defaults.payment.xendit.status),
          accountName: String(xendit.accountName ?? ''),
          apiKeyConfigured: Boolean(xendit.apiKeyConfigured),
          settlementNotes: String(xendit.settlementNotes ?? defaults.payment.xendit.settlementNotes),
        },
        btnQris: {
          ...defaults.payment.btnQris,
          ...btnQris,
          status: String(btnQris.status ?? defaults.payment.btnQris.status),
          merchantId: String(btnQris.merchantId ?? ''),
          terminalId: String(btnQris.terminalId ?? ''),
          apiBaseUrl: String(btnQris.apiBaseUrl ?? ''),
          apiClientId: String(btnQris.apiClientId ?? ''),
          apiSecretConfigured: Boolean(btnQris.apiSecretConfigured || btnQris.apiSecret),
          qrisImageUrl: String(btnQris.qrisImageUrl ?? ''),
          qrisPayload: String(btnQris.qrisPayload ?? ''),
          notes: String(btnQris.notes ?? defaults.payment.btnQris.notes),
        },
        receiverAccounts: this.normalizeReceiverAccounts(paymentSource.receiverAccounts),
      },
    };
  }

  private normalizeFnbSettingsStore(input: unknown) {
    const source = input && typeof input === 'object' ? input as Record<string, any> : {};
    const hasStoreShape = source.default || source.branches;
    const defaultSettings = this.normalizeFnbSettings(hasStoreShape ? source.default : source);
    const branchRows = source.branches && typeof source.branches === 'object' ? source.branches as any : {};
    const branches = Object.fromEntries(
      Object.entries(branchRows).map(([branchId, value]) => [branchId, this.normalizeFnbSettings(value)])
    );

    return { default: defaultSettings, branches };
  }

  private resolveFnbSettings(input: unknown, branchId?: string | null) {
    const store = this.normalizeFnbSettingsStore(input);
    if (!branchId) return store.default;
    return this.normalizeFnbSettings({
      ...store.default,
      ...(store.branches[branchId] ?? {}),
      payment: {
        ...store.default.payment,
        ...(store.branches[branchId]?.payment ?? {}),
        methods: {
          ...store.default.payment.methods,
          ...(store.branches[branchId]?.payment?.methods ?? {}),
        },
        xendit: {
          ...store.default.payment.xendit,
          ...(store.branches[branchId]?.payment?.xendit ?? {}),
        },
        btnQris: {
          ...store.default.payment.btnQris,
          ...(store.branches[branchId]?.payment?.btnQris ?? {}),
        },
        receiverAccounts: store.branches[branchId]?.payment?.receiverAccounts ?? store.default.payment.receiverAccounts,
      },
    });
  }

  private publicPaymentSettings(settings: any, branchId?: string | null) {
    const normalized = this.resolveFnbSettings(settings, branchId);
    return {
      provider: normalized.payment.provider,
      methods: normalized.payment.methods,
      btnQris: {
        status: normalized.payment.btnQris.status,
        merchantId: normalized.payment.btnQris.merchantId,
        terminalId: normalized.payment.btnQris.terminalId,
        qrisImageUrl: normalized.payment.btnQris.qrisImageUrl,
        qrisPayload: normalized.payment.btnQris.qrisPayload,
        notes: normalized.payment.btnQris.notes,
      },
      receiverAccounts: normalized.payment.receiverAccounts.map((account: any) => ({
        id: account.id,
        label: account.label,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        accountHolder: account.accountHolder,
        percentage: account.percentage,
        isPrimary: account.isPrimary,
      })),
    };
  }

  async getFnbSettings(tenantId: string, branchId?: string | null) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { fnbSettings: true },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');
    return this.resolveFnbSettings(tenant.fnbSettings, branchId);
  }

  async updateFnbSettings(tenantId: string, data: any, branchId?: string | null) {
    const normalized = this.normalizeFnbSettings(data);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { fnbSettings: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const store = this.normalizeFnbSettingsStore(tenant.fnbSettings);
    const nextStore = branchId
      ? { ...store, branches: { ...store.branches, [branchId]: normalized } }
      : { ...store, default: normalized };

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { fnbSettings: nextStore as Prisma.InputJsonValue },
      select: { fnbSettings: true },
    });

    return this.resolveFnbSettings(updated.fnbSettings, branchId);
  }

  async getCatalog(
    tenantId: string,
    _subIndustry?: string,
    options: boolean | { includeHidden?: boolean; includeArchived?: boolean } = false,
    branchId?: string | null,
  ) {
    const includeHidden = typeof options === 'boolean' ? options : Boolean(options.includeHidden);
    const includeArchived = typeof options === 'boolean' ? false : Boolean(options.includeArchived);
    const now = new Date();
    const [categories, products, promoBanners, tenant] = await Promise.all([
      this.prisma.posCategory.findMany({
        where: { tenantId, ...(branchId ? { branchId } : {}), ...(includeHidden ? {} : { isActive: true }) },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.posProduct.findMany({
        where: {
          tenantId,
          ...(branchId ? { branchId } : {}),
          ...(includeArchived ? { archivedAt: { not: null } } : { archivedAt: null }),
          ...(includeHidden || includeArchived ? {} : { isAvailable: true, category: { isActive: true } }),
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          recipe: {
            include: {
              items: true,
            },
          },
          variants: true,
          modifierGroups: {
            include: {
              modifierGroup: {
                include: {
                  options: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.posPromoBanner.findMany({
        where: {
          tenantId,
          ...(branchId ? { branchId } : {}),
          ...(includeHidden
            ? {}
            : {
                isActive: true,
                OR: [{ startsAt: null }, { startsAt: { lte: now } }],
                AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
              }),
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { 
          id: true, 
          name: true,
          fnbSettings: true,
          subscriptions: {
            include: { subIndustry: true },
            take: 1
          }
        },
      }),
    ]);

    return {
      tenant: tenant ? {
        id: tenant.id,
        name: tenant.name,
        subIndustry: tenant.subscriptions?.[0]?.subIndustry?.slug || "cafe",
        paymentSettings: this.publicPaymentSettings(tenant.fnbSettings, branchId),
      } : null,
      categories: categories.map((category) => this.mapCategory(category)),
      promoBanners: promoBanners.map((banner) => this.mapPromoBanner(banner)),
      products: products.map((product) => this.mapProduct(product)),
    };
  }

  private mapCategory(category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    return {
      id: category.id,
      name: category.name,
      icon: category.icon,
      color: category.color,
      sortOrder: category.sortOrder ?? 0,
      isActive: category.isActive ?? true,
    };
  }

  private mapProduct(product: any) {
    return {
      id: product.id,
      categoryId: product.categoryId,
      name: product.name,
      description: product.description,
      price: Number(product.price),
      imageUrl: product.imageUrl,
      isBestSeller: product.isBestSeller ?? false,
      isAvailable: product.isAvailable,
      archivedAt: product.archivedAt,
      sortOrder: product.sortOrder ?? 0,
      recipe: product.recipe
        ? {
            id: product.recipe.id,
            items: (product.recipe.items ?? []).map((item: any) => ({
              ingredientId: item.ingredientId,
              quantityRequired: Number(item.quantityRequired),
            })),
          }
        : null,
      variants: (product.variants ?? []).map((variant: any) => ({
        id: variant.id,
        name: variant.name,
        priceAdjustment: Number(variant.priceAdjustment),
      })),
      modifierGroups: (product.modifierGroups ?? []).map(({ modifierGroup }: any) => ({
        id: modifierGroup.id,
        name: modifierGroup.name,
        minSelection: modifierGroup.minSelection,
        maxSelection: modifierGroup.maxSelection,
        options: (modifierGroup.options ?? []).map((option: any) => ({
          id: option.id,
          name: option.name,
          priceAdjustment: Number(option.priceAdjustment),
        })),
      })),
    };
  }

  private mapPromoBanner(banner: any) {
    return {
      id: banner.id,
      title: banner.title,
      imageUrl: banner.imageUrl,
      linkUrl: banner.linkUrl,
      sortOrder: banner.sortOrder ?? 0,
      isActive: banner.isActive ?? true,
      startsAt: banner.startsAt,
      endsAt: banner.endsAt,
    };
  }

  private async saveMenuImageUrl(value: unknown) {
    if (typeof value !== 'string') return undefined;
    if (!value.startsWith('data:image/')) return value;
    const savedUrl = await this.storageService.saveBase64Image(value, 'fnb/menu');
    return savedUrl;
  }

  private async savePromoBannerImageUrl(value: unknown) {
    if (typeof value !== 'string') return undefined;
    if (!value.startsWith('data:image/')) return value;
    return this.storageService.saveBase64Image(value, 'fnb/promo-banners');
  }

  private mapKitchenStatus(status: string) {
    if (status === 'ACCEPTED') return 'ACCEPTED';
    if (status === 'COOKING') return 'COOKING';
    if (status === 'READY') return 'READY';
    return 'NEW';
  }

  private mapKitchenOrder(order: any) {
    return {
      id: order.id,
      invoiceNumber: order.invoiceNumber,
      status: this.mapKitchenStatus(order.status),
      createdAt: order.createdAt,
      totalAmount: Number(order.totalAmount),
      paymentMethod: order.paymentMethod,
      items: (order.items ?? []).map((item: any) => ({
        id: item.id,
        quantity: item.quantity,
        note: item.note,
        variantSnapshot: item.variantSnapshot,
        modifiersSnapshot: item.modifiersSnapshot,
        product: {
          id: item.product?.id ?? item.productId,
          name: item.product?.name ?? 'Menu',
        },
      })),
    };
  }

  private mapOrder(order: any) {
    return {
      id: order.id,
      invoiceNumber: order.invoiceNumber,
      status: order.status,
      paymentStatus: order.paymentStatus ?? 'UNPAID',
      kitchenStatus: order.kitchenStatus ?? 'PENDING',
      totalAmount: Number(order.totalAmount),
      cashReceived: Number(order.cashReceived ?? 0),
      changeAmount: Number(order.changeAmount ?? 0),
      paymentMethod: order.paymentMethod,
      notes: order.notes,
      orderType: order.orderType,
      tableId: order.tableId,
      reservationTime: order.reservationTime,
      pax: order.pax,
      customerName: order.customerName,
      dpAmount: order.dpAmount ? Number(order.dpAmount) : null,
      isRefunded: order.isRefunded ?? false,
      refundAmount: order.refundAmount ? Number(order.refundAmount) : null,
      followUpStatus: order.followUpStatus ?? 'PENDING',
      shiftId: order.shiftId,
      createdAt: order.createdAt,
      items: (order.items ?? []).map((item: any) => ({
        id: item.id,
        quantity: item.quantity,
        priceAtSale: Number(item.priceAtSale),
        note: item.note,
        variantSnapshot: item.variantSnapshot,
        modifiersSnapshot: item.modifiersSnapshot,
        product: {
          id: item.product?.id ?? item.productId,
          name: item.product?.name ?? 'Menu',
          categoryId: item.product?.categoryId ?? null,
        },
      })),
    };
  }

  private mapShift(shift: any, orderCount = 0) {
    return {
      id: shift.id,
      cashierId: shift.cashierId,
      status: shift.status,
      startTime: shift.startTime,
      endTime: shift.endTime,
      initialCash: Number(shift.initialCash),
      finalCashSystem: Number(shift.finalCashSystem),
      finalCashActual: Number(shift.finalCashActual),
      notes: shift.notes,
      orderCount,
    };
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async makeUniqueCategorySlug(tenantId: string, rawSlug: string, excludeId?: string) {
    const baseSlug = this.slugify(rawSlug) || 'kategori';
    let candidate = baseSlug;
    let suffix = 2;

    while (true) {
      const existing = await this.prisma.posCategory.findFirst({
        where: {
          tenantId,
          slug: candidate,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      });

      if (!existing) return candidate;

      candidate = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
  }

  async getIngredients(tenantId: string, branchId?: string | null) {
    const ingredients = await this.prisma.posIngredient.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: [{ name: 'asc' }],
    });

    return ingredients.map((ingredient) => ({
      id: ingredient.id,
      name: ingredient.name,
      unit: ingredient.unit,
      currentStock: Number(ingredient.currentStock),
      minStockAlert: Number(ingredient.minStockAlert),
      costPerUnit: Number(ingredient.costPerUnit),
    }));
  }

  private mapIngredient(ingredient: any) {
    return {
      id: ingredient.id,
      name: ingredient.name,
      unit: ingredient.unit,
      currentStock: Number(ingredient.currentStock),
      minStockAlert: Number(ingredient.minStockAlert),
      costPerUnit: Number(ingredient.costPerUnit),
    };
  }

  async createIngredient(tenantId: string, data: any, branchId?: string | null) {
    const name = String(data.name ?? '').trim();
    if (!name) throw new BadRequestException('Ingredient name is required');

    const currentStock = Number(data.currentStock ?? 0);
    const minStockAlert = Number(data.minStockAlert ?? 0);
    const costPerUnit = Number(data.costPerUnit ?? 0);
    if (![currentStock, minStockAlert, costPerUnit].every(Number.isFinite)) {
      throw new BadRequestException('Ingredient numeric fields are invalid');
    }

    const ingredient = await this.prisma.posIngredient.create({
      data: {
        tenantId,
        branchId: branchId ?? null,
        name,
        unit: String(data.unit ?? 'gram').trim() || 'gram',
        currentStock,
        minStockAlert,
        costPerUnit,
      },
    });

    return this.mapIngredient(ingredient);
  }

  async updateIngredient(tenantId: string, id: string, data: any, branchId?: string | null) {
    const existing = await this.prisma.posIngredient.findFirst({ where: { id, tenantId, ...(branchId ? { branchId } : {}) } });
    if (!existing) throw new NotFoundException('Ingredient not found');

    const ingredient = await this.prisma.posIngredient.update({
      where: { id },
      data: {
        ...(typeof data.name === 'string' && data.name.trim() ? { name: data.name.trim() } : {}),
        ...(typeof data.unit === 'string' && data.unit.trim() ? { unit: data.unit.trim() } : {}),
        ...(data.currentStock !== undefined ? { currentStock: Number(data.currentStock) || 0 } : {}),
        ...(data.minStockAlert !== undefined ? { minStockAlert: Number(data.minStockAlert) || 0 } : {}),
        ...(data.costPerUnit !== undefined ? { costPerUnit: Number(data.costPerUnit) || 0 } : {}),
      },
    });

    return this.mapIngredient(ingredient);
  }

  async deleteIngredient(tenantId: string, id: string, branchId?: string | null) {
    const existing = await this.prisma.posIngredient.findFirst({
      where: { id, tenantId, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Ingredient not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.posRecipeItem.deleteMany({
        where: {
          ingredientId: id,
          recipe: {
            product: {
              tenantId,
              ...(branchId ? { branchId } : {}),
            },
          },
        },
      });
      await tx.posModifierOption.updateMany({
        where: {
          ingredientId: id,
          modifierGroup: {
            tenantId,
            ...(branchId ? { branchId } : {}),
          },
        },
        data: { ingredientId: null },
      });
      await tx.posIngredient.delete({ where: { id } });
    });

    return { id, deleted: true };
  }

  async getOrders(tenantId: string, branchId?: string | null) {
    const orders = await this.prisma.posOrder.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      take: 100,
    });

    return orders.map((order) => this.mapOrder(order));
  }

  async getShifts(tenantId: string, branchId?: string | null) {
    const shifts = await this.prisma.posShift.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: [{ startTime: 'desc' }],
      include: {
        orders: true,
      },
      take: 50,
    });

    return shifts.map((shift) => this.mapShift(shift, shift.orders.length));
  }

  async openShift(tenantId: string, data: any, branchId?: string | null) {
    const cashierId = String(data.cashierId ?? 'cashier-demo').trim() || 'cashier-demo';
    const initialCash = Number(data.initialCash ?? 0);
    if (!Number.isFinite(initialCash) || initialCash < 0) {
      throw new BadRequestException('Initial cash is invalid');
    }

    const existingOpen = await this.prisma.posShift.findFirst({
      where: { tenantId, cashierId, status: 'OPEN', ...(branchId ? { branchId } : {}) },
    });
    if (existingOpen) return this.mapShift(existingOpen);

    const shift = await this.prisma.posShift.create({
      data: {
        tenantId,
        branchId: branchId ?? null,
        cashierId,
        initialCash,
        finalCashSystem: 0,
        finalCashActual: 0,
        status: 'OPEN',
        notes: typeof data.notes === 'string' ? data.notes : null,
      },
    });

    return this.mapShift(shift);
  }

  async closeShift(tenantId: string, id: string, data: any, branchId?: string | null) {
    if (branchId) { const shift = await this.prisma.posShift.findFirst({ where: { id, tenantId, branchId } }); if (!shift) throw new NotFoundException('Shift not found in your branch'); }
    const existing = await this.prisma.posShift.findFirst({
      where: { id, tenantId },
      include: { orders: true },
    });
    if (!existing) throw new NotFoundException('Shift not found');

    const finalCashActual = Number(data.finalCashActual ?? 0);
    if (!Number.isFinite(finalCashActual) || finalCashActual < 0) {
      throw new BadRequestException('Final cash actual is invalid');
    }

    const cashSales = existing.orders
      .filter((order) => order.paymentMethod === 'CASH')
      .reduce((sum, order) => sum + Number(order.totalAmount), 0);
    const finalCashSystem = Number(existing.initialCash) + cashSales;

    const shift = await this.prisma.posShift.update({
      where: { id },
      data: {
        status: 'CLOSED',
        endTime: new Date(),
        finalCashSystem,
        finalCashActual,
        notes: typeof data.notes === 'string' ? data.notes : existing.notes,
      },
      include: { orders: true },
    });

    return this.mapShift(shift, shift.orders.length);
  }

  async getStockLogs(tenantId: string, branchId?: string | null) {
    const logs = await this.prisma.posStockLog.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });

    return logs.map((log) => ({
      id: log.id,
      ingredientId: log.ingredientId,
      productId: log.productId,
      changeAmount: Number(log.changeAmount),
      finalStock: Number(log.finalStock),
      movementType: log.movementType,
      reason: log.reason,
      notes: log.notes,
      createdAt: log.createdAt,
    }));
  }

  async createStockAdjustment(tenantId: string, data: any, branchId?: string | null) {
    const ingredientId = String(data.ingredientId ?? '').trim();
    const amount = Number(data.amount ?? 0);
    const reason = String(data.reason ?? 'ADJUSTMENT').toUpperCase();
    if (!ingredientId) throw new BadRequestException('Ingredient ID is required');
    if (!Number.isFinite(amount) || amount === 0) throw new BadRequestException('Adjustment amount is invalid');
    if (!['PURCHASE', 'ADJUSTMENT', 'WASTE'].includes(reason)) {
      throw new BadRequestException('Adjustment reason is invalid');
    }

    return this.prisma.$transaction(async (tx) => {
      const ingredient = await tx.posIngredient.findFirst({ where: { id: ingredientId, tenantId } });
      if (!ingredient) throw new NotFoundException('Ingredient not found');

      const finalStock = Number(ingredient.currentStock) + amount;
      const savedIngredient = await tx.posIngredient.update({
        where: { id: ingredientId },
        data: { currentStock: finalStock },
      });
      const log = await tx.posStockLog.create({
        data: {
          tenantId,
          branchId: branchId ?? null,
          ingredientId,
          changeAmount: amount,
          finalStock,
          movementType: amount > 0 ? 'IN' : 'OUT',
          reason,
          notes: typeof data.notes === 'string' ? data.notes : null,
        },
      });

      return {
        ingredient: {
          id: savedIngredient.id,
          name: savedIngredient.name,
          unit: savedIngredient.unit,
          currentStock: Number(savedIngredient.currentStock),
          minStockAlert: Number(savedIngredient.minStockAlert),
        },
        log: {
          id: log.id,
          ingredientId: log.ingredientId,
          changeAmount: Number(log.changeAmount),
          finalStock: Number(log.finalStock),
          movementType: log.movementType,
          reason: log.reason,
          notes: log.notes,
          createdAt: log.createdAt,
        },
      };
    });
  }

  async getKitchenOrders(tenantId: string, branchId?: string | null) {
    const orders = await this.prisma.posOrder.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        status: { in: ['PAID', 'ACCEPTED', 'COOKING', 'READY'] },
      },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      take: 80,
    });

    return orders.map((order) => this.mapKitchenOrder(order));
  }

  async updateKitchenOrderStatus(tenantId: string, id: string, data: any, branchId?: string | null) {

    const nextStatus = String(data.status ?? '').toUpperCase();
    const allowedStatuses = ['ACCEPTED', 'COOKING', 'READY'];
    if (!allowedStatuses.includes(nextStatus)) {
      throw new BadRequestException('Invalid kitchen status');
    }

    const existing = await this.prisma.posOrder.findFirst({ where: { id, tenantId, ...(branchId ? { branchId } : {}) } });
    if (!existing) throw new NotFoundException('Kitchen order not found');

    const order = await this.prisma.posOrder.update({
      where: { id },
      data: { status: nextStatus },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return this.mapKitchenOrder(order);
  }

  private parseRecipeQuantity(value: unknown) {
    const quantity = typeof value === 'string' ? Number(value.trim().replace(',', '.')) : Number(value ?? 0);
    return Number.isFinite(quantity) ? quantity : Number.NaN;
  }

  private getRecipeItems(data: any) {
    if (!Array.isArray(data.recipeItems)) return undefined;
    const quantityByIngredient = new Map<string, number>();

    for (const item of data.recipeItems) {
      if (!item || typeof item !== 'object') continue;
      const source = item as any;
      const ingredientId = String(source.ingredientId ?? '').trim();
      const hasQuantity = source.quantityRequired !== undefined && String(source.quantityRequired).trim().length > 0;
      if (!ingredientId && !hasQuantity) continue;
      if (!ingredientId) throw new BadRequestException('Ingredient is required for every recipe row');

      const quantityRequired = this.parseRecipeQuantity(source.quantityRequired);
      if (!Number.isFinite(quantityRequired) || quantityRequired <= 0) {
        throw new BadRequestException('Recipe quantity must be a number greater than 0');
      }

      quantityByIngredient.set(ingredientId, (quantityByIngredient.get(ingredientId) ?? 0) + quantityRequired);
    }

    return Array.from(quantityByIngredient.entries()).map(([ingredientId, quantityRequired]) => ({ ingredientId, quantityRequired }));
  }

  private async saveProductRecipe(
    tx: Prisma.TransactionClient,
    tenantId: string,
    productId: string,
    recipeItems: { ingredientId: string; quantityRequired: number }[] | undefined,
  ) {
    if (recipeItems === undefined) return;

    const ingredientIds = Array.from(new Set(recipeItems.map((item: any) => item.ingredientId)));
    const ownedIngredientCount = ingredientIds.length === 0
      ? 0
      : await tx.posIngredient.count({ where: { tenantId, id: { in: ingredientIds } } });

    if (ownedIngredientCount !== ingredientIds.length) {
      throw new BadRequestException('One or more recipe ingredients are invalid for this tenant');
    }

    const existingRecipe = await tx.posRecipe.findUnique({ where: { productId } });

    if (recipeItems.length === 0) {
      if (existingRecipe) {
        await tx.posRecipe.delete({ where: { id: existingRecipe.id } });
      }
      return;
    }

    const recipe = existingRecipe
      ? await tx.posRecipe.update({ where: { id: existingRecipe.id }, data: {} })
      : await tx.posRecipe.create({ data: { productId } });

    await tx.posRecipeItem.deleteMany({ where: { recipeId: recipe.id } });
    await tx.posRecipeItem.createMany({
      data: recipeItems.map((item: any) => ({
        recipeId: recipe.id,
        ingredientId: item.ingredientId,
        quantityRequired: item.quantityRequired,
      })),
    });
  }

  private parseNonNegativeMoney(value: unknown) {
    const amount = Number(value ?? 0);
    return Number.isFinite(amount) && amount >= 0 ? amount : Number.NaN;
  }

  private getProductVariants(data: any) {
    if (!Array.isArray(data.variants)) return undefined;
    return data.variants
      .map((item: any) => {
        if (!item || typeof item !== 'object') return null;
        const source = item as any;
        const name = String(source.name ?? '').trim();
        const priceAdjustment = this.parseNonNegativeMoney(source.priceAdjustment);
        if (!name && (!Number.isFinite(priceAdjustment) || priceAdjustment === 0)) return null;
        if (!name) throw new BadRequestException('Variant name is required');
        if (!Number.isFinite(priceAdjustment)) throw new BadRequestException('Variant price adjustment is invalid');
        return { name, priceAdjustment };
      })
      .filter((item: any): item is { name: string; priceAdjustment: number } => Boolean(item));
  }

  private getProductModifierGroups(data: any) {
    if (!Array.isArray(data.modifierGroups)) return undefined;
    return data.modifierGroups
      .map((group: any) => {
        if (!group || typeof group !== 'object') return null;
        const source = group as any;
        const name = String(source.name ?? '').trim();
        const minSelection = Number(source.minSelection ?? 0);
        const maxSelection = Number(source.maxSelection ?? 1);
        const options = Array.isArray(source.options)
          ? source.options
              .map((option: any) => {
                if (!option || typeof option !== 'object') return null;
                const optionSource = option as any;
                const optionName = String(optionSource.name ?? '').trim();
                const priceAdjustment = this.parseNonNegativeMoney(optionSource.priceAdjustment);
                if (!optionName && (!Number.isFinite(priceAdjustment) || priceAdjustment === 0)) return null;
                if (!optionName) throw new BadRequestException('Modifier option name is required');
                if (!Number.isFinite(priceAdjustment)) throw new BadRequestException('Modifier option price adjustment is invalid');
                return { name: optionName, priceAdjustment };
              })
              .filter((item: any): item is { name: string; priceAdjustment: number } => Boolean(item))
          : [];

        if (!name && options.length === 0) return null;
        if (!name) throw new BadRequestException('Modifier group name is required');
        if (!Number.isInteger(minSelection) || minSelection < 0) throw new BadRequestException('Minimum modifier selection is invalid');
        if (!Number.isInteger(maxSelection) || maxSelection < 1) throw new BadRequestException('Maximum modifier selection is invalid');
        if (minSelection > maxSelection) throw new BadRequestException('Minimum modifier selection cannot exceed maximum selection');
        if (options.length === 0) throw new BadRequestException(`Modifier group "${name}" must have at least one option`);
        if (maxSelection > options.length) throw new BadRequestException(`Maximum selection for "${name}" cannot exceed option count`);
        return { name, minSelection, maxSelection, options };
      })
      .filter((item: any): item is { name: string; minSelection: number; maxSelection: number; options: { name: string; priceAdjustment: number }[] } => Boolean(item));
  }

  private async replaceProductChoices(
    tx: Prisma.TransactionClient,
    tenantId: string,
    branchId: string | null,
    productId: string,
    variants: { name: string; priceAdjustment: number }[] | undefined,
    modifierGroups: { name: string; minSelection: number; maxSelection: number; options: { name: string; priceAdjustment: number }[] }[] | undefined,
  ) {
    if (variants !== undefined) {
      await tx.posProductVariant.deleteMany({ where: { productId } });
      if (variants.length > 0) {
        await tx.posProductVariant.createMany({
          data: variants.map((variant) => ({
            productId,
            name: variant.name,
            priceAdjustment: variant.priceAdjustment,
          })),
        });
      }
    }

    if (modifierGroups === undefined) return;

    const existingLinks = await tx.posModifierGroupProduct.findMany({
      where: { productId },
      select: { modifierGroupId: true },
    });
    const existingGroupIds = existingLinks.map((item: any) => item.modifierGroupId);

    if (existingGroupIds.length > 0) {
      await tx.posModifierGroupProduct.deleteMany({ where: { productId } });
      for (const groupId of existingGroupIds) {
        const remainingProductCount = await tx.posModifierGroupProduct.count({ where: { modifierGroupId: groupId } });
        if (remainingProductCount === 0) {
          await tx.posModifierGroup.delete({ where: { id: groupId } });
        }
      }
    }

    for (const group of modifierGroups) {
      const savedGroup = await tx.posModifierGroup.create({
        data: {
          tenantId,
          branchId,
          name: group.name,
          minSelection: group.minSelection,
          maxSelection: group.maxSelection,
          options: {
            create: group.options.map((option: any) => ({
              name: option.name,
              priceAdjustment: option.priceAdjustment,
            })),
          },
        },
      });
      await tx.posModifierGroupProduct.create({
        data: {
          productId,
          modifierGroupId: savedGroup.id,
        },
      });
    }
  }

  private normalizeSortOrder(value: unknown) {
    const sortOrder = Number(value ?? 0);
    return Number.isFinite(sortOrder) ? sortOrder : 0;
  }

  private async ensureCategorySortOrderAvailable(
    tenantId: string,
    branchId: string | null,
    sortOrder: number,
    excludeCategoryId?: string,
  ) {
    const existing = await this.prisma.posCategory.findFirst({
      where: {
        tenantId,
        branchId,
        sortOrder,
        ...(excludeCategoryId ? { id: { not: excludeCategoryId } } : {}),
      },
      select: { name: true },
    });
    if (existing) {
      throw new BadRequestException(`Urutan ${sortOrder} sudah digunakan oleh kategori "${existing.name}" di cabang ini.`);
    }
  }

  private async findProductSortOrderConflict(
    tenantId: string,
    branchId: string | null,
    categoryId: string,
    sortOrder: number,
    excludeProductId?: string,
  ) {
    return this.prisma.posProduct.findFirst({
      where: {
        tenantId,
        branchId,
        categoryId,
        sortOrder,
        archivedAt: null,
        ...(excludeProductId ? { id: { not: excludeProductId } } : {}),
      },
      select: { id: true, name: true, sortOrder: true },
    });
  }

  async createCategory(tenantId: string, data: any, branchId?: string | null) {
    const name = String(data.name ?? '').trim();
    if (!name) throw new BadRequestException('Category name is required');
    const slug = await this.makeUniqueCategorySlug(tenantId, String(data.slug ?? name));
    const normalizedBranchId = branchId ?? null;
    const sortOrder = this.normalizeSortOrder(data.sortOrder);
    await this.ensureCategorySortOrderAvailable(tenantId, normalizedBranchId, sortOrder);

    const category = await this.prisma.posCategory.create({
      data: {
        tenantId,
        branchId: normalizedBranchId,
        name,
        slug,
        color: typeof data.color === 'string' ? data.color : null,
        icon: typeof data.icon === 'string' ? data.icon : null,
        sortOrder,
        isActive: data.isActive === false ? false : true,
      },
    });

    return this.mapCategory(category);
  }

  async updateCategory(tenantId: string, id: string, data: any, branchId?: string | null) {
    const existing = await this.prisma.posCategory.findFirst({ where: { id, tenantId, ...(branchId ? { branchId } : {}) } });
    if (!existing) throw new NotFoundException('Category not found');
    const hasName = typeof data.name === 'string' && data.name.trim();
    const name = hasName ? String(data.name).trim() : existing.name;
    const rawSlug = typeof data.slug === 'string' && data.slug.trim()
      ? data.slug.trim()
      : hasName
        ? name
        : existing.slug;
    const slug = await this.makeUniqueCategorySlug(tenantId, rawSlug, id);
    const sortOrder = data.sortOrder !== undefined ? this.normalizeSortOrder(data.sortOrder) : existing.sortOrder;
    await this.ensureCategorySortOrderAvailable(tenantId, existing.branchId ?? null, sortOrder, id);

    const category = await this.prisma.posCategory.update({
      where: { id },
      data: {
        ...(typeof data.name === 'string' && data.name.trim() ? { name } : {}),
        slug,
        ...(typeof data.color === 'string' ? { color: data.color } : {}),
        ...(typeof data.icon === 'string' ? { icon: data.icon } : {}),
        ...(typeof data.isActive === 'boolean' ? { isActive: data.isActive } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder } : {}),
      },
    });

    return this.mapCategory(category);
  }

  async deleteCategory(tenantId: string, id: string, branchId?: string | null) {
    const existing = await this.prisma.posCategory.findFirst({
      where: { id, tenantId, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Category not found');

    const productCount = await this.prisma.posProduct.count({
      where: { tenantId, categoryId: id, ...(branchId ? { branchId } : {}) },
    });
    if (productCount > 0) {
      throw new BadRequestException(`Kategori masih dipakai oleh ${productCount} menu. Pindahkan atau hapus menu terlebih dahulu.`);
    }

    await this.prisma.posCategory.delete({ where: { id } });
    return { id, deleted: true };
  }

  private parseOptionalDate(value: unknown) {
    if (value === undefined) return undefined;
    const text = String(value ?? '').trim();
    if (!text) return null;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Tanggal banner promo tidak valid.');
    return date;
  }

  async createPromoBanner(tenantId: string, data: any, branchId?: string | null) {
    const title = String(data.title ?? '').trim();
    if (!title) throw new BadRequestException('Judul banner promo wajib diisi.');
    const imageUrl = await this.savePromoBannerImageUrl(data.imageUrl);
    if (!imageUrl) throw new BadRequestException('Gambar banner promo wajib diisi.');
    const sortOrder = this.normalizeSortOrder(data.sortOrder);
    const startsAt = this.parseOptionalDate(data.startsAt);
    const endsAt = this.parseOptionalDate(data.endsAt);
    if (startsAt && endsAt && startsAt > endsAt) {
      throw new BadRequestException('Tanggal mulai banner tidak boleh setelah tanggal selesai.');
    }

    const banner = await this.prisma.posPromoBanner.create({
      data: {
        tenantId,
        branchId: branchId ?? null,
        title,
        imageUrl,
        linkUrl: typeof data.linkUrl === 'string' && data.linkUrl.trim() ? data.linkUrl.trim() : null,
        sortOrder,
        isActive: data.isActive === false ? false : true,
        startsAt: startsAt ?? null,
        endsAt: endsAt ?? null,
      },
    });

    return this.mapPromoBanner(banner);
  }

  async updatePromoBanner(tenantId: string, id: string, data: any, branchId?: string | null) {
    const existing = await this.prisma.posPromoBanner.findFirst({
      where: { id, tenantId, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Banner promo tidak ditemukan.');

    const imageUrl = await this.savePromoBannerImageUrl(data.imageUrl);
    const startsAt = this.parseOptionalDate(data.startsAt);
    const endsAt = this.parseOptionalDate(data.endsAt);
    const nextStartsAt = startsAt === undefined ? existing.startsAt : startsAt;
    const nextEndsAt = endsAt === undefined ? existing.endsAt : endsAt;
    if (nextStartsAt && nextEndsAt && nextStartsAt > nextEndsAt) {
      throw new BadRequestException('Tanggal mulai banner tidak boleh setelah tanggal selesai.');
    }

    const banner = await this.prisma.posPromoBanner.update({
      where: { id },
      data: {
        ...(typeof data.title === 'string' && data.title.trim() ? { title: data.title.trim() } : {}),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(typeof data.linkUrl === 'string' ? { linkUrl: data.linkUrl.trim() || null } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: this.normalizeSortOrder(data.sortOrder) } : {}),
        ...(typeof data.isActive === 'boolean' ? { isActive: data.isActive } : {}),
        ...(startsAt !== undefined ? { startsAt } : {}),
        ...(endsAt !== undefined ? { endsAt } : {}),
      },
    });

    return this.mapPromoBanner(banner);
  }

  async deletePromoBanner(tenantId: string, id: string, branchId?: string | null) {
    const existing = await this.prisma.posPromoBanner.findFirst({
      where: { id, tenantId, ...(branchId ? { branchId } : {}) },
    });
    if (!existing) throw new NotFoundException('Banner promo tidak ditemukan.');
    await this.prisma.posPromoBanner.delete({ where: { id } });
    return { id, deleted: true };
  }

  async createProduct(tenantId: string, data: any, branchId?: string | null) {
    const name = String(data.name ?? '').trim();
    const categoryId = String(data.categoryId ?? '').trim();
    const price = Number(data.price ?? 0);
    if (!name) throw new BadRequestException('Product name is required');
    if (!categoryId) throw new BadRequestException('Category ID is required');
    if (!Number.isFinite(price) || price < 0) throw new BadRequestException('Price is invalid');

    const category = await this.prisma.posCategory.findFirst({ where: { id: categoryId, tenantId, ...(branchId ? { branchId } : {}) } });
    if (!category) throw new BadRequestException('Category is invalid for this tenant');
    if (!category.isActive) throw new BadRequestException('Kategori yang disembunyikan tidak bisa dipakai untuk menu baru.');

    const recipeItems = this.getRecipeItems(data);
    const variants = this.getProductVariants(data);
    const modifierGroups = this.getProductModifierGroups(data);
    const imageUrl = await this.saveMenuImageUrl(data.imageUrl) ?? null;
    const normalizedBranchId = branchId ?? category.branchId ?? null;
    const sortOrder = this.normalizeSortOrder(data.sortOrder);
    const sortConflict = await this.findProductSortOrderConflict(tenantId, normalizedBranchId, categoryId, sortOrder);
    if (sortConflict) {
      throw new BadRequestException(`Urutan ${sortOrder} sudah digunakan oleh menu "${sortConflict.name}" di kategori ini.`);
    }

    const product = await this.prisma.$transaction(async (tx) => {
      const savedProduct = await tx.posProduct.create({
        data: {
          tenantId,
          branchId: normalizedBranchId,
          categoryId,
          name,
          description: typeof data.description === 'string' ? data.description : null,
          price,
          imageUrl,
          isBestSeller: data.isBestSeller === true,
          isAvailable: data.isAvailable === false ? false : true,
          sortOrder,
        },
      });

      await this.saveProductRecipe(tx, tenantId, savedProduct.id, recipeItems);
      await this.replaceProductChoices(tx, tenantId, normalizedBranchId, savedProduct.id, variants, modifierGroups);

      return tx.posProduct.findUniqueOrThrow({
        where: { id: savedProduct.id },
        include: {
          recipe: { include: { items: true } },
          variants: true,
          modifierGroups: {
            include: {
              modifierGroup: {
                include: { options: true },
              },
            },
          },
        },
      });
    });

    return this.mapProduct(product);
  }

  async updateProduct(tenantId: string, id: string, data: any, branchId?: string | null) {
    const existing = await this.prisma.posProduct.findFirst({ where: { id, tenantId, ...(branchId ? { branchId } : {}) } });
    if (!existing) throw new NotFoundException('Product not found');

    let nextCategoryId = existing.categoryId;
    let nextBranchId = existing.branchId ?? null;
    if (typeof data.categoryId === 'string') {
      const category = await this.prisma.posCategory.findFirst({ where: { id: data.categoryId, tenantId } });
      if (!category) throw new BadRequestException('Category is invalid for this tenant');
      nextCategoryId = category.id;
      nextBranchId = category.branchId ?? existing.branchId ?? null;
    }
    const nextSortOrder = data.sortOrder !== undefined ? this.normalizeSortOrder(data.sortOrder) : existing.sortOrder;
    const sortConflict = await this.findProductSortOrderConflict(tenantId, nextBranchId, nextCategoryId, nextSortOrder, id);
    const allowSortOrderSwap = data.allowSortOrderSwap === true;
    if (sortConflict && !allowSortOrderSwap) {
      throw new BadRequestException(`Urutan ${nextSortOrder} sudah digunakan oleh menu "${sortConflict.name}" di kategori ini.`);
    }
    if (sortConflict && allowSortOrderSwap && (existing.categoryId !== nextCategoryId || (existing.branchId ?? null) !== nextBranchId)) {
      throw new BadRequestException('Tukar urutan hanya bisa dilakukan dalam kategori dan cabang yang sama.');
    }

    const recipeItems = this.getRecipeItems(data);
    const variants = this.getProductVariants(data);
    const modifierGroups = this.getProductModifierGroups(data);
    const imageUrl = await this.saveMenuImageUrl(data.imageUrl);

    const product = await this.prisma.$transaction(async (tx) => {
      if (sortConflict && allowSortOrderSwap) {
        await tx.posProduct.update({
          where: { id: sortConflict.id },
          data: { sortOrder: existing.sortOrder },
        });
      }
      await tx.posProduct.update({
        where: { id },
        data: {
          ...(typeof data.name === 'string' && data.name.trim() ? { name: data.name.trim() } : {}),
          ...(typeof data.description === 'string' ? { description: data.description } : {}),
          ...(typeof data.categoryId === 'string' ? { categoryId: data.categoryId } : {}),
          ...(data.price !== undefined ? { price: Number(data.price) || 0 } : {}),
          ...(imageUrl !== undefined ? { imageUrl } : {}),
          ...(typeof data.isBestSeller === 'boolean' ? { isBestSeller: data.isBestSeller } : {}),
          ...(typeof data.isAvailable === 'boolean' ? { isAvailable: data.isAvailable } : {}),
          ...(data.sortOrder !== undefined ? { sortOrder: nextSortOrder } : {}),
        },
      });

      await this.saveProductRecipe(tx, tenantId, id, recipeItems);
      await this.replaceProductChoices(tx, tenantId, nextBranchId, id, variants, modifierGroups);

      return tx.posProduct.findUniqueOrThrow({
        where: { id },
        include: {
          recipe: { include: { items: true } },
          variants: true,
          modifierGroups: {
            include: {
              modifierGroup: {
                include: { options: true },
              },
            },
          },
        },
      });
    });

    return this.mapProduct(product);
  }

  async deleteProduct(tenantId: string, id: string, branchId?: string | null) {
    const existing = await this.prisma.posProduct.findFirst({
      where: { id, tenantId, ...(branchId ? { branchId } : {}) },
      include: { recipe: true },
    });
    if (!existing) throw new NotFoundException('Product not found');

    const orderItemCount = await this.prisma.posOrderItem.count({
      where: {
        productId: id,
        order: {
          tenantId,
          ...(branchId ? { branchId } : {}),
        },
      },
    });

    if (orderItemCount > 0) {
      await this.prisma.$transaction(async (tx) => {
        if (existing.recipe) {
          await tx.posRecipe.delete({ where: { id: existing.recipe.id } });
        }
        await tx.posProduct.update({
          where: { id },
          data: { isAvailable: false, archivedAt: new Date() },
        });
      });

      return { id, deleted: false, archived: true };
    }

    await this.prisma.$transaction(async (tx) => {
      if (existing.recipe) {
        await tx.posRecipe.delete({ where: { id: existing.recipe.id } });
      }
      await tx.posProduct.delete({ where: { id } });
    });

    return { id, deleted: true, archived: false };
  }

  async restoreProduct(tenantId: string, id: string, branchId?: string | null) {
    const existing = await this.prisma.posProduct.findFirst({
      where: { id, tenantId, ...(branchId ? { branchId } : {}), archivedAt: { not: null } },
    });
    if (!existing) throw new NotFoundException('Archived product not found');

    const product = await this.prisma.posProduct.update({
      where: { id },
      data: {
        archivedAt: null,
        isAvailable: false,
      },
      include: {
        recipe: { include: { items: true } },
        variants: true,
        modifierGroups: {
          include: {
            modifierGroup: {
              include: { options: true },
            },
          },
        },
      },
    });

    return this.mapProduct(product);
  }

  private mapTable(table: any, isAvailable?: boolean) {
    return {
      id: table.id,
      name: table.name,
      number: String(table.name ?? '').replace(/^Meja\s*/i, ''),
      capacity: table.capacity,
      status: table.status,
      isAvailable: isAvailable ?? table.status === 'AVAILABLE',
    };
  }

  async getTables(tenantId: string, reservationTime?: string, pax?: number, branchId?: string | null) {
    const tables = await this.prisma.posTable.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: { name: 'asc' },
    });

    if (!reservationTime) {
      return tables.map((table) => this.mapTable(table, true));
    }

    // A simple availability check: If there is a reservation within 2 hours of this time for this table, it's not available.
    const resDate = new Date(reservationTime);
    const startRange = new Date(resDate.getTime() - 2 * 60 * 60 * 1000); // 2 hours before
    const endRange = new Date(resDate.getTime() + 2 * 60 * 60 * 1000);   // 2 hours after

    const conflictingOrders = await this.prisma.posOrder.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        orderType: 'RESERVATION',
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        reservationTime: {
          gte: startRange,
          lte: endRange,
        }
      },
      select: { tableId: true }
    });

    const conflictingTableIds = new Set(conflictingOrders.map(o => o.tableId));

    return tables.map(t => ({
      ...this.mapTable(t),
      isAvailable: !conflictingTableIds.has(t.id) && (!pax || t.capacity >= pax)
    }));
  }

  async createTable(tenantId: string, data: any, branchId?: string | null) {
    const rawName = String(data.name ?? data.number ?? '').trim();
    if (!rawName) throw new BadRequestException('Table name is required');
    const name = rawName.toLowerCase().startsWith('meja') ? rawName : `Meja ${rawName}`;
    const capacity = Math.max(1, Math.round(Number(data.capacity ?? 2) || 2));
    const status = String(data.status ?? 'AVAILABLE').toUpperCase();

    const table = await this.prisma.posTable.create({
      data: {
        tenantId,
        branchId: branchId ?? null,
        name,
        capacity,
        status: ['AVAILABLE', 'OCCUPIED', 'RESERVED'].includes(status) ? status : 'AVAILABLE',
      },
    });

    return this.mapTable(table);
  }

  async updateTable(tenantId: string, id: string, data: any, branchId?: string | null) {
    const existing = await this.prisma.posTable.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Table not found');

    const rawName = typeof data.name === 'string' ? data.name.trim() : typeof data.number === 'string' ? data.number.trim() : '';
    const status = typeof data.status === 'string' ? data.status.toUpperCase() : undefined;
    const table = await this.prisma.posTable.update({
      where: { id },
      data: {
        ...(rawName ? { name: rawName.toLowerCase().startsWith('meja') ? rawName : `Meja ${rawName}` } : {}),
        ...(data.capacity !== undefined ? { capacity: Math.max(1, Math.round(Number(data.capacity) || 1)) } : {}),
        ...(status && ['AVAILABLE', 'OCCUPIED', 'RESERVED'].includes(status) ? { status } : {}),
      },
    });

    return this.mapTable(table);
  }

  private mapReservation(order: any) {
    return {
      id: order.id,
      guestName: order.customerName ?? 'Tamu',
      contact: order.notes?.replace(/^Contact:\s*/i, '') ?? '',
      pax: order.pax ?? 1,
      time: order.reservationTime ? new Date(order.reservationTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '',
      tableId: order.tableId,
      status: order.status === 'CANCELLED' ? 'Cancelled' : order.status === 'COMPLETED' ? 'Completed' : order.status === 'SEATED' ? 'Seated' : 'Upcoming',
      reservationTime: order.reservationTime,
    };
  }

  async getReservations(tenantId: string, branchId?: string | null) {
    const rows = await this.prisma.posOrder.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}), orderType: 'RESERVATION' },
      orderBy: [{ reservationTime: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((order) => this.mapReservation(order));
  }

  async createReservation(tenantId: string, data: any, branchId?: string | null) {
    const customerName = String(data.guestName ?? data.customerName ?? '').trim();
    const tableId = String(data.tableId ?? '').trim();
    if (!customerName) throw new BadRequestException('Guest name is required');
    if (!tableId) throw new BadRequestException('Table is required');
    const table = await this.prisma.posTable.findFirst({ where: { id: tableId, tenantId, ...(branchId ? { branchId } : {}) } });
    if (!table) throw new BadRequestException('Table does not belong to tenant');

    const dateText = String(data.date ?? new Date().toISOString().slice(0, 10));
    const timeText = String(data.time ?? '19:00');
    const reservationTime = new Date(`${dateText}T${timeText}:00`);
    if (Number.isNaN(reservationTime.getTime())) throw new BadRequestException('Reservation time is invalid');

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const count = await this.prisma.posOrder.count({ where: { tenantId, ...(branchId ? { branchId } : {}), orderType: 'RESERVATION' } });
    const order = await this.prisma.posOrder.create({
      data: {
        tenantId,
        branchId: branchId ?? null,
        invoiceNumber: `RSV/${dateStr}/${String(count + 1).padStart(3, '0')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        totalAmount: 0,
        paymentMethod: 'CASH',
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        kitchenStatus: 'PENDING',
        notes: String(data.contact ?? '').trim() ? `Contact: ${String(data.contact).trim()}` : null,
        orderType: 'RESERVATION',
        tableId,
        reservationTime,
        pax: Math.max(1, Math.round(Number(data.pax ?? 1) || 1)),
        customerName,
        followUpStatus: 'PENDING',
      },
    });
    await this.prisma.posTable.update({ where: { id: tableId }, data: { status: 'RESERVED' } });
    return this.mapReservation(order);
  }

  async updateReservationStatus(tenantId: string, id: string, data: any, branchId?: string | null) {
    const status = String(data.status ?? '').trim();
    const statusMap: Record<string, string> = {
      Upcoming: 'PENDING',
      Seated: 'SEATED',
      Completed: 'COMPLETED',
      Cancelled: 'CANCELLED',
    };
    const nextStatus = statusMap[status] ?? status.toUpperCase();
    if (!['PENDING', 'SEATED', 'COMPLETED', 'CANCELLED'].includes(nextStatus)) throw new BadRequestException('Invalid reservation status');
    const existing = await this.prisma.posOrder.findFirst({ where: { id, tenantId, orderType: 'RESERVATION' } });
    if (!existing) throw new NotFoundException('Reservation not found');
    const updated = await this.prisma.posOrder.update({ where: { id }, data: { status: nextStatus } });
    if (existing.tableId && ['COMPLETED', 'CANCELLED'].includes(nextStatus)) {
      await this.prisma.posTable.update({ where: { id: existing.tableId }, data: { status: 'AVAILABLE' } });
    }
    if (existing.tableId && nextStatus === 'SEATED') {
      await this.prisma.posTable.update({ where: { id: existing.tableId }, data: { status: 'OCCUPIED' } });
    }
    return this.mapReservation(updated);
  }

  /**
   * Creates a new POS Order and deducts inventory stock automatically
   * using a database transaction to ensure atomicity.
   */
  async createOrder(tenantId: string, data: CreateOrderDto, branchId?: string | null) {
    const settings = await this.getFnbSettings(tenantId, branchId);
    const methodKeyMap: Record<CreateOrderDto['paymentMethod'], keyof FnbPaymentMethods> = {
      CASH: 'cash',
      QRIS: 'qris',
      E_WALLET: 'eWallet',
      DEBIT: 'debit',
      TRANSFER: 'transfer',
    };
    const methodKey = methodKeyMap[data.paymentMethod];
    if (methodKey && !settings.payment.methods[methodKey]) {
      throw new BadRequestException('Payment method is disabled for this outlet');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Generate Invoice Number (e.g. INV/2026/05/30/001)
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
        // Simple logic for sequence count:
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const count = await tx.posOrder.count({
          where: {
            tenantId,
            ...(branchId ? { branchId } : {}),
            createdAt: { gte: todayStart },
          }
        });
        const seq = (count + 1).toString().padStart(3, '0');
        const invoiceNumber = `INV/${dateStr}/${seq}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const openShift = await tx.posShift.findFirst({
          where: { tenantId, status: 'OPEN', ...(branchId ? { branchId } : {}) },
          orderBy: { startTime: 'desc' },
        });

        const productIds = data.items.map((item: any) => item.productId);
        const products = await tx.posProduct.findMany({
          where: { id: { in: productIds }, tenantId }
        });
        const productMap = new Map(products.map(p => [p.id, Number(p.price)]));

        let subtotal = 0;
        const processedItems = data.items.map((item: any) => {
          const basePrice = productMap.get(item.productId) ?? 0;
          let extraPrice = 0;
          
          if (item.variantSnapshot && typeof item.variantSnapshot === 'object' && 'priceAdjustment' in item.variantSnapshot) {
            extraPrice += Number((item.variantSnapshot as any).priceAdjustment) || 0;
          }
          if (Array.isArray(item.modifiersSnapshot)) {
            for (const mod of item.modifiersSnapshot) {
              if (mod && typeof mod === 'object' && 'priceAdjustment' in mod) {
                extraPrice += Number(mod.priceAdjustment) || 0;
              }
            }
          }
          const finalPrice = basePrice + extraPrice;
          subtotal += finalPrice * item.quantity;
          
          return {
            ...item,
            priceAtSale: finalPrice
          };
        });

        let finalTotalAmount = subtotal;
        if (settings.serviceChargeRate > 0) {
          finalTotalAmount += (subtotal * (settings.serviceChargeRate / 100));
        }
        if (settings.taxRate > 0) {
          finalTotalAmount += (finalTotalAmount * (settings.taxRate / 100));
        }
        finalTotalAmount = Math.round(finalTotalAmount);

        // DP Logic: If reservation is on a different day, and dpAmount is passed or we assume 50%
        let finalPaymentStatus = 'UNPAID';
        let dpAmount = 0;
        if (data.orderType === 'RESERVATION' && data.reservationTime) {
          const resDateStr = new Date(data.reservationTime).toISOString().slice(0, 10);
          const todayStr = new Date().toISOString().slice(0, 10);
          if (resDateStr !== todayStr) {
            // Require DP 50%
            dpAmount = data.dpAmount || (finalTotalAmount / 2);
            // If they pay DP now, mark as PARTIALLY_PAID
            if (data.paymentMethod !== 'CASH' || data.cashReceived! >= dpAmount) {
              finalPaymentStatus = 'PARTIALLY_PAID';
            }
          }
        }

        // 2. Create the Order
        const order = await tx.posOrder.create({
          data: {
            tenantId,
            branchId: branchId ?? null,
            invoiceNumber,
            totalAmount: finalTotalAmount,
            paymentMethod: data.paymentMethod,
            cashReceived: data.cashReceived || 0,
            changeAmount: data.changeAmount || 0,
            status: 'PENDING',
            paymentStatus: finalPaymentStatus,
            kitchenStatus: 'PENDING',
            notes: data.notes || '',
            shiftId: openShift?.id,
            orderType: data.orderType || 'DINE_IN',
            tableId: data.tableId || null,
            reservationTime: data.reservationTime ? new Date(data.reservationTime) : null,
            pax: data.pax || 1,
            customerName: data.customerName || null,
            dpAmount: dpAmount > 0 ? dpAmount : null,
            followUpStatus: data.orderType === 'RESERVATION' ? 'PENDING' : 'CONFIRMED',
            items: {
              create: processedItems.map((item: any) => ({
                productId: item.productId,
                quantity: item.quantity,
                priceAtSale: item.priceAtSale,
                variantSnapshot: item.variantSnapshot || Prisma.JsonNull,
                modifiersSnapshot: item.modifiersSnapshot || Prisma.JsonNull,
                note: item.note,
              }))
            }
          },
          include: {
            items: true,
          }
        });

        // 3. Deduct Inventory Stock
        await this.inventoryService.deductStockForOrderItems(
          tenantId,
          data.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
          tx,
          order.id,
          branchId ?? null
        );

        return order;
      });
    } catch (error) {
      console.error('Error creating POS order:', error);
      throw new InternalServerErrorException('Failed to create order');
    }
  }

  async getOrderHistory(tenantId: string, orderIds: string[]) {
    if (!orderIds || orderIds.length === 0) return [];
    const orders = await this.prisma.posOrder.findMany({
      where: {
        tenantId,
        id: { in: orderIds },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: { product: true }
        }
      }
    });
    return orders.map((order) => this.mapOrder(order));
  }

  async getReceipt(tenantId: string, orderId: string) {
    const order = await this.prisma.posOrder.findFirst({
      where: { tenantId, id: orderId },
      include: {
        tenant: true,
        items: {
          include: { product: true }
        }
      }
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return {
      ...this.mapOrder(order),
      paymentSettings: this.publicPaymentSettings(order.tenant.fnbSettings, order.branchId),
    };
  }

  async markOrderAsPaid(tenantId: string, orderId: string, data: { cashReceived?: number }, branchId?: string | null) {
    if (branchId) { const order = await this.prisma.posOrder.findFirst({ where: { id: orderId, tenantId, branchId } }); if (!order) throw new NotFoundException('Order not found in your branch'); }
    const order = await this.prisma.posOrder.findFirst({
      where: { tenantId, id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.paymentStatus === 'PAID') {
      throw new BadRequestException('Order is already paid');
    }

    const cashReceived = data.cashReceived || Number(order.totalAmount);
    const changeAmount = cashReceived - Number(order.totalAmount);

    const updatedOrder = await this.prisma.posOrder.update({
      where: { id: orderId },
      data: {
        status: 'PAID', // Also update overall status to PAID
        paymentStatus: 'PAID',
        cashReceived,
        changeAmount: Math.max(0, changeAmount),
      },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    return this.mapOrder(updatedOrder);
  }

  async updateFollowUpStatus(tenantId: string, orderId: string, status: string, branchId?: string | null) {
    if (branchId) { const order = await this.prisma.posOrder.findFirst({ where: { id: orderId, tenantId, branchId } }); if (!order) throw new NotFoundException('Order not found in your branch'); }
    const updatedOrder = await this.prisma.posOrder.update({
      where: { id: orderId, tenantId },
      data: { followUpStatus: status },
      include: {
        items: { include: { product: true } }
      }
    });
    return this.mapOrder(updatedOrder);
  }

  async cancelOrder(tenantId: string, orderId: string, branchId?: string | null) {
    if (branchId) { const order = await this.prisma.posOrder.findFirst({ where: { id: orderId, tenantId, branchId } }); if (!order) throw new NotFoundException('Order not found in your branch'); }
    const order = await this.prisma.posOrder.findFirst({
      where: { tenantId, id: orderId },
      include: { tenant: true }
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.status === 'CANCELLED' || order.status === 'COMPLETED') {
      throw new BadRequestException('Order cannot be cancelled');
    }

    // Determine refund logic based on tenant config
    let isRefunded = false;
    let refundAmount = 0;
    
    // Parse fnbSettings
    const settings = order.tenant.fnbSettings as any;
    const refundPolicy = settings?.refundPolicy || 'NO_REFUND';

    // If DP was paid and policy is to refund
    if (order.paymentStatus === 'PARTIALLY_PAID' || order.paymentStatus === 'PAID') {
      const amountPaid = Number(order.paymentStatus === 'PARTIALLY_PAID' ? (order.dpAmount || 0) : order.totalAmount);
      if (refundPolicy === 'REFUND_50') {
        isRefunded = true;
        refundAmount = amountPaid * 0.5;
      } else if (refundPolicy === 'FULL_REFUND') {
        isRefunded = true;
        refundAmount = amountPaid;
      } else {
        isRefunded = false;
        refundAmount = 0;
      }
    }

    const updatedOrder = await this.prisma.posOrder.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        isRefunded,
        refundAmount,
      },
      include: {
        items: { include: { product: true } }
      }
    });

    // TODO: restore inventory stock (omitted for brevity if needed)
    return this.mapOrder(updatedOrder);
  }
}
