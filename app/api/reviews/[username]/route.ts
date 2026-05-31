import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(
  request: Request,
  context: { params: { username: string } }
) {
  const body = (await request.json().catch(() => ({}))) as { done?: unknown };
  const username = decodeURIComponent(context.params.username).trim();

  if (!username) {
    return NextResponse.json({ error: "Missing username" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("fiverr_review_buyers")
    .update({ done: Boolean(body.done), last_seen_at: new Date().toISOString() })
    .eq("username", username)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, buyer: data });
}
