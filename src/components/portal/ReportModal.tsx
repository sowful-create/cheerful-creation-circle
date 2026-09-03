import { useEffect, useState } from "react";
import type { Member, RecordRow } from "@/lib/portal.functions";
import type { SessionUser } from "@/components/portal/types";

export type ModalTarget = { member: Member; date: string; slot: "午前" | "午後" };

type Props = {
  target: ModalTarget;
  record?: RecordRow;
  user: SessionUser;
  onClose: () => void;
  onSave: (values: {
    visitedLocation: string;
    startTime: string;
    endTime: string;
    workContent: string;
  }) => Promise<void>;
  onReview?: (status: "確認済" | "要修正", comment: string) => Promise<void>;
};

export function ReportModal({ target, record, user, onClose, onSave, onReview }: Props) {
  const [visitedLocation, setVisited] = useState(record?.visitedLocation ?? "");
  const [startTime, setStart] = useState(record?.startTime ?? "");
  const [endTime, setEnd] = useState(record?.endTime ?? "");
  const [workContent, setContent] = useState(record?.workContent ?? "");
  const [comment, setComment] = useState(record?.reviewComment ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setVisited(record?.visitedLocation ?? "");
    setStart(record?.startTime ?? "");
    setEnd(record?.endTime ?? "");
    setContent(record?.workContent ?? "");
    setComment(record?.reviewComment ?? "");
  }, [record]);

  const isManager = user.role === "管理者" || user.role === "確認者";
  const canEdit = isManager || (target.member.id === user.id && user.canEdit);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold">{target.member.name} さんの日報</h3>
            <p className="text-xs text-muted-foreground">
              {target.date}（{target.slot}）
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
          >
            閉じる
          </button>
        </div>

        {record?.reviewStatus === "要修正" && record.reviewComment && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <strong>修正指示：</strong>
            {record.reviewComment}
          </div>
        )}

        <div className="space-y-3.5">
          <Field label="訪問先・勤務場所">
            <input
              value={visitedLocation}
              disabled={!canEdit}
              onChange={(e) => setVisited(e.target.value)}
              placeholder="例: A事業所"
              className="input-base"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="開始時刻">
              <input
                type="time"
                value={startTime}
                disabled={!canEdit}
                onChange={(e) => setStart(e.target.value)}
                className="input-base"
              />
            </Field>
            <Field label="終了時刻">
              <input
                type="time"
                value={endTime}
                disabled={!canEdit}
                onChange={(e) => setEnd(e.target.value)}
                className="input-base"
              />
            </Field>
          </div>
          <Field label="勤務内容">
            <textarea
              rows={5}
              value={workContent}
              disabled={!canEdit}
              onChange={(e) => setContent(e.target.value)}
              placeholder="実施した業務内容を記入してください"
              className="input-base resize-y"
            />
          </Field>

          {isManager && onReview && (
            <Field label="確認コメント（要修正の場合）">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="修正してほしい点"
                className="input-base"
              />
            </Field>
          )}
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {isManager && onReview && (
            <>
              <button
                disabled={busy}
                onClick={() => run(() => onReview("要修正", comment))}
                className="rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2 text-xs font-semibold text-destructive disabled:opacity-50"
              >
                要修正で差し戻す
              </button>
              <button
                disabled={busy}
                onClick={() => run(() => onReview("確認済", ""))}
                className="rounded-xl bg-success px-3.5 py-2 text-xs font-semibold text-success-foreground disabled:opacity-50"
              >
                確認済にする
              </button>
            </>
          )}
          {canEdit && (
            <button
              disabled={busy}
              onClick={() => run(() => onSave({ visitedLocation, startTime, endTime, workContent }))}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm disabled:opacity-50"
            >
              保存する
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
