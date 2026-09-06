import { randomBytes } from 'node:crypto';
import {
  AppError,
  type CheckoutInput,
  type CheckoutResult,
  type Locale,
  type OrderDetail,
  type OrderItemDto,
  type OrderSummary,
  type ShipmentDto,
  type ShippingQuote,
  type ShippingQuoteInput,
} from '@3dsfera/shared';
import type { Db } from '../../lib/prisma.js';
import { publicUrl } from '../../lib/storage.js';
import { sendOrderConfirmation } from '../../lib/mailer.js';
import { env } from '../../env.js';
import { paymentProvider } from '../payments/index.js';
import { MAX_PARCEL_GRAMS, quoteShipping } from './shipping.js';

/**
 * Orders.
 *
 * Two rules shape everything here. Money is computed from the database, never
 * from the request: the client says what it wants and how many, and nothing
 * else. And an order is written in one transaction with the stock it consumes,
 * so two buyers racing for the last item cannot both win.
 */

const ORDER_NUMBER_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Human-readable and unambiguous over the phone: no zero/O, no one/I, and the
 * date up front so support can find it without a search.
 */
function generateOrderNumber(now = new Date()): string {
  const date = now.toISOString().slice(2, 10).replace(/-/g, '');
  const random = Array.from(randomBytes(5))
    .map((byte) => ORDER_NUMBER_ALPHABET[byte % ORDER_NUMBER_ALPHABET.length])
    .join('');

  return `SF-${date}-${random}`;
}

interface PricedLine {
  productId: string;
  supplierId: string;
  supplierName: string;
  slug: string;
  title: string;
  unitPriceCents: number;
  quantity: number;
  weightGrams: number;
  currency: string;
  previewUrl: string | null;
}

/**
 * Loads the requested products and prices them from the database.
 *
 * Also where every reason to refuse an order lives: a product that vanished,
 * one that is no longer published, a currency mismatch, an empty shelf.
 */
async function priceLines(
  db: Db,
  lines: { productId: string; quantity: number }[],
): Promise<PricedLine[]> {
  const products = await db.product.findMany({
    where: { id: { in: lines.map((line) => line.productId) }, status: 'PUBLISHED' },
    select: {
      id: true,
      slug: true,
      title: true,
      priceCents: true,
      currency: true,
      stock: true,
      weightGrams: true,
      supplierId: true,
      supplier: { select: { companyName: true, status: true } },
      assets: { where: { kind: 'PREVIEW' }, select: { storageKey: true }, take: 1 },
    },
  });

  const byId = new Map(products.map((product) => [product.id, product]));
  const priced: PricedLine[] = [];

  for (const line of lines) {
    const product = byId.get(line.productId);

    if (!product || product.supplier.status !== 'APPROVED') {
      throw new AppError({
        status: 409,
        code: 'ERR_CONFLICT',
        message: `Product ${line.productId} is no longer available`,
        params: { productId: line.productId },
      });
    }

    if (product.stock < line.quantity) {
      throw new AppError({
        status: 409,
        code: 'ERR_CONFLICT',
        message: `Only ${product.stock} of "${product.title}" left`,
        issues: [{ path: product.id, code: 'out_of_stock', message: String(product.stock) }],
        params: { title: product.title, stock: product.stock },
      });
    }

    priced.push({
      productId: product.id,
      supplierId: product.supplierId,
      supplierName: product.supplier.companyName,
      slug: product.slug,
      title: product.title,
      unitPriceCents: product.priceCents,
      quantity: line.quantity,
      weightGrams: product.weightGrams,
      currency: product.currency,
      previewUrl: product.assets[0] ? publicUrl(product.assets[0].storageKey) : null,
    });
  }

  return priced;
}

function totalWeight(lines: PricedLine[]): number {
  return lines.reduce((total, line) => total + line.weightGrams * line.quantity, 0);
}

function subtotal(lines: PricedLine[]): number {
  return lines.reduce((total, line) => total + line.unitPriceCents * line.quantity, 0);
}

export async function quoteForCart(db: Db, input: ShippingQuoteInput): Promise<ShippingQuote> {
  const lines = await priceLines(db, input.lines);
  const weightGrams = totalWeight(lines);

  if (weightGrams > MAX_PARCEL_GRAMS) {
    throw new AppError({
      status: 400,
      code: 'ERR_VALIDATION',
      message: `Parcel weight ${weightGrams}g exceeds the ${MAX_PARCEL_GRAMS}g limit`,
      params: { maxKg: MAX_PARCEL_GRAMS / 1000 },
    });
  }

  const currency = lines[0]?.currency ?? 'RUB';

  return quoteShipping({
    country: input.country,
    weightGrams,
    subtotalCents: subtotal(lines),
    currency: currency as ShippingQuote['currency'],
  });
}

