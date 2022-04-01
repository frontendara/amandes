module.exports = {
  root: true,
  env: {
    browser: true,
  },
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  rules: {
    // TODO: gradually enable these rules
    "@typescript-eslint/no-explicit-any": "off",
    "no-redeclare": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/ban-types": "off",
    "@typescript-eslint/no-empty-function": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "prefer-rest-params": "off",
    "prefer-spread": "off",
    "no-undef": "off",
    "@typescript-eslint/no-this-alias": "off",
    "no-constant-condition": "off",
    "no-var": "off",
    "no-prototype-builtins": "off",
    "no-dupe-else-if": "off",
  },
};
