import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import replace from "@rollup/plugin-replace";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    replace({
      __DEV__: true,
      preventAssignment: true,
    }),
  ],
  resolve: {
    alias: [
      {
        find: "react",
        replacement: path.resolve(__dirname, "../packages/react"),
      },
      {
        find: "react-dom",
        replacement: path.resolve(__dirname, "../packages/react-dom"),
      },
      {
        find: "react-fiber-host-config",
        replacement: path.resolve(
          __dirname,
          "../packages/react-dom-bindings/src/client/react-dom-host-config.ts"
        ),
      },
    ],
  },
  optimizeDeps: {
    // exclude: ["react", "react-dom"],
  },
});
