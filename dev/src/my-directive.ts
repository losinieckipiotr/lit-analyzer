import { html, render } from "lit";
import { Directive, DirectiveClass, DirectiveParameters, PartInfo } from "lit/directive.js";

class MyDirective extends Directive {
  constructor(partInfo: PartInfo) {
    super(partInfo);
  }

  render(value: number) {
    return value;
  }
}
export interface DirectiveResult<C extends DirectiveClass = DirectiveClass> {
}

export const directive = <C extends DirectiveClass>(c: C): DirectiveResult<C> => (...values: DirectiveParameters<InstanceType<C>>) => ({
    // This property needs to remain unminified.
    ['_$litDirective$']: c,
    values,
});

const myDirective = directive(MyDirective);


render(html`<input ${myDirective(42)}/>`, document.body)




// interface MyDir {
//   <T>(vals: unknown[], f: () => T): DirectiveResult<typeof MyDirective<T>>;
// }