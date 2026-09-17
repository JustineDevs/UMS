export type CourierDefinition = {
  slug: string;
  label: string;
  region: string;
  aftershipSlug?: string;
  supportsLabels: boolean;
};

export const COURIER_REGISTRY: CourierDefinition[] = [
  {
    slug: "jtexpress-ph",
    label: "J&T Express Philippines",
    region: "PH",
    aftershipSlug: "jtexpress-ph",
    supportsLabels: false,
  },
  {
    slug: "ghn",
    label: "Giao Hang Nhanh (GHN)",
    region: "VN",
    aftershipSlug: "ghn",
    supportsLabels: false,
  },
  {
    slug: "ghtk",
    label: "Giao Hang Tiet Kiem (GHTK)",
    region: "VN",
    aftershipSlug: "ghtk",
    supportsLabels: false,
  },
  {
    slug: "vnpost",
    label: "Vietnam Post",
    region: "VN",
    aftershipSlug: "vnpost",
    supportsLabels: false,
  },
  {
    slug: "grabexpress-ph",
    label: "GrabExpress Philippines",
    region: "PH",
    aftershipSlug: "grab-ph",
    supportsLabels: false,
  },
];
