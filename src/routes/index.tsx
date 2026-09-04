import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteMember,
  getMonthData,
  getSessionUser,
  loginUser,
  logoutUser,
  saveMember,
  saveReport,
  saveShiftPlans,
  setReviewStatus,
  type Member,
  type RecordRow,
} from "@/lib/portal.functions";
import { indexRecords, recordKey } from "@/lib/portal-utils";
import { ToastProvider, useToast } from "@/components/portal/Toast";
import { ReportModal, type ModalTarget } from "@/components/portal/ReportModal";
import { PersonalView } from "@/components/portal/PersonalView";
import { MatrixView } from "@/components/portal/MatrixView";
import { ShiftAdminView } from "@/components/portal/ShiftAdminView";
import { ReviewView } from "@/components/portal/ReviewView";
import { MemberAdmin, type MemberDraft } from "@/components/portal/MemberAdmin";
import type { SessionUser } from "@/components/portal/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "日報・シフト管理ポータル" },
      {
        name: "description",
        content:
          "訪問先シフトと日々の日報をひとつにまとめる業務ポータル。提出状況の可視化、確認・差し戻し、Excel一括更新に対応します。",
      },
      { property: "og:title", content: "日報・シフト管理ポータル" },
      {
        property: "og:description",
        content: "シフト計画と日報提出・確認をまとめて管理できる業務ポータル。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ToastProvider>
      <PortalPage />
    </ToastProvider>
  ),
});

type TabKey = "personal" | "matrix" | "shift" | "review" | "members";

