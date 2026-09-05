import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import type { Member, RecordRow } from "@/lib/portal.functions";
import { DAY_NAMES, SLOTS, dateStr, daysInMonth, recordKey } from "@/lib/portal-utils";

type Entry = { memberId: string; date: string; slot: "午前" | "午後"; visitedLocation: string };

type Props = {
  members: Member[];
  year: number;
  month: number;
  records: Map<string, RecordRow>;
  onSave: (entries: Entry[]) => Promise<void>;
  notify: (msg: string, kind?: "success" | "error" | "info") => void;
};

export function ShiftAdminView({ members, year, month, records, onSave, notify }: Props) {
  const total = daysInMonth(year, month);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const days = useMemo(() => Array.from({ length: total }, (_, i) => i + 1), [total]);
  const dirtyCount = Object.keys(draft).length;

  const valueOf = (memberId: string, date: string, slot: "午前" | "午後") => {
    const key = recordKey(memberId, date, slot);
    return draft[key] ?? records.get(key)?.visitedLocation ?? "";
  };

  const setValue = (memberId: string, date: string, slot: "午前" | "午後", value: string) => {
    const key = recordKey(memberId, date, slot);
    const original = records.get(key)?.visitedLocation ?? "";
    setDraft((prev) => {
      const next = { ...prev };
      if (value === original) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const commit = async (entries: Entry[]) => {
    if (entries.length === 0) {
      notify("変更がありません", "info");
      return;
    }
    setBusy(true);
    try {
      await onSave(entries);
      setDraft({});
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = () =>
    commit(
      Object.entries(draft).map(([key, visitedLocation]) => {
        const parts = key.split("|");
        return {
          memberId: parts[0] ?? "",
          date: parts[1] ?? "",
          slot: (parts[2] ?? "午前") as "午前" | "午後",
          visitedLocation,
        };
      }),
    );

  const exportExcel = () => {
    const rows: Record<string, string>[] = [];
    for (const m of members) {
      for (const day of days) {
        const date = dateStr(year, month, day);
        for (const slot of SLOTS) {
          const rec = records.get(recordKey(m.id, date, slot));
          rows.push({
            ユーザーID: m.userId,
            氏名: m.name,
            日付: date,
            曜日: DAY_NAMES[new Date(year, month - 1, day).getDay()] ?? "",
            時間帯: slot,
            訪問先: rec?.visitedLocation ?? "",
            勤務内容: rec?.workContent ?? "",
            確認状況: rec?.reviewStatus ?? "未確認",
          });
        }
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${year}-${month}`);
    XLSX.writeFile(wb, `シフト_${year}年${month}月.xlsx`);
    notify("Excelを書き出しました");
  };

  const importExcel = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0] ?? "";
      const sheet = sheetName ? wb.Sheets[sheetName] : undefined;
      if (!sheet) throw new Error("シートが見つかりません");
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const byUserId = new Map(members.map((m) => [m.userId, m]));
      const entries: Entry[] = [];

      for (const r of rows) {
        const userId = String(r["ユーザーID"] ?? "").trim();
        const member = byUserId.get(userId);
        const rawDate = r["日付"];
        const slot = String(r["時間帯"] ?? "").trim();
        const location = String(r["訪問先"] ?? "").trim();
        if (!member || !slot || (slot !== "午前" && slot !== "午後")) continue;

        let date = "";
        if (rawDate instanceof Date) {
          date = `${rawDate.getFullYear()}-${String(rawDate.getMonth() + 1).padStart(2, "0")}-${String(rawDate.getDate()).padStart(2, "0")}`;
        } else {
          date = String(rawDate).trim().slice(0, 10);
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

        const current = records.get(recordKey(member.id, date, slot))?.visitedLocation ?? "";
        if (current === location) continue;
        entries.push({ memberId: member.id, date, slot, visitedLocation: location });
      }
      await commit(entries);
      notify(`${entries.length} 件を取り込みました`);
    } catch (err) {
      notify(err instanceof Error ? err.message : "インポートに失敗しました", "error");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
        <div>
          <h2 className="text-base font-bold">シフト事前編集・一括管理</h2>
          <p className="text-xs text-muted-foreground">
            訪問先を直接入力するか、Excelで一括更新できます。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportExcel}
            className="rounded-xl border border-success/40 bg-card px-3 py-1.5 text-xs font-semibold text-success"
          >
            当月状況エクスポート
          </button>
          <label className="cursor-pointer rounded-xl bg-success px-3 py-1.5 text-xs font-semibold text-success-foreground">
            Excelインポート
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importExcel(f);
              }}
            />
          </label>
          <button
            disabled={busy || dirtyCount === 0}
            onClick={saveDraft}
            className="rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
          >
            変更を保存{dirtyCount > 0 ? `（${dirtyCount}）` : ""}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="table-scroll">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="sticky-head-1 bg-muted">
                <th className="sticky-corner min-w-[140px] border-r border-border bg-muted p-3 text-center font-semibold">
                  メンバー氏名
                </th>
                {days.map((day) => (
                  <th
                    key={day}
                    colSpan={2}
                    className="min-w-[180px] border-r border-border p-2 text-center font-semibold"
                  >
                    {day}日（{DAY_NAMES[new Date(year, month - 1, day).getDay()]}）
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-border">
                  <td className="sticky-col border-r border-border bg-card p-3 font-semibold">
                    {m.name}
                  </td>
                  {days.flatMap((day) => {
                    const date = dateStr(year, month, day);
                    return SLOTS.map((slot) => (
                      <td key={`${day}-${slot}`} className="border-r border-border p-1">
                        <input
                          value={valueOf(m.id, date, slot)}
                          onChange={(e) => setValue(m.id, date, slot, e.target.value)}
                          placeholder={slot}
                          className="w-[86px] rounded-md border border-border bg-background px-1.5 py-1 text-[11px] outline-none focus:border-primary"
                        />
                      </td>
                    ));
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
