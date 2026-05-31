import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function DELETE(
  _request: Request,
  context: { params: { gigKey: string } }
) {
  const gigKey = decodeURIComponent(context.params.gigKey).trim();

  if (!gigKey || gigKey === "unknown") {
    return NextResponse.json({ error: "Missing or protected gig key" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("fiverr_gigs")
    .delete()
    .eq("gig_key", gigKey);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
