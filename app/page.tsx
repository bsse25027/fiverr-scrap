import { supabaseAdmin } from "@/lib/supabaseAdmin";
import DashboardClient from "./ui/DashboardClient";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export type Buyer = {
  id: number;
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

export default async function Page() {
  noStore();

  const { data, error } = await supabaseAdmin
    .from("fiverr_review_buyers")
    .select("*")
    .order("last_seen_at", { ascending: false });

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Supabase Error</h1>
        <p>{error.message}</p>
      </main>
    );
  }

  return <DashboardClient initialBuyers={(data || []) as Buyer[]} />;
}
