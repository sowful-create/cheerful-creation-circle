import { useMemo, useState } from "react";
import type { Member, RecordRow } from "@/lib/portal.functions";
import { STATE_BADGE, slotState } from "@/lib/portal-utils";

type Props = {
  members: Member[];
  records: RecordRow[];
  onReview: (
    record: RecordRow,
    status: "確認済" | "要修正",
    comment: string,
  ) => Promise<void>;
};

export function ReviewView({ members, records, onReview }: Props) {
  const [filter, setFilter] = useState<"未確認" | "全て" | "要修正">("未確認");
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const nameOf = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);

  const list = useMemo(() => {
    return records
      .filter((r) => r.workContent.trim().length > 0)
      .filter((r) => (filter === "全て" ? true : r.reviewStatus === filter))
      .sort((a, b) => (a.date === b.date ? a.slot.localeCompare(b.slot) : a.date.localeCompare(b.date)));
  }, [records, filter]);

  const act = async (rec: RecordRow, status: "確認済" | "要修正") => {
    setBusyId(rec.id);
    try {
      await onReview(rec, status, comments[rec.id] ?? rec.reviewComment ?? "");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-success/40 bg-success/10 p-4">
        <div>
          <h2 className="text-base font-bold">日報の確認・承認</h2>
          <p className="text-xs text-muted-foreground">
            提出された日報を確認し、確認済または要修正を設定します。
          </p>
        </div>
        <div className="flex gap-1.5">
          {(["未確認", "要修正", "全て"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 && (
        <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          対象の日報はありません。
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {list.map((rec) => {
          const state = slotState(rec);
          return (
            <div key={rec.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-bold">
                  {nameOf.get(rec.memberId) ?? "不明"}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {rec.date}（{rec.slot}）
                  </span>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATE_BADGE[state]}`}>
                  {state}
                </span>
              </div>
              <p className="text-xs font-semibold">{rec.visitedLocation || "訪問先未設定"}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {rec.startTime || "--:--"} 〜 {rec.endTime || "--:--"}
              </p>
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-muted/70 p-2.5 text-xs">
                {rec.workContent}
              </p>

              <input
                value={comments[rec.id] ?? rec.reviewComment}
                onChange={(e) => setComments((p) => ({ ...p, [rec.id]: e.target.value }))}
                placeholder="修正指示コメント"
                className="input-base mt-3"
              />
              <div className="mt-2.5 flex justify-end gap-2">
                <button
                  disabled={busyId === rec.id}
                  onClick={() => act(rec, "要修正")}
                  className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive disabled:opacity-50"
                >
                  要修正
                </button>
                <button
                  disabled={busyId === rec.id}
                  onClick={() => act(rec, "確認済")}
                  className="rounded-xl bg-success px-3 py-1.5 text-xs font-semibold text-success-foreground disabled:opacity-50"
                >
                  確認済
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
