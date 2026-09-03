CREATE TABLE public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL DEFAULT '一般',
  pin_hash text NOT NULL,
  can_edit boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.app_users TO service_role;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.shift_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  slot text NOT NULL,
  visited_location text NOT NULL DEFAULT '',
  start_time text NOT NULL DEFAULT '',
  end_time text NOT NULL DEFAULT '',
  work_content text NOT NULL DEFAULT '',
  review_status text NOT NULL DEFAULT '未確認',
  review_comment text NOT NULL DEFAULT '',
  reviewed_by text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, work_date, slot)
);

GRANT ALL ON public.shift_records TO service_role;
ALTER TABLE public.shift_records ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_users (user_id, name, role, pin_hash, can_edit, sort_order) VALUES
  ('admin',     '管理 太郎', '管理者', encode(sha256('1234'::bytea), 'hex'), true, 1),
  ('checker01', '確認 花子', '確認者', encode(sha256('1234'::bytea), 'hex'), true, 2),
  ('user01',    '佐藤 一郎', '一般',   encode(sha256('1234'::bytea), 'hex'), true, 10),
  ('user02',    '鈴木 二郎', '一般',   encode(sha256('1234'::bytea), 'hex'), true, 11),
  ('user03',    '高橋 三子', '一般',   encode(sha256('1234'::bytea), 'hex'), true, 12),
  ('user04',    '田中 四葉', '一般',   encode(sha256('1234'::bytea), 'hex'), false, 13);

INSERT INTO public.shift_records (member_id, work_date, slot, visited_location, start_time, end_time, work_content, review_status, review_comment)
SELECT u.id,
       date_trunc('month', now())::date + (d - 1),
       s.slot,
       CASE ((d + CASE WHEN s.slot = '午前' THEN 0 ELSE 1 END) % 4)
         WHEN 0 THEN 'A事業所'
         WHEN 1 THEN 'B工場'
         WHEN 2 THEN '本社オフィス'
         ELSE 'C倉庫'
       END,
       CASE WHEN s.slot = '午前' THEN '09:00' ELSE '13:00' END,
       CASE WHEN s.slot = '午前' THEN '12:00' ELSE '18:00' END,
       CASE WHEN d % 3 = 0 THEN '' ELSE '定期点検と報告書作成を実施しました。' END,
       CASE WHEN d % 5 = 0 THEN '確認済' WHEN d % 7 = 0 THEN '要修正' ELSE '未確認' END,
       CASE WHEN d % 7 = 0 THEN '勤務時間の記載を修正してください。' ELSE '' END
FROM public.app_users u
CROSS JOIN generate_series(1, 10) AS d
CROSS JOIN (VALUES ('午前'), ('午後')) AS s(slot)
WHERE u.user_id IN ('user01', 'user02', 'user03');