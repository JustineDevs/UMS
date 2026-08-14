export type ExperimentStatus = "draft" | "running" | "paused" | "completed";

export type Experiment = {
  id: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  startDate?: string;
  endDate?: string;
  variants: ExperimentVariant[];
  metrics: ExperimentMetric[];
  trafficPercentage: number;
  holdoutPercentage: number;
};

export type ExperimentVariant = {
  id: string;
  name: string;
  weight: number;
  isControl: boolean;
};

export type ExperimentMetric = {
  name: string;
  type: "conversion" | "revenue" | "engagement" | "custom";
  isPrimary: boolean;
};

export type ExperimentAssignment = {
  experimentId: string;
  variantId: string;
  userId: string;
  assignedAt: string;
  inHoldout: boolean;
};

export function assignVariant(
  experiment: Experiment,
  userId: string,
): ExperimentAssignment {
  if (experiment.status !== "running") {
    return {
      experimentId: experiment.id,
      variantId: experiment.variants.find((v) => v.isControl)?.id ?? experiment.variants[0]?.id ?? "",
      userId,
      assignedAt: new Date().toISOString(),
      inHoldout: false,
    };
  }

  const hash = simpleHash(`${experiment.id}:${userId}`);
  const bucket = hash % 100;

  if (bucket < experiment.holdoutPercentage) {
    return {
      experimentId: experiment.id,
      variantId: experiment.variants.find((v) => v.isControl)?.id ?? "",
      userId,
      assignedAt: new Date().toISOString(),
      inHoldout: true,
    };
  }

  if (bucket >= experiment.trafficPercentage + experiment.holdoutPercentage) {
    return {
      experimentId: experiment.id,
      variantId: experiment.variants.find((v) => v.isControl)?.id ?? "",
      userId,
      assignedAt: new Date().toISOString(),
      inHoldout: false,
    };
  }

  const totalWeight = experiment.variants.reduce((sum, v) => sum + v.weight, 0);
  let cumulativeWeight = 0;
  const variantBucket = (hash >> 8) % totalWeight;

  for (const variant of experiment.variants) {
    cumulativeWeight += variant.weight;
    if (variantBucket < cumulativeWeight) {
      return {
        experimentId: experiment.id,
        variantId: variant.id,
        userId,
        assignedAt: new Date().toISOString(),
        inHoldout: false,
      };
    }
  }

  return {
    experimentId: experiment.id,
    variantId: experiment.variants[0]?.id ?? "",
    userId,
    assignedAt: new Date().toISOString(),
    inHoldout: false,
  };
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

export type ExperimentResult = {
  variantId: string;
  sampleSize: number;
  conversionRate: number;
  revenuePerUser: number;
  isStatisticallySignificant: boolean;
  pValue: number;
  uplift: number;
};

export function calculateUplift(control: number, treatment: number): number {
  if (control === 0) return 0;
  return ((treatment - control) / control) * 100;
}

export function isSignificant(pValue: number, threshold = 0.05): boolean {
  return pValue < threshold;
}
