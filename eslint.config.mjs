import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 禁止显式 any 类型
      // 注意：隐式 any 由 TypeScript 编译器在 prebuild 阶段检查
      "@typescript-eslint/no-explicit-any": "error",
      // 未使用的变量警告（允许下划线前缀）
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "schemaspy/**",
    "types/**",
    "scripts/**",
  ]),
]);

export default eslintConfig;
