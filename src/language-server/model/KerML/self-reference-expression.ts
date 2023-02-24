import { SelfReferenceExpression } from "../../generated/ast";
import { metamodelOf, ElementID, ModelContainer } from "../metamodel";
import { InlineExpressionMeta } from "./inline-expression";
import { TypeMeta } from "./_internal";

@metamodelOf(SelfReferenceExpression)
export class SelfReferenceExpressionMeta extends InlineExpressionMeta {
    constructor(id: ElementID, parent: ModelContainer<SelfReferenceExpression>) {
        super(id, parent);
    }

    override self(): SelfReferenceExpression | undefined {
        return super.self() as SelfReferenceExpression;
    }

    override parent(): ModelContainer<SelfReferenceExpression> {
        return this._parent;
    }

    override returnType(): string | TypeMeta | undefined {
        return "KerML::Core::Feature";
    }
}

declare module "../../generated/ast" {
    interface SelfReferenceExpression {
        $meta: SelfReferenceExpressionMeta;
    }
}
