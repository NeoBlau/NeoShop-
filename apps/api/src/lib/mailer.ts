import { createTransport, type Transporter } from 'nodemailer';
import { dictionaries, type Locale } from '@3dsfera/shared';
import { env, isProduction, isTest } from '../env.js';

/**
 * Transactional mail.
 *
 * Development points at Mailpit, which accepts everything and shows it in a
 * browser, so nobody has to configure a real mailbox to see what a buyer
 * receives. Tests use nodemailer's JSON transport: the message is composed for
 * real and captured instead of sent.
 *
 * Sending never throws into a request. A confirmation that fails to send is a
 * problem worth logging; it is not a reason to fail an order that has already
 * been paid for.
 */

let transporter: Transporter | null = null;

function mailer(): Transporter {
  transporter ??= isTest
    ? createTransport({ jsonTransport: true })
    : createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        // A local development relay (Mailpit) speaks plain SMTP. Without this,
        // nodemailer opportunistically upgrades to STARTTLS, meets whatever
        // self-signed certificate the relay happens to ship, and refuses to
        // send. Production keeps the upgrade: there the relay is real.
        ignoreTLS: !isProduction && !env.SMTP_SECURE,
        // Mailpit accepts anything; a real relay gets credentials from the
        // environment in production.
        ...(process.env['SMTP_USER']
          ? {
              auth: {
                user: process.env['SMTP_USER'],
                pass: process.env['SMTP_PASSWORD'] ?? '',
              },
            }
          : {}),
      });

  return transporter;
}

/** Replaces {{name}} placeholders. The dictionaries use the same syntax as the UI. */
function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) =>
    String(values[key] ?? `{{${key}}}`),
  );
}

function money(cents: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export interface OrderMailInput {
  to: string;
  locale: Locale;
  order: {
    number: string;
    currency: string;
    subtotalCents: number;
    shippingCents: number;
    totalCents: number;
    items: { title: string; quantity: number; unitPriceCents: number }[];
    address: {
      recipient: string;
      country: string;
      city: string;
      line1: string;
      postalCode: string;
    };
  };
  statusUrl: string;
}

export async function sendOrderConfirmation(input: OrderMailInput): Promise<void> {
  const dictionary = dictionaries[input.locale].email;
  const { order } = input;

  const lines = order.items
    .map(
      (item) =>
        `  • ${item.title} × ${item.quantity} — ${money(item.unitPriceCents * item.quantity, order.currency, input.locale)}`,
    )
    .join('\n');

  const text = [
    dictionary.confirmGreeting,
    '',
    fill(dictionary.confirmIntro, { number: order.number }),
    '',
    `${dictionary.confirmItems}:`,
    lines,
    '',
    `${dictionary.confirmShipping}: ${money(order.shippingCents, order.currency, input.locale)}`,
    `${dictionary.confirmTotal}: ${money(order.totalCents, order.currency, input.locale)}`,
    '',
    `${dictionary.confirmAddress}:`,
    `  ${order.address.recipient}`,
    `  ${order.address.postalCode}, ${order.address.city}, ${order.address.country}`,
    `  ${order.address.line1}`,
    '',
    dictionary.confirmTrack,
    `  ${input.statusUrl}`,
    '',
    dictionary.confirmFooter,
  ].join('\n');

  await send({
    to: input.to,
    subject: fill(dictionary.confirmSubject, { number: order.number }),
    text,
  });
}

export interface ShipmentMailInput {
  to: string;
  locale: Locale;
  orderNumber: string;
  carrier: string;
  trackingNumber: string | null;
  statusUrl: string;
}

export async function sendShipmentNotice(input: ShipmentMailInput): Promise<void> {
  const dictionary = dictionaries[input.locale].email;

  const text = [
    fill(dictionary.shippedIntro, { number: input.orderNumber, carrier: input.carrier }),
    input.trackingNumber
      ? fill(dictionary.shippedTracking, { tracking: input.trackingNumber })
      : '',
    '',
    input.statusUrl,
  ]
    .filter((line) => line !== '')
    .join('\n');

  await send({
    to: input.to,
    subject: fill(dictionary.shippedSubject, { number: input.orderNumber }),
    text,
  });
}

async function send(message: { to: string; subject: string; text: string }): Promise<void> {
  try {
    await mailer().sendMail({ from: env.MAIL_FROM, ...message });
  } catch (error) {
    // The order is already placed and paid; losing the notification must not
    // undo that. It is logged loudly so the failure is visible.
    console.error('[mail] failed to send', { to: message.to, subject: message.subject, error });
  }
}

/** Test seam: lets a suite read what would have been sent. */
export function resetMailer(): void {
  transporter = null;
}

export interface ModerationMailInput {
  to: string;
  locale: Locale;
  title: string;
  approved: boolean;
  /** Required on a rejection; the supplier has nothing to act on without it. */
  reason: string | null;
}

/**
 * Tells a supplier what a moderator decided.
 *
 * A rejection carries the reason in full. It is the one place the text is
 * repeated — the audit log keeps only its length, because a reason can name a
 * person in a photograph or a trademark that is being disputed, and neither
 * belongs in a log that is read by everyone with the admin role.
 */
export async function sendModerationNotice(input: ModerationMailInput): Promise<void> {
  const dictionary = dictionaries[input.locale].email;

  const subject = fill(
    input.approved ? dictionary.moderationApproved : dictionary.moderationRejected,
    { title: input.title },
  );

  const text = input.approved
    ? fill(dictionary.moderationApprovedBody, { title: input.title })
    : [
        fill(dictionary.moderationRejectedBody, { title: input.title }),
        '',
        input.reason ?? '',
        '',
        dictionary.moderationRejectedFooter,
      ].join('\n');

  await send({ to: input.to, subject, text });
}
