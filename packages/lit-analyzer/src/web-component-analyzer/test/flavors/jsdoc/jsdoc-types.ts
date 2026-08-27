import test from "ava";
import { parseSimpleJsDocTypeExpression } from "../../../src/analyze/util/js-doc-util.js";
import { SimpleType } from "../../../src/simple-type.js";
import { getCurrentTsModule } from "../../helpers/ts-test.js";

test("Parse required and union", t => {
  const ts = getCurrentTsModule();
  const program = ts.createProgram([], {});
  const type = parseSimpleJsDocTypeExpression("!Array|undefined", {
    ts,
    program
  });

  t.deepEqual(type, {
    kind: "UNION",
    types: [{ kind: "ARRAY", type: { kind: "ANY" } }, { kind: "UNDEFINED" }]
  } as SimpleType);
});
