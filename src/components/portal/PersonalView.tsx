import type { Member, RecordRow } from "@/lib/portal.functions";
import type { SessionUser } from "@/components/portal/types";
import {
  DAY_NAMES,
  SLOTS,
  STATE_BADGE,
  STATE_SURFACE,
  dateStr,
  daysInMonth,
  recordKey,
  slotState,
} from "@/lib/portal-utils";

type Props = {
  user: SessionUser;
  member: Member;
  year: number;
  month: number;
  records: Map<string, RecordRow>;
  onOpen: (member: Member, date: string, slot: "午前" | "午後") => void;
};

export function PersonalView({ user, member, year, month, records, onOpen }: Props) {
  const total = daysInMonth(year, month);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const canEdit = user.role === "管理者" || user.role === "確認者" || (member.id === user.id && user.canEdit);

  let submitted = 0;
  for (let d = 1; d <= total; d++) {
    for (const slot of SLOTS) {
      const rec = records.get(recordKey(member.id, dateStr(year, month, d), slot));
      if (rec && rec.workContent.trim()) submitted++;
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold">
              {member.name} さんの日報（{year}年{month}月）
            </h2>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                canEdit ? STATE_BADGE["提出済"] : STATE_BADGE["未入力"]
              }`}
            >
              {canEdit ? "編集可能" : "閲覧専用"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {canEdit
              ? "各枠をクリックして勤務時間・内容を入力してください。"
              : "閲覧権限のみです。内容の確認のみ行えます。"}
          </p>
        </div>
        <div className="text-xs font-semibold text-muted-foreground">
          当月進捗: <span className="text-primary">{submitted} / {total * 2} 枠 提出済</span>
        </div>
      </div>

      <div className="space-y-3">
        {Array.from({ length: total }, (_, i) => i + 1).map((day) => {
          const date = dateStr(year, month, day);
          const dow = new Date(year, month - 1, day).getDay();
          const isToday = isCurrentMonth && day === today.getDate();
          return (
            <div
              key={day}
              className={`rounded-2xl border bg-card p-3.5 shadow-sm transition hover:shadow-md ${
                isToday ? "border-primary ring-2 ring-primary/15" : "border-border"
              }`}
            >
              <div className="mb-2 flex items-center justify-between border-b border-border pb-2">
                <span
                  className={`text-sm font-bold ${
                    dow === 0 ? "text-destructive" : dow === 6 ? "text-info" : "text-foreground"
                  }`}
                >
                  {day}日（{DAY_NAMES[dow]}）
                </span>
                {isToday && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                    本日
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SLOTS.map((slot) => {
                  const rec = records.get(recordKey(member.id, date, slot));
                  const state = slotState(rec);
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => onOpen(member, date, slot)}
                        className={`w-full rounded-xl border p-3 text-left transition ${STATE_SURFACE[state]}`}
                    >
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-bold">{slot}</span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATE_BADGE[state]}`}
                        >
                          {state}
                        </span>
                      </div>
                      <p className="truncate text-[11px] font-semibold">
                        {rec?.visitedLocation || (
                          <span className="font-normal text-muted-foreground">訪問先未設定</span>
                        )}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {rec?.workContent || "勤務内容未記入"}
                      </p>
                      {state === "要修正" && rec?.reviewComment && (
                        <p className="mt-1 rounded-md bg-destructive/10 p-1.5 text-[10px] text-destructive">
                          修正指示: {rec.reviewComment}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
