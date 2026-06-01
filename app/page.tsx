import { supabaseAdmin } from "@/lib/supabaseAdmin";
import DashboardClient from "./ui/DashboardClient";
import { unstable_noStore as noStore } from "next/cache";
import type { Buyer, Gig } from "./types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function Page() {
  noStore();

  const [gigsResult, buyersResult] = await Promise.all([
    supabaseAdmin
      .from("fiverr_gigs")
      .select("*")
      .order("last_seen_at", { ascending: false }),
    supabaseAdmin
      .from("fiverr_review_buyers")
      .select("*")
      .eq("archived", false)
      .order("last_seen_at", { ascending: false })
  ]);

  if (gigsResult.error || buyersResult.error) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Supabase Error</h1>
        <p>{gigsResult.error?.message || buyersResult.error?.message}</p>
      </main>
    );
  }

  return (
    <DashboardClient
      initialGigs={(gigsResult.data || []) as Gig[]}
      initialBuyers={(buyersResult.data || []) as Buyer[]}
    />
  );
}
