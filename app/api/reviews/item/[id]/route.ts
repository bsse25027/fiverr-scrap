import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function DELETE(
  _request: Request,
  context: { params: { id: string } }
) {
  const id = Number(context.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid review id" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("fiverr_review_buyers")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
