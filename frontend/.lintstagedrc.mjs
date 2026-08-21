export default {
  "package.json": () => "npm run format",
  "frontend/**/*.{js,jsx,ts,tsx}": (filenames) => [
    `eslint --max-warnings=0 ${filenames.join(" ")}`,
    `prettier --write ${filenames.join(" ")}`,
  ],
  "frontend/src/i18n/locales/*.json": (filenames) => [
    "npm run validate-i18n",
    `eslint --max-warnings=0 ${filenames.join(" ")}`,
  ],
};
