import type {
  CheckoutInput,
  CheckoutResult,
  OrderDetail,
  OrderSummary,
  ShipmentUpdateInput,
  ShippingQuote,
  ShippingQuoteInput,
  SupplierOrderDto,
} from '@3dsfera/shared';
import { api } from '../../api/client.js';

export interface MockConfirmResult {
  status: 'succeeded' | 'already_paid' | 'failed';
}

export const ordersApi = {
  quote: (input: ShippingQuoteInput) => api.post<ShippingQuote>('/api/orders/quote', input),
  checkout: (input: CheckoutInput) => api.post<CheckoutResult>('/api/orders', input),
  list: () => api.get<{ orders: OrderSummary[] }>('/api/orders'),
  detail: (number: string) => api.get<{ order: OrderDetail }>(`/api/orders/${number}`),

  /**
   * Confirms a payment held by the built-in mock provider. Stripe never
   * reaches this: there the browser talks to Stripe and Stripe calls our
   * webhook.
   */
  confirmMockPayment: (reference: string) =>
    api.post<MockConfirmResult>('/api/payments/mock/confirm', { reference }),
};

export const supplierOrdersApi = {
  list: () => api.get<{ orders: SupplierOrderDto[] }>('/api/supplier/orders'),
  updateShipment: (orderId: string, input: ShipmentUpdateInput) =>
    api.put<{ shipment: { id: string; carrier: string; trackingNumber: string | null } }>(
      `/api/supplier/orders/${orderId}/shipment`,
      input,
    ),
};
