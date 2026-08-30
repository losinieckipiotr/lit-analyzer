// declare global {
//   interface HTMLElementTagNameMap {
//     "my-element-3": MyElement3;
//   }
// }
export class MyElement3 extends HTMLElement {}
customElements.define("my-element-3", MyElement3);
