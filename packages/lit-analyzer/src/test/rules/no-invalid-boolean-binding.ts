import { getDiagnostics } from "../helpers/analyze.js";
import { hasDiagnostic, hasNoDiagnostics } from "../helpers/assert.js";
import { tsTest } from "../helpers/ts-test.js";

tsTest(
  "Emits 'no-invalid-boolean-binding' diagnostic when a boolean binding is used on a non-boolean type",
  (t) => {
    const { diagnostics } = getDiagnostics('html`<input ?type="${true}" />`', {
      rules: {
        "no-incompatible-type-binding": "off",
      },
    });
    hasDiagnostic(t, diagnostics, "no-invalid-boolean-binding");
  },
);

tsTest(
  "Emits no 'no-invalid-boolean-binding' diagnostic when the rule is turned off",
  (t) => {
    const { diagnostics } = getDiagnostics('html`<input ?type="${true}" />`', {
      rules: {
        "no-invalid-boolean-binding": "off",
        "no-incompatible-type-binding": "off",
      },
    });
    hasNoDiagnostics(t, diagnostics);
  },
);

tsTest(
  "Emits no 'no-invalid-boolean-binding' diagnostic when a boolean binding is used on a boolean type",
  (t) => {
    const { diagnostics } = getDiagnostics(
      'html`<input ?disabled="${true}" />`',
    );
    hasNoDiagnostics(t, diagnostics);
  },
);
