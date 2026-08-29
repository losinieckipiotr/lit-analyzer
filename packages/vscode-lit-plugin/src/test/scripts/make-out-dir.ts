import * as fs from "fs";

if (!fs.existsSync("out")) {
  fs.mkdirSync("out");
}
