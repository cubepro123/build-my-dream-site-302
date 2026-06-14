import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ALGOLIA_INDEX = "listings";
const GATEWAY_HOST = "connector-gateway.lovable.dev";

type ListingForIndex = {
  id: string;
  title: string;
  description?: string | null;
  price?: number | string | null;
  currency: string;
  category: string;
  location: string;
  listing_lat?: number | null;
  listing_lng?: number | null;
  listing_address?: string | null;
  images?: string[] | null;
  seller_id: string;
  status: string;
  created_at?: string | null;
};

function getClient() {
  // Lazy import keeps SDK out of client bundle
  return import("algoliasearch").then(({ algoliasearch }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const algKey = process.env.ALGOLIA_API_KEY;
    if (!lovableKey || !algKey) throw new Error("Algolia is not configured");
    return algoliasearch("gateway", algKey, {
      hosts: [{ url: GATEWAY_HOST, accept: "readWrite", protocol: "https" }],
      baseHeaders: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": algKey,
      },
    });
  });
}

function toRecord(l: ListingForIndex) {
  return {
    objectID: l.id,
    title: l.title,
    description: l.description ?? "",
    price: Number(l.price ?? 0),
    currency: l.currency,
    category: l.category,
    location: l.location,
    listing_address: l.listing_address ?? "",
    _geoloc:
      l.listing_lat != null && l.listing_lng != null
        ? { lat: l.listing_lat, lng: l.listing_lng }
        : undefined,
    images: l.images ?? [],
    seller_id: l.seller_id,
    status: l.status,
    created_at_ts: l.created_at ? Math.floor(new Date(l.created_at).getTime() / 1000) : 0,
  };
}

// Backfill + apply settings. Anyone authenticated can trigger; idempotent.
export const reindexAllListings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = await getClient();
    await client.setSettings({
      indexName: ALGOLIA_INDEX,
      indexSettings: {
        searchableAttributes: ["title", "description", "category", "location", "listing_address"],
        attributesForFaceting: [
          "category",
          "location",
          "currency",
          "filterOnly(status)",
          "filterOnly(seller_id)",
        ],
        customRanking: ["desc(created_at_ts)"],
        ranking: ["typo", "geo", "words", "filters", "proximity", "attribute", "exact", "custom"],
        attributesToHighlight: ["title", "description"],
      },
    });
    const { data, error } = await context.supabase
      .from("listings")
      .select(
        "id,title,description,price,currency,category,location,listing_lat,listing_lng,listing_address,images,seller_id,status,created_at",
      )
      .eq("status", "active");
    if (error) throw error;
    const records = (data ?? []).map(toRecord);
    if (records.length) {
      await client.saveObjects({ indexName: ALGOLIA_INDEX, objects: records });
    }
    return { ok: true, count: records.length };
  });

export const syncListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const client = await getClient();
    const { data: row, error } = await context.supabase
      .from("listings")
      .select(
        "id,title,description,price,currency,category,location,listing_lat,listing_lng,listing_address,images,seller_id,status,created_at",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!row) {
      await client.deleteObject({ indexName: ALGOLIA_INDEX, objectID: data.id });
      return { ok: true, deleted: true };
    }
    // Only the owner can sync their own listing (defense in depth)
    if (row.seller_id !== context.userId) throw new Error("Forbidden");
    if (row.status !== "active") {
      await client.deleteObject({ indexName: ALGOLIA_INDEX, objectID: data.id });
      return { ok: true, deleted: true };
    }
    await client.saveObject({ indexName: ALGOLIA_INDEX, body: toRecord(row) });
    return { ok: true };
  });

export const deleteListingFromIndex = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const client = await getClient();
    await client.deleteObject({ indexName: ALGOLIA_INDEX, objectID: data.id });
    return { ok: true };
  });
