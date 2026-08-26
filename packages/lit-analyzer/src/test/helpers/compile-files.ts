/* eslint-disable no-console */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  Extension,
  ModuleKind,
  ModuleResolutionCache,
  ResolvedModuleWithFailedLookupLocations,
  ResolvedProjectReference,
  StringLiteralLike,
  type CompilerHost,
  type CompilerOptions,
  type Program,
  type ScriptTarget,
  type SourceFile,
} from "typescript";
import { getCurrentTsModule, getCurrentTsModuleDirectory } from "./ts-test.js";

export interface ITestFile {
  fileName?: string;
  text: string;
  entry?: boolean;
  // includeLib?: boolean;
}

export type TestFile = ITestFile | string;

class TestCompilerHost implements CompilerHost {
  private ts = getCurrentTsModule();
  private files: ITestFile[];
  private includeLib: boolean = true; //files.find(file => file.includeLib) != null;
  private cache: ModuleResolutionCache;

  constructor(inputFiles: TestFile[] | TestFile) {
    this.files = (Array.isArray(inputFiles) ? inputFiles : [inputFiles])
      .map((file) =>
        typeof file === "string"
          ? {
              text: file,
              fileName: `auto-generated-${Math.floor(Math.random() * 100000)}.ts`,
              entry: true,
            }
          : {
              ...file,
              fileName:
                file.fileName ||
                `auto-generated-${Math.floor(Math.random() * 100000)}.ts`,
            },
      )
      .map((file) => ({ ...file, fileName: file.fileName }));

    const cache = this.ts.createModuleResolutionCache(
      this.getCurrentDirectory(),
      (fileName: string) => this.getCanonicalFileName(fileName),
      this.getCompilerOptions(),
    );

    this.cache = cache;
  }

  private getCompilerOptions(): CompilerOptions {
    const { ts } = this;

    return {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ESNext,
      allowJs: true,
      sourceMap: false,
      strict: true, // if strict = false, "undefined" and "null" will be removed from unions types.
      // lib: [],
      traceResolution: true,
    };
  }

  getEntryFile() {
    const { files } = this;

    return files.find((file) => file.entry === true) || files[0];
  }

  getProgram() {
    const { ts, files } = this;

    return ts.createProgram({
      //rootNames: [...files.map(file => file.fileName!), "node_modules/typescript/lib/lib.dom.d.ts"],
      // rootNames: [
      //   ...files.map((file) => file.fileName!),
      //   ...(includeLib ? ["node_modules/typescript/lib/lib.dom.d.ts"] : []),
      // ],
      rootNames: files.map((file) => file.fileName!),
      options: this.getCompilerOptions(),
      host: this,
    });
  }

  writeFile() {
    // do nothing
  }

  readFile(fileName: string): string | undefined {
    const { files, includeLib } = this;

    const matchedFile = files.find(
      (currentFile) => currentFile.fileName === fileName,
    );

    if (matchedFile != null) {
      return matchedFile.text;
    }

    if (includeLib) {
      fileName = fileName.match(/[/\\]/)
        ? fileName
        : join(getCurrentTsModuleDirectory(), fileName);
    }

    if (existsSync(fileName)) {
      return readFileSync(fileName, "utf8").toString();
    } else {
      throw new Error(`File not found: ${fileName}`);
    }
  }

  getSourceFile(fileName: string, languageVersion: ScriptTarget) {
    const { ts } = this;

    const sourceText = this.readFile(fileName);

    if (sourceText === undefined) {
      return undefined;
    }

    // console.log(`Creating source file: ${fileName}`);

    return ts.createSourceFile(
      fileName,
      sourceText,
      languageVersion,
      true,
      ts.ScriptKind.TS,
    );
  }

  fileExists(fileName: string) {
    return this.files.some((currentFile) => currentFile.fileName === fileName);
  }

  getCurrentDirectory() {
    return "./";
  }

  getDirectories(directoryName: string) {
    const { ts } = this;

    return ts.sys.getDirectories(directoryName);
  }

  getDefaultLibFileName(options: CompilerOptions) {
    const { ts } = this;

    return ts.getDefaultLibFileName(options);
  }

