"use client";

import type {
  CatalogProductDetail,
  CatalogVariantStockRow,
} from "@/lib/medusa-catalog-service";
import { useAdminToast } from "@/components/admin-console";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CatalogProductPreview,
  type CatalogPreviewLayoutDensity,
} from "./CatalogProductPreview";
import {
  CatalogMediaPickerDialog,
  type CatalogAddPlacement,
} from "./CatalogMediaPickerDialog";
import { CatalogUnifiedMediaList } from "./CatalogUnifiedMediaList";
import { normalizeCatalogAssetUrl } from "@/lib/catalog-asset-url";
import { RelatedProductsPicker } from "./RelatedProductsPicker";
import { VariantMatrixField } from "./VariantMatrixField";
import { CatalogMutationImpactPanel } from "./CatalogMutationImpactPanel";
import type { StorefrontCatalogMutationClassification } from "@/lib/storefront-commerce-invalidation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CategoryOption = { id: string; name: string; handle: string };

function catalogPreviewDensity(width: number): CatalogPreviewLayoutDensity {
  if (width >= 1040) return "spacious";
  if (width >= 720) return "comfortable";
  return "compact";
}

function buildCarouselVideosInitial(
  sm: CatalogProductDetail["storefrontMetadata"] | null | undefined,
): string {
  if (!sm) return "";
  const lines: string[] = [];
  const v = sm.videoUrl?.trim();
  if (v) lines.push(v);
  const extra = sm.galleryVideoUrlsText?.trim();
  if (extra) {
    for (const line of extra.split(/\r?\n/)) {
      const t = line.trim();
      if (t) lines.push(t);
    }
  }
  return lines.join("\n");
}

function parseStrictStockUnits(
  raw: string,
): { ok: true; value: number } | { ok: false; error: string } {
  const t = raw.trim();
  if (t === "") return { ok: false, error: "Enter stock quantity." };
  if (!/^\d+$/.test(t)) {
    return {
      ok: false,
      error: "Stock must be a whole number (0 or greater).",
    };
  }
  const n = Number(t);
  if (!Number.isSafeInteger(n) || n < 0) {
    return {
      ok: false,
      error: "Stock must be a whole number (0 or greater).",
    };
  }
  return { ok: true, value: n };
}

function matrixCellKey(size: string, color: string): string {
  return `${size.trim()}\u0000${color.trim()}`;
}

/** One row per selected size × color; optional match to an existing Medusa variant. */
type MatrixStockWireRow = {
  cellKey: string;
  label: string;
  serverRow: CatalogVariantStockRow | null;
};

function buildMatrixStockWireRows(
  sizes: string[],
  colors: string[],
  serverRows: CatalogVariantStockRow[],
): MatrixStockWireRow[] {
  const byKey = new Map<string, CatalogVariantStockRow>();
  for (const r of serverRows) {
    const k = matrixCellKey(r.sizeLabel, r.colorLabel);
    if (!byKey.has(k)) byKey.set(k, r);
  }
  const out: MatrixStockWireRow[] = [];
  for (const sz of sizes) {
    for (const col of colors) {
      const k = matrixCellKey(sz, col);
      out.push({
        cellKey: k,
        label: `${sz.trim()} / ${col.trim()}`,
        serverRow: byKey.get(k) ?? null,
      });
    }
  }
  return out;
}

function initialDefaultMatrixStock(product: CatalogProductDetail): string {
  if (product.variantStockRows.length <= 1) return "0";
  const nums = product.variantStockRows
    .map((r) => r.stockedQuantity)
    .filter((n): n is number => n != null);
  if (nums.length > 0 && nums.every((n) => n === nums[0])) {
    return String(nums[0]);
  }
  return "0";
}

type Props =
  | { mode: "create"; regionCurrencyCode?: string }
  | { mode: "edit"; product: CatalogProductDetail };

