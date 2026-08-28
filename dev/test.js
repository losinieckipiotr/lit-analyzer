import { runTests, runVSCodeCommand, downloadAndUnzipVSCode } from '@vscode/test-electron';
import * as path from 'path';
import * as assert from 'assert';
import { Writable } from 'stream';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function main() {
  const extensionDevelopmentPath = path.resolve(__dirname, './');
	const extensionTestsPath = path.resolve(__dirname, './index.js');
  const testWorkspace = __dirname

  const vscodeExecutablePath = await downloadAndUnzipVSCode('1.113.0')

  await runVSCodeCommand(['--install-extension', 'runem.lit-plugin']);

	await runTests({
    vscodeExecutablePath,
		extensionDevelopmentPath,
		extensionTestsPath,
    launchArgs: [testWorkspace],
	});
}

main();
