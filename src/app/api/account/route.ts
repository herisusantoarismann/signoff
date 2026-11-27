import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAuthenticatedOwner } from "@/lib/security/actor";
import { deleteProjectStoragePrefix, handleApiError } from "@/lib/supabase/http";

export async function GET() {
  try {
    const owner = await getAuthenticatedOwner();
    if (!owner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({
      id: owner.id,
      email: owner.email,
      studio_name: owner.studioName,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const owner = await getAuthenticatedOwner();
    if (!owner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const rawName = typeof body.studio_name === "string" ? body.studio_name.trim() : "";
    if (rawName.length > 60) {
      return NextResponse.json(
        { error: "Nama studio maksimal 60 karakter." },
        { status: 400 }
      );
    }

    const admin = createAdminSupabaseClient();
    const { data, error } = await admin
      .from("profiles")
      .upsert({ id: owner.id, studio_name: rawName || null }, { onConflict: "id" })
      .select("id, studio_name")
      .single();

    if (error) throw error;
    return NextResponse.json({ profile: data });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const owner = await getAuthenticatedOwner();
    if (!owner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const confirmEmail = typeof body.confirmEmail === "string" ? body.confirmEmail.trim().toLowerCase() : "";
    if (!owner.email || confirmEmail !== owner.email.toLowerCase()) {
      return NextResponse.json(
        { error: "Email konfirmasi tidak cocok." },
        { status: 400 }
      );
    }

    const admin = createAdminSupabaseClient();
    const { data: projects } = await admin
      .from("projects")
      .select("id")
      .eq("owner_id", owner.id);

    for (const p of projects ?? []) {
      await deleteProjectStoragePrefix(p.id);
    }

    await admin.from("projects").delete().eq("owner_id", owner.id);
    await admin.from("profiles").delete().eq("id", owner.id);

    const { error: delErr } = await admin.auth.admin.deleteUser(owner.id);
    if (delErr) throw delErr;

    return NextResponse.json({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
