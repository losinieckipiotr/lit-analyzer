// Pretending this is the Lit html function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const html: any;

class MyElement extends HTMLElement {}
customElements.define("my-element", MyElement);

export const template = html`<my-element></my-element>`;
