export type SessionUser = {
  id: string;
  userId: string;
  name: string;
  role: "管理者" | "確認者" | "一般";
  canEdit: boolean;
};
