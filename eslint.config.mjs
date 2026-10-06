import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 前台每次換頁都要整頁重新載入，讓 LIFF 重新初始化（沿用原 HTML 版行為）；
      // 後台登出、401 轉登入頁也需要整頁跳轉
      "@next/next/no-location-assign-relative-destination": "off",
    },
  },
  {
    // 後台頁面從原 admin-web 原樣移植，保留「effect 內呼叫 load()」的資料載入寫法
    files: ["src/app/admin/(protected)/**/*.tsx"],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
