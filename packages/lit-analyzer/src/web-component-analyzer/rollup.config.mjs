import resolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import ts from "@rollup/plugin-typescript";
import copy from "rollup-plugin-copy";
import pkg from "./package.json" with { type: "json" };

const watch = { include: "src/**" };
const external = ["typescript", "fast-glob", "path", "fs", "yargs"];
const replaceVersionConfig = {
  VERSION: pkg.version,
  delimiters: ["<@", "@>"],
  preventAssignment: true
};

export default [
  // Standard module config
  {
    input: {
      api: "src/api.ts",
      cli: "src/cli.ts",
      bin: "src/bin.ts",
      "is-assignable-to-type": "src/is-assignable-to-type.ts",
      "simple-type": "src/simple-type.ts"
    },
    output: [
      {
        dir: "lib/esm",
        format: "esm",
        chunkFileNames: "chunk-[name]-[hash].js"
      }
    ],
    plugins: [
      replace(replaceVersionConfig),
      ts({
        module: "esnext",
        moduleResolution: "bundler",
        outDir: "./lib/esm"
      }),
      resolve(),
      copy({
        targets: [
          { src: "package-esm.json", dest: "lib/esm", rename: "package.json" }
        ]
      })
    ],
    external,
    watch
  },
  // CommonJS config
  {
    input: {
      api: "src/api.ts",
      cli: "src/cli.ts",
      bin: "src/bin.ts",
      "is-assignable-to-type": "src/is-assignable-to-type.ts",
      "simple-type": "src/simple-type.ts"
    },
    output: [
      {
        dir: "lib/cjs",
        format: "cjs",
        chunkFileNames: "chunk-[name]-[hash].js"
      }
    ],
    plugins: [
      replace(replaceVersionConfig),
      ts({
        outDir: "./lib/cjs"
      }),
      resolve()
    ],
    external,
    watch
  }
];
