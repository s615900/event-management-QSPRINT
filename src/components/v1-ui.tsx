import Link from "next/link";

// 前台頁首（第一版的藍色頁首）。所有前台頁面共用，不使用漢堡選單；
// back=true 時左上角顯示「‹ 首頁」回到首頁選單。

export function V1Header({ title, subtitle, back = false }: { title: string; subtitle?: string; back?: boolean }) {
  return (
    <header className="relative bg-brand px-5 py-4 text-center text-white">
      {back && (
        <Link href="/" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-sm opacity-90 hover:bg-white/15 hover:opacity-100">
          ‹ 首頁
        </Link>
      )}
      <Link href="/" className="text-xs opacity-80 hover:opacity-100">Event Management</Link>
      <h1 className="mt-0.5 text-lg font-semibold">{title}</h1>
      {subtitle && <p className="mt-1 text-[13px] opacity-85">{subtitle}</p>}
    </header>
  );
}

export function V1Container({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-[480px] px-4 pb-10 pt-5">{children}</main>;
}
