#!/usr/bin/env node

// A script that launches vscode with our extension installed and
// executes ./mocha-driver

import * as path from "path";

import { downloadAndUnzipVSCode, runTests } from "@vscode/test-electron";

async function main() {
  try {
    // When testing the packaged-and-then-unzipped extension, we'll be handed the path to it.

    const EXTENSION_PATH = process.env["EXTENSION_PATH"];

    if (!EXTENSION_PATH) {
      throw new Error("EXTENSION_PATH environment variable is not set.");
    }

    const extensionPath = path.resolve(EXTENSION_PATH);

    const extensionTestsPath = path.resolve(__dirname, "./mocha-driver");

    const fixturesDir = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "src",
      "test",
      "fixtures",
    );
    // Download VS Code, unzip it and run the integration test

    const vscodeExecutablePath = await downloadAndUnzipVSCode("1.113.0");

    await runTests({
      vscodeExecutablePath,
      extensionDevelopmentPath: extensionPath,
      extensionTestsPath,
      launchArgs: [fixturesDir, "--disable-extensions"],
    });

    const inCI = !!process.env.CI;
    // For reasons unknown, the test runner sometimes fails to free some
    // resource after testing is done when running locally.
    // Note that at this point, the test has completed successfully.
    if (!inCI) {
      setTimeout(function () {
        // eslint-disable-next-line no-console
        console.log(
          `[tests completed successfully, but some resource leak is preventing the test runner from exiting, so manually exiting]`,
        );
        process.exit(0);
      }, 1_000).unref();
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  }
}

main();
