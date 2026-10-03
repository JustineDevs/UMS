#!/usr/bin/env node

/**
 * Populate the local Worker catalog with believable storefront inventory.
 *
 * This intentionally talks to the same catalog mutation endpoint used by the
 * admin app. It is local-only so product pages, cart, checkout, and search all
 * exercise the real commerce graph instead of a frontend fixture.
 */
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(root, ".env.local") });

const apiUrl = (process.env.API_URL ?? "").trim().replace(/\/$/, "");
const secret = process.env.JWT_SECRET;
const organizationId = process.env.CATALOG_SEED_ORGANIZATION_ID?.trim() || "e2e-admin";

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(apiUrl)) {
  throw new Error("Refusing to seed a non-local API_URL. Set API_URL to the local Worker URL.");
}
if (!secret) throw new Error("JWT_SECRET is required to call the local catalog Worker.");
if (!process.env.MEDUSA_DB_URL) throw new Error("MEDUSA_DB_URL is required to resolve local catalog categories.");

const catalog = [
  {
    title: "Cort AD810 Acoustic Guitar",
    handle: "cort-ad810-acoustic-guitar",
    description: "A dependable full-size acoustic with a spruce top and warm, balanced projection for practice, lessons, and live playing.",
    pricePhp: 8999,
    sku: "CORT-AD810-NAT",
    brand: "Cort",
    category: "Guitars",
    color: "Natural",
    image: "https://images.unsplash.com/photo-1525201548942-d8732f6617a0?w=1200&q=85",
    stockQuantity: 12,
  },
  {
    title: "Squier Sonic Stratocaster HT",
    handle: "squier-sonic-stratocaster-ht",
    description: "A comfortable, familiar electric guitar platform with a slim neck and versatile single-coil character.",
    pricePhp: 11999,
    sku: "SQR-SONIC-STRAT-BLK",
    brand: "Squier",
    category: "Guitars",
    color: "Black",
    image: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=1200&q=85",
    stockQuantity: 8,
  },
  {
    title: "Boss Katana-50 Gen 3",
    handle: "boss-katana-50-gen-3",
    description: "A compact 50-watt guitar amplifier with expressive tones for home practice, rehearsal, and small stages.",
    pricePhp: 18999,
    sku: "BOSS-KTN50-G3",
    brand: "BOSS",
    category: "Amplifiers",
    color: "Black",
    image: "https://images.unsplash.com/photo-1588449668365-d15e397f6787?w=1200&q=85",
    stockQuantity: 6,
  },
  {
    title: "Yamaha F310 Acoustic Guitar",
    handle: "yamaha-f310-acoustic-guitar",
    description: "A comfortable dreadnought acoustic built for clear projection, reliable tuning, and everyday playability.",
    pricePhp: 10999,
    sku: "YAM-F310-NAT",
    brand: "Yamaha",
    category: "Guitars",
    color: "Natural",
    image: "https://images.unsplash.com/photo-1525201548942-d8732f6617a0?w=1200&q=85&fit=crop&crop=center",
    stockQuantity: 10,
  },
  {
    title: "Roland FP-30X Digital Piano",
    handle: "roland-fp-30x-digital-piano",
    description: "A slim digital piano with a weighted keyboard feel and expressive sound for home practice and performance.",
    pricePhp: 54999,
    sku: "ROL-FP30X-BLK",
    brand: "Roland",
    category: "Keyboards & Pianos",
    color: "Black",
    image: "https://images.unsplash.com/photo-1552422535-c45813c61732?w=1200&q=85",
    stockQuantity: 4,
  },
  {
    title: "Alesis Nitro Max Electronic Drum Kit",
    handle: "alesis-nitro-max-electronic-drum-kit",
    description: "A responsive electronic drum kit with mesh heads, practice sounds, and a compact footprint for home studios.",
    pricePhp: 32999,
    sku: "ALE-NITRO-MAX",
    brand: "Alesis",
    category: "Drums",
    color: "Black",
    image: "https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=1200&q=85",
    stockQuantity: 5,
  },
  {
    title: "NUX Mighty Air Wireless Stereo Amp",
    handle: "nux-mighty-air-wireless-stereo-amp",
    description: "A portable stereo modeling amplifier with wireless practice convenience and room-filling sound.",
    pricePhp: 14999,
    sku: "NUX-MIGHTY-AIR",
    brand: "NUX",
    category: "Amplifiers",
    color: "Black",
    image: "https://images.unsplash.com/photo-1588449668365-d15e397f6787?w=1200&q=85&fit=crop&crop=faces",
    stockQuantity: 9,
  },
  {
    title: "Marshall MG15GFX Guitar Amplifier",
    handle: "marshall-mg15gfx-guitar-amplifier",
    description: "A compact practice amplifier with classic British-inspired voice, built-in effects, and headphone output.",
    pricePhp: 12999,
    sku: "MAR-MG15GFX",
    brand: "Marshall",
    category: "Amplifiers",
    color: "Black",
    image: "https://images.unsplash.com/photo-1588449668365-d15e397f6787?w=1200&q=85&fit=crop&crop=entropy",
    stockQuantity: 7,
  },
  {
    title: "Fender Player II Stratocaster",
    handle: "fender-player-ii-stratocaster",
    description: "A versatile electric guitar with a comfortable modern neck, three single-coil pickups, and classic Fender response.",
    pricePhp: 62999,
    sku: "FEN-PLAYER2-STRAT-SB",
    brand: "Fender",
    category: "Guitars",
    color: "Sunburst",
    image: "https://images.unsplash.com/photo-1516924962500-2b4b3b99ea02?w=1200&q=85",
    stockQuantity: 3,
  },
  {
    title: "Ibanez GRX70QA Electric Guitar",
    handle: "ibanez-grx70qa-electric-guitar",
    description: "A player-friendly electric guitar with a slim neck, dual humbuckers, and a versatile five-way pickup layout.",
    pricePhp: 16999,
    sku: "IBA-GRX70QA-BLU",
    brand: "Ibanez",
    category: "Guitars",
    color: "Blue Burst",
    image: "https://images.unsplash.com/photo-1550985616-10810253b84d?w=1200&q=85",
    stockQuantity: 6,
  },
  {
    title: "Tama Imperialstar 5-Piece Drum Kit",
    handle: "tama-imperialstar-5-piece-drum-kit",
    description: "A complete acoustic drum kit with responsive shells, hardware, and cymbal-ready configuration for growing players.",
    pricePhp: 69999,
    sku: "TAM-IMPERIAL-5P-BLK",
    brand: "Tama",
    category: "Drums",
    color: "Black",
    image: "https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=1200&q=85&fit=crop&crop=faces",
    stockQuantity: 2,
  },
  {
    title: "Korg B2 Digital Piano",
    handle: "korg-b2-digital-piano",
    description: "A straightforward digital piano with weighted keys and carefully voiced piano sounds for home practice.",
    pricePhp: 34999,
    sku: "KOR-B2-BLK",
    brand: "Korg",
    category: "Keyboards & Pianos",
    color: "Black",
    image: "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=1200&q=85",
    stockQuantity: 5,
  },
  {
    title: "Yamaha Pacifica 112V Electric Guitar",
    handle: "yamaha-pacifica-112v-electric-guitar",
    description: "A reliable HSS electric guitar with smooth playability and flexible tones for practice, recording, and stage work.",
    pricePhp: 24999,
    sku: "YAM-PAC112V-NAT",
    brand: "Yamaha",
    category: "Guitars",
    color: "Natural",
    image: "https://images.unsplash.com/photo-1564186763535-ebb21ef5277f?w=1200&q=85",
    stockQuantity: 5,
  },
  {
    title: "Boss DS-1 Distortion Pedal",
    handle: "boss-ds-1-distortion-pedal",
    description: "A compact distortion pedal with cutting attack and sustain for adding familiar rock drive to any guitar rig.",
    pricePhp: 4999,
    sku: "BOSS-DS1-ORANGE",
    brand: "BOSS",
    category: "Effects",
    color: "Orange",
    image: "https://images.unsplash.com/photo-1563213126-a4273aed2016?w=1200&q=85",
    stockQuantity: 14,
  },
  {
    title: "Shure SM58 Vocal Microphone",
    handle: "shure-sm58-vocal-microphone",
    description: "A dependable dynamic vocal microphone tuned for clear, focused speech and singing in rehearsal or performance.",
    pricePhp: 6999,
    sku: "SHU-SM58-LC",
    brand: "Shure",
    category: "Accessories & Gear",
    color: "Black",
    image: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=1200&q=85",
    stockQuantity: 10,
  },
  {
    title: "Behringer Xenyx 802 Mixer",
    handle: "behringer-xenyx-802-mixer",
    description: "A compact analog mixer with microphone preamps and flexible inputs for small setups, streaming, and home recording.",
    pricePhp: 5499,
    sku: "BEH-XENYX-802",
    brand: "Behringer",
    category: "Accessories & Gear",
    color: "Black",
    image: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1200&q=85",
    stockQuantity: 8,
  },
  {
    title: "D'Addario EXL110 Nickel Wound Strings",
    handle: "daddario-exl110-nickel-wound-strings",
    description: "A balanced set of nickel-wound electric guitar strings with a familiar feel for everyday playing and reliable intonation.",
    pricePhp: 499,
    sku: "DAD-EXL110-010",
    brand: "D'Addario",
    category: "Accessories & Gear",
    color: "Nickel",
    image: "https://images.unsplash.com/photo-1525201548942-d8732f6617a0?w=1200&q=85&fit=crop&crop=bottom",
    stockQuantity: 30,
  },
  {
    title: "Epiphone Les Paul Standard 50s",
    handle: "epiphone-les-paul-standard-50s",
    description: "A classic single-cut electric guitar with warm humbucker tones, a comfortable neck, and stage-ready sustain.",
    pricePhp: 39999,
    sku: "EPI-LP50S-HB",
    brand: "Epiphone",
    category: "Guitars",
    color: "Heritage Burst",
    image: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=1200&q=85",
    stockQuantity: 4,
  },
];