  getCanonicalFileName(fileName: string) {
    return this.useCaseSensitiveFileNames() ? fileName : fileName.toLowerCase();
  }

  getNewLine() {
    const { ts } = this;

    return ts.sys.newLine;
  }

  useCaseSensitiveFileNames() {
    const { ts } = this;

    return ts.sys.useCaseSensitiveFileNames;
  }

  trace(s: string) {
    console.log("trace: ", s);
  }

  directoryExists(directoryName: string): boolean {
    if (directoryName === "") {
      console.log("directoryExists: ", { directoryName, result: true });
      return true;
    }

    console.log("directoryExists: ", { directoryName, result: false });
    return false;
  }

  // TODO: a lot of method can be removed now or throw errors
  // realpath(path: string): string {
  //   throw new Error("Method not implemented.");
  // }

  // resolveModuleNames?(
  //   moduleNames: string[],
  //   containingFile: string,
  //   reusedNames: string[] | undefined,
  //   redirectedReference: ResolvedProjectReference | undefined,
  //   options: CompilerOptions,
  //   containingSourceFile?: SourceFile,
  // ): (ResolvedModule | undefined)[] {
  //   throw new Error("Method not implemented.");
  // }

  resolveModuleNameLiterals(
    moduleLiterals: readonly StringLiteralLike[],
    containingFile: string,
    redirectedReference: ResolvedProjectReference | undefined,
    options: CompilerOptions,
    containingSourceFile: SourceFile,
    reusedNames: readonly StringLiteralLike[] | undefined,
  ): readonly ResolvedModuleWithFailedLookupLocations[] {
    const { files, cache } = this;
    const fileNames = files.map((file) => file.fileName);
    const dirCache = cache.getOrCreateCacheForDirectory(
      this.getCurrentDirectory(),
    );

    const result: ResolvedModuleWithFailedLookupLocations[] = [];

    for (const moduleLiteral of moduleLiterals) {
      const text = moduleLiteral.getText();

      const resModule = {
        resolvedModule: {
          resolvedFileName: "",
          originalPath: undefined,
          extension: Extension.Ts,
          isExternalLibraryImport: false,
          packageId: undefined,
          resolvedUsingTsExtension: false,
        },
        failedLookupLocations: undefined,
        affectingLocations: undefined,
        resolutionDiagnostics: undefined,
        alternateResult: undefined,
      };

      // local file
      if (text.startsWith('"./')) {
        let name = text.replace('"./', "");

        if (name.endsWith('"')) {
          name = name.slice(0, -1);
        } else {
          throw new Error(`parsing error for: ${text}`);
        }

        // add .ts extension if not present
        if (!name.endsWith(Extension.Ts)) {
          name += Extension.Ts;
        }

        if (!fileNames.includes(name)) {
          throw new Error(`File not found: ${name}`);
        }

        resModule.resolvedModule!.resolvedFileName = name;
      }

      result.push(resModule);

      const moduleName = text.replaceAll('"', "");
      dirCache.set(moduleName, ModuleKind.ESNext, resModule);
    }

    return result;
  }

  getModuleResolutionCache(): ModuleResolutionCache {
    return this.cache;
  }
}

/**
 * Compiles 'virtual' files with Typescript
 */
export function compileFiles(inputFiles: TestFile[] | TestFile = []): {
  program: Program;
  sourceFile: SourceFile;
  compilerHost: CompilerHost;
} {
  const compilerHost = new TestCompilerHost(inputFiles);

  const entryFile = compilerHost.getEntryFile();
  const program = compilerHost.getProgram();

  // We need to overwrite this so the traversal of external modules can be tested.
  // TODO: why is it here? if needed should be handled in the TestCompilerHost class.
  program.isSourceFileFromExternalLibrary = (
    sourceFile: SourceFile,
  ): boolean => {
    const filename = sourceFile.fileName;
    return filename.includes("node_modules");
  };

  const entrySourceFile =
    entryFile.fileName != null
      ? program.getSourceFile(entryFile.fileName)!
      : program.getSourceFiles()[0];

  return {
    program,
    sourceFile: entrySourceFile,
    compilerHost,
  };
}
