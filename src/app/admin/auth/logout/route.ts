import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE } from "@/server/admin/session";

async function logout() {
  const store = await cookies();
  store.delete({ name: ADMIN_SESSION_COOKIE, path: "/admin" });
  redirect("/admin/login");
}

export const GET = logout;
export const POST = logout;