// Keep the acceptance URL stable for existing automated checks, but never
// expose its test-oriented title in the storefront.
const acceptanceRouteProduct = {
  title: "Epiphone DR-100 Acoustic Guitar",
  handle: "e2e-native-guitar",
  description: "A full-size acoustic guitar with a comfortable neck and dependable projection for everyday playing.",
  pricePhp: 12999,
  sku: "EPIPHONE-DR100-NAT",
  brand: "Epiphone",
  category: "Guitars",
  color: "Natural",
  image: "https://images.unsplash.com/photo-1525201548942-d8732f6617a0?w=1200&q=85&fit=crop&crop=bottom",
  stockQuantity: 11,
};

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function internalToken() {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    sub: "local-catalog-seed",
    iss: "uvs.internal",
    aud: "uvs-worker",
    role: "admin",
    permissions: ["*", "catalog:write"],
    organization_id: organizationId,
    exp: Math.floor(Date.now() / 1000) + 900,
  }));
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

async function queryLocalCatalog() {
  const client = new pg.Client({ connectionString: process.env.MEDUSA_DB_URL });
  await client.connect();
  try {
    const [categories, products] = await Promise.all([
      client.query("SELECT id, name FROM public.product_category WHERE deleted_at IS NULL"),
      client.query("SELECT id, handle, updated_at, metadata FROM public.product WHERE deleted_at IS NULL"),
    ]);
    return { categories: new Map(categories.rows.map((row) => [row.name, row.id])), products: new Map(products.rows.map((row) => [row.handle, row])) };
  } finally {
    await client.end();
  }
}

