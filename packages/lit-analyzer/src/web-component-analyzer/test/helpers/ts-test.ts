import test, { ImplementationFn } from "ava";
import { dirname } from "path";
import * as ts from "typescript";

type TestFunction = (
  title: string,
  implementation: ImplementationFn<unknown[]>
) => void;

function getTsModuleWithKind() {
  return require("typescript") as typeof ts;
}

export function getCurrentTsModule() {
  return getTsModuleWithKind();
}

export function getCurrentTsModuleDirectory() {
  return dirname(require.resolve("typescript"));
}

function setupTest(
  testFunction: TestFunction,
  title: string,
  cb: ImplementationFn<unknown[]>
) {
  // Generate title based on the ts module
  const version = getTsModuleWithKind().versionMajorMinor;
  const titleWithModule = `[ts${version}] ${title}`;

  // Setup up the ava test
  testFunction(
    titleWithModule,
    (...args: Parameters<ImplementationFn<unknown[]>>) => {
      // @ts-expect-error - idk maybe fix later
      const res = cb(...args);

      return res;
    }
  );
}

/**
 * Sets up an ava test that runs multiple times with different ts modules
 * @param testFunction
 * @param title
 * @param cb
 */
function setupTests(
  testFunction: (
    title: string,
    implementation: ImplementationFn<unknown[]>
  ) => void,
  title: string,
  cb: ImplementationFn<unknown[]>
) {
  setupTest(testFunction, title, cb);
}

/**
 * Wraps an ava test and runs it multiple times with different ts modules
 * @param testFunction
 */
export function wrapAvaTest(testFunction: TestFunction): TestFunction {
  return (title, implementation) => {
    return setupTests(testFunction, title, implementation);
  };
}

/**
 * Wrap the ava test module in these helper functions
 */
export const tsTest = Object.assign(wrapAvaTest(test), {
  only: wrapAvaTest(test.only),
  skip: wrapAvaTest(test.skip)
});
