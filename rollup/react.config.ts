import generatePackageJson from "rollup-plugin-generate-package-json";

import {
  getBaseRollupPlugins,
  getPackageJSON,
  resolvePackagePath,
} from "./utils";

const { name, module } = getPackageJSON("react");
const packagePath = resolvePackagePath(name);
const packageDistPath = resolvePackagePath(name, true);

export default [
  {
    input: `${packagePath}/${module}`,
    output: {
      file: `${packageDistPath}/index.js`,
      name: "react",
      format: "umd",
    },
    plugins: [
      getBaseRollupPlugins({ typescript: {} }),
      generatePackageJson({
        inputFolder: packagePath,
        outputFolder: packageDistPath,
        baseContents: ({ name, description, version }) => ({
          name,
          version,
          description,
          main: "index.js",
        }),
      }),
    ],
  },
  {
    input: `${packagePath}/src/jsx.ts`,
    output: [
      {
        file: `${packageDistPath}/jsx-runtime.js`,
        name: "jsx-runtime.js",
        format: "umd",
      },
      {
        file: `${packageDistPath}/jsx-dev-runtime.js`,
        name: "jsx-dev-runtime.js",
        format: "umd",
      },
    ],
    plugins: getBaseRollupPlugins({ typescript: {} }),
  },
];