function PortalPage() {
  const notify = useToast();
  const now = new Date();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [members, setMembers] = useState<Member[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [tab, setTab] = useState<TabKey>("personal");
  const [target, setTarget] = useState<ModalTarget | null>(null);
  const [loading, setLoading] = useState(false);

  const recordMap = useMemo(() => indexRecords(records), [records]);
  const isManager = user?.role === "管理者" || user?.role === "確認者";
  const isAdmin = user?.role === "管理者";

  const reload = useCallback(
    async (y: number, m: number) => {
      setLoading(true);
      try {
        const data = await getMonthData({ data: { year: y, month: m } });
        setMembers(data.members);
        setRecords(data.records);
      } catch (err) {
        notify(err instanceof Error ? err.message : "データの取得に失敗しました", "error");
      } finally {
        setLoading(false);
      }
    },
    [notify],
  );

  useEffect(() => {
    void (async () => {
      try {
        const res = await getSessionUser();
        if (res.user) setUser(res.user as SessionUser);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (user) void reload(year, month);
  }, [user, year, month, reload]);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const me = useMemo(() => members.find((m) => m.id === user?.id), [members, user]);

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        読み込み中...
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={setUser} />;

  const tabs: { key: TabKey; label: string; show: boolean }[] = [
    { key: "personal", label: "マイ日報", show: true },
    { key: "matrix", label: "全体マトリクス", show: true },
    { key: "shift", label: "シフト事前編集", show: !!isAdmin },
    { key: "review", label: "日報確認・編集", show: !!isManager },
    { key: "members", label: "メンバー管理", show: !!isAdmin },
  ];

  const openModal = (member: Member, date: string, slot: "午前" | "午後") =>
    setTarget({ member, date, slot });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-sm font-bold tracking-tight">日報・シフト管理ポータル</h1>
            <p className="text-[11px] text-muted-foreground">
              {user.name} さん（{user.role}） / ID: {user.userId}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-border bg-background p-1">
              <button onClick={() => shiftMonth(-1)} className="rounded-lg px-2.5 py-1 text-xs hover:bg-muted">
                ← 前月
              </button>
              <span className="px-2 text-xs font-bold">
                {year}年{month}月
              </span>
              <button onClick={() => shiftMonth(1)} className="rounded-lg px-2.5 py-1 text-xs hover:bg-muted">
                翌月 →
              </button>
            </div>
            <button
              onClick={() => {
                const d = new Date();
                setYear(d.getFullYear());
                setMonth(d.getMonth() + 1);
              }}
              className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold"
            >
              今月
            </button>
            <button
              onClick={async () => {
                await logoutUser();
                setUser(null);
              }}
              className="rounded-xl bg-foreground px-3 py-1.5 text-xs font-semibold text-background"
            >
              ログアウト
            </button>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-4 pb-2">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`whitespace-nowrap rounded-t-xl px-3.5 py-2 text-xs font-semibold transition ${
                  tab === t.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {t.label}
              </button>
            ))}
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-5">
        {loading && <p className="mb-3 text-xs text-muted-foreground">読み込み中...</p>}

        {tab === "personal" &&
          (me ? (
            <PersonalView
              user={user}
              member={me}
              year={year}
              month={month}
              records={recordMap}
              onOpen={openModal}
            />
          ) : (
            <p className="text-sm text-muted-foreground">メンバー情報が見つかりません。</p>
          ))}

        {tab === "matrix" && (
          <MatrixView
            user={user}
            members={members}
            year={year}
            month={month}
            records={recordMap}
            onOpen={openModal}
          />
        )}

        {tab === "shift" && isAdmin && (
          <ShiftAdminView
            members={members}
            year={year}
            month={month}
            records={recordMap}
            notify={notify}
            onSave={async (entries) => {
              try {
                const res = await saveShiftPlans({ data: { entries } });
                notify(`${res.updated} 件のシフトを更新しました`);
                await reload(year, month);
              } catch (err) {
                notify(err instanceof Error ? err.message : "保存に失敗しました", "error");
              }
            }}
          />
        )}

        {tab === "review" && isManager && (
          <ReviewView
            members={members}
            records={records}
            onReview={async (rec, status, comment) => {
              try {
                await setReviewStatus({
                  data: {
                    memberId: rec.memberId,
                    date: rec.date,
                    slot: rec.slot,
                    status,
                    comment,
                  },
                });
                notify(`「${status}」に更新しました`);
                await reload(year, month);
              } catch (err) {
                notify(err instanceof Error ? err.message : "更新に失敗しました", "error");
              }
            }}
          />
        )}

        {tab === "members" && isAdmin && (
          <MemberAdmin
            members={members}
            onSave={async (draft: MemberDraft) => {
              try {
                await saveMember({
                  data: {
                    ...(draft.id ? { id: draft.id } : {}),
                    userId: draft.userId,
                    name: draft.name,
                    role: draft.role,
                    canEdit: draft.canEdit,
                    active: draft.active,
                    sortOrder: draft.sortOrder,
                    ...(draft.pin ? { pin: draft.pin } : {}),
                  },
                });
                notify("メンバー情報を保存しました");
                await reload(year, month);
              } catch (err) {
                notify(err instanceof Error ? err.message : "保存に失敗しました", "error");
              }
            }}
            onDelete={async (id) => {
              try {
                await deleteMember({ data: { id } });
                notify("メンバーを削除しました");
                await reload(year, month);
              } catch (err) {
                notify(err instanceof Error ? err.message : "削除に失敗しました", "error");
              }
            }}
          />
        )}
      </main>

      {target && (
        <ReportModal
          target={target}
          user={user}
          {...(() => {
            const rec = recordMap.get(recordKey(target.member.id, target.date, target.slot));
            return rec ? { record: rec } : {};
          })()}
          onClose={() => setTarget(null)}
          onSave={async (values) => {
            try {
              await saveReport({
                data: {
                  memberId: target.member.id,
                  date: target.date,
                  slot: target.slot,
                  ...values,
                },
              });
              notify("日報を保存しました");
              setTarget(null);
              await reload(year, month);
            } catch (err) {
              notify(err instanceof Error ? err.message : "保存に失敗しました", "error");
            }
          }}
          {...(isManager
            ? {
                onReview: async (status: "確認済" | "要修正", comment: string) => {
                  try {
                    await setReviewStatus({
                      data: {
                        memberId: target.member.id,
                        date: target.date,
                        slot: target.slot,
                        status,
                        comment,
                      },
                    });
                    notify(`「${status}」に更新しました`);
                    setTarget(null);
                    await reload(year, month);
                  } catch (err) {
                    notify(err instanceof Error ? err.message : "更新に失敗しました", "error");
                  }
                },
              }
            : {})}
        />
      )}
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const notify = useToast();
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await loginUser({ data: { userId, pin } });
      if (!res.success) {
        notify(res.message, "error");
        return;
      }
      onLogin(res.user as SessionUser);
    } catch (err) {
      notify(err instanceof Error ? err.message : "ログインに失敗しました", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-muted to-background px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        <h1 className="text-lg font-bold tracking-tight">日報・シフト管理ポータル</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          ユーザーIDとPINでログインしてください。
        </p>

        <div className="mt-5 space-y-3.5">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
              ユーザーID
            </span>
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              autoComplete="username"
              placeholder="user01"
              className="input-base"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">PIN</span>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoComplete="current-password"
              placeholder="••••"
              className="input-base"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={busy || !userId || !pin}
          className="mt-5 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          ログイン
        </button>

        <div className="mt-4 rounded-xl bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">サンプルアカウント（PIN: 1234）</p>
          <p>admin（管理者） / checker01（確認者） / user01〜user04（一般）</p>
        </div>
      </form>
    </div>
  );
}
