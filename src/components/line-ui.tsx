// 前台共用 UI（樣式對照原本 register/form/history 頁面的 CSS）

export const inputCls =
  "w-full appearance-none rounded-lg border border-[#ddd] bg-white px-3.5 py-[11px] text-[15px] text-[#333] focus:border-brand focus:shadow-[0_0_0_3px_rgba(79,168,222,0.15)] focus:outline-none disabled:bg-[#f5f5f5]";

export const btnPrimary =
  "mt-2 block w-full cursor-pointer rounded-[10px] border-none bg-brand p-3.5 text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#aaa]";

export const btnSoft =
  "mt-2.5 block w-full cursor-pointer rounded-[10px] border border-[#c5deff] bg-[#f0f7ff] p-3 text-[15px] font-medium text-[#1a73e8]";

export const btnGray =
  "mt-2.5 block w-full cursor-pointer rounded-[10px] border border-[#ddd] bg-white p-3 text-[15px] text-[#555]";

export function Container({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[480px] px-4 pb-10 pt-5">{children}</div>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mb-4 rounded-xl bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.08)] ${className}`}>{children}</div>;
}

export function Field({
  label,
  required,
  error,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  error?: string | false;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-4 last:mb-0 ${className}`}>
      <label className="mb-1.5 block text-sm font-medium text-[#333]">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {error && <div className="mt-1 text-[13px] text-danger">{error}</div>}
    </div>
  );
}

export function Spinner({ size = 32 }: { size?: number }) {
  return (
    <div
      className="mx-auto mb-2.5 animate-spin rounded-full border-[3px] border-[#ddd] border-t-brand"
      style={{ width: size, height: size }}
    />
  );
}

export function Loading({ text }: { text: string }) {
  return (
    <div className="p-10 text-center text-[#666]">
      <Spinner />
      <p>{text}</p>
    </div>
  );
}

export function AccountDisabled() {
  return (
    <div className="p-10 text-center text-[#666]">
      <p>⚠️ 帳號已停用</p>
      <a href="/register" className={`${btnPrimary} mt-4`}>
        重新登錄
      </a>
    </div>
  );
}
