import { ExecutionContext } from "ava";
import { LitAnalyzerRuleId } from "../../lib/analyze/lit-analyzer-config.js";
import { LitDiagnostic } from "../../lib/analyze/types/lit-diagnostic.js";

export function hasDiagnostic(
  t: ExecutionContext,
  diagnostics: LitDiagnostic[],
  ruleName: LitAnalyzerRuleId,
  message?: string,
): void {
  if (diagnostics.length !== 1) {
    prettyLogDiagnostics(t, diagnostics);
  }

  t.is(diagnostics.length, 1, "Expected exactly one diagnostic");
  t.is(diagnostics[0].source, ruleName, message);
}

export function hasNoDiagnostics(
  t: ExecutionContext,
  diagnostics: LitDiagnostic[],
  message?: string,
) {
  const diagnosticsPretty = diagnostics.map(
    (diagnostic) => `${diagnostic.source}: ${diagnostic.message}`,
  );
  return t.deepEqual(diagnosticsPretty, [], message);
}

function prettyLogDiagnostics(
  t: ExecutionContext,
  diagnostics: LitDiagnostic[],
) {
  t.log(
    diagnostics.map(
      (diagnostic) => `${diagnostic.source}: ${diagnostic.message}`,
    ),
  );
}
