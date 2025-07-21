import libCSS from "./lib.css?inline";

let baseStylesheet: CSSStyleSheet | null = null;

function getBaseStylesheet(): CSSStyleSheet {
  if (!baseStylesheet) {
    baseStylesheet = new CSSStyleSheet();
    baseStylesheet.replaceSync(
      // https://github.com/tailwindlabs/tailwindcss/issues/15005
      libCSS.replace("((-webkit-hyphens:none)) and ", ""),
    );
  }
  return baseStylesheet;
}

export function initializeComponentStylesheet(
  element: HTMLElement,
  extraCSS?: string,
): void {
  if (!element.shadowRoot) {
    return;
  }

  const base = getBaseStylesheet();
  if (extraCSS) {
    const extra = new CSSStyleSheet();
    extra.replaceSync(extraCSS);
    element.shadowRoot.adoptedStyleSheets = [base, extra];
  } else {
    element.shadowRoot.adoptedStyleSheets = [base];
  }
}
