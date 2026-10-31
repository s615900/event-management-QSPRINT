import { redirect } from "next/navigation";
import { getAdminSession } from "@/server/admin/session";
import SponsorsClient from "./SponsorsClient";

// 贊助清單：只有管理員看得到
export default async function SponsorsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (session.role === "staff") redirect("/admin");
  return <SponsorsClient />;
}
