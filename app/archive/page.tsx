import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ArchiveClient from "@/app/ui/ArchiveClient";
import type { Buyer, Gig } from "@/app/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function ArchivePage() {
  noStore();

  const [buyersResult, gigsResult] = await Promise.all([
    supabaseAdmin
      .from("fiverr_review_buyers")
      .select("*")
      .eq("archived", true)
      .order("archived_at", { ascending: false }),
    supabaseAdmin
      .from("fiverr_gigs")
      .select("*")
  ]);

  if (buyersResult.error || gigsResult.error) {
    return (
      <main style={{ padding: 24 }}>
        <Link href="/">Back to gigs</Link>
        <h1>Supabase Error</h1>
        <p>{buyersResult.error?.message || gigsResult.error?.message}</p>
      </main>
    );
  }

  return (
    <ArchiveClient
      initialBuyers={(buyersResult.data || []) as Buyer[]}
      gigs={(gigsResult.data || []) as Gig[]}
    />
  );
}
