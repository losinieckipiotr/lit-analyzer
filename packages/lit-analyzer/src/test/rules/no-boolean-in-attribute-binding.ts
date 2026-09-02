import { getDiagnostics } from "../helpers/analyze.js";
import { hasDiagnostic, hasNoDiagnostics } from "../helpers/assert.js";
import { tsTest } from "../helpers/ts-test.js";

tsTest("Non-boolean-binding with an empty string value is valid", (t) => {
  const { diagnostics } = getDiagnostics('html`<input required="" />`', {
    rules: { "no-boolean-in-attribute-binding": true },
  });

  hasNoDiagnostics(t, diagnostics);
});

tsTest(
  "Non-boolean-binding with a boolean type expression is not valid",
  (t) => {
    const { diagnostics } = getDiagnostics(
      'html`<input maxlength="${true}" />`',
      { rules: { "no-boolean-in-attribute-binding": true } },
    );

    hasDiagnostic(t, diagnostics, "no-boolean-in-attribute-binding");
  },
);

tsTest(
  "Non-boolean-binding on a boolean type attribute with a non-boolean type expression is not valid",
  (t) => {
    const { diagnostics } = getDiagnostics(
      'html`<input required="${{} as string}" />`',
      { rules: { "no-boolean-in-attribute-binding": true } },
    );

    hasDiagnostic(t, diagnostics, "no-boolean-in-attribute-binding");
  },
);

tsTest(
  "Boolean assigned to 'true|'false' doesn't emit 'no-boolean-in-attribute-binding' warning",
  (t) => {
    const { diagnostics } = getDiagnostics(
      'let b: boolean = true; html`<input aria-expanded="${b}" />`',
      // for now commented, but may be usefull somewhere else
      // [
      //   'import { html, LitElement, render } from "lit";',
      //   'import { customElement, property } from "lit/decorators.js";',
      //   "declare global {",
      //   "  interface HTMLElementTagNameMap {",
      //   '    "test-el": TestEl;',
      //   "  }",
      //   "}",
      //   '@customElement("test-el")',
      //   "class TestEl extends LitElement {",
      //   '  @property({ type: String, attribute: "bval" })',
      //   '  bval: "true" | "false" = "true";',
      //   "}",
      //   "let bval: boolean = true;",
      //   "render(html`<test-el bval=${bval}></test-el>`, document.body);",
      // ].join("\n"),
      {
        rules: {
          "no-boolean-in-attribute-binding": true,
        },
      },
    );
    hasNoDiagnostics(t, diagnostics);
  },
);
