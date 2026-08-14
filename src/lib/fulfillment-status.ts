export type OperatorFulfillmentStatus =
  | "AWAITING_PAYMENT"
  | "PAID"
  | "NEEDS_PRODUCTION"
  | "READY_TO_PACK"
  | "PACKED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

const NEXT_OPERATOR_STATUSES: Partial<Record<OperatorFulfillmentStatus, OperatorFulfillmentStatus[]>> = {
  READY_TO_PACK: ["PACKED", "DELIVERED"],
  PACKED: ["SHIPPED", "DELIVERED"],
  SHIPPED: ["DELIVERED"],
};

export function nextOperatorFulfillmentStatuses(
  current: OperatorFulfillmentStatus,
): OperatorFulfillmentStatus[] {
  return NEXT_OPERATOR_STATUSES[current] ?? [];
}

export function canOperatorTransitionFulfillment(
  current: OperatorFulfillmentStatus,
  next: OperatorFulfillmentStatus,
) {
  return current === next || nextOperatorFulfillmentStatuses(current).includes(next);
}
