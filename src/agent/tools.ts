import Anthropic from '@anthropic-ai/sdk';

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: 'get_order_status',
    description: 'Look up the current status of an order by order ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        order_id: {
          type: 'string',
          description: 'The order ID (e.g. ORD-1001)',
        },
      },
      required: ['order_id'],
    },
  },
  {
    name: 'initiate_return',
    description: 'Initiate a return for an item in an order and receive an RMA confirmation number.',
    input_schema: {
      type: 'object' as const,
      properties: {
        order_id: {
          type: 'string',
          description: 'The order ID',
        },
        item_name: {
          type: 'string',
          description: 'The name of the item to return',
        },
        reason: {
          type: 'string',
          description: 'The reason for the return',
        },
      },
      required: ['order_id', 'item_name', 'reason'],
    },
  },
  {
    name: 'search_policy',
    description: "Retrieve Bookly's policy text for a given support topic.",
    input_schema: {
      type: 'object' as const,
      properties: {
        topic: {
          type: 'string',
          enum: ['shipping', 'returns', 'password_reset', 'payment'],
          description: 'The policy topic to retrieve',
        },
      },
      required: ['topic'],
    },
  },
];

// --- Mock data ---

interface Order {
  id: string;
  status: string;
  items: string[];
  carrier: string | null;
  trackingNumber: string | null;
  estimatedDelivery?: string;
  deliveredOn?: string;
}

const mockOrders: Record<string, Order> = {
  'ORD-1001': {
    id: 'ORD-1001',
    status: 'Shipped',
    estimatedDelivery: '2026-08-16',
    items: ['The Pragmatic Programmer', 'Clean Code'],
    carrier: 'UPS',
    trackingNumber: '1Z999AA10123456784',
  },
  'ORD-1002': {
    id: 'ORD-1002',
    status: 'Processing',
    estimatedDelivery: '2026-08-18',
    items: ['Designing Data-Intensive Applications'],
    carrier: null,
    trackingNumber: null,
  },
  'ORD-1003': {
    id: 'ORD-1003',
    status: 'Delivered',
    deliveredOn: '2026-08-12',
    items: ['The Hobbit', 'Dune'],
    carrier: 'FedEx',
    trackingNumber: '9261290100830450447453',
  },
};

const policies: Record<string, string> = {
  shipping: `Bookly Shipping Policy:
- Standard shipping: 3–5 business days, free on orders over $35.
- Express shipping: 1–2 business days, $12.99.
- International shipping: 7–14 business days, rates vary by destination.
- Orders are processed within 1 business day of placement.`,

  returns: `Bookly Returns Policy:
- Items may be returned within 30 days of delivery.
- Books must be in original, unread condition (no markings or damage).
- Digital and eBook purchases are non-refundable.
- Refunds are issued to the original payment method within 5–7 business days of receiving the return.`,

  password_reset: `To reset your Bookly password:
1. Go to bookly.com/login and click "Forgot password?"
2. Enter your registered email address.
3. Check your inbox for a reset link (valid for 24 hours).
4. If you don't receive it within a few minutes, check your spam folder.
5. Still having trouble? Reply here and we'll manually verify your account.`,

  payment: `Bookly accepts Visa, Mastercard, American Express, Discover, PayPal, and Bookly Gift Cards.
We do not store full card numbers on our servers. All transactions are processed via Stripe with 256-bit SSL encryption.`,
};

// --- Handlers ---

export function handleToolCall(name: string, input: Record<string, string>): string {
  switch (name) {
    case 'get_order_status': {
      const order = mockOrders[input.order_id?.toUpperCase()];
      if (!order) {
        return JSON.stringify({ error: `No order found with ID "${input.order_id}". Please double-check the order number.` });
      }
      return JSON.stringify(order);
    }

    case 'initiate_return': {
      const order = mockOrders[input.order_id?.toUpperCase()];
      if (!order) {
        return JSON.stringify({ error: `No order found with ID "${input.order_id}".` });
      }
      // Deterministic mock RMA: hash order_id + item for repeatability in tests
      const rmaNumber = `RMA-${(input.order_id + input.item_name).length * 1337 % 90000 + 10000}`;
      return JSON.stringify({
        rma_number: rmaNumber,
        order_id: input.order_id,
        item: input.item_name,
        reason: input.reason,
        ship_to: 'Bookly Returns Center, 123 Book Lane, Portland OR 97201',
        instructions: `Write "${rmaNumber}" on the outside of the package.`,
        refund_timeline: '5–7 business days after we receive the item.',
      });
    }

    case 'search_policy': {
      const policy = policies[input.topic];
      if (!policy) {
        return JSON.stringify({ error: `Unknown policy topic: "${input.topic}"` });
      }
      return policy;
    }

    default:
      return JSON.stringify({ error: `Unknown tool: "${name}"` });
  }
}
