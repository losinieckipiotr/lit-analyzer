import * as fs from "fs";
import * as path from "path";
import {
  CreateSourceFileOptions,
  Extension,
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
}

export type TestFile = ITestFile | string;

class TestCompilerHost implements CompilerHost {
  private ts = getCurrentTsModule();
  private files: ITestFile[];

  constructor(
    inputFiles: TestFile[] | TestFile,
    private includeLib: boolean,
  ) {
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
  }

  private getCompilerOptions(): CompilerOptions {
    const { ts } = this;

    return {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ESNext,
      allowJs: true,
      sourceMap: false,
      strict: true,
      // useful for debugging
      // traceResolution: true,
      // lib: includeLib ? undefined : [],
      lib: [],
    };
  }

  getEntryFile() {
    const { files } = this;

    const result = files.find((file) => file.entry === true) || files[0];

    return result;
  }

  getProgram() {
    const { ts, files, includeLib } = this;

    const program = ts.createProgram({
      rootNames: [
        ...files.map((file) => file.fileName!),
        ...(includeLib ? ["node_modules/typescript/lib/lib.dom.d.ts"] : []),
      ],
      options: this.getCompilerOptions(),
      host: this,
    });

    // TODO: I still do not understand how it works and is this is good approach for testing
    // We need to overwrite this so the traversal of external modules can be tested.
    program.isSourceFileFromExternalLibrary = (
      sourceFile: SourceFile,
    ): boolean => {
      return sourceFile.fileName.includes("node_modules");
    };

    return program;
  }

  fileExists(fileName: string): boolean {
    return this.files.some((currentFile) => currentFile.fileName === fileName);
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
        : path.join(getCurrentTsModuleDirectory(), fileName);
    }

    if (fs.existsSync(fileName)) {
      return fs.readFileSync(fileName, "utf8").toString();
    } else {
      throw new Error(`File not found: ${fileName}`);
    }
  }

  trace(s: string): void {
    // custom trace function, usefull in debugging
    // eslint-disable-next-line no-console
    console.log(s);
  }

  directoryExists(directoryName: string): boolean {
    let result = false;

    if (directoryName === "" || directoryName === "node_modules") {
      result = true;
    }

    return result;
  }

  // ModuleResolutionHost - not implemented
  // realpath?(path: string): string;

  getCurrentDirectory(): string {
    return "./";
  }

  getDirectories(directoryName: string): string[] {
    const { ts } = this;

    // note: this reads from file system
    return ts.sys.getDirectories(directoryName);
  }

  getSourceFile(
    fileName: string,
    languageVersion: ScriptTarget | CreateSourceFileOptions,
    _onError?: (message: string) => void,
    _shouldCreateNewSourceFile?: boolean,
  ): SourceFile | undefined {
    const { ts } = this;

    const sourceText = this.readFile(fileName);

    if (sourceText === undefined) {
      return undefined;
    }

    return ts.createSourceFile(
      fileName,
      sourceText,
      languageVersion,
      true,
      ts.ScriptKind.TS,
    );
  }

  // CompilerHost - not implemented
  // getSourceFileByPath?(fileName: string, path: Path, languageVersionOrOptions: ScriptTarget | CreateSourceFileOptions, onError?: (message: string) => void, shouldCreateNewSourceFile?: boolean): SourceFile | undefined;

  // CompilerHost - not implemented
  // getCancellationToken?(): CancellationToken;

  getDefaultLibFileName(options: CompilerOptions): string {
    const { ts } = this;

    return ts.getDefaultLibFileName(options);
  }

  // CompilerHost - not implemented
  // getDefaultLibLocation?(): string;

  writeFile(): void {
    // do nothing
  }

  getCanonicalFileName(fileName: string): string {
    return this.useCaseSensitiveFileNames() ? fileName : fileName.toLowerCase();
  }

  useCaseSensitiveFileNames(): boolean {
    const { ts } = this;

    return ts.sys.useCaseSensitiveFileNames;
  }

  getNewLine(): string {
    const { ts } = this;

    return ts.sys.newLine;
  }

  // CompilerHost - not implemented
  // readDirectory?(
  //   rootDir: string,
  //   extensions: readonly string[],
  //   excludes: readonly string[] | undefined,
  //   includes: readonly string[],
  //   depth?: number,
  // ): string[] {}

  // CompilerHost - not implemented
  // getModuleResolutionCache?(): ModuleResolutionCache | undefined;

  // CompilerHost - not implemented
  // resolveTypeReferenceDirectives?(
  //   typeReferenceDirectiveNames: string[] | readonly FileReference[],
  //   containingFile: string,
  //   redirectedReference: ResolvedProjectReference | undefined,
  //   options: CompilerOptions,
  //   containingFileMode?: ResolutionMode,
  // ): (ResolvedTypeReferenceDirective | undefined)[] {}

  resolveModuleNameLiterals(
    moduleLiterals: readonly StringLiteralLike[],
    // not used for now
    containingFile: string,
    _redirectedReference: ResolvedProjectReference | undefined,
    _options: CompilerOptions,
    containingSourceFile: SourceFile,
    _reusedNames: readonly StringLiteralLike[] | undefined,
  ): readonly ResolvedModuleWithFailedLookupLocations[] {
    const { files } = this;
    const fileNames = files.map((file) => file.fileName);

    const result: ResolvedModuleWithFailedLookupLocations[] = [];

    for (const moduleLiteral of moduleLiterals) {
      const text = moduleLiteral.getText();

      if (!text.startsWith('"')) {
        throw new Error(`resolutuion for module '${text}' is not implemented`);
      }

      let name = text;

      if (text.startsWith('"./')) {
        name = text.replace('"./', "");
      }

      if (name.endsWith('"')) {
        name = name.slice(0, -1);
      } else {
        throw new Error(`parsing error for: ${text}`);
      }

      if (!name.endsWith(Extension.Ts)) {
        name += Extension.Ts;
      }

      if (!fileNames.includes(name)) {
        result.push({ resolvedModule: undefined });
      } else {
        result.push({
          resolvedModule: {
            resolvedFileName: name,
            extension: Extension.Ts,
            isExternalLibraryImport: false,
            packageId: undefined,
            resolvedUsingTsExtension: false,
          },
        });
      }
    }

    return result;
  }

  // CompilerHost - not implemented
  // resolveTypeReferenceDirectiveReferences?<T extends FileReference | string>(
  //   typeDirectiveReferences: readonly T[],
  //   containingFile: string,
  //   redirectedReference: ResolvedProjectReference | undefined,
  //   options: CompilerOptions,
  //   containingSourceFile: SourceFile | undefined,
  //   reusedNames: readonly T[] | undefined,
  // ): readonly ResolvedTypeReferenceDirectiveWithFailedLookupLocations[] {}

  // from CompilerHost - not implemented
  // jsDocParsingMode?: JSDocParsingMode;
}

/**
 * Compiles 'virtual' files with Typescript
 */
export function compileFiles(
  inputFiles: TestFile[] | TestFile = [],
  includeLib: boolean = false,
): {
  program: Program;
  sourceFile: SourceFile;
  compilerHost: CompilerHost;
} {
  const compilerHost = new TestCompilerHost(inputFiles, includeLib);

  const entryFile = compilerHost.getEntryFile();
  const program = compilerHost.getProgram();

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
