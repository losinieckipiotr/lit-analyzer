#!/usr/bin/env node

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./index.js")
	.cli()
	// eslint-disable-next-line no-console
	.catch(console.log);
