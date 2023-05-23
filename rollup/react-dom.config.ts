import generatePackageJson from "rollup-plugin-generate-package-json";
import alias from "@rollup/plugin-alias";

import {
  getBaseRollupPlugins,
  getPackageJSON,
  resolvePackagePath,
} from "./utils";

const { name, module, peerDependencies } = getPackageJSON("react-dom");
const packagePath = resolvePackagePath(name);
const packageDistPath = resolvePackagePath(name, true);

export default [
  {
    input: `${packagePath}/index.ts`,
    output: [
      {
        file: `${packageDistPath}/index.js`,
        name: "index.js",
        format: "umd",
      },
      {
        file: `${packageDistPath}/client.js`,
        name: "client.js",
        format: "umd",
      },
    ],
    external: [...Object.keys(peerDependencies)],
    plugins: [
      getBaseRollupPlugins({ typescript: {} }),
      alias({
        entries: {
          "./react-fiber-host-config": `${packagePath}/src/react-dom-host-config.ts`,
        },
      }),
      generatePackageJson({
        inputFolder: packagePath,
        outputFolder: packageDistPath,
        baseContents: ({ name, description, version }) => ({
          name,
          version,
          description,
          peerDependencies: {
            react: version,
          },
          main: "index.js",
        }),
      }),
    ],
  },
];