export function ProductEditorForm(props: Props) {
  const router = useRouter();
  const toast = useAdminToast();
  const isEdit = props.mode === "edit";
  const p = isEdit ? props.product : null;
  const createCurrency =
    props.mode === "create" ? (props.regionCurrencyCode ?? "php") : "php";

  const [title, setTitle] = useState(p?.title ?? "");
  const [handle, setHandle] = useState(p?.handle ?? "");
  const [description, setDescription] = useState(p?.description ?? "");
  const [status, setStatus] = useState<"draft" | "published">(
    (p?.status === "published" ? "published" : "draft") as
      | "draft"
      | "published",
  );
  const [pricePhp, setPricePhp] = useState(
    p?.pricePhp != null ? String(p.pricePhp) : "",
  );
  const [sku, setSku] = useState(p?.sku ?? "");
  const [unifiedMedia, setUnifiedMedia] = useState<string[]>(() => {
    const main =
      p?.imageUrls?.length && p.imageUrls.length > 0
        ? [...p.imageUrls]
        : (p?.thumbnail ?? "").trim()
          ? [(p?.thumbnail ?? "").trim()]
          : [];
    const gLines = buildCarouselVideosInitial(
      isEdit && p ? p.storefrontMetadata : null,
    )
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    return [...main, ...gLines];
  });
  const [mainImageCount, setMainImageCount] = useState(() => {
    const main =
      p?.imageUrls?.length && p.imageUrls.length > 0
        ? [...p.imageUrls]
        : (p?.thumbnail ?? "").trim()
          ? [(p?.thumbnail ?? "").trim()]
          : [];
    return main.length;
  });
  const [categoryIds, setCategoryIds] = useState<string[]>(
    p?.categoryIds ?? [],
  );
  const [stockQuantity, setStockQuantity] = useState(() => {
    if (!isEdit || !p) return "0";
    if (p.variantStockRows.length > 1) return "0";
    if (p.stockQuantity != null) return String(p.stockQuantity);
    const first = p.variantStockRows[0]?.stockedQuantity;
    if (first != null) return String(first);
    return "0";
  });
  const [variantStockById, setVariantStockById] = useState<
    Record<string, string>
  >(() =>
    isEdit && p
      ? Object.fromEntries(
          p.variantStockRows.map((r) => [
            r.variantId,
            r.stockedQuantity != null ? String(r.stockedQuantity) : "0",
          ]),
        )
      : {},
  );
  /** Stock for matrix cells that do not have a Medusa variant yet (per size/color, independent). */
  const [stockByMatrixCell, setStockByMatrixCell] = useState<
    Record<string, string>
  >({});
  const sm = isEdit ? p?.storefrontMetadata : null;
  const [brand, setBrand] = useState(sm?.brand ?? "");
  const [weightKg, setWeightKg] = useState(
    sm?.weightKg != null ? String(sm.weightKg) : "",
  );
  const [dimensionsLabel, setDimensionsLabel] = useState(
    sm?.dimensionsLabel ?? "",
  );
  const [material, setMaterial] = useState(sm?.material ?? "");
  const [lifestyleImageUrl, setLifestyleImageUrl] = useState(
    sm?.lifestyleImageUrl ?? "",
  );
  const [seoDescription, setSeoDescription] = useState(
    sm?.seoDescription ?? "",
  );
  const [relatedHandlesText, setRelatedHandlesText] = useState(
    sm?.relatedHandlesText ?? "",
  );
  const [matrixSizes, setMatrixSizes] = useState<string[]>(() =>
    isEdit && p?.matrixSizes?.length ? [...p.matrixSizes] : [],
  );
  const [matrixColors, setMatrixColors] = useState<string[]>(() =>
    isEdit && p?.matrixColors?.length ? [...p.matrixColors] : [],
  );
  const [lastMutationClassification, setLastMutationClassification] =
    useState<StorefrontCatalogMutationClassification | null>(null);
  const [hotspotsJson, setHotspotsJson] = useState(sm?.hotspotsJson ?? "");
  const [variantBarcode, setVariantBarcode] = useState(
    isEdit && p?.variantBarcode ? p.variantBarcode : "",
  );
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryHandle, setNewCategoryHandle] = useState("");
  const [categoryCreating, setCategoryCreating] = useState(false);
  const [categoryCreateError, setCategoryCreateError] = useState<string | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploadingCatalogImage, setUploadingCatalogImage] = useState(false);
  const [uploadingCatalogVideo, setUploadingCatalogVideo] = useState(false);
  const [uploadingBulk, setUploadingBulk] = useState(false);
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false);
  const [catalogAddPlacement, setCatalogAddPlacement] =
    useState<CatalogAddPlacement>("gallery");
  const bulkUploadInputRef = useRef<HTMLInputElement>(null);
  const mainImageCountRef = useRef(mainImageCount);

  const productIdForUpload = isEdit && p ? p.id : "";

  useEffect(() => {
    mainImageCountRef.current = mainImageCount;
  }, [mainImageCount]);

  useEffect(() => {
    setMainImageCount((c) => Math.min(Math.max(0, c), unifiedMedia.length));
  }, [unifiedMedia.length]);

  const postCatalogMediaFile = useCallback(
    async (file: File): Promise<string | null> => {
      const fd = new FormData();
      fd.append("file", file);
      if (productIdForUpload) fd.append("productId", productIdForUpload);
      try {
        const res = await fetch("/api/admin/catalog/media", {
          method: "POST",
          body: fd,
        });
        const body = (await res.json()) as {
          error?: string;
          data?: { public_url?: string };
        };
        if (!res.ok) {
          toast.push(body.error ?? "Upload failed", "error");
          return null;
        }
        const url = body.data?.public_url?.trim();
        if (!url) {
          toast.push("Upload did not return a file address.", "error");
          return null;
        }
        return normalizeCatalogAssetUrl(url);
      } catch {
        toast.push("Upload failed", "error");
        return null;
      }
    },
    [productIdForUpload, toast],
  );

  const handleBulkUpload = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      const arr = Array.from(files);
      setUploadingBulk(true);
      try {
        for (const file of arr) {
          const isImage =
            /^image\//.test(file.type) ||
            /\.(png|jpe?g|webp|gif)$/i.test(file.name);
          if (isImage) setUploadingCatalogImage(true);
          else setUploadingCatalogVideo(true);
          const url = await postCatalogMediaFile(file);
          if (isImage) setUploadingCatalogImage(false);
          else setUploadingCatalogVideo(false);
          if (!url) continue;
          if (isImage) {
            const insertionIndex = mainImageCountRef.current;
            setUnifiedMedia((prev) => {
              const n = [...prev];
              n.splice(insertionIndex, 0, url);
              return n;
            });
            const nextMainImageCount = insertionIndex + 1;
            mainImageCountRef.current = nextMainImageCount;
            setMainImageCount(nextMainImageCount);
          } else {
            setUnifiedMedia((prev) => [...prev, url]);
          }
        }
        toast.push(
          "Files saved to catalog storage. Save the product to apply them.",
          "success",
        );
      } finally {
        setUploadingBulk(false);
        setUploadingCatalogImage(false);
        setUploadingCatalogVideo(false);
        if (bulkUploadInputRef.current) bulkUploadInputRef.current.value = "";
      }
    },
    [postCatalogMediaFile, toast],
  );

  const handlePickManyFromCatalog = useCallback(
    (urls: string[]) => {
      const normalized = urls.map(normalizeCatalogAssetUrl).filter(Boolean);
      if (normalized.length === 0) return;
      if (catalogAddPlacement === "main") {
        const insertionIndex = mainImageCountRef.current;
        setUnifiedMedia((prev) => {
          const n = [...prev];
          let mc = insertionIndex;
          for (const u of normalized) {
            n.splice(mc, 0, u);
            mc += 1;
          }
          return n;
        });
        const nextMainImageCount = insertionIndex + normalized.length;
        mainImageCountRef.current = nextMainImageCount;
        setMainImageCount(nextMainImageCount);
      } else {
        setUnifiedMedia((prev) => [...prev, ...normalized]);
      }
      toast.push(
        "Added from catalog library. Save the product to apply it.",
        "success",
      );
    },
    [catalogAddPlacement, toast],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/catalog/categories")
      .then((r) => r.json())
      .then((body: { categories?: CategoryOption[] }) => {
        if (!cancelled && Array.isArray(body.categories)) {
          setCategories(body.categories);
        }
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const variantComboCount = matrixSizes.length * matrixColors.length;
  const showPerVariantStock = Boolean(
    isEdit && p && variantComboCount > 1 && p.variantStockRows.length > 0,
  );

  const stockRowsFingerprint =
    isEdit && p
      ? p.variantStockRows
          .map((r) => `${r.variantId}:${r.stockedQuantity ?? "x"}`)
          .join("|")
      : "";

  useEffect(() => {
    if (!isEdit || !p) return;
    setVariantStockById(
      Object.fromEntries(
        p.variantStockRows.map((r) => [
          r.variantId,
          r.stockedQuantity != null ? String(r.stockedQuantity) : "0",
        ]),
      ),
    );
  }, [isEdit, p?.id, stockRowsFingerprint]);

  const stockMatrixProductIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isEdit || !p || !showPerVariantStock) return;
    const productSwitched = stockMatrixProductIdRef.current !== p.id;
    stockMatrixProductIdRef.current = p.id;
    setStockByMatrixCell((prev) => {
      const base = productSwitched ? {} : prev;
      const serverKeys = new Set(
        p.variantStockRows.map((r) => matrixCellKey(r.sizeLabel, r.colorLabel)),
      );
      const next: Record<string, string> = {};
      const hadAny = Object.keys(base).length > 0;
      for (const sz of matrixSizes) {
        for (const col of matrixColors) {
          const k = matrixCellKey(sz, col);
          if (serverKeys.has(k)) continue;
          if (base[k] !== undefined) {
            next[k] = base[k]!;
          } else {
            next[k] = hadAny ? "0" : initialDefaultMatrixStock(p);
          }
        }
      }
      return next;
    });
  }, [
    isEdit,
    p?.id,
    showPerVariantStock,
    matrixSizes,
    matrixColors,
    stockRowsFingerprint,
  ]);

  const draftMatrixPairKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const sz of matrixSizes) {
      for (const col of matrixColors) {
        keys.add(matrixCellKey(sz, col));
      }
    }
    return keys;
  }, [matrixSizes, matrixColors]);

  /** Same order as "N sizes × M colors" — one stock row per checkbox combination. */
  const matrixStockWireRows = useMemo(() => {
    if (!isEdit || !p || !showPerVariantStock) return [];
    return buildMatrixStockWireRows(
      matrixSizes,
      matrixColors,
      p.variantStockRows,
    );
  }, [
    isEdit,
    p?.id,
    showPerVariantStock,
    matrixSizes,
    matrixColors,
    stockRowsFingerprint,
  ]);

  const orphanServerVariantRows = useMemo(() => {
    if (!isEdit || !p || !showPerVariantStock) return [];
    return p.variantStockRows.filter(
      (r) => !draftMatrixPairKeys.has(matrixCellKey(r.sizeLabel, r.colorLabel)),
    );
  }, [
    isEdit,
    p?.id,
    showPerVariantStock,
    draftMatrixPairKeys,
    stockRowsFingerprint,
  ]);

  const previewImageUrls = useMemo(
    () =>
      unifiedMedia
        .slice(0, mainImageCount)
        .map((s) => s.trim())
        .filter(Boolean),
    [unifiedMedia, mainImageCount],
  );

  const previewVideoUrls = useMemo(
    () =>
      unifiedMedia
        .slice(mainImageCount)
        .map((s) => s.trim())
        .filter(Boolean),
    [unifiedMedia, mainImageCount],
  );

  const selectedCategoryLabels = useMemo(() => {
    const loaded = categories
      .filter((category) => categoryIds.includes(category.id))
      .map((category) => category.name.trim())
      .filter(Boolean);
    if (loaded.length > 0) return loaded;
    if (!isEdit || !p) return [];
    const byId = new Map<string, string>();
    for (let index = 0; index < p.categoryIds.length; index += 1) {
      const id = p.categoryIds[index];
      const label = p.categoryLabels[index];
      if (id && label) byId.set(id, label);
    }
    return categoryIds.map((id) => byId.get(id)?.trim() ?? "").filter(Boolean);
  }, [categories, categoryIds, isEdit, p]);

  function toggleCategory(id: string) {
    setCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function createStoreCategory() {
    setCategoryCreateError(null);
    const nm = newCategoryName.trim();
    if (!nm) {
      setCategoryCreateError("Enter a category name.");
      return;
    }
    setCategoryCreating(true);
    try {
      const res = await fetch("/api/admin/catalog/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nm,
          handle: newCategoryHandle.trim() || undefined,
        }),
      });
      const j = (await res.json()) as {
        error?: string;
        category?: CategoryOption;
      };
      if (!res.ok) {
        setCategoryCreateError(j.error ?? "Could not create category.");
        return;
      }
      if (j.category?.id) {
        const cat = j.category;
        setCategories((prev) => {
          if (prev.some((c) => c.id === cat.id)) return prev;
          return [...prev, cat].sort((a, b) => a.name.localeCompare(b.name));
        });
        setCategoryIds((prev) =>
          prev.includes(cat.id) ? prev : [...prev, cat.id],
        );
        setNewCategoryName("");
        setNewCategoryHandle("");
      }
    } catch {
      setCategoryCreateError("Network unavailable.");
    } finally {
      setCategoryCreating(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const priceNum = parseFloat(pricePhp);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setError("Enter a valid price.");
      setSaving(false);
      return;
    }

    let stockQtyInt: number;
    let matrixCellStocksPayload:
      | Array<{ sizeLabel: string; colorLabel: string; quantity: number }>
      | undefined;

    if (showPerVariantStock && p) {
      matrixCellStocksPayload = [];
      for (const sz of matrixSizes) {
        for (const col of matrixColors) {
          const k = matrixCellKey(sz, col);
          const serverRow = p.variantStockRows.find(
            (r) => matrixCellKey(r.sizeLabel, r.colorLabel) === k,
          );
          const raw = serverRow
            ? (variantStockById[serverRow.variantId] ?? "0")
            : (stockByMatrixCell[k] ?? "0");
          const rowParsed = parseStrictStockUnits(raw);
          if (!rowParsed.ok) {
            const label = serverRow
              ? serverRow.label
              : `${sz.trim()} / ${col.trim()}`;
            setError(`${label}: ${rowParsed.error}`);
            setSaving(false);
            return;
          }
          matrixCellStocksPayload.push({
            sizeLabel: sz.trim(),
            colorLabel: col.trim(),
            quantity: rowParsed.value,
          });
        }
      }
      stockQtyInt = 0;
    } else {
      const stockParsed = parseStrictStockUnits(stockQuantity);
      if (!stockParsed.ok) {
        setError(stockParsed.error);
        setSaving(false);
        return;
      }
      stockQtyInt = stockParsed.value;
      matrixCellStocksPayload = undefined;
    }

    if (matrixSizes.length < 1 || matrixColors.length < 1) {
      setError("Select at least one size and one color.");
      setSaving(false);
      return;
    }
    const combos = matrixSizes.length * matrixColors.length;
    if (combos > 80) {
      setError(`Too many variants (${combos}). Maximum is 80.`);
      setSaving(false);
      return;
    }

    const galleryLines = unifiedMedia
      .slice(mainImageCount)
      .map((s) => s.trim())
      .filter(Boolean);
    const videoUrl = galleryLines[0] ?? null;
    const galleryVideoUrlsText = galleryLines.slice(1).join("\n");

    const storefrontMetadata = {
      brand: brand.trim() || null,
      videoUrl,
      galleryVideoUrlsText,
      weightKg: (() => {
        const w = weightKg.trim();
        if (!w) return null;
        const n = Number(w);
        return Number.isFinite(n) ? n : null;
      })(),
      dimensionsLabel: dimensionsLabel.trim() || null,
      material: material.trim() || null,
      lifestyleImageUrl: lifestyleImageUrl.trim() || null,
      seoDescription: seoDescription.trim() || null,
      relatedHandlesText,
      hotspotsJson,
    };

    const imageUrls = unifiedMedia
      .slice(0, mainImageCount)
      .map((s) => s.trim())
      .filter(Boolean);

    const sharedPayload = {
      title: title.trim(),
      handle: handle.trim(),
      description: description.trim() || null,
      status,
      pricePhp: priceNum,
      imageUrls,
      categoryIds,
      stockQuantity: stockQtyInt,
      storefrontMetadata,
    };

    try {
      if (isEdit && p) {
        const patchBody: Record<string, unknown> = {
          ...sharedPayload,
          sizeLabels: matrixSizes,
          colorLabels: matrixColors,
          expected_revision: p.revision,
        };
        if (combos > 1) {
          patchBody.sku = null;
          patchBody.variantBarcode = null;
        } else {
          patchBody.sku = sku.trim() || null;
          patchBody.variantBarcode = variantBarcode.trim() || null;
        }
        if (matrixCellStocksPayload?.length) {
          patchBody.matrixCellStocks = matrixCellStocksPayload;
        }
        const res = await fetch(`/api/admin/catalog/products/${p.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `catalog-update-${crypto.randomUUID()}`,
          },
          body: JSON.stringify(patchBody),
        });
        const j = (await res.json()) as {
          error?: string;
          mutationClassification?: StorefrontCatalogMutationClassification;
          stripeCatalogSync?: {
            state: "synced" | "failed" | "pending" | "unavailable";
            reason?: string;
          };
        };
        if (!res.ok) {
          const msg = j.error ?? "Unable to save changes";
          setError(msg);
          toast.push(msg, "error");
          setSaving(false);
          return;
        }
        const cls = j.mutationClassification;
        if (cls) {
          setLastMutationClassification(cls);
        }
        if (j.stripeCatalogSync) {
          if (j.stripeCatalogSync.state === "failed") {
            toast.push(
              `Catalog saved, but Stripe sync failed: ${j.stripeCatalogSync.reason ?? "retry from the provider sync queue."}`,
              "error",
            );
          } else if (j.stripeCatalogSync.state === "pending") {
            toast.push(
              "Catalog saved. Stripe synchronization is pending.",
              "info",
            );
          }
        }
        if (cls === "checkout_affecting") {
          toast.push(
            "Changes saved. Price changed: storefront listings refresh and open checkouts may need a total review.",
            "success",
          );
        } else if (cls === "sellability_affecting") {
          toast.push(
            "Changes saved. Stock, publish, or variant matrix changed: matching open checkouts are flagged for review.",
            "success",
          );
        } else if (cls === "merchandising_only") {
          toast.push(
            "Changes saved. Merchandising updated. Active checkout payment rows were not reset for quote totals.",
            "success",
          );
        } else {
          toast.push(
            "Changes saved. Editorial update. Active checkout payment rows were not reset.",
            "success",
          );
        }
        router.push("/admin/catalog?flash=updated");
        router.refresh();
        return;
      }

      const res = await fetch("/api/admin/catalog/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `catalog-create-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({
          ...sharedPayload,
          handle: handle.trim() || undefined,
          description: description.trim() || undefined,
          sku: combos > 1 ? undefined : sku.trim() || undefined,
          variantBarcode: combos > 1 ? null : variantBarcode.trim() || null,
          sizeLabels: matrixSizes,
          colorLabels: matrixColors,
          sizeLabel: undefined,
          colorLabel: undefined,
        }),
      });
      const j = (await res.json()) as {
        error?: string;
        productId?: string;
        stripeCatalogSync?: {
          state: "synced" | "failed" | "pending" | "unavailable";
          reason?: string;
        };
      };
      if (!res.ok) {
        const msg = j.error ?? "Unable to create product";
        setError(msg);
        toast.push(msg, "error");
        setSaving(false);
        return;
      }
      if (j.productId) {
        if (j.stripeCatalogSync) {
          if (j.stripeCatalogSync.state === "failed") {
            toast.push(
              `Product created, but Stripe sync failed: ${j.stripeCatalogSync.reason ?? "retry from the provider sync queue."}`,
              "error",
            );
          }
        }
        toast.push("Product created. Opening the product list.", "success");
        router.push("/admin/catalog?flash=created");
        router.refresh();
      }
    } catch {
      const msg = "Network unavailable. Check your connection and try again.";
      setError(msg);
      toast.push(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!isEdit || !p) return;
    if (!window.confirm("Delete this product? This cannot be undone.")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/catalog/products/${p.id}`, {
        method: "DELETE",
        headers: { "Idempotency-Key": `catalog-delete-${crypto.randomUUID()}` },
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        const msg = j.error ?? "Unable to delete product";
        setError(msg);
        toast.push(msg, "error");
        setDeleting(false);
        return;
      }
      toast.push("Product removed from the catalog.", "success");
      router.push("/admin/catalog?flash=deleted");
      router.refresh();
    } catch {
      const msg = "Network unavailable. Check your connection and try again.";
      setError(msg);
      toast.push(msg, "error");
    } finally {
      setDeleting(false);
    }
  }

  const catalogLayoutRef = useRef<HTMLDivElement>(null);
  const [catalogLayoutWidth, setCatalogLayoutWidth] = useState(0);

  useLayoutEffect(() => {
    const el = catalogLayoutRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setCatalogLayoutWidth(Math.round(w));
    });
    ro.observe(el);
    setCatalogLayoutWidth(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  const previewDensity = useMemo(
    () =>
      catalogLayoutWidth === 0
        ? "comfortable"
        : catalogPreviewDensity(catalogLayoutWidth),
    [catalogLayoutWidth],
  );

  const catalogGridClassName = useMemo(() => {
    switch (previewDensity) {
      case "spacious":
        return "grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,480px)] lg:gap-8 lg:items-start xl:gap-10";
      case "compact":
        return "grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(220px,340px)] lg:gap-6 lg:items-start";
      default:
        return "grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,400px)] lg:gap-7 lg:items-start xl:gap-8";
    }
  }, [previewDensity]);

  return (
    <form onSubmit={(e) => void submit(e)} className="w-full min-w-0">
      <div ref={catalogLayoutRef} className={catalogGridClassName}>
        <aside className="order-1 min-w-0 w-full lg:order-2 lg:sticky lg:top-6 lg:z-[1] lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overscroll-contain lg:self-start xl:top-8">
          <CatalogProductPreview
            title={title}
            handle={handle}
            description={description}
            status={status}
            brand={brand}
            currencyCode={isEdit && p ? p.currencyCode : createCurrency}
            pricePhp={pricePhp}
            imageUrls={previewImageUrls}
            videoUrls={previewVideoUrls}
            categoryLabels={selectedCategoryLabels}
            sizes={matrixSizes}
            colors={matrixColors}
            layoutDensity={previewDensity}
          />
        </aside>
        <div className="order-2 min-w-0 space-y-6 lg:order-1">
          {isEdit ? (
            <CatalogMutationImpactPanel
              lastClassification={lastMutationClassification}
            />
          ) : null}
          {isEdit ? (
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/admin/catalog"
                className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/35 bg-surface-container-lowest px-4 py-2.5 text-sm font-semibold text-on-surface shadow-sm transition hover:bg-surface-container-low"
              >
                <span
                  className="inline-flex h-5 w-5 items-center justify-center"
                  aria-hidden
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M11.78 4.22a.75.75 0 0 1 0 1.06L7.06 10l4.72 4.72a.75.75 0 1 1-1.06 1.06l-5.25-5.25a.75.75 0 0 1 0-1.06l5.25-5.25a.75.75 0 0 1 1.06 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                Back to products
              </Link>
            </div>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950"
            >
              {error}
            </div>
          ) : null}

          {saving ? (
            <div
              role="status"
              className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-on-surface"
            >
              <span className="inline-flex items-center gap-2 font-medium text-on-surface">
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"
                  aria-hidden
                />
                Saving to catalog…
              </span>
            </div>
          ) : null}

          {deleting ? (
            <div
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            >
              <span className="inline-flex items-center gap-2 font-medium">
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber-700 border-t-transparent"
                  aria-hidden
                />
                Removing product…
              </span>
            </div>
          ) : null}

          <Card size="sm">
            <CardHeader>
              <CardTitle>Shop</CardTitle>
              <CardDescription>
                Published items show on the public catalog. Categories drive the
                category filter. Size and color are saved as Medusa options and
                match storefront filters. Tick every size and color you need.
                Each combination is a sellable variant. Editing uses the same
                matrix as create.
              </CardDescription>
            </CardHeader>
          </Card>

          {status === "draft" ? (
            <div
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
              role="status"
            >
              <strong>Draft</strong> keeps the product out of the live shop.
              Shoppers only see items that are <strong>Published</strong> and
              included in the same selling channel as your online store.
            </div>
          ) : null}

          {status === "published" ? (
            <div className="rounded-lg border border-outline-variant/25 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
              The live site only lists products that belong to its selling
              channel. Saving here adds or keeps that link when your store is
              connected. If an item is missing online, confirm it is published
              here and included in the channel in the full store admin.
            </div>
          ) : null}

          {isEdit && p && !p.shopVariantOptionsReady ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              This product did not use Size + Color options yet. Saving from
              this screen adds those options and rebuilds variants from the
              matrix below. Per-variant SKU and barcode stay in your store admin
              when you keep more than one variant.
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Product identity</CardTitle>
              <CardDescription>
                Set the public name, address, and description used by the
                storefront.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="catalog-product-title">Title</Label>
                <Input
                  id="catalog-product-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={500}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="catalog-product-handle">
                  Web address (handle)
                </Label>
                <Input
                  id="catalog-product-handle"
                  className="font-mono"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="auto from title if empty"
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="catalog-product-description">Description</Label>
                <Textarea
                  id="catalog-product-description"
                  className="min-h-[120px]"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={50000}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Public product details</CardTitle>
              <CardDescription>
                Optional extras for the public product page: brand, weight and
                size notes, related items, search snippet, and optional image
                hotspot data for supported layouts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    Brand
                  </label>
                  <input
                    className="mt-2 w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Shown on PDP and shop filters"
                    maxLength={200}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    Search listing description
                  </label>
                  <textarea
                    className="mt-2 w-full min-h-[72px] rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    placeholder="Optional. Replaces the short text shown in search results when set."
                    maxLength={500}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    Weight (kg)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="mt-2 w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder="e.g. 0.35"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    Dimensions label
                  </label>
                  <input
                    className="mt-2 w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
                    value={dimensionsLabel}
                    onChange={(e) => setDimensionsLabel(e.target.value)}
                    placeholder="e.g. 40 x 30 x 5 cm"
                    maxLength={200}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    Material
                  </label>
                  <input
                    className="mt-2 w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    placeholder="Fabric composition"
                    maxLength={500}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    Lifestyle image
                  </label>
                  <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                    Optional full-width photo for lookbook or campaign use.
                    Paste a web address, a path on your site starting with /, or
                    a small embedded image.
                  </p>
                  <input
                    type="text"
                    className="mt-2 w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
                    value={lifestyleImageUrl}
                    onChange={(e) => setLifestyleImageUrl(e.target.value)}
                    placeholder="Web address or site path"
                    maxLength={2000}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    Related products
                  </label>
                  <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                    Search the catalog and add handles, or edit the list below.
                    Handles must match product web slugs shown on the shop.
                  </p>
                  <div className="mt-2">
                    <RelatedProductsPicker
                      valueText={relatedHandlesText}
                      onChangeText={setRelatedHandlesText}
                      excludeHandle={isEdit && p ? p.handle : undefined}
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    Image hotspots (advanced)
                  </label>
                  <textarea
                    className="mt-2 w-full min-h-[120px] rounded-lg border border-outline-variant/30 px-3 py-2 font-mono text-xs"
                    value={hotspotsJson}
                    onChange={(e) => setHotspotsJson(e.target.value)}
                    placeholder='[{"xPct":20,"yPct":40,"productSlug":"other-handle","label":"Optional"}]'
                    maxLength={10000}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Categories</CardTitle>
              <CardDescription>
                Use categories to control shop filters and catalog discovery.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Categories (shop filter)
              </span>
              <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                Tick categories for this product. Add a new shop category below
                when you need a label that is not in the list yet.
              </p>
              {!categoriesLoaded ? (
                <p className="mt-2 text-sm text-on-surface-variant">
                  Loading categories…
                </p>
              ) : categories.length === 0 ? (
                <p className="mt-2 text-sm text-on-surface-variant">
                  No categories yet. Add one below, or create more in your store
                  admin.
                </p>
              ) : (
                <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-outline-variant/20 bg-white p-3">
                  {categories.map((c) => (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={categoryIds.includes(c.id)}
                          onChange={() => toggleCategory(c.id)}
                        />
                        <span>{c.name}</span>
                        <span className="font-mono text-xs text-on-surface-variant">
                          {c.handle}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 rounded-lg border border-outline-variant/20 bg-surface-container-low/60 p-3 space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  Add shop category
                </p>
                {categoryCreateError ? (
                  <p className="text-xs text-red-700" role="alert">
                    {categoryCreateError}
                  </p>
                ) : null}
                <input
                  className="w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
                  placeholder="Name (e.g. Summer shorts)"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  maxLength={200}
                  aria-label="New category name"
                />
                <input
                  className="w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm font-mono"
                  placeholder="Web slug (optional, auto if empty)"
                  value={newCategoryHandle}
                  onChange={(e) => setNewCategoryHandle(e.target.value)}
                  maxLength={200}
                  aria-label="New category handle"
                />
                <button
                  type="button"
                  disabled={categoryCreating}
                  className="rounded-lg border border-outline-variant/30 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide disabled:opacity-50"
                  onClick={() => void createStoreCategory()}
                >
                  {categoryCreating ? "Creating…" : "Create and select"}
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Variants</CardTitle>
              <CardDescription>
                Define the size and color matrix used by Medusa variants and
                inventory.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VariantMatrixField
                sizes={matrixSizes}
                colors={matrixColors}
                onSizesChange={setMatrixSizes}
                onColorsChange={setMatrixColors}
              />
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Sellability</CardTitle>
              <CardDescription>
                Control publication, price, and available units for this
                product.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`grid grid-cols-1 gap-6 ${showPerVariantStock ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}
              >
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    Status
                  </label>
                  <select
                    className="mt-2 w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
                    value={status}
                    onChange={(e) =>
                      setStatus(
                        e.target.value === "published" ? "published" : "draft",
                      )
                    }
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    Price (
                    {isEdit && p
                      ? p.currencyCode.toUpperCase()
                      : createCurrency.toUpperCase()}
                    )
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className="mt-2 w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
                    value={pricePhp}
                    onChange={(e) => setPricePhp(e.target.value)}
                    required
                  />
                </div>
                {!showPerVariantStock ? (
                  <div>
                    <label
                      htmlFor="catalog-product-stock"
                      className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant"
                    >
                      Stock (units)
                    </label>
                    <p
                      id="catalog-stock-help"
                      className="mt-1 text-xs leading-relaxed text-on-surface-variant sm:hidden"
                    >
                      Stocked units at the first warehouse this app uses.
                      Reserved units (open carts) can make sellable availability
                      lower. Other warehouses are set in the full store admin.
                      {variantComboCount > 1
                        ? " Matrix create: the same quantity is applied to every variant."
                        : ""}
                    </p>
                    <input
                      id="catalog-product-stock"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      className="mt-2 w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
                      value={stockQuantity}
                      onChange={(e) => {
                        const next = e.target.value.replace(/\D/g, "");
                        setStockQuantity(next);
                      }}
                      required
                      aria-describedby="catalog-stock-help catalog-stock-help-wide"
                    />
                    <p
                      id="catalog-stock-help-wide"
                      className="mt-1 hidden text-xs leading-relaxed text-on-surface-variant sm:block"
                    >
                      Stocked units at the first warehouse for this workspace.
                      Sellable stock can be lower when units are reserved. Other
                      locations are set in the full store admin.
                      {variantComboCount > 1
                        ? " When you create a matrix, this quantity is applied to every variant."
                        : ""}
                    </p>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {showPerVariantStock ? (
            <Card>
              <CardHeader>
                <CardTitle>Stock by variant</CardTitle>
                <CardDescription>
                  Set each selected size and color combination independently.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    Stock by variant (warehouse)
                  </span>
                  <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                    One row per combination from Size and Color above (same
                    count as “N sizes × M colors”). Each cell has its own
                    quantity. Changing one row does not change the others.
                    Combinations not in the store yet keep their value here
                    until you save and variants are created.
                  </p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-outline-variant/20 bg-white">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-outline-variant/20 bg-surface-container-low/80">
                        <th className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                          Variant (size / color)
                        </th>
                        <th className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                          Stock (units)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrixStockWireRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={2}
                            className="px-3 py-3 text-on-surface-variant"
                          >
                            No matrix combinations to show.
                          </td>
                        </tr>
                      ) : (
                        matrixStockWireRows.map((wire) => (
                          <tr
                            key={wire.cellKey}
                            className="border-b border-outline-variant/15 last:border-0"
                          >
                            <td className="px-3 py-2 align-middle text-on-surface">
                              <div className="flex flex-col gap-0.5">
                                <span>{wire.label}</span>
                                {wire.serverRow ? null : (
                                  <span className="text-[11px] font-normal normal-case tracking-normal text-on-surface-variant">
                                    Not in store yet — stock applies to this
                                    combination only when you save
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 align-middle">
                              {wire.serverRow ? (
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  autoComplete="off"
                                  className="w-28 rounded-lg border border-outline-variant/30 px-2 py-1.5 font-mono text-sm"
                                  value={
                                    variantStockById[
                                      wire.serverRow.variantId
                                    ] ?? "0"
                                  }
                                  onChange={(e) => {
                                    const next = e.target.value.replace(
                                      /\D/g,
                                      "",
                                    );
                                    setVariantStockById((prev) => ({
                                      ...prev,
                                      [wire.serverRow!.variantId]: next,
                                    }));
                                  }}
                                  aria-label={`Stock for ${wire.label}`}
                                />
                              ) : (
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  autoComplete="off"
                                  className="w-28 rounded-lg border border-outline-variant/30 px-2 py-1.5 font-mono text-sm"
                                  value={stockByMatrixCell[wire.cellKey] ?? "0"}
                                  onChange={(e) => {
                                    const next = e.target.value.replace(
                                      /\D/g,
                                      "",
                                    );
                                    setStockByMatrixCell((prev) => ({
                                      ...prev,
                                      [wire.cellKey]: next,
                                    }));
                                  }}
                                  aria-label={`Stock for ${wire.label} (not in store yet)`}
                                />
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {orphanServerVariantRows.length > 0 ? (
                  <div
                    className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-3 text-xs leading-relaxed text-amber-950"
                    role="status"
                  >
                    <p className="font-semibold text-amber-950">
                      Combinations still in the store but not selected above (
                      {orphanServerVariantRows.length})
                    </p>
                    <p className="mt-1">
                      Saving applies your current Size and Color lists. These
                      pairs are removed from the product unless you add matching
                      options back.
                    </p>
                    <ul className="mt-2 list-inside list-disc text-on-surface">
                      {orphanServerVariantRows.map((r) => (
                        <li key={r.variantId}>{r.label}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card size="sm">
            <CardHeader>
              <CardTitle>Identifiers</CardTitle>
              <CardDescription>
                Optional SKU and barcode values used by warehouse, POS, and
                fulfillment workflows.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label
                  htmlFor="catalog-product-sku"
                  className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant"
                >
                  SKU (optional)
                </label>
                <p
                  id="catalog-sku-help"
                  className="mt-1 text-xs leading-relaxed text-on-surface-variant"
                >
                  Stock keeping unit: your own code for this variant (warehouse
                  bins, barcode labels, packing slips, POS search). Leave empty
                  to skip a SKU on create; you can add one later in your store
                  admin.
                </p>
                {variantComboCount > 1 ? (
                  <p className="mt-2 text-xs text-on-surface-variant">
                    Matrix products skip SKU and barcode here. Assign per
                    variant in the full store admin.
                  </p>
                ) : null}
                <input
                  id="catalog-product-sku"
                  className="mt-2 w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm font-mono"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  maxLength={120}
                  placeholder="e.g. MAC-TEE-BLK-M"
                  aria-describedby="catalog-sku-help"
                  disabled={variantComboCount > 1}
                />
              </div>

              <div>
                <label
                  htmlFor="catalog-variant-barcode"
                  className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant"
                >
                  Barcode (optional)
                </label>
                <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                  UPC, EAN, or internal scancode for this item when your
                  checkout or devices read it.
                </p>
                <input
                  id="catalog-variant-barcode"
                  className="mt-2 w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm font-mono"
                  value={variantBarcode}
                  onChange={(e) => setVariantBarcode(e.target.value)}
                  maxLength={120}
                  placeholder="Numeric or alphanumeric"
                  disabled={variantComboCount > 1}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Product media</CardTitle>
              <CardDescription>
                Manage main images, gallery media, and uploaded catalog assets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Product media
              </label>
              <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                Main photos and gallery in one list. The first main photo is the
                shop preview. Use Send to gallery to move clips or extra stills
                below the main block. Upload several files at once or pick
                multiple files from the catalog library (choose Main or Gallery
                before adding).
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  ref={bulkUploadInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/mp4,video/webm,video/quicktime,video/ogg,.mp4,.webm,.mov,.png,.jpg,.jpeg,.webp,.gif"
                  className="sr-only"
                  aria-hidden
                  tabIndex={-1}
                  onChange={(e) => {
                    void handleBulkUpload(e.target.files);
                  }}
                />
                <button
                  type="button"
                  disabled={
                    uploadingBulk ||
                    uploadingCatalogImage ||
                    uploadingCatalogVideo ||
                    saving
                  }
                  className="rounded-lg border border-outline-variant/30 bg-surface-container-high px-3 py-1.5 text-xs font-semibold text-on-surface disabled:opacity-50"
                  onClick={() => bulkUploadInputRef.current?.click()}
                >
                  {uploadingBulk ||
                  uploadingCatalogImage ||
                  uploadingCatalogVideo
                    ? "Uploading…"
                    : "Upload files"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  className="rounded-lg border border-outline-variant/30 bg-surface-container-high px-3 py-1.5 text-xs font-semibold text-on-surface disabled:opacity-50"
                  onClick={() => setCatalogPickerOpen(true)}
                >
                  Pick from catalog library
                </button>
              </div>
              <div className="mt-3">
                <CatalogUnifiedMediaList
                  items={unifiedMedia}
                  mainImageCount={mainImageCount}
                  onItemsChange={setUnifiedMedia}
                  onMainCountChange={setMainImageCount}
                  disabled={saving || uploadingBulk}
                />
              </div>
            </CardContent>
          </Card>

          <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80 motion-reduce:transition-none">
            <button
              type="submit"
              disabled={saving || deleting}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 motion-reduce:transition-none"
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create product"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-input px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
              onClick={() => router.push("/admin/catalog")}
            >
              Cancel
            </button>
            {isEdit ? (
              <button
                type="button"
                disabled={deleting || saving}
                className="ml-auto rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive transition hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-destructive/30 disabled:opacity-50 motion-reduce:transition-none"
                onClick={() => void remove()}
              >
                {deleting ? "Deleting…" : "Delete product"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <CatalogMediaPickerDialog
        open={catalogPickerOpen}
        addPlacement={catalogAddPlacement}
        onAddPlacementChange={setCatalogAddPlacement}
        onClose={() => setCatalogPickerOpen(false)}
        onPickMany={handlePickManyFromCatalog}
      />
    </form>
  );
}
