import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  // Keep the starter on the flat config export that actually runs under the pinned ESLint/Next toolchain.
  ...nextCoreWebVitals,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "drizzle/**"]),
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // این پروژه یک داشبورد کلاینت‌محور است که داده‌ها را در effect بار می‌گیرد و
      // برای شمارش معکوس آزمون به ساعت واقعی نیاز دارد؛ این دو قاعده‌ی کامپایلر
      // React در این الگوها بازده مثبتی ندارند.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
    },
  },
]);
