module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "plugin:json/recommended",
    "plugin:i18n-keys/recommended",
  ],
  ignorePatterns: ["dist", ".eslintrc.cjs"],
  parser: "@typescript-eslint/parser",
  plugins: ["react-refresh", "json", "i18n-keys"],
  settings: {
    react: {
      version: "detect",
    },
  },
  rules: {
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
    "@typescript-eslint/no-explicit-any": "warn",
    "json/duplicate-key": ["error"],
    "i18n-keys/no-duplicate-keys": "error",
    "i18n-keys/ensure-i18n-initialized": "warn",
    "i18n-keys/no-raw-translation-keys": "error",
  },
};
