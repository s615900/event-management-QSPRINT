import { redirect } from "next/navigation";
import { getAdminSession } from "@/server/admin/session";

// 管理員專用頁面：攝影師帳號只能看儀表板和自己的拍攝行程，進到這裡一律導回儀表板
export default async function AdminOnlyLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (session.role === "staff") redirect("/admin");
  return children;
}
