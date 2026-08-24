import { html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "./my-element-2";

/**
 * @event some-event - Fired when something happens
 */
@customElement("my-element")
export class MyElement extends LitElement {
	@property({ attribute: "hell>o" }) test: number | undefined;

	@property({ type: Date }) test2: number | undefined;

	@state() internal: number | undefined;

	static get observedAttributes() {
		return ["this is a test", "testing"];
	}

	someEvent() {
		dispatchEvent(
			new CustomEvent(
				"some-event",
				{ bubbles: true, composed: true, detail: { test: 'data' } }
			)
		);
	}

	onSomeEvent(event: CustomEvent<{ test: string }>) {
		console.log(event.detail.test);
	}

	render() {
		return html`
			<my-tsconfig-element size="large"></my-tsconfig-element>
			<unknown-element @heheheh="${() => {}}" globalattribute></unknown-element>
			<heheheh></heheheh>
			<my-element2>
				<div slot=""></div>
				<div slot="right"></div>
			</my-element2>
			<my-element></my-element>
			<input @hehehehe="${() => {}}" />
			<my-element @click="${() => {}}"></my-element>
			<my-element @some-event=${this.onSomeEvent}></my-element>
			<my-element></my-element>
			<my-element2 .foo="${"bar"}"></my-element2>
		`;
	}
}
