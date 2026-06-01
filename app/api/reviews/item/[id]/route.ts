import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  const id = Number(context.params.id);
  const body = (await request.json().catch(() => ({}))) as {
    done?: unknown;
    archived?: unknown;
    archiveNote?: unknown;
    archive_note?: unknown;
  };

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid review id" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    last_seen_at: new Date().toISOString()
  };

  if ("done" in body) {
    updates.done = Boolean(body.done);
  }

  if ("archived" in body) {
    const archived = Boolean(body.archived);
    const note = typeof body.archiveNote === "string"
      ? body.archiveNote.trim()
      : typeof body.archive_note === "string"
        ? body.archive_note.trim()
        : "";

    updates.archived = archived;
    updates.archive_note = archived ? note || null : null;
    updates.archived_at = archived ? new Date().toISOString() : null;
  }

  const { data, error } = await supabaseAdmin
    .from("fiverr_review_buyers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, buyer: data });
}

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
