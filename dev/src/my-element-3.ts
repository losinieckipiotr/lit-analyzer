import { LitElement, html, render } from "lit";
// declare global {
//   interface HTMLElementTagNameMap {
//     "my-element-3": MyElement3;
//   }
// }


/** */
class MyElement3 extends LitElement {}

render(html`<my-element-3></my-element-3>`, document.body);

// customElements.define("my-element-3", MyElement3);
