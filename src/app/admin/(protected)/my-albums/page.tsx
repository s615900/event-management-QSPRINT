import { redirect } from "next/navigation";
import { getAdminSession } from "@/server/admin/session";
import { AlbumManager } from "../_lib/AlbumManager";

// 攝影師帳號的「我的相簿」：需要相簿權限；管理員請用「相簿管理」
export default async function MyAlbumsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (session.role === "admin") redirect("/admin/albums");
  if (!session.albumAccess) redirect("/admin");
  return <AlbumManager mine />;
}
