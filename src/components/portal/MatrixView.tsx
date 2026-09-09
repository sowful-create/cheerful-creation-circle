import { useEffect, useRef } from "react";
import type { Member, RecordRow } from "@/lib/portal.functions";
import type { SessionUser } from "@/components/portal/types";
import {
  DAY_NAMES,
  SLOTS,
  STATE_CELL,
  STATE_SWATCH,
  type SlotState,
  dateStr,
  daysInMonth,
  recordKey,
  slotState,
} from "@/lib/portal-utils";

type Props = {
  user: SessionUser;
  members: Member[];
  year: number;
  month: number;
  records: Map<string, RecordRow>;
  onOpen: (member: Member, date: string, slot: "午前" | "午後") => void;
};

export function MatrixView({ user, members, year, month, records, onOpen }: Props) {
  const total = daysInMonth(year, month);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const containerRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    const c = containerRef.current;
    const t = todayRef.current;
    if (c && t) c.scrollLeft = Math.max(0, t.offsetLeft - c.clientWidth / 2);
  }, [year, month, members.length]);

  const isManager = user.role === "管理者" || user.role === "確認者";
  const legend: Array<{ state: SlotState; label: string }> = [
    { state: "要修正", label: "要修正" },
    { state: "提出済", label: "提出済" },
    { state: "確認済", label: "確認済" },
    { state: "休み", label: "休み" },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
        <span>自分の行をクリックすると日報入力画面が開きます</span>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1" aria-label="状態の色分け">
            {legend.map(({ state, label }) => (
              <span key={state} className="inline-flex items-center gap-1 whitespace-nowrap">
                <span className={`h-2.5 w-2.5 rounded-sm border ${STATE_SWATCH[state]}`} aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
          <span className="whitespace-nowrap">横スクロール可能（本日が中央に表示されます）</span>
        </div>
      </div>
      <div ref={containerRef} className="table-scroll">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="sticky-head-1 bg-muted text-muted-foreground">
              <th
                rowSpan={2}
                className="sticky-corner min-w-[140px] border-r border-border bg-muted p-3 text-center align-middle font-semibold text-foreground"
              >
                メンバー氏名
              </th>
              {Array.from({ length: total }, (_, i) => i + 1).map((day) => {
                const dow = new Date(year, month - 1, day).getDay();
                const isToday = isCurrentMonth && day === today.getDate();
                return (
                  <th
                    key={day}
                    ref={isToday ? todayRef : undefined}
                    colSpan={2}
                    className={`min-w-[150px] border-r border-border p-2 text-center font-semibold ${
                      isToday
                        ? "bg-primary/15 text-primary"
                        : dow === 0
                          ? "bg-destructive/10 text-destructive"
                          : dow === 6
                            ? "bg-info/10 text-info"
                            : "bg-muted"
                    }`}
                  >
                    {day}日（{DAY_NAMES[dow]}）
                  </th>
                );
              })}
            </tr>
            <tr className="sticky-head-2 bg-secondary text-[11px] text-muted-foreground">
              {Array.from({ length: total }, (_, i) => i + 1).flatMap((day) =>
                SLOTS.map((slot) => (
                  <th
                    key={`${day}-${slot}`}
                    className="w-[75px] border-r border-border bg-secondary p-1 text-center font-medium"
                  >
                    {slot}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const isSelf = member.id === user.id;
              const clickable = isSelf || isManager;
              return (
                <tr key={member.id} className="border-b border-border hover:bg-accent/30">
                  <td
                    className={`sticky-col border-r border-border p-3 font-semibold ${
                      isSelf ? "bg-secondary text-primary" : "bg-card"
                    }`}
                  >
                    {member.name}
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                      {member.role !== "一般" ? member.role : ""}
                    </span>
                  </td>
                  {Array.from({ length: total }, (_, i) => i + 1).flatMap((day) => {
                    const date = dateStr(year, month, day);
                    return SLOTS.map((slot) => {
                      const rec = records.get(recordKey(member.id, date, slot));
                      const state = slotState(rec);
                      return (
                        <td
                          key={`${day}-${slot}`}
                          onClick={() => clickable && onOpen(member, date, slot)}
                          className={`border-r border-border p-1.5 align-top ${STATE_CELL[state]} ${
                            clickable ? "cursor-pointer hover:brightness-95" : ""
                          }`}
                        >
                          <span className="block truncate text-[10px] text-foreground/80">
                            {rec?.visitedLocation || "-"}
                          </span>
                        </td>
                      );
                    });
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
