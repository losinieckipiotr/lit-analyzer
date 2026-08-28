import { html, LitElement, render } from "lit";
import { customElement, property } from "lit/decorators.js";
import "./my-element-2.js";

declare global {
  interface HTMLElementTagNameMap {
    "test-el": TestEl;
  }
}

@customElement("test-el")
export class TestEl extends LitElement {
	@property({ type: String, attribute: "bval" })
	bval: 'true' | 'false' = 'true';
}

let bval: boolean = true;

render(html`<test-el bval=${bval}></test-el>`, document.body);
