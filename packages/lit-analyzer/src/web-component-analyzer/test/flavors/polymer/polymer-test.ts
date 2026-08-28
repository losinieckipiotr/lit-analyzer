import {
  isAssignableToSimpleTypeKind,
  SimpleType,
  SimpleTypeKind
} from "../../../src/simple-type.js";
import { analyzeTextWithCurrentTsModule } from "../../helpers/analyze-text-with-current-ts-module.js";
import { tsTest } from "../../helpers/ts-test.js";
import { getComponentProp } from "../../helpers/util.js";

tsTest("Polymer components are correctly picked up", t => {
  const {
    results: [result]
  } = analyzeTextWithCurrentTsModule(`
		class XCustom extends PolymerElement {
			static get properties() {
				return {
					user: String,
					isHappy: Boolean,
					count: {
						type: Number,
						readOnly: true,
						notify: true,
						value: 10
					}
				}
			}
		}

		customElements.define('x-custom', XCustom);
	 `);

  const { members } = result.componentDefinitions[0].declaration!;

  t.is(members.length, 3);

  const userProp = getComponentProp(members, "user");
  t.truthy(userProp);
  t.truthy(
    isAssignableToSimpleTypeKind(
      userProp!.type!() as SimpleType,
      SimpleTypeKind.STRING
    )
  );
  t.is(userProp!.attrName, "user");

  const isHappyProp = getComponentProp(members, "isHappy");
  t.truthy(isHappyProp);
  t.truthy(
    isAssignableToSimpleTypeKind(
      isHappyProp!.type!() as SimpleType,
      SimpleTypeKind.BOOLEAN
    )
  );
  t.is(isHappyProp!.attrName, "is-happy");

  const countProp = getComponentProp(members, "count");
  t.truthy(countProp);
  t.truthy(
    isAssignableToSimpleTypeKind(
      countProp!.type!() as SimpleType,
      SimpleTypeKind.NUMBER
    )
  );
  t.is(countProp!.attrName, "count");
  t.is(countProp!.default, 10);
});