function toItemDto(item: {
  id: string;
  productId: string;
  titleSnapshot: string;
  unitPriceCents: number;
  quantity: number;
  product: { slug: string; assets: { storageKey: string }[] };
  supplier: { companyName: string };
}): OrderItemDto {
  return {
    id: item.id,
    productId: item.productId,
    slug: item.product.slug,
    title: item.titleSnapshot,
    unitPriceCents: item.unitPriceCents,
    quantity: item.quantity,
    previewUrl: item.product.assets[0] ? publicUrl(item.product.assets[0].storageKey) : null,
    supplierName: item.supplier.companyName,
  };
}

const orderSelect = {
  id: true,
  number: true,
  status: true,
  currency: true,
  subtotalCents: true,
  shippingCents: true,
  totalCents: true,
  createdAt: true,
  paidAt: true,
  items: {
    select: {
      id: true,
      productId: true,
      titleSnapshot: true,
      unitPriceCents: true,
      quantity: true,
      product: {
        select: {
          slug: true,
          assets: { where: { kind: 'PREVIEW' as const }, select: { storageKey: true }, take: 1 },
        },
      },
      supplier: { select: { companyName: true } },
    },
  },
  shipments: {
    select: {
      id: true,
      carrier: true,
      trackingNumber: true,
      status: true,
      shippedAt: true,
      deliveredAt: true,
      supplier: { select: { companyName: true } },
    },
  },
  address: true,
} as const;

type OrderRow = {
  id: string;
  number: string;
  status: OrderSummary['status'];
  currency: OrderSummary['currency'];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  createdAt: Date;
  paidAt: Date | null;
  items: Parameters<typeof toItemDto>[0][];
  shipments: {
    id: string;
    carrier: string;
    trackingNumber: string | null;
    status: ShipmentDto['status'];
    shippedAt: Date | null;
    deliveredAt: Date | null;
    supplier: { companyName: string };
  }[];
  address: {
    recipient: string;
    phone: string;
    country: string;
    region: string | null;
    city: string;
    postalCode: string;
    line1: string;
    line2: string | null;
    comment: string | null;
  } | null;
};

/**
 * @param includeAddress the delivery address is personal data; only the buyer
 * who owns the order and an admin ever see it.
 */
function toDetail(order: OrderRow, includeAddress: boolean): OrderDetail {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    currency: order.currency,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    totalCents: order.totalCents,
    itemCount: order.items.reduce((total, item) => total + item.quantity, 0),
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    items: order.items.map(toItemDto),
    shipments: order.shipments.map((shipment) => ({
      id: shipment.id,
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
      status: shipment.status,
      supplierName: shipment.supplier.companyName,
      shippedAt: shipment.shippedAt?.toISOString() ?? null,
      deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
    })),
    address:
      includeAddress && order.address
        ? {
            recipient: order.address.recipient,
            phone: order.address.phone,
            country: order.address.country,
            region: order.address.region,
            city: order.address.city,
            postalCode: order.address.postalCode,
            line1: order.address.line1,
            line2: order.address.line2,
            comment: order.address.comment,
          }
        : null,
  };
}

export interface CheckoutContext {
  buyerId: string;
  buyerEmail: string;
  locale: Locale;
}

