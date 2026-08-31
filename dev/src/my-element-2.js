// @ts-check
import { html, LitElement, render } from 'lit';
/**
 * @element my-element2
 * @attr foo - The foo attribute
 * @slot - Unnamed slot
 * @slot right - Right slot
 * @slot left - Left slot
 */
export class MyElement2 extends LitElement {
	static properties = {
		foo: { type: Number, attribute: 'foo' }
	};

	constructor() {
		super();

		/** @type {number} */
		this.foo = 1;
	}
}



customElements.define("my-element2", MyElement2);

const input = document.querySelector('input');


render(html`
<input type="number" value="1">
<my-element2 foo=${1}></my-element2>
`, document.body);
