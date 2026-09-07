import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Member = {
  id: string;
  userId: string;
  name: string;
  role: "管理者" | "確認者" | "一般";
  canEdit: boolean;
  active: boolean;
  sortOrder: number;
};

export type RecordRow = {
  id: string;
  memberId: string;
  date: string;
  slot: "午前" | "午後";
  visitedLocation: string;
  startTime: string;
  endTime: string;
  workContent: string;
  reviewStatus: "未確認" | "確認済" | "要修正";
  reviewComment: string;
  reviewedBy: string;
};

const monthInput = z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) });

function monthRange(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const from = `${year}-${pad(month)}-01`;
  const nextY = month === 12 ? year + 1 : year;
  const nextM = month === 12 ? 1 : month + 1;
  const to = `${nextY}-${pad(nextM)}-01`;
  return { from, to };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapMember(r: any): Member {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    role: r.role,
    canEdit: r.can_edit,
    active: r.active,
    sortOrder: r.sort_order,
  };
}

function mapRecord(r: any): RecordRow {
  return {
    id: r.id,
    memberId: r.member_id,
    date: r.work_date,
    slot: r.slot,
    visitedLocation: r.visited_location ?? "",
    startTime: r.start_time ?? "",
    endTime: r.end_time ?? "",
    workContent: r.work_content ?? "",
    reviewStatus: r.review_status ?? "未確認",
    reviewComment: r.review_comment ?? "",
    reviewedBy: r.reviewed_by ?? "",
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const loginUser = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: string; pin: string }) =>
    z.object({ userId: z.string().min(1), pin: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { getAdmin, getPortalSession, hashPin } = await import("./portal.server");
    const supabaseAdmin = await getAdmin();
    const { data: row } = await supabaseAdmin
      .from("app_users")
      .select("id, user_id, name, role, can_edit, active, pin_hash")
      .eq("user_id", data.userId.trim())
      .maybeSingle();

    if (!row || !row.active || row.pin_hash !== hashPin(data.pin)) {
      return { success: false as const, message: "ユーザーIDまたはPINが正しくありません" };
    }
    const session = await getPortalSession();
    await session.update({ memberId: row.id });
    return {
      success: true as const,
      user: {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        role: row.role,
        canEdit: row.can_edit,
      },
    };
  });

export const logoutUser = createServerFn({ method: "POST" }).handler(async () => {
  const { getPortalSession } = await import("./portal.server");
  const session = await getPortalSession();
  await session.clear();
  return { success: true as const };
});

export const getSessionUser = createServerFn({ method: "POST" }).handler(async () => {
  const { currentUser } = await import("./portal.server");
  return { user: await currentUser() };
});

