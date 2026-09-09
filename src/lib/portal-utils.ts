import type { RecordRow } from "./portal.functions";

export const SLOTS = ["午前", "午後"] as const;
export type Slot = (typeof SLOTS)[number];
export const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

export const pad = (n: number) => String(n).padStart(2, "0");

export function dateStr(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function recordKey(memberId: string, date: string, slot: string) {
  return `${memberId}|${date}|${slot}`;
}

export function indexRecords(records: RecordRow[]) {
  const map = new Map<string, RecordRow>();
  for (const r of records) map.set(recordKey(r.memberId, r.date, r.slot), r);
  return map;
}

export type SlotState = "確認済" | "要修正" | "提出済" | "予定あり" | "未入力";

export function slotState(record?: RecordRow): SlotState {
  if (!record) return "未入力";
  const hasContent = record.workContent.trim().length > 0;
  if (hasContent) {
    if (record.reviewStatus === "確認済") return "確認済";
    if (record.reviewStatus === "要修正") return "要修正";
    return "提出済";
  }
  return record.visitedLocation.trim() ? "予定あり" : "未入力";
}

export const STATE_DOT: Record<SlotState, string> = {
  確認済: "bg-success",
  要修正: "bg-destructive",
  提出済: "bg-info",
  予定あり: "bg-warning",
  未入力: "bg-muted-foreground/30",
};

export const STATE_BADGE: Record<SlotState, string> = {
  確認済: "bg-success/12 text-success border-success/30",
  要修正: "bg-destructive/12 text-destructive border-destructive/30",
  提出済: "bg-info/12 text-info border-info/30",
  予定あり: "bg-warning/18 text-warning-foreground border-warning/40",
  未入力: "bg-muted text-muted-foreground border-border",
};

export const STATE_SURFACE: Record<SlotState, string> = {
  確認済: "border-success/40 bg-success/12 hover:border-success/60 hover:bg-success/18",
  要修正: "border-destructive/40 bg-destructive/12 hover:border-destructive/60 hover:bg-destructive/18",
  提出済: "border-info/40 bg-info/12 hover:border-info/60 hover:bg-info/18",
  予定あり: "border-warning/50 bg-warning/18 hover:border-warning/70 hover:bg-warning/25",
  未入力: "border-border bg-background hover:border-primary/50 hover:bg-accent/40",
};
