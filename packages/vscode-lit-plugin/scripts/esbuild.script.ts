import * as esbuild from "esbuild";

async function build() {
  await esbuild.build({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    outfile: "built/bundle.js",
    platform: "node",
    // minify: false,
    // sourcemap: "inline",
    minify: true,
    sourcemap: false,
    target: "es2024",
    format: "cjs",
    color: true,
    external: ["vscode", "typescript"],
    mainFields: ["module", "main"],
  });

  await esbuild.build({
    entryPoints: ["../ts-lit-plugin/lib/index.js"],
    bundle: true,
    outfile: "built/node_modules/ts-lit-plugin/lib/index.js",
    platform: "node",
    external: ["typescript"],
    // minify: false,
    // sourcemap: false,
    minify: true,
    sourcemap: false,
    target: "es2024",
    format: "cjs",
    color: true,
    mainFields: ["module", "main"],
  });
}

build();
