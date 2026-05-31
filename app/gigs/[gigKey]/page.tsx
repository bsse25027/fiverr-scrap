import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import GigDetailClient from "@/app/ui/GigDetailClient";
import type { Buyer, Gig } from "@/app/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function GigPage({ params }: { params: { gigKey: string } }) {
  noStore();

  const gigKey = decodeURIComponent(params.gigKey);

  const [gigResult, buyersResult] = await Promise.all([
    supabaseAdmin
      .from("fiverr_gigs")
      .select("*")
      .eq("gig_key", gigKey)
      .single(),
    supabaseAdmin
      .from("fiverr_review_buyers")
      .select("*")
      .eq("gig_key", gigKey)
      .order("last_seen_at", { ascending: false })
  ]);

  if (gigResult.error || !gigResult.data) {
    notFound();
  }

  if (buyersResult.error) {
    return (
      <main style={{ padding: 24 }}>
        <Link href="/">Back to gigs</Link>
        <h1>Supabase Error</h1>
        <p>{buyersResult.error.message}</p>
      </main>
    );
  }

  return (
    <GigDetailClient
      gig={gigResult.data as Gig}
      initialBuyers={(buyersResult.data || []) as Buyer[]}
    />
  );
}
