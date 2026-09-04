import { getDiagnostics as _getDiagnostics } from "../helpers/analyze.js";
import { hasDiagnostic, hasNoDiagnostics } from "../helpers/assert.js";
import { tsTest } from "../helpers/ts-test.js";

/**
 * Overrides the getDiagnostics function to always include 'lib.dom.d.ts'
 */
const getDiagnostics = (...args: Parameters<typeof _getDiagnostics>) => {
  const [inputFiles, config, includeLib, ...rest] = args;

  if (includeLib !== undefined) {
    throw new Error("includeLib argument is forced to true");
  }

  if (rest.length > 0) {
    const unknownArg: never[] = rest;

    throw new Error(`Unknown argument: ${unknownArg}`);
  }

  return _getDiagnostics(inputFiles, config, true);
};

const preface = `
  class TrustedResourceUrl {};
  class SafeUrl {};
  class SafeStyle {};

  const trustedResourceUrl = new TrustedResourceUrl();
  const safeUrl = new SafeUrl();
  const safeStyle = new SafeStyle();

	const anyValue: any = {};
`;

tsTest("May bind string to script src with default config", (t) => {
  const { diagnostics } = getDiagnostics(
    'html`<script .src=${"/foo.js"}></script>`',
    {},
  );
  hasNoDiagnostics(t, diagnostics);
});

tsTest.skip(
  "May not bind string to script src with ClosureSafeTypes config",
  (t) => {
    const { diagnostics } = getDiagnostics(
      'html`<script src=${"/foo.js"}></script>`',
      { securitySystem: "ClosureSafeTypes" },
    );
    hasDiagnostic(t, diagnostics, "no-incompatible-type-binding");
  },
);

tsTest.skip(
  "May not bind string to script .src with ClosureSafeTypes config",
  (t) => {
    const { diagnostics } = getDiagnostics(
      'html`<script .src=${"/foo.js"}></script>`',
      { securitySystem: "ClosureSafeTypes" },
    );
    hasDiagnostic(t, diagnostics, "no-incompatible-type-binding");
  },
);

tsTest(
  "May pass static string to script src with ClosureSafeTypes config",
  (t) => {
    const { diagnostics } = getDiagnostics(
      'html`<script src="/foo.js"></script>`',
      { securitySystem: "ClosureSafeTypes" },
    );
    hasNoDiagnostics(t, diagnostics);
  },
);

tsTest(
  "May not pass a TrustedResourceUrl to script src with default config",
  (t) => {
    const { diagnostics } = getDiagnostics(
      preface + "html`<script src=${trustedResourceUrl}></script>`",
      {},
    );
    hasDiagnostic(t, diagnostics, "no-complex-attribute-binding");
  },
);

tsTest(
  "May not pass a TrustedResourceUrl to script .src with default config",
  (t) => {
    const { diagnostics } = getDiagnostics(
      preface + "html`<script .src=${trustedResourceUrl}></script>`",
      {},
    );
    hasDiagnostic(t, diagnostics, "no-incompatible-type-binding");
  },
);

tsTest.skip(
  "May pass a TrustedResourceUrl to script src with ClosureSafeTypes config",
  (t) => {
    const { diagnostics } = getDiagnostics(
      preface + "html`<script src=${trustedResourceUrl}></script>`",
      { securitySystem: "ClosureSafeTypes" },
    );
    hasNoDiagnostics(t, diagnostics);
  },
);

tsTest.skip(
  "May pass a TrustedResourceUrl to script .src with ClosureSafeTypes config",
  (t) => {
    const { diagnostics } = getDiagnostics(
      preface + "html`<script .src=${trustedResourceUrl}></script>`",
      { securitySystem: "ClosureSafeTypes" },
    );
    hasNoDiagnostics(t, diagnostics);
  },
);

tsTest.skip(
  "May not pass a SafeUrl to script src with ClosureSafeTypes config",
  (t) => {
    const { diagnostics } = getDiagnostics(
      preface + "html`<script src=${safeUrl}></script>`",
      { securitySystem: "ClosureSafeTypes" },
    );
    hasDiagnostic(t, diagnostics, "no-complex-attribute-binding");
  },
);

tsTest.skip(
  "May not pass a SafeUrl to script .src with ClosureSafeTypes config",
  (t) => {
    const { diagnostics } = getDiagnostics(
      preface + "html`<script .src=${safeUrl}></script>`",
      { securitySystem: "ClosureSafeTypes" },
    );
    hasDiagnostic(t, diagnostics, "no-incompatible-type-binding");
  },
);

tsTest("May pass `any` to script src with ClosureSafeTypes config", (t) => {
  const { diagnostics } = getDiagnostics(
    preface + "html`<script src=${anyValue}></script>`",
    { securitySystem: "ClosureSafeTypes" },
  );
  hasNoDiagnostics(t, diagnostics);
});

