import type { FastifyInstance } from 'fastify';
import {
  AppError,
  shipmentUpdateSchema,
  type ShipmentDto,
  type SupplierOrderDto,
} from '@3dsfera/shared';
import { prisma } from '../../lib/prisma.js';
import { parseInput } from '../../lib/validate.js';
import { recordAudit } from '../../lib/audit.js';
import { hashIp } from '../../lib/tokens.js';
import { env } from '../../env.js';
import { sendShipmentNotice } from '../../lib/mailer.js';
import { orderStatusUrl } from '../orders/service.js';

/**
 * Incoming orders, as a supplier sees them.
 *
 * A supplier sees their own lines and where the parcel is going — city and
 * country. The street address is not theirs to browse; it belongs on the label
 * at the moment of shipping, and until the carrier integration exists it stays
 * with the buyer and the admin.
 */
function requireSupplierId(request: {
  currentUser: { supplier: { id: string } | null } | null;
}): string {
  const supplier = request.currentUser?.supplier;
  if (!supplier) {
    throw new AppError({
      status: 400,
      code: 'ERR_SUPPLIER_PROFILE_REQUIRED',
      message: 'This account has no supplier profile',
    });
  }
  return supplier.id;
}

export async function supplierOrderRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireRole('SUPPLIER', 'ADMIN'));

  app.get('/', async (request) => {
    const supplierId = requireSupplierId(request);

    const items = await prisma.orderItem.findMany({
      where: {
        supplierId,
        // Unpaid orders are not work: they may never be paid at all.
        order: { status: { in: ['PAID', 'PACKING', 'SHIPPED', 'DELIVERED'] } },
      },
      orderBy: { order: { createdAt: 'desc' } },
      take: 200,
      select: {
        titleSnapshot: true,
        quantity: true,
        unitPriceCents: true,
        order: {
          select: {
            id: true,
            number: true,
            status: true,
            currency: true,
            createdAt: true,
            paidAt: true,
            address: { select: { country: true, city: true } },
            shipments: {
              where: { supplierId },
              select: {
                id: true,
                carrier: true,
                trackingNumber: true,
                status: true,
                shippedAt: true,
                deliveredAt: true,
                supplier: { select: { companyName: true } },
              },
              take: 1,
            },
          },
        },
      },
    });

    // One row per order, with that supplier's lines grouped under it.
    const byOrder = new Map<string, SupplierOrderDto>();

    for (const item of items) {
      const existing = byOrder.get(item.order.id);
      const line = {
        title: item.titleSnapshot,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      };

      if (existing) {
        existing.items.push(line);
        existing.totalCents += line.unitPriceCents * line.quantity;
        continue;
      }

      const shipment = item.order.shipments[0];

      byOrder.set(item.order.id, {
        orderId: item.order.id,
        orderNumber: item.order.number,
        status: item.order.status,
        createdAt: item.order.createdAt.toISOString(),
        paidAt: item.order.paidAt?.toISOString() ?? null,
        currency: item.order.currency,
        items: [line],
        totalCents: line.unitPriceCents * line.quantity,
        destination: {
          country: item.order.address?.country ?? '',
          city: item.order.address?.city ?? '',
        },
        shipment: shipment
          ? {
              id: shipment.id,
              carrier: shipment.carrier,
              trackingNumber: shipment.trackingNumber,
              status: shipment.status,
              supplierName: shipment.supplier.companyName,
              shippedAt: shipment.shippedAt?.toISOString() ?? null,
              deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
            }
          : null,
      });
    }

    return { orders: [...byOrder.values()] };
  });

  /**
   * Creates or updates this supplier's shipment for an order. The order's own
   * status follows: it ships when every supplier in it has shipped, and is
   * delivered when every parcel has arrived.
   */
  app.put('/:orderId/shipment', async (request) => {
    const supplierId = requireSupplierId(request);
    const { orderId } = request.params as { orderId: string };
    const input = parseInput(shipmentUpdateSchema, request.body);

    const owns = await prisma.orderItem.findFirst({
      where: { orderId, supplierId },
      select: { id: true },
    });

    if (!owns) {
      throw new AppError({ status: 404, code: 'ERR_NOT_FOUND', message: 'Order not found' });
    }

    const existing = await prisma.shipment.findFirst({
      where: { orderId, supplierId },
      select: { id: true, status: true },
    });

    const shipped = input.status !== 'CREATED';
    const delivered = input.status === 'DELIVERED';

    const shipment = existing
      ? await prisma.shipment.update({
          where: { id: existing.id },
          data: {
            carrier: input.carrier,
            trackingNumber: input.trackingNumber ?? null,
            status: input.status,
            ...(shipped ? { shippedAt: new Date() } : {}),
            ...(delivered ? { deliveredAt: new Date() } : {}),
          },
          select: { id: true, carrier: true, trackingNumber: true, status: true },
        })
      : await prisma.shipment.create({
          data: {
            orderId,
            supplierId,
            carrier: input.carrier,
            trackingNumber: input.trackingNumber ?? null,
            status: input.status,
            ...(shipped ? { shippedAt: new Date() } : {}),
            ...(delivered ? { deliveredAt: new Date() } : {}),
          },
          select: { id: true, carrier: true, trackingNumber: true, status: true },
        });

    await syncOrderStatus(orderId);

    if (shipped && !existing?.status.startsWith('HANDED')) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { number: true, buyer: { select: { email: true, locale: true } } },
      });

      if (order) {
        await sendShipmentNotice({
          to: order.buyer.email,
          locale: order.buyer.locale,
          orderNumber: order.number,
          carrier: input.carrier,
          trackingNumber: input.trackingNumber ?? null,
          statusUrl: orderStatusUrl(order.number),
        });
      }
    }

    await recordAudit({
      actorUserId: request.currentUser?.id ?? null,
      actorRole: request.currentUser?.role ?? 'SUPPLIER',
      action: 'shipment.update',
      entityType: 'Order',
      entityId: orderId,
      metadata: { status: input.status, carrier: input.carrier },
      ipHash: hashIp(request.ip, env.SESSION_SECRET),
    });

    const dto: Pick<ShipmentDto, 'id' | 'carrier' | 'trackingNumber' | 'status'> = shipment;
    return { shipment: dto };
  });
}

/**
 * An order with several suppliers moves only when they all have. Anything else
 * tells the buyer their order shipped when half of it is still on a shelf.
 */
async function syncOrderStatus(orderId: string): Promise<void> {
  const [suppliers, shipments, order] = await Promise.all([
    prisma.orderItem.findMany({
      where: { orderId },
      select: { supplierId: true },
      distinct: ['supplierId'],
    }),
    prisma.shipment.findMany({ where: { orderId }, select: { status: true } }),
    prisma.order.findUnique({ where: { id: orderId }, select: { status: true } }),
  ]);

  if (!order || order.status === 'CANCELLED' || order.status === 'PENDING') return;

  const expected = suppliers.length;
  const dispatched = shipments.filter((shipment) => shipment.status !== 'CREATED').length;
  const delivered = shipments.filter((shipment) => shipment.status === 'DELIVERED').length;

  const next =
    delivered === expected && expected > 0
      ? 'DELIVERED'
      : dispatched === expected && expected > 0
        ? 'SHIPPED'
        : shipments.length > 0
          ? 'PACKING'
          : order.status;

  if (next !== order.status) {
    await prisma.order.update({ where: { id: orderId }, data: { status: next } });
  }
}
