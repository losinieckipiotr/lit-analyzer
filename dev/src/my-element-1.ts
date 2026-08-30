import { html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "./my-element-2.js";

/**
 * @event some-event - Fired when something happens
 */
@customElement("my-element")
export class MyElement extends LitElement {
	@property({ type: String, attribute: "bval" })
	bval: 'true' | 'false' = 'true';

	@property({ type: Boolean })
	disabled: boolean = false;

	@property({ attribute: "hell>o" }) test: number | undefined;

	@property({ type: Date }) test2: number | undefined;

	@property({ type: String })
	test3: string | undefined;

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
		const el = document.querySelector("my-element");

		let input = document.createElement("input");
		input.ariaExpanded = "true";

		let b: boolean = true;

		// let a: number = 'd';

		return html`
			<my-element bval="${b}"></my-element>
			<my-element ?disabled=${"true"}></my-element>

			<my-tsconfig-element size="large"></my-tsconfig-element>
			<unknown-element @heheheh="${() => {}}" globalattribute></unknown-element>
			<heheheh></heheheh>
			<my-element2>
				<div slot=""></div>
				<div slot="right"></div>
			</my-element2>
			<my-element .test3="${1}"></my-element>
			<input @hehehehe="${() => {}}" />
			<my-element @click="${() => {}}"></my-element>
			<my-element @some-event=${this.onSomeEvent}></my-element>
			<my-element></my-element>
			<my-element2 .foo="${"bar"}"></my-element2>
		`;
	}
}
