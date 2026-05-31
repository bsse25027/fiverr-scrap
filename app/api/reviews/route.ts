import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type"
};

type IncomingGig = {
  gigKey?: unknown;
  gig_key?: unknown;
  gigId?: unknown;
  gig_id?: unknown;
  gigUrl?: unknown;
  gig_url?: unknown;
  title?: unknown;
  sellerUsername?: unknown;
  seller_username?: unknown;
  sellerProfileImageUrl?: unknown;
  seller_profile_image_url?: unknown;
  gigImageUrl?: unknown;
  gig_image_url?: unknown;
  description?: unknown;
};

type IncomingReview = {
  username?: unknown;
  profileImageUrl?: unknown;
  profile_image_url?: unknown;
  country?: unknown;
  rating?: unknown;
  review?: unknown;
  gigUrl?: unknown;
  gig_url?: unknown;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeImageUrl(url: string) {
  return url
    .replace("/f_auto,q_auto,t_profile_small/", "/")
    .replace("/f_auto,q_auto,t_profile_original/", "/")
    .replace("/f_auto,q_auto/", "/")
    .replace(/([^:])\/{2,}/g, "$1/");
}

function normalizeGigUrl(value: string) {
  if (!value) return "";

  try {
    const url = new URL(value);
    url.hash = "";
    return `${url.origin}${url.pathname}`;
  } catch {
    return value;
  }
}

function getFallbackGigKey(gigUrl: string) {
  if (!gigUrl) return "unknown";

  try {
    const url = new URL(gigUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.length >= 2 ? `${parts[0]}-${parts[1]}`.toLowerCase() : url.pathname.toLowerCase();
  } catch {
    return gigUrl.toLowerCase();
  }
}

function normalizeGig(input: IncomingGig | undefined, sourceUrl: string) {
  const gigUrl = normalizeGigUrl(asString(input?.gigUrl) || asString(input?.gig_url) || sourceUrl);
  const rawGigKey =
    asString(input?.gigKey) ||
    asString(input?.gig_key) ||
    asString(input?.gigId) ||
    asString(input?.gig_id) ||
    getFallbackGigKey(gigUrl);
  const gigKey = rawGigKey || "unknown";

  return {
    gig_key: gigKey,
    gig_url: gigUrl || "unknown",
    title: asString(input?.title) || null,
    seller_username: asString(input?.sellerUsername) || asString(input?.seller_username) || null,
    seller_profile_image_url: normalizeImageUrl(
      asString(input?.sellerProfileImageUrl) || asString(input?.seller_profile_image_url)
    ) || null,
    gig_image_url: normalizeImageUrl(asString(input?.gigImageUrl) || asString(input?.gig_image_url)) || null,
    description: asString(input?.description) || null,
    raw: input || {},
    last_seen_at: new Date().toISOString()
  };
}

function normalizeReview(item: IncomingReview, sourceUrl: string, gigKey: string, gigUrl: string) {
  const username = asString(item.username);
  const profileImageUrl = normalizeImageUrl(
    asString(item.profileImageUrl) || asString(item.profile_image_url)
  );

  if (!username || !profileImageUrl) return null;

  return {
    gig_key: gigKey,
    username,
    profile_image_url: profileImageUrl,
    country: asString(item.country) || null,
    rating: typeof item.rating === "number" ? item.rating : null,
    review: asString(item.review) || null,
    gig_url: normalizeGigUrl(asString(item.gigUrl) || asString(item.gig_url) || gigUrl) || null,
    source_url: sourceUrl || null,
    raw: item,
    last_seen_at: new Date().toISOString()
  };
}

type ReviewRow = NonNullable<ReturnType<typeof normalizeReview>>;

function isReviewRow(row: ReturnType<typeof normalizeReview>): row is ReviewRow {
  return row !== null;
}

export async function GET() {
  const [gigsResult, buyersResult] = await Promise.all([
    supabaseAdmin
      .from("fiverr_gigs")
      .select("*")
      .order("last_seen_at", { ascending: false }),
    supabaseAdmin
      .from("fiverr_review_buyers")
      .select("*")
      .order("last_seen_at", { ascending: false })
  ]);

  const error = gigsResult.error || buyersResult.error;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }

  return NextResponse.json({ gigs: gigsResult.data || [], buyers: buyersResult.data || [] }, {
    headers: {
      ...corsHeaders,
      "Cache-Control": "no-store, no-cache, must-revalidate"
    }
  });
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
  }

  const body = payload as { gig?: IncomingGig; reviews?: IncomingReview[]; url?: string };
  const sourceUrl = normalizeGigUrl(asString(body.url));
  const gig = normalizeGig(body.gig, sourceUrl);
  const incomingReviews = Array.isArray(body.reviews) ? body.reviews : [];

  const { error: gigError } = await supabaseAdmin
    .from("fiverr_gigs")
    .upsert(gig, {
      onConflict: "gig_key",
      ignoreDuplicates: false
    });

  if (gigError) {
    return NextResponse.json({ error: gigError.message }, { status: 500, headers: corsHeaders });
  }

  const normalizedRows = incomingReviews
    .map((item) => normalizeReview(item, sourceUrl, gig.gig_key, gig.gig_url))
    .filter(isReviewRow);
  const rows = Array.from(
    new Map(normalizedRows.map((row) => [`${row.gig_key}|${row.username.toLowerCase()}`, row])).values()
  );

  if (!rows.length) {
    return NextResponse.json(
      { error: "Gig saved, but no valid reviews were found. Each review needs username and profileImageUrl." },
      { status: 400, headers: corsHeaders }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("fiverr_review_buyers")
    .upsert(rows, {
      onConflict: "gig_key,username",
      ignoreDuplicates: false
    })
    .select("id,username,gig_key");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }

  return NextResponse.json({
    ok: true,
    gig: {
      gig_key: gig.gig_key,
      gig_url: gig.gig_url,
      title: gig.title
    },
    received: incomingReviews.length,
    deduped: rows.length,
    saved: data?.length ?? rows.length
  }, { headers: corsHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders
  });
}