async function mutate(product, existing, categoryId, token) {
  const method = existing ? "PATCH" : "POST";
  const endpoint = existing
    ? `${apiUrl}/api/admin/catalog/products/${encodeURIComponent(existing.id)}`
    : `${apiUrl}/api/admin/catalog/products`;
  const body = {
    title: product.title,
    handle: product.handle,
    description: product.description,
    status: "published",
    pricePhp: product.pricePhp,
    sku: product.sku,
    imageUrls: [product.image],
    thumbnail: product.image,
    categoryIds: [categoryId],
    sizeLabel: "One Size",
    colorLabel: product.color,
    stockQuantity: product.stockQuantity,
    storefrontMetadata: {
      brand: product.brand,
      organization_id: organizationId,
      mediaIds: [],
    },
  };
  if (existing) body.expectedRevision = new Date(existing.updated_at).toISOString();
  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `local-catalog-${method.toLowerCase()}-${product.handle}-${existing?.updated_at ?? "new"}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${product.handle} failed (${response.status}): ${payload.error ?? "unknown error"}`);
  return payload.productId;
}

const { categories, products } = await queryLocalCatalog();
const token = internalToken();
let created = 0;
let updated = 0;
for (const product of catalog) {
  const categoryId = categories.get(product.category);
  if (!categoryId) throw new Error(`Missing local category: ${product.category}`);
  const existing = products.get(product.handle);
  await mutate(product, existing, categoryId, token);
  if (existing) updated += 1;
  else created += 1;
  console.log(`${existing ? "updated" : "created"}: ${product.title}`);
}

const acceptanceRouteExisting = products.get(acceptanceRouteProduct.handle);
if (acceptanceRouteExisting) {
  await mutate(acceptanceRouteProduct, acceptanceRouteExisting, categories.get("Guitars"), token);
  updated += 1;
  console.log(`updated: ${acceptanceRouteProduct.title} (acceptance route preserved)`);
}

console.log(`Local catalog ready: ${created} created, ${updated} updated, ${catalog.length + (acceptanceRouteExisting ? 1 : 0)} total seeded products.`);