tsTest("May pass `any` to script .src with ClosureSafeTypes config", (t) => {
  const { diagnostics } = getDiagnostics(
    preface + "html`<script .src=${anyValue}></script>`",
    { securitySystem: "ClosureSafeTypes" },
  );
  hasNoDiagnostics(t, diagnostics);
});

tsTest.skip(
  "May pass either a SafeUrl, a TrustedResourceUrl, a string, or `any` to img src with ClosureSafeTypes config",
  (t) => {
    hasNoDiagnostics(
      t,
      getDiagnostics(preface + "html`<img src=${safeUrl}>`", {
        securitySystem: "ClosureSafeTypes",
      }).diagnostics,
    );

    hasNoDiagnostics(
      t,
      getDiagnostics(preface + "html`<img src=${trustedResourceUrl}>`", {
        securitySystem: "ClosureSafeTypes",
      }).diagnostics,
    );

    hasNoDiagnostics(
      t,
      getDiagnostics(preface + "html`<img src=${'/img.webp'}>`", {
        securitySystem: "ClosureSafeTypes",
      }).diagnostics,
    );

    hasNoDiagnostics(
      t,
      getDiagnostics(preface + "html`<img src=${anyValue}>`", {
        securitySystem: "ClosureSafeTypes",
      }).diagnostics,
    );
  },
);

tsTest.skip(
  "May pass either a SafeUrl, a TrustedResourceUrl, a string, or `any` to img .src with ClosureSafeTypes config",
  (t) => {
    hasNoDiagnostics(
      t,
      getDiagnostics(preface + "html`<img .src=${safeUrl}>`", {
        securitySystem: "ClosureSafeTypes",
      }).diagnostics,
    );

    hasNoDiagnostics(
      t,
      getDiagnostics(preface + "html`<img .src=${trustedResourceUrl}>`", {
        securitySystem: "ClosureSafeTypes",
      }).diagnostics,
    );

    hasNoDiagnostics(
      t,
      getDiagnostics(preface + "html`<img .src=${'/img.webp'}>`", {
        securitySystem: "ClosureSafeTypes",
      }).diagnostics,
    );

    hasNoDiagnostics(
      t,
      getDiagnostics(preface + "html`<img .src=${anyValue}>`", {
        securitySystem: "ClosureSafeTypes",
      }).diagnostics,
    );
  },
);

tsTest.skip("May pass a string to style with ClosureSafeTypes config", (t) => {
  const { diagnostics } = getDiagnostics(
    preface + 'html`<div style=${"color: red"}></div>`',
    { securitySystem: "ClosureSafeTypes" },
  );
  hasNoDiagnostics(t, diagnostics);
});

tsTest.skip("May pass a string to .style with ClosureSafeTypes config", (t) => {
  const { diagnostics } = getDiagnostics(
    preface + 'html`<div .style=${"color: red"}></div>`',
    { securitySystem: "ClosureSafeTypes" },
  );
  hasNoDiagnostics(t, diagnostics);
});

tsTest.skip(
  "May pass a SafeStyle to style with ClosureSafeTypes config",
  (t) => {
    const { diagnostics } = getDiagnostics(
      preface + "html`<div style=${safeStyle}></div>`",
      { securitySystem: "ClosureSafeTypes" },
    );
    hasNoDiagnostics(t, diagnostics);
  },
);

tsTest.skip(
  "May pass a SafeStyle to .style with ClosureSafeTypes config",
  (t) => {
    const { diagnostics } = getDiagnostics(
      preface + "html`<div .style=${safeStyle}></div>`",
      { securitySystem: "ClosureSafeTypes" },
    );
    hasNoDiagnostics(t, diagnostics);
  },
);

tsTest("May pass a `any` to style with ClosureSafeTypes config", (t) => {
  const { diagnostics } = getDiagnostics(
    preface + "html`<div style=${anyValue}></div>`",
    { securitySystem: "ClosureSafeTypes" },
  );
  hasNoDiagnostics(t, diagnostics);
});

tsTest("May pass a `any` to .style with ClosureSafeTypes config", (t) => {
  const { diagnostics } = getDiagnostics(
    preface + "html`<div .style=${anyValue}></div>`",
    { securitySystem: "ClosureSafeTypes" },
  );
  hasNoDiagnostics(t, diagnostics);
});

tsTest.skip(
  "Types renamed by Clutz are properly matched against allowed types.",
  (t) => {
    const { diagnostics } = getDiagnostics(
      [
        {
          fileName: "main.ts",
          text: `
					// A type name known to have been output by Clutz.
					class module$contents$goog$html$SafeUrl_SafeUrl {}

					html\`<a href='\${"abc" as module$contents$goog$html$SafeUrl_SafeUrl}'>This is a link.</a>\`;

					// A type name of the same format.
					class module$some$clutz$name_TrustedResourceUrl {}

					html\`<script src='\${"abc" as module$some$clutz$name_TrustedResourceUrl}'></script>\`;
				`,
        },
      ],
      {
        securitySystem: "ClosureSafeTypes",
      },
    );
    hasNoDiagnostics(t, diagnostics);
  },
);
