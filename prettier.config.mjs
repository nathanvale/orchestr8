/**
 * Central Prettier configuration (2025 baseline)
 * Rationale:
 * - JS config allows comments + type hints.
 * - printWidth 80 aligns with project formatting guardrails (see formatting rules attachment).
 * - Consistent singleQuote + no semicolons for readability & diff minimization.
 * - import/package.json sorting handled by plugins.
 * - Markdown wrapped for better diffing in PR reviews.
 * - JSON kept wider (100) to avoid unnecessary wrapping of dependency objects.
 *
 * @type {import('prettier').Config}
 */
const config = {
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: false,
  singleQuote: true,
  quoteProps: 'consistent',
  jsxSingleQuote: false,
  trailingComma: 'all',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  proseWrap: 'always',
  htmlWhitespaceSensitivity: 'css',
  vueIndentScriptAndStyle: false,
  endOfLine: 'lf',
  embeddedLanguageFormatting: 'auto',
  singleAttributePerLine: false,
  experimentalTernaries: false,
  pluginSearchDirs: false, // Ensures only declared plugins are resolved
  plugins: [
    'prettier-plugin-organize-imports',
    'prettier-plugin-packagejson',
    // 'prettier-plugin-tailwindcss', // Enable when Tailwind usage confirmed
  ],
  overrides: [
    // Keep dependency blocks readable without excessive wrapping
    {
      files: ['*.json', '!package.json'],
      options: { printWidth: 100 },
    },
    // Maintain stable ordering + formatting for package.json (plugin handles sort)
    {
      files: 'package.json',
      options: { printWidth: 100 },
    },
    // Documentation prefers 80 cols for review legibility
    {
      files: ['*.md'],
      options: { proseWrap: 'always', printWidth: 80 },
    },
    // YAML: prefer double quotes to avoid escaping single quotes in prose
    {
      files: ['*.yml', '*.yaml'],
      options: { singleQuote: false },
    },
    // Ensure TypeScript parser explicitly applied (helps editor edge cases)
    {
      files: ['*.ts', '*.tsx'],
      options: { parser: 'typescript' },
    },
    // Ensure Prettier formats its own config correctly when imported elsewhere
    {
      files: ['prettier.config.*'],
      options: { printWidth: 80 },
    },
  ],
}

export default config
