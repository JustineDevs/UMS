export type RiskLevel = "low" | "medium" | "high" | "critical";

export type FraudSignal = {
  type: string;
  score: number;
  details: string;
};

export type RiskAssessment = {
  orderId: string;
  overallScore: number;
  level: RiskLevel;
  signals: FraudSignal[];
  requiresManualReview: boolean;
  assessedAt: string;
};

export type VelocityCheckInput = {
  email: string;
  ipAddress?: string;
  deviceFingerprint?: string;
  windowMinutes: number;
};

export type AddressCheckInput = {
  billingCountry: string;
  shippingCountry: string;
  billingPostalCode?: string;
  ipCountry?: string;
};

export function scoreVelocity(orderCountInWindow: number, threshold: number): FraudSignal | null {
  if (orderCountInWindow <= threshold) return null;
  const score = Math.min(100, (orderCountInWindow / threshold) * 50);
  return {
    type: "velocity",
    score,
    details: `${orderCountInWindow} orders in window (threshold: ${threshold})`,
  };
}

export function scoreAddressMismatch(input: AddressCheckInput): FraudSignal | null {
  const issues: string[] = [];
  if (
    input.billingCountry &&
    input.shippingCountry &&
    input.billingCountry.toUpperCase() !== input.shippingCountry.toUpperCase()
  ) {
    issues.push("billing/shipping country mismatch");
  }
  if (
    input.ipCountry &&
    input.billingCountry &&
    input.ipCountry.toUpperCase() !== input.billingCountry.toUpperCase()
  ) {
    issues.push("IP country differs from billing country");
  }
  if (issues.length === 0) return null;
  return {
    type: "address_mismatch",
    score: issues.length * 25,
    details: issues.join("; "),
  };
}

export function scoreHighOrderValue(amountMinor: number, thresholdMinor: number): FraudSignal | null {
  if (amountMinor <= thresholdMinor) return null;
  const ratio = amountMinor / thresholdMinor;
  return {
    type: "high_value",
    score: Math.min(100, ratio * 20),
    details: `Order value ${amountMinor} exceeds threshold ${thresholdMinor}`,
  };
}

export function scoreProviderRisk(providerRiskScore?: number): FraudSignal | null {
  if (providerRiskScore === undefined || providerRiskScore === null) return null;
  if (providerRiskScore < 30) return null;
  return {
    type: "provider_risk",
    score: providerRiskScore,
    details: `Payment provider risk score: ${providerRiskScore}`,
  };
}

export function assessRisk(
  orderId: string,
  signals: (FraudSignal | null)[],
): RiskAssessment {
  const validSignals = signals.filter((s): s is FraudSignal => s !== null);
  const overallScore =
    validSignals.length === 0
      ? 0
      : Math.round(validSignals.reduce((sum, s) => sum + s.score, 0) / validSignals.length);

  let level: RiskLevel = "low";
  if (overallScore >= 75) level = "critical";
  else if (overallScore >= 50) level = "high";
  else if (overallScore >= 25) level = "medium";

  return {
    orderId,
    overallScore,
    level,
    signals: validSignals,
    requiresManualReview: level === "high" || level === "critical",
    assessedAt: new Date().toISOString(),
  };
}
