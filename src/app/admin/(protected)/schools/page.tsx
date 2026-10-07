import { redirect } from "next/navigation";
import { getAdminSession } from "@/server/admin/session";
import SchoolsClient from "./SchoolsClient";

// 學校名單管理：管理員，或有「學校名單權限」的攝影師帳號
export default async function SchoolsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (session.role === "staff" && !session.schoolAccess) redirect("/admin");
  return <SchoolsClient />;
}