export const getMonthData = createServerFn({ method: "POST" })
  .inputValidator((d: { year: number; month: number }) => monthInput.parse(d))
  .handler(async ({ data }) => {
    const { currentUser, getAdmin } = await import("./portal.server");
    const user = await currentUser();
    // A missing/expired session is an expected application state. Returning it
    // as data avoids turning an automatic refresh into an unhandled RPC error.
    if (!user) {
      return { authenticated: false as const, members: [], records: [] };
    }
    const supabaseAdmin = await getAdmin();
    const { from, to } = monthRange(data.year, data.month);

    const { data: members, error: mErr } = await supabaseAdmin
      .from("app_users")
      .select("id, user_id, name, role, can_edit, active, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (mErr) throw new Error(mErr.message);

    const { data: records, error: rErr } = await supabaseAdmin
      .from("shift_records")
      .select("*")
      .gte("work_date", from)
      .lt("work_date", to);
    if (rErr) throw new Error(rErr.message);

    return {
      authenticated: true as const,
      members: (members ?? []).map(mapMember),
      records: (records ?? []).map(mapRecord),
    };
  });

const reportInput = z.object({
  memberId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.enum(["午前", "午後"]),
  visitedLocation: z.string().max(200).optional(),
  startTime: z.string().max(10).optional(),
  endTime: z.string().max(10).optional(),
  workContent: z.string().max(4000).optional(),
});

export const saveReport = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof reportInput>) => reportInput.parse(d))
  .handler(async ({ data }) => {
    const { requireUser, getAdmin } = await import("./portal.server");
    const user = await requireUser();
    const isManager = user.role === "管理者" || user.role === "確認者";
    if (!isManager && (data.memberId !== user.id || !user.canEdit)) {
      throw new Error("編集権限がありません");
    }
    const supabaseAdmin = await getAdmin();
    const { data: existing } = await supabaseAdmin
      .from("shift_records")
      .select("id, review_status")
      .eq("member_id", data.memberId)
      .eq("work_date", data.date)
      .eq("slot", data.slot)
      .maybeSingle();

    const payload = {
      member_id: data.memberId,
      work_date: data.date,
      slot: data.slot,
      visited_location: data.visitedLocation ?? "",
      start_time: data.startTime ?? "",
      end_time: data.endTime ?? "",
      work_content: data.workContent ?? "",
      // 本人が修正したら「要修正」を解除して再提出扱いにする
      review_status:
        existing?.review_status === "要修正" && !isManager ? "未確認" : (existing?.review_status ?? "未確認"),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from("shift_records")
      .upsert(payload, { onConflict: "member_id,work_date,slot" });
    if (error) throw new Error(error.message);
    return { success: true as const };
  });

const shiftInput = z.object({
  entries: z
    .array(
      z.object({
        memberId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        slot: z.enum(["午前", "午後"]),
        visitedLocation: z.string().max(200),
      }),
    )
    .max(2000),
});

export const saveShiftPlans = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof shiftInput>) => shiftInput.parse(d))
  .handler(async ({ data }) => {
    const { requireUser, getAdmin } = await import("./portal.server");
    const user = await requireUser();
    if (user.role !== "管理者" && !user.canEdit) throw new Error("権限がありません");
    const supabaseAdmin = await getAdmin();

    let updated = 0;
    for (const e of data.entries) {
      const { data: existing } = await supabaseAdmin
        .from("shift_records")
        .select("id")
        .eq("member_id", e.memberId)
        .eq("work_date", e.date)
        .eq("slot", e.slot)
        .maybeSingle();

      if (existing) {
        const { error } = await supabaseAdmin
          .from("shift_records")
          .update({ visited_location: e.visitedLocation, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabaseAdmin.from("shift_records").insert({
          member_id: e.memberId,
          work_date: e.date,
          slot: e.slot,
          visited_location: e.visitedLocation,
        });
        if (error) throw new Error(error.message);
      }
      updated++;
    }
    return { success: true as const, updated };
  });

const reviewInput = z.object({
  memberId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.enum(["午前", "午後"]),
  status: z.enum(["未確認", "確認済", "要修正"]),
  comment: z.string().max(1000).optional(),
});

export const setReviewStatus = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof reviewInput>) => reviewInput.parse(d))
  .handler(async ({ data }) => {
    const { requireUser, getAdmin } = await import("./portal.server");
    const user = await requireUser();
    if (user.role !== "管理者" && user.role !== "確認者") throw new Error("確認権限がありません");
    const supabaseAdmin = await getAdmin();
    const { error } = await supabaseAdmin.from("shift_records").upsert(
      {
        member_id: data.memberId,
        work_date: data.date,
        slot: data.slot,
        review_status: data.status,
        review_comment: data.status === "要修正" ? (data.comment ?? "") : "",
        reviewed_by: user.name,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id,work_date,slot" },
    );
    if (error) throw new Error(error.message);
    return { success: true as const };
  });

export const listMembers = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAdmin, getAdmin } = await import("./portal.server");
  await requireAdmin();
  const supabaseAdmin = await getAdmin();
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id, user_id, name, role, can_edit, active, sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return { members: (data ?? []).map(mapMember) };
});

const memberInput = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().min(1).max(50),
  name: z.string().min(1).max(50),
  role: z.enum(["管理者", "確認者", "一般"]),
  canEdit: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  pin: z.string().max(50).optional(),
});

export const saveMember = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof memberInput>) => memberInput.parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, getAdmin, hashPin } = await import("./portal.server");
    await requireAdmin();
    const supabaseAdmin = await getAdmin();

    const base = {
      user_id: data.userId.trim(),
      name: data.name.trim(),
      role: data.role,
      can_edit: data.canEdit,
      active: data.active,
      sort_order: data.sortOrder,
    };

    if (data.id) {
      const patch = data.pin ? { ...base, pin_hash: hashPin(data.pin) } : base;
      const { error } = await supabaseAdmin.from("app_users").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      if (!data.pin) throw new Error("新規登録にはPINが必要です");
      const { error } = await supabaseAdmin
        .from("app_users")
        .insert({ ...base, pin_hash: hashPin(data.pin) });
      if (error) throw new Error(error.message);
    }
    return { success: true as const };
  });

export const deleteMember = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin, getAdmin } = await import("./portal.server");
    const admin = await requireAdmin();
    if (admin.id === data.id) throw new Error("自分自身は削除できません");
    const supabaseAdmin = await getAdmin();
    const { error } = await supabaseAdmin.from("app_users").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true as const };
  });
