/* eslint-disable no-console */
import fs from "fs";

console.log("Copying 'test/flavors/lwc' to 'dist/test/flavors/lwc'...");

fs.cpSync("test/flavors/lwc/comp", "dist/test/flavors/lwc/comp", {
  recursive: true
});
