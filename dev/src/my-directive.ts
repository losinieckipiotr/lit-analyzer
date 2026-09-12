import { html, render } from "lit";
import { directive, Directive, PartInfo } from "lit/directive.js";

class MyDirective extends Directive {
  constructor(partInfo: PartInfo) {
    super(partInfo);
  }

  render(value: number) {
    return value;
  }
}

const myDirective = directive(MyDirective);

render(html`<input ${myDirective(42)}/>`, document.body)


// interface MyDir {
//   <T>(vals: unknown[], f: () => T): DirectiveResult<typeof MyDirective<T>>;
// }