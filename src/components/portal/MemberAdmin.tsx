import { useState } from "react";
import type { Member } from "@/lib/portal.functions";

export type MemberDraft = {
  id?: string;
  userId: string;
  name: string;
  role: "管理者" | "確認者" | "一般";
  canEdit: boolean;
  active: boolean;
  sortOrder: number;
  pin?: string;
};

type Props = {
  members: Member[];
  onSave: (draft: MemberDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const EMPTY: MemberDraft = {
  userId: "",
  name: "",
  role: "一般",
  canEdit: true,
  active: true,
  sortOrder: 100,
  pin: "",
};

export function MemberAdmin({ members, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState<MemberDraft>(EMPTY);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await onSave(draft);
      setDraft(EMPTY);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-base font-bold">
          {draft.id ? "メンバーを編集" : "メンバーを追加"}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          ユーザーIDとPINでログインします。PIN欄を空のまま保存すると既存PINを維持します。
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
              ユーザーID
            </span>
            <input
              value={draft.userId}
              onChange={(e) => setDraft({ ...draft, userId: e.target.value })}
              className="input-base"
              placeholder="user05"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">氏名</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="input-base"
              placeholder="山田 太郎"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
              PIN{draft.id ? "（変更する場合のみ）" : ""}
            </span>
            <input
              value={draft.pin ?? ""}
              onChange={(e) => setDraft({ ...draft, pin: e.target.value })}
              className="input-base"
              placeholder="1234"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">権限</span>
            <select
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value as MemberDraft["role"] })}
              className="input-base"
            >
              <option value="一般">一般</option>
              <option value="確認者">確認者</option>
              <option value="管理者">管理者</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">表示順</span>
            <input
              type="number"
              value={draft.sortOrder}
              onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })}
              className="input-base"
            />
          </label>
          <div className="flex items-end gap-4 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.canEdit}
                onChange={(e) => setDraft({ ...draft, canEdit: e.target.checked })}
              />
              日報の編集を許可
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
              />
              在籍中
            </label>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {draft.id && (
            <button
              onClick={() => setDraft(EMPTY)}
              className="rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-muted-foreground"
            >
              新規入力に戻す
            </button>
          )}
          <button
            disabled={busy || !draft.userId || !draft.name}
            onClick={submit}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
          >
            保存
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="p-3 font-semibold">ユーザーID</th>
              <th className="p-3 font-semibold">氏名</th>
              <th className="p-3 font-semibold">権限</th>
              <th className="p-3 font-semibold">編集</th>
              <th className="p-3 font-semibold">状態</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="p-3 font-mono text-[11px]">{m.userId}</td>
                <td className="p-3 font-semibold">{m.name}</td>
                <td className="p-3">{m.role}</td>
                <td className="p-3">{m.canEdit ? "可" : "閲覧のみ"}</td>
                <td className="p-3">{m.active ? "在籍" : "停止"}</td>
                <td className="p-3 text-right">
                  <button
                    onClick={() =>
                      setDraft({
                        id: m.id,
                        userId: m.userId,
                        name: m.name,
                        role: m.role,
                        canEdit: m.canEdit,
                        active: m.active,
                        sortOrder: m.sortOrder,
                        pin: "",
                      })
                    }
                    className="mr-2 rounded-lg border border-border px-2.5 py-1 font-semibold"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`${m.name} を削除しますか？日報も削除されます。`)) void onDelete(m.id);
                    }}
                    className="rounded-lg border border-destructive/40 px-2.5 py-1 font-semibold text-destructive"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
