import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type"
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

function normalizeReview(item: IncomingReview, sourceUrl: string) {
  const username = asString(item.username);
  const profileImageUrl = normalizeImageUrl(
    asString(item.profileImageUrl) || asString(item.profile_image_url)
  );

  if (!username || !profileImageUrl) return null;

  return {
    username,
    profile_image_url: profileImageUrl,
    country: asString(item.country) || null,
    rating: typeof item.rating === "number" ? item.rating : null,
    review: asString(item.review) || null,
    gig_url: asString(item.gigUrl) || asString(item.gig_url) || null,
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
  const { data, error } = await supabaseAdmin
    .from("fiverr_review_buyers")
    .select("*")
    .order("last_seen_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }

  return NextResponse.json({ buyers: data || [] }, {
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

  const body = payload as { reviews?: IncomingReview[]; url?: string };
  const sourceUrl = asString(body.url);
  const incomingReviews = Array.isArray(body.reviews) ? body.reviews : [];
  const normalizedRows = incomingReviews
    .map((item) => normalizeReview(item, sourceUrl))
    .filter(isReviewRow);
  const rows = Array.from(
    new Map(normalizedRows.map((row) => [row.username.toLowerCase(), row])).values()
  );

  if (!rows.length) {
    return NextResponse.json(
      { error: "No valid reviews. Each review needs username and profileImageUrl." },
      { status: 400, headers: corsHeaders }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("fiverr_review_buyers")
    .upsert(rows, {
      onConflict: "username",
      ignoreDuplicates: false
    })
    .select("username");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }

  return NextResponse.json({
    ok: true,
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
