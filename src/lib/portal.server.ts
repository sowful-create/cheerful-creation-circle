import { useSession, getWebRequest } from "@tanstack/react-start/server";
import { createHash } from "node:crypto";

export type PortalSession = { memberId?: string };

export type SessionUser = {
  id: string;
  userId: string;
  name: string;
  role: "管理者" | "確認者" | "一般";
  canEdit: boolean;
};

function isHttps() {
  try {
    const req = getWebRequest();
    const proto = req.headers.get("x-forwarded-proto");
    if (proto) return proto.split(",")[0]!.trim() === "https";
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

function sessionConfig() {
  // プレビューは iframe 内（クロスサイト）で表示されるため、
  // https のときは SameSite=None + Secure にしないとクッキーが送られない。
  const https = isHttps();
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "shift-portal",
    maxAge: 60 * 60 * 24 * 14,
    cookie: {
      httpOnly: true,
      secure: https,
      sameSite: (https ? "none" : "lax") as "none" | "lax",
      path: "/",
    },
  };
}


export function getPortalSession() {
  return useSession<PortalSession>(sessionConfig());
}

export function hashPin(pin: string) {
  return createHash("sha256").update(pin, "utf8").digest("hex");
}

export async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function currentUser(): Promise<SessionUser | null> {
  const session = await getPortalSession();
  const memberId = session.data.memberId;
  if (!memberId) return null;
  const supabaseAdmin = await getAdmin();
  const { data } = await supabaseAdmin
    .from("app_users")
    .select("id, user_id, name, role, can_edit, active")
    .eq("id", memberId)
    .maybeSingle();
  if (!data || !data.active) return null;
  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    role: data.role as SessionUser["role"],
    canEdit: data.can_edit,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new Error("ログインが必要です");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "管理者") throw new Error("管理者権限が必要です");
  return user;
}
