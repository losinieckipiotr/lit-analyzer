import { getDiagnostics } from "../helpers/analyze.js";
import { hasDiagnostic, hasNoDiagnostics } from "../helpers/assert.js";
import { tsTest } from "../helpers/ts-test.js";

tsTest(
  "'no-missing-element-type-definition' reports diagnostic when element is not in HTMLElementTagNameMap",
  (t) => {
    const { diagnostics } = getDiagnostics(
      `
		class MyElement extends HTMLElement { }; 
		customElements.define("my-element", MyElement)
	`,
      {
        rules: { "no-missing-element-type-definition": true },
      },
      true, // include lib.dom.d.ts file with HTMLElementTagNameMap
    );

    hasDiagnostic(t, diagnostics, "no-missing-element-type-definition");
  },
);

tsTest(
  "'no-missing-element-type-definition' reports no diagnostic when element is in HTMLElementTagNameMap",
  (t) => {
    const { diagnostics } = getDiagnostics(
      `
		class MyElement extends HTMLElement { }; 
		customElements.define("my-element", MyElement)
		declare global {
			interface HTMLElementTagNameMap {
				"my-element": MyElement
			}
		}
	`,
      {
        rules: { "no-missing-element-type-definition": true },
      },
      true, // include lib.dom.d.ts file with HTMLElementTagNameMap
    );

    hasNoDiagnostics(t, diagnostics);
  },
);

tsTest(
  "'no-missing-element-type-definition' reports no diagnostic when LitElement is in HTMLElementTagNameMap",
  (t) => {
    const { diagnostics } = getDiagnostics(
      [
        'import { html, LitElement, render } from "lit";',
        'import { customElement, property } from "lit/decorators.js";',
        "declare global {",
        "  interface HTMLElementTagNameMap {",
        '    "test-el": TestEl',
        "  }",
        "}",
        '@customElement("test-el")',
        "class TestEl extends LitElement { }",
        'customElements.define("test-el", TestEl)',
      ].join("\n"),
      {
        rules: { "no-missing-element-type-definition": true },
      },
      true, // include lib.dom.d.ts file with HTMLElementTagNameMap
    );

    hasNoDiagnostics(t, diagnostics);
  },
);
