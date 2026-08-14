export type OrderTimelineEvent = {
  id: string;
  orderId: string;
  type: OrderEventType;
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export type OrderEventType =
  | "order_placed"
  | "payment_confirmed"
  | "processing"
  | "packed"
  | "shipped"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "delivery_attempted"
  | "delivery_delayed"
  | "return_requested"
  | "return_approved"
  | "refund_initiated"
  | "refund_completed"
  | "cancelled";

export type DelayNotification = {
  orderId: string;
  originalDeliveryDate: string;
  newEstimatedDate: string;
  reason: string;
  notifiedAt: string;
  channel: "email" | "sms" | "push";
};

export type SelfServeAction =
  | "cancel_order"
  | "change_address"
  | "add_note"
  | "request_return"
  | "extend_return_window";

export type SelfServePolicy = {
  action: SelfServeAction;
  allowedStatuses: string[];
  maxWindowHours: number;
  requiresApproval: boolean;
};

export const SELF_SERVE_POLICIES: SelfServePolicy[] = [
  {
    action: "cancel_order",
    allowedStatuses: ["pending", "processing"],
    maxWindowHours: 1,
    requiresApproval: false,
  },
  {
    action: "change_address",
    allowedStatuses: ["pending", "processing"],
    maxWindowHours: 2,
    requiresApproval: false,
  },
  {
    action: "add_note",
    allowedStatuses: ["pending", "processing", "shipped"],
    maxWindowHours: Infinity,
    requiresApproval: false,
  },
  {
    action: "request_return",
    allowedStatuses: ["delivered"],
    maxWindowHours: 7 * 24,
    requiresApproval: true,
  },
];

export function canPerformAction(
  action: SelfServeAction,
  orderStatus: string,
  orderCreatedAt: string,
): { allowed: boolean; reason?: string } {
  const policy = SELF_SERVE_POLICIES.find((p) => p.action === action);
  if (!policy) return { allowed: false, reason: "Action not supported" };

  if (!policy.allowedStatuses.includes(orderStatus)) {
    return { allowed: false, reason: `Not available for status: ${orderStatus}` };
  }

  const ageHours = (Date.now() - new Date(orderCreatedAt).getTime()) / (1000 * 60 * 60);
  if (ageHours > policy.maxWindowHours) {
    return { allowed: false, reason: `Window expired (${policy.maxWindowHours}h)` };
  }

  return { allowed: true };
}

export function buildOrderTimeline(events: OrderTimelineEvent[]): OrderTimelineEvent[] {
  return [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

export function getDeliveryProgress(events: OrderTimelineEvent[]): {
  currentStep: number;
  totalSteps: number;
  isComplete: boolean;
  isDelayed: boolean;
} {
  const milestones: OrderEventType[] = [
    "order_placed",
    "payment_confirmed",
    "processing",
    "shipped",
    "in_transit",
    "delivered",
  ];

  const completedTypes = new Set(events.map((e) => e.type));
  let currentStep = 0;
  for (const m of milestones) {
    if (completedTypes.has(m)) currentStep++;
    else break;
  }

  return {
    currentStep,
    totalSteps: milestones.length,
    isComplete: completedTypes.has("delivered"),
    isDelayed: completedTypes.has("delivery_delayed"),
  };
}
