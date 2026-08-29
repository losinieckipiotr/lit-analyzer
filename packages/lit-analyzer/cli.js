#!/usr/bin/env node

import { cli } from "./dist/index.js";

cli()
  // eslint-disable-next-line no-console
  .catch(console.log);
