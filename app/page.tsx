import { supabaseAdmin } from "@/lib/supabaseAdmin";
import DashboardClient from "./ui/DashboardClient";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export type Buyer = {
  id: number;
  gig_key: string;
  username: string;
  profile_image_url: string;
  country: string | null;
  rating: number | null;
  review: string | null;
  gig_url: string | null;
  source_url: string | null;
  done: boolean;
  first_seen_at: string;
  last_seen_at: string;
};

export type Gig = {
  gig_key: string;
  gig_url: string;
  title: string | null;
  seller_username: string | null;
  seller_profile_image_url: string | null;
  gig_image_url: string | null;
  description: string | null;
  first_seen_at: string;
  last_seen_at: string;
};

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