export async function checkout(
  db: Db,
  context: CheckoutContext,
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const lines = await priceLines(db, input.lines);
  const goods = subtotal(lines);
  const weightGrams = totalWeight(lines);

  const currency = (lines[0]?.currency ?? input.currency) as CheckoutInput['currency'];
  if (lines.some((line) => line.currency !== currency)) {
    throw new AppError({
      status: 400,
      code: 'ERR_VALIDATION',
      message: 'All products in one order must share a currency',
    });
  }

  const quote = quoteShipping({
    country: input.address.country,
    weightGrams,
    subtotalCents: goods,
    currency,
  });

  const total = goods + quote.priceCents;

  // One transaction: the order, its lines, the address, and the stock it
  // consumes. `decrement` with a stock guard makes two buyers racing for the
  // last unit resolve in the database rather than in application code.
  const orderId = await db.$transaction(async (tx) => {
    for (const line of lines) {
      const updated = await tx.product.updateMany({
        where: { id: line.productId, stock: { gte: line.quantity } },
        data: { stock: { decrement: line.quantity }, orderCount: { increment: line.quantity } },
      });

      if (updated.count === 0) {
        throw new AppError({
          status: 409,
          code: 'ERR_CONFLICT',
          message: `"${line.title}" sold out while the order was being placed`,
          params: { title: line.title, stock: 0 },
        });
      }
    }

    const created = await tx.order.create({
      data: {
        number: generateOrderNumber(),
        buyerId: context.buyerId,
        status: 'PENDING',
        currency,
        subtotalCents: goods,
        shippingCents: quote.priceCents,
        totalCents: total,
        items: {
          create: lines.map((line) => ({
            productId: line.productId,
            supplierId: line.supplierId,
            titleSnapshot: line.title,
            unitPriceCents: line.unitPriceCents,
            quantity: line.quantity,
          })),
        },
        address: {
          create: {
            recipient: input.address.recipient,
            phone: input.address.phone,
            country: input.address.country,
            region: input.address.region ?? null,
            city: input.address.city,
            postalCode: input.address.postalCode,
            line1: input.address.line1,
            line2: input.address.line2 ?? null,
            comment: input.address.comment ?? null,
          },
        },
      },
      select: { id: true },
    });

    return created.id;
  });

  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, select: orderSelect });

  const provider = paymentProvider();
  const intent = await provider.createIntent({
    orderId: order.id,
    orderNumber: order.number,
    amountCents: total,
    currency,
    description: `3DSFERA ${order.number}`,
    buyerEmail: context.buyerEmail,
  });

  await db.order.update({
    where: { id: order.id },
    data: { paymentProvider: provider.name, paymentIntentId: intent.id },
  });

  return {
    order: toDetail(order as OrderRow, true),
    payment: {
      provider: intent.provider,
      reference: intent.reference,
      ...(intent.clientSecret ? { clientSecret: intent.clientSecret } : {}),
      ...(intent.redirectUrl ? { redirectUrl: intent.redirectUrl } : {}),
    },
  };
}

/**
 * Marks an order paid from a provider callback.
 *
 * Idempotent by design: providers retry webhooks, and a second delivery of the
 * same event must not send a second confirmation or move an already-shipped
 * order backwards.
 */
export async function markOrderPaid(
  db: Db,
  reference: string,
  amountCents: number,
): Promise<{ handled: boolean; alreadyPaid: boolean }> {
  const order = await db.order.findFirst({
    where: { paymentIntentId: reference },
    select: { ...orderSelect, buyer: { select: { email: true, locale: true } } },
  });

  if (!order) return { handled: false, alreadyPaid: false };
  if (order.status !== 'PENDING') return { handled: true, alreadyPaid: true };

  if (amountCents !== order.totalCents) {
    // A mismatch means the amount was tampered with or the order changed after
    // the intent was created. Neither is something to resolve automatically.
    throw new AppError({
      status: 409,
      code: 'ERR_CONFLICT',
      message: `Payment of ${amountCents} does not match order total ${order.totalCents}`,
    });
  }

  await db.order.update({
    where: { id: order.id },
    data: { status: 'PAID', paidAt: new Date() },
  });

  await sendOrderConfirmation({
    to: order.buyer.email,
    locale: order.buyer.locale,
    order: {
      number: order.number,
      currency: order.currency,
      subtotalCents: order.subtotalCents,
      shippingCents: order.shippingCents,
      totalCents: order.totalCents,
      items: order.items.map((item) => ({
        title: item.titleSnapshot,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      })),
      address: order.address ?? {
        recipient: '',
        country: '',
        city: '',
        line1: '',
        postalCode: '',
      },
    },
    statusUrl: orderStatusUrl(order.number),
  });

  return { handled: true, alreadyPaid: false };
}

export function orderStatusUrl(number: string): string {
  const origin = env.WEB_ORIGIN[0] ?? 'http://localhost:5173';
  return `${origin}/orders/${number}`;
}

export async function listBuyerOrders(db: Db, buyerId: string): Promise<OrderSummary[]> {
  const orders = await db.order.findMany({
    where: { buyerId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: orderSelect,
  });

  return orders.map((order) => {
    const detail = toDetail(order as OrderRow, false);
    const { items: _items, shipments: _shipments, address: _address, ...summary } = detail;
    return summary;
  });
}

export async function getOrder(
  db: Db,
  number: string,
  viewer: { userId: string; isAdmin: boolean },
): Promise<OrderDetail> {
  const order = await db.order.findUnique({
    where: { number },
    select: { ...orderSelect, buyerId: true },
  });

  if (!order) {
    throw new AppError({ status: 404, code: 'ERR_NOT_FOUND', message: 'Order not found' });
  }

  const isOwner = order.buyerId === viewer.userId;
  if (!isOwner && !viewer.isAdmin) {
    // 404 rather than 403: whether an order number exists is itself
    // information, and order numbers are guessable enough to matter.
    throw new AppError({ status: 404, code: 'ERR_NOT_FOUND', message: 'Order not found' });
  }

  return toDetail(order as OrderRow, isOwner || viewer.isAdmin);
}
