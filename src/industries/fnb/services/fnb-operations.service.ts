import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

const preOrderStatuses = ['New', 'Confirmed', 'In Production', 'Ready', 'Completed', 'Cancelled'];
const wholesaleStatuses = ['Draft', 'Confirmed', 'Packed', 'Delivered', 'Invoiced'];

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dateValue(value: unknown, fallback = new Date()) {
  if (!value) return fallback;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

@Injectable()
export class FnbOperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSnapshot(tenantId: string, branchId?: string | null) {
    const [promoRules, preOrders, wholesaleCustomers, wholesaleOrders, deliveryIntegrations, deliveryStatuses, foodCourtTenants, tenantSettlements] =
      await Promise.all([
        this.getPromoRules(tenantId, branchId),
        this.getPreOrders(tenantId, branchId),
        this.getWholesaleCustomers(tenantId, branchId),
        this.getWholesaleOrders(tenantId, branchId),
        this.getDeliveryIntegrations(tenantId, branchId),
        this.getDeliveryStatuses(tenantId, branchId),
        this.getFoodCourtTenants(tenantId, branchId),
        this.getTenantSettlements(tenantId, branchId),
      ]);

    return {
      promoRules,
      preOrders,
      wholesaleCustomers,
      wholesaleOrders,
      deliveryIntegrations,
      deliveryStatuses,
      foodCourtTenants,
      tenantSettlements,
    };
  }

  async getPromoRules(tenantId: string, branchId?: string | null) {
    const rows = await this.prisma.fnbPromoRule.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: [{ createdAt: 'desc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      tenant: row.tenantName ?? 'Semua tenant',
      type: row.type,
      status: row.status,
      startDate: row.startDate,
      endDate: row.endDate,
      period: `${row.startDate ? row.startDate.toLocaleDateString('id-ID') : '01 Jun'} - ${row.endDate ? row.endDate.toLocaleDateString('id-ID') : '30 Jun 2026'}`,
    }));
  }

  async createPromoRule(tenantId: string, data: any, branchId?: string | null) {
    const name = String(data.name ?? '').trim();
    const type = String(data.type ?? '').trim();
    if (!name || !type) throw new BadRequestException('Promo name and type are required');

    const rule = await this.prisma.fnbPromoRule.create({
      data: {
        tenantId,
        branchId: branchId ?? null,
        name,
        type,
        tenantName: String(data.tenant ?? data.tenantName ?? 'Semua tenant').trim() || 'Semua tenant',
        status: String(data.status ?? 'Aktif'),
        startDate: data.startDate ? dateValue(data.startDate) : null,
        endDate: data.endDate ? dateValue(data.endDate) : null,
      },
    });

    return (await this.getPromoRules(tenantId, branchId)).find((row) => row.id === rule.id);
  }

  async getPreOrders(tenantId: string, branchId?: string | null) {
    const rows = await this.prisma.fnbBakeryPreOrder.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: [{ pickupDate: 'asc' }, { pickupTime: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      customerName: row.customerName,
      contact: row.contact,
      productName: row.productName,
      pickupDate: row.pickupDate.toISOString().slice(0, 10),
      pickupTime: row.pickupTime,
      quantity: row.quantity,
      depositPaid: Number(row.depositPaid),
      totalAmount: Number(row.totalAmount),
      status: row.status,
      notes: row.notes ?? '',
    }));
  }

  async createPreOrder(tenantId: string, data: any, branchId?: string | null) {
    const customerName = String(data.customerName ?? '').trim();
    const contact = String(data.contact ?? '').trim();
    const productName = String(data.productName ?? '').trim();
    if (!customerName || !contact || !productName) {
      throw new BadRequestException('Customer, contact, and product are required');
    }

    const row = await this.prisma.fnbBakeryPreOrder.create({
      data: {
        tenantId,
        branchId: branchId ?? null,
        customerName,
        contact,
        productName,
        pickupDate: dateValue(data.pickupDate),
        pickupTime: String(data.pickupTime ?? '12:00'),
        quantity: Math.max(1, Math.round(numberValue(data.quantity, 1))),
        depositPaid: numberValue(data.depositPaid),
        totalAmount: numberValue(data.totalAmount),
        notes: String(data.notes ?? '').trim() || null,
      },
    });

    return (await this.getPreOrders(tenantId, branchId)).find((item) => item.id === row.id);
  }

  async updatePreOrderStatus(tenantId: string, id: string, status: string) {
    if (!preOrderStatuses.includes(status)) throw new BadRequestException('Invalid pre-order status');
    const existing = await this.prisma.fnbBakeryPreOrder.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Pre-order not found');
    await this.prisma.fnbBakeryPreOrder.update({ where: { id }, data: { status } });
    return (await this.getPreOrders(tenantId)).find((item) => item.id === id);
  }

  async getWholesaleCustomers(tenantId: string, branchId?: string | null) {
    const rows = await this.prisma.fnbWholesaleCustomer.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: [{ name: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      channel: row.channel,
      priceTier: row.priceTier,
      paymentTerms: row.paymentTerms,
    }));
  }

  async createWholesaleCustomer(tenantId: string, data: any, branchId?: string | null) {
    const name = String(data.name ?? '').trim();
    if (!name) throw new BadRequestException('Wholesale customer name is required');

    const channel = String(data.channel ?? 'Cafe').trim() || 'Cafe';
    const priceTier = String(data.priceTier ?? 'Silver').trim() || 'Silver';
    const paymentTerms = String(data.paymentTerms ?? 'COD').trim() || 'COD';

    const customer = await this.prisma.fnbWholesaleCustomer.create({
      data: {
        tenantId,
        branchId: branchId ?? null,
        name,
        channel,
        priceTier,
        paymentTerms,
      },
    });

    return {
      id: customer.id,
      name: customer.name,
      channel: customer.channel,
      priceTier: customer.priceTier,
      paymentTerms: customer.paymentTerms,
    };
  }

  async getWholesaleOrders(tenantId: string, branchId?: string | null) {
    const rows = await this.prisma.fnbWholesaleOrder.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: [{ deliveryDate: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      customerId: row.customerId,
      deliveryDate: row.deliveryDate.toISOString().slice(0, 10),
      status: row.status,
      items: Array.isArray(row.items) ? row.items : [],
    }));
  }

  async createWholesaleOrder(tenantId: string, data: any, branchId?: string | null) {
    const customerId = String(data.customerId ?? '').trim();
    const customer = await this.prisma.fnbWholesaleCustomer.findFirst({ where: { id: customerId, tenantId, ...(branchId ? { branchId } : {}) } });
    if (!customer) throw new BadRequestException('Wholesale customer is required');
    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) throw new BadRequestException('Wholesale items are required');

    const row = await this.prisma.fnbWholesaleOrder.create({
      data: {
        tenantId,
        branchId: branchId ?? customer.branchId ?? null,
        customerId,
        deliveryDate: dateValue(data.deliveryDate),
        items: items as Prisma.InputJsonValue,
      },
    });

    return (await this.getWholesaleOrders(tenantId, branchId)).find((item) => item.id === row.id);
  }

  async updateWholesaleOrderStatus(tenantId: string, id: string, status: string) {
    if (!wholesaleStatuses.includes(status)) throw new BadRequestException('Invalid wholesale status');
    const existing = await this.prisma.fnbWholesaleOrder.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Wholesale order not found');
    await this.prisma.fnbWholesaleOrder.update({ where: { id }, data: { status } });
    return (await this.getWholesaleOrders(tenantId)).find((item) => item.id === id);
  }

  async getDeliveryIntegrations(tenantId: string, branchId?: string | null) {
    const rows = await this.prisma.fnbDeliveryIntegration.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: [{ channel: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      channel: row.channel,
      status: row.status,
      menuMapped: row.menuMapped,
      notes: row.notes ?? '',
    }));
  }

  async createDeliveryIntegration(tenantId: string, data: any, branchId?: string | null) {
    const channel = String(data.channel ?? '').trim();
    if (!channel) throw new BadRequestException('Delivery channel is required');

    const row = await this.prisma.fnbDeliveryIntegration.create({
      data: {
        tenantId,
        branchId: branchId ?? null,
        channel,
        status: String(data.status ?? 'Ready to connect').trim() || 'Ready to connect',
        menuMapped: Math.max(0, Math.round(numberValue(data.menuMapped))),
        notes: String(data.notes ?? '').trim() || null,
      },
    });

    return {
      id: row.id,
      channel: row.channel,
      status: row.status,
      menuMapped: row.menuMapped,
      notes: row.notes ?? '',
    };
  }

  async getDeliveryStatuses(tenantId: string, branchId?: string | null) {
    const rows = await this.prisma.fnbDeliveryStatus.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: [{ createdAt: 'desc' }],
      take: 80,
    });
    return rows.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      channel: row.channel,
      kitchenStatus: row.kitchenStatus,
      fulfillment: row.fulfillment,
      etaMinutes: row.etaMinutes,
      createdAt: row.createdAt,
    }));
  }

  async generateDeliveryStatuses(tenantId: string, branchId?: string | null) {
    await this.seedDeliveryStatusesIfEmpty(tenantId, branchId);
    return this.getDeliveryStatuses(tenantId, branchId);
  }

  async getFoodCourtTenants(tenantId: string, branchId?: string | null) {
    const rows = await this.prisma.fnbFoodCourtTenant.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: [{ name: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      commission: Number(row.commission),
      categoryName: row.categoryName,
    }));
  }

  async createFoodCourtTenant(tenantId: string, data: any, branchId?: string | null) {
    const name = String(data.name ?? '').trim();
    if (!name) throw new BadRequestException('Tenant name is required');
    const row = await this.prisma.fnbFoodCourtTenant.create({
      data: {
        tenantId,
        branchId: branchId ?? null,
        name,
        status: String(data.status ?? 'Aktif'),
        commission: numberValue(data.commission, 12),
        categoryName: String(data.categoryName ?? '').trim() || null,
      },
    });
    return (await this.getFoodCourtTenants(tenantId, branchId)).find((item) => item.id === row.id);
  }

  async getTenantSettlements(tenantId: string, branchId?: string | null) {
    const rows = await this.prisma.fnbTenantSettlement.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      include: { foodCourtTenant: true },
      orderBy: [{ period: 'desc' }, { foodCourtTenant: { name: 'asc' } }],
    });
    return rows.map((row) => ({
      id: row.id,
      tenantId: row.foodCourtTenantId,
      tenantName: row.foodCourtTenant.name,
      status: row.status,
      commission: Number(row.foodCourtTenant.commission),
      sales: Number(row.salesAmount),
      commissionAmount: Number(row.commissionAmount),
      settlement: Number(row.netSettlement),
      period: row.period,
    }));
  }

  async generateTenantSettlements(tenantId: string, branchId?: string | null) {
    await this.ensureSettlementRows(tenantId, branchId);
    return this.getTenantSettlements(tenantId, branchId);
  }

  async markSettlementPaid(tenantId: string, id: string) {
    const existing = await this.prisma.fnbTenantSettlement.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Settlement not found');
    await this.prisma.fnbTenantSettlement.update({ where: { id }, data: { status: 'Paid', paidAt: new Date() } });
    return (await this.getTenantSettlements(tenantId)).find((row) => row.id === id);
  }

  private async seedWholesaleCustomersIfEmpty(tenantId: string) {
    const count = await this.prisma.fnbWholesaleCustomer.count({ where: { tenantId } });
    if (count > 0) return;
    await this.prisma.fnbWholesaleCustomer.createMany({
      data: [
        { tenantId, name: 'Hotel Aruna', channel: 'Hotel', priceTier: 'Platinum', paymentTerms: 'Net 14' },
        { tenantId, name: 'Kopi Lantai Dua', channel: 'Cafe', priceTier: 'Gold', paymentTerms: 'Net 7' },
        { tenantId, name: 'Reseller Bu Rani', channel: 'Reseller', priceTier: 'Silver', paymentTerms: 'COD' },
      ],
    });
  }

  private async seedDeliveryIntegrationsIfEmpty(tenantId: string) {
    const count = await this.prisma.fnbDeliveryIntegration.count({ where: { tenantId } });
    if (count > 0) return;
    const productCount = await this.prisma.posProduct.count({ where: { tenantId } });
    await this.prisma.fnbDeliveryIntegration.createMany({
      data: [
        { tenantId, channel: 'GrabFood', status: 'Connected', menuMapped: productCount, notes: 'Auto accept aktif' },
        { tenantId, channel: 'GoFood', status: 'Connected', menuMapped: Math.max(0, productCount - 1), notes: 'Auto accept aktif' },
        { tenantId, channel: 'ShopeeFood', status: 'Ready to connect', menuMapped: Math.max(0, productCount - 2), notes: 'Butuh API key' },
        { tenantId, channel: 'WhatsApp Order', status: 'Ready to connect', menuMapped: productCount, notes: 'Butuh nomor bisnis' },
      ],
      skipDuplicates: true,
    });
  }

  private async seedDeliveryStatusesIfEmpty(tenantId: string, branchId?: string | null) {
    const count = await this.prisma.fnbDeliveryStatus.count({ where: { tenantId, ...(branchId ? { branchId } : {}) } });
    if (count > 0) return;
    const orders = await this.prisma.posOrder.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}), status: { not: 'CANCELLED' } },
      orderBy: [{ createdAt: 'desc' }],
      take: 20,
    });
    if (orders.length === 0) return;
    const channels = ['GrabFood', 'GoFood', 'ShopeeFood', 'WhatsApp Order'];
    await this.prisma.fnbDeliveryStatus.createMany({
      data: orders.map((order, index) => ({
        tenantId,
        branchId: branchId ?? null,
        invoiceNumber: order.invoiceNumber,
        channel: channels[index % channels.length],
        kitchenStatus: order.kitchenStatus ?? order.status,
        fulfillment: ['Waiting pickup', 'Driver assigned', 'On delivery'][index % 3],
        etaMinutes: 12 + index * 5,
        createdAt: order.createdAt,
      })),
    });
  }

  private async seedFoodCourtTenantsIfEmpty(tenantId: string) {
    const count = await this.prisma.fnbFoodCourtTenant.count({ where: { tenantId } });
    if (count > 0) return;
    const categories = await this.prisma.posCategory.findMany({ where: { tenantId }, take: 4, orderBy: [{ name: 'asc' }] });
    const names = categories.length > 0 ? categories.map((category) => category.name) : ['Tenant Sate Nusantara', 'Tenant Kopi Sudut', 'Tenant Bakmi Kota'];
    await this.prisma.fnbFoodCourtTenant.createMany({
      data: names.map((name, index) => ({
        tenantId,
        name: name.startsWith('Tenant') ? name : `Tenant ${name}`,
        status: index === names.length - 1 ? 'Review' : 'Aktif',
        commission: 12 + index * 2,
        categoryName: name,
      })),
    });
  }

  private async ensureSettlementRows(tenantId: string, branchId?: string | null) {
    const tenants = await this.getFoodCourtTenants(tenantId, branchId);
    const period = new Date().toISOString().slice(0, 7);
    const orders = await this.prisma.posOrder.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}), status: { not: 'CANCELLED' } },
      orderBy: [{ createdAt: 'desc' }],
    });
    const totalSales = orders.reduce((sum, order) => sum + Number(order.totalAmount), 0);

    await Promise.all(
      tenants.map(async (tenant, index) => {
        const existing = await this.prisma.fnbTenantSettlement.findUnique({
          where: { foodCourtTenantId_period: { foodCourtTenantId: tenant.id, period } },
        });
        if (existing) return;
        const salesAmount = tenants.length > 0 ? totalSales / tenants.length + index * 25000 : 0;
        const commissionAmount = salesAmount * (tenant.commission / 100);
        await this.prisma.fnbTenantSettlement.create({
          data: {
            tenantId,
            branchId: branchId ?? null,
            foodCourtTenantId: tenant.id,
            period,
            salesAmount,
            commissionAmount,
            netSettlement: salesAmount - commissionAmount,
          },
        });
      }),
    );
  }
}
