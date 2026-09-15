import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 데스크톱 셸/빌드 스크립트 — CommonJS 노드/일렉트론 인프라(앱 lint 범위 밖).
    "electron/**",
    "scripts/**",
    ".sna/**",
    "dist_electron/**",
  ]),
]);

export default eslintConfig;
