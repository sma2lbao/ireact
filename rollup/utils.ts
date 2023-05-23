import ts from "rollup-plugin-typescript2";
import cjs from "@rollup/plugin-commonjs";
import replace from "@rollup/plugin-replace";
import path from "path";
import fs from "fs";

const packagesPath = path.resolve(__dirname, "../packages");
const distPath = path.resolve(__dirname, "../dist/node_modules");

export function resolvePackagePath(packageName: string, isDist?: boolean) {
  if (isDist) {
    return `${distPath}/${packageName}`;
  }
  return `${packagesPath}/${packageName}`;
}

export function getPackageJSON(packageName: string) {
  const path = `${resolvePackagePath(packageName)}/package.json`;
  const text = fs.readFileSync(path, { encoding: "utf-8" });
  try {
    return JSON.parse(text);
  } catch (error) {
    return {};
  }
}

export function getBaseRollupPlugins({
  alias = {
    __DEV__: true,
    preventAssignment: true,
  },
  typescript = {},
}) {
  return [replace(alias), cjs(), ts(typescript)];
}
