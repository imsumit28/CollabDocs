module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    // Use a lint-only tsconfig that also includes the test files (the build
    // tsconfig excludes __tests__ so they aren't compiled into dist).
    project: "./tsconfig.eslint.json",
    tsconfigRootDir: __dirname,
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  rules: {
    // `any` is pragmatic around socket.io / swagger typings — surface it as a
    // warning rather than failing the build.
    "@typescript-eslint/no-explicit-any": "warn",
    // Allow intentionally-unused args/vars when prefixed with _ (e.g. Express
    // error-handler signatures that must keep all four parameters).
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
  },
  ignorePatterns: ["dist/", "node_modules/"],
};
