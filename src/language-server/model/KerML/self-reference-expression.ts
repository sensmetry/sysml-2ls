import { SelfReferenceExpression, Type } from "../../generated/ast";
import { metamodelOf, ElementID } from "../metamodel";
import { InlineExpressionMeta } from "./inline-expression";

@metamodelOf(SelfReferenceExpression)
export class SelfReferenceExpressionMeta extends InlineExpressionMeta {
    constructor(node: SelfReferenceExpression, id: ElementID) {
        super(node, id);
    }

    override self(): SelfReferenceExpression {
        return super.self() as SelfReferenceExpression;
    }

    override returnType(): string | Type | undefined {
        return "KerML::Core::Feature";
    }
}

declare module "../../generated/ast" {
    interface SelfReferenceExpression {
        $meta: SelfReferenceExpressionMeta;
    }
}
