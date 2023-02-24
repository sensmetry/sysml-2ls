/********************************************************************************
 * Copyright (c) 2022-2023 Sensmetry UAB and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License, v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is
 * available at https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import {
    AstNode,
    DefaultScopeProvider,
    findLeafNodeAtOffset,
    getDocument,
    isLeafCstNode,
    LangiumDocument,
    ReferenceInfo,
} from "langium";
import {
    Alias,
    ConnectorEnd,
    ElementReference,
    Expression,
    Feature,
    InlineExpression,
    isNamedArgument,
    Namespace,
    SysMLFunction,
    Type,
    TypeReference,
} from "../../generated/ast";
import {
    CHILD_CONTENTS_OPTIONS,
    collectRedefinitions,
    ContentsOptions,
    DEFAULT_ALIAS_RESOLVER,
} from "../../utils/scope-util";
import {
    SysMLScope,
    makeScope,
    makeLinkingScope,
    FilteredScope,
    ScopeStream,
} from "../../utils/scopes";
import { KeysMatching } from "../../utils/common";
import { SysMLDefaultServices } from "../services";
import { SysMLIndexManager } from "../shared/workspace/index-manager";
import { MetamodelBuilder } from "../shared/workspace/metamodel-builder";
import { CancellationToken } from "vscode-languageserver";
import { getPreviousNode } from "../../utils/cst-util";
import { ElementMeta, ElementReferenceMeta, Metamodel } from "../../model";
import { SysMLType } from "../sysml-ast-reflection";

type SpecializationKeys = KeysMatching<Type & Feature, Array<TypeReference>>;

// can't convert type unions to arrays so have to do it manually, however there
// is a type assertion to make sure we include all keys
const SpecializationPropertiesArray = (function <T extends SpecializationKeys[]>(...values: T): T {
    return values;
})(
    "chains",
    "conjugates",
    "differences",
    "disjoins",
    "featuredBy",
    "intersects",
    "inverseOf",
    "redefines",
    "references",
    "specializes",
    "subsets",
    "typedBy",
    "unions"
);

type DeclaredSpecializationKeys = typeof SpecializationPropertiesArray[number];

// casting and constraining to each other so that if any property is missing the
// type system will warn us, i.e. DeclaredSpecializationKeys ===
// SpecializationKeys
const SpecializationProperties = (function <T extends DeclaredSpecializationKeys>(
    values: T[]
): Set<string> {
    return new Set<string>(values);
})(SpecializationPropertiesArray as SpecializationKeys[]);

export class SysMLScopeProvider extends DefaultScopeProvider {
    protected override indexManager: SysMLIndexManager;
    protected metamodelBuilder: MetamodelBuilder;

    constructor(services: SysMLDefaultServices) {
        super(services);
        this.indexManager = services.shared.workspace.IndexManager;
        this.metamodelBuilder = services.shared.workspace.MetamodelBuilder;
    }

    override getScope(context: ReferenceInfo): SysMLScope {
        const unfiltered = this.getScopeUnfiltered(context);
        const referenceType = this.reflection.getReferenceType(context);
        return new FilteredScope(unfiltered, (desc) => desc.element.is(referenceType as SysMLType));
    }

    /**
     * Get a scope with all named elements so that aliases are not filtered out
     * @param context
     * @returns Scope with all named elements
     */
    getScopeUnfiltered(context: ReferenceInfo): ScopeStream {
        return makeLinkingScope(context.container.$meta, {}, this.indexManager.getGlobalScope());
    }

    /**
     * Get the scope for reference resolution
     * @param container reference owning container
     * @param index index of the reference
     * @param aliasResolver alias resolution function, a linker may use a
     * function that also links the alias to be resolved, while other services
     * may simply follow to the alias target
     * @returns scope that can be used to resolve the reference at {@link index}
     */
    getElementReferenceScope(
        container: ElementReferenceMeta,
        index: number,
        aliasResolver = DEFAULT_ALIAS_RESOLVER
    ): SysMLScope | ScopeStream | undefined {
        let parent: ReturnType<typeof this.getContext>;
        if (index === 0) {
            // either not a reference or start of qualified type chain only the
            // first part in the chain can use its parent scope, every other
            // part has to use the resolved element scope skipping the reference
            // scope itself since it doesn't contain anything anyway
            const context = this.getContext(container);
            if (context === "error") return;
            if (context) {
                parent = context;
            } else {
                return this.initialScope(
                    container.parent(),
                    container.document,
                    container.self()?.$containerProperty,
                    aliasResolver
                );
            }
        } else {
            // even if the reference was discarded due to the wrong type,
            // construct the reference resolution scope for completion provider
            parent = container.found.at(index - 1);
        }

        if (!parent) return;

        // not a start of the reference so it has to be resolved in the scope of
        // `parent`
        const ast = container.self();
        return this.localScope(
            parent,
            container.document ?? (ast ? getDocument(ast) : undefined),
            aliasResolver
        );
    }

    /**
     * Get the scope for reference resolution of the first reference in the
     * qualified chain
     * @param owner owner of the {@link ElementReference} that the reference is
     * a part of
     * @param document document that contains {@link owner}
     * @param property property that {@link ElementReference} is assigned to
     * @param aliasResolver alias resolution function
     * @see {@link getElementReferenceScope} (`index === 0`)
     * @returns scope that can be used to resolve the first reference in
     * {@link ElementReference}
     */
    initialScope(
        owner: Metamodel | undefined,
        document?: LangiumDocument,
        property?: string,
        aliasResolver = DEFAULT_ALIAS_RESOLVER
    ): ScopeStream | undefined {
        while (owner?.is(InlineExpression)) {
            // unwrap all the expressions to get the real parent
            owner = owner.parent();
        }

        let redefinitions: ContentsOptions["visited"] | undefined = undefined;
        let parent: Metamodel | undefined;
        if (owner?.is(Type)) {
            // also skip the first scoping node as references are always a part
            // of its declaration. However SysML adds more references that are
            // not used for scope resolution therefore we only skip if the
            // reference declares a specialization
            if (property && SpecializationProperties.has(property)) {
                parent = owner.parent();
            } else {
                parent = owner;
            }

            if (owner.is(Feature)) {
                redefinitions = new Set();
                // collect redefinitions for hiding redefined elements
                collectRedefinitions(owner, redefinitions);

                // connector ends cannot reference connector scope
                if (owner.is(ConnectorEnd)) {
                    parent = owner.parent().parent();
                }
            }
        } else if (owner?.is(Alias)) {
            // skip the alias scope since resolution tries to follow aliases to
            // their final destination
            parent = owner.parent();
        } else {
            parent = owner;
        }

        if (!parent) return;

        const ast = parent.self();
        if (ast) {
            // skipping the the owning node to avoid name resolution bugs if the
            // node has the same name as the reference
            try {
                document ??= getDocument(ast);
            } catch {
                // doesn't matter if no document was found
            }

            if (document) this.initializeParents(ast, document);
        }

        return makeLinkingScope(
            parent,
            {
                aliasResolver: aliasResolver,
                // TODO: not sure if this is right and specializations are
                // allowed to reference the declaring element but this fixes a
                // linking error in
                // SysML-v2-Release/sysml/src/examples/Individuals%20Examples/JohnIndividualExample.sysml
                skip: property === "subsets" || property === "inverseOf" ? undefined : owner,
                visited: redefinitions,
            },
            this.indexManager.getGlobalScope(document as LangiumDocument<Namespace> | undefined)
        );
    }

    /**
     * Get the scope that can be used for reference resolution in the context of
     * {@link node}
     * @param node AST node to get scope for
     * @param document document that contains {@link node}
     * @param aliasResolver alias resolution function
     * @see {@link getElementReferenceScope} (`index > 0`)
     * @returns scope of publicly visible elements from {@link node} scope
     */
    localScope(
        node: Metamodel,
        document?: LangiumDocument,
        aliasResolver = DEFAULT_ALIAS_RESOLVER
    ): SysMLScope {
        const ast = node.self();
        if (ast && document) this.metamodelBuilder.preLink(ast, document, CancellationToken.None);
        return makeScope(node, {
            ...CHILD_CONTENTS_OPTIONS,
            aliasResolver: aliasResolver,
        });
    }

    /**
     * Get node final reference target
     * @param node
     * @returns Element referenced by `node` if linked, `"error"` if failed to link
     * and `undefined` for no reference
     */
    protected getElementTarget(node: Metamodel): ElementMeta | undefined | "error" {
        if (node.is(ElementReference)) {
            return node.to.target?.element ?? "error";
        } else if (node.isAny([InlineExpression, Expression, SysMLFunction])) {
            const target = node.returnType();
            return this.indexManager.findType(target) ?? "error";
        }

        return undefined;
    }

    /**
     * Get context for scope resolution
     * @param ref Reference to resolve context for
     * @returns `undefined` if implicit parent context, `"error"` if context failed to
     * be linked and {@link Element} for existing context
     */
    protected getContext(ref: ElementReferenceMeta): ElementMeta | undefined | "error" {
        const ast = ref.self();
        if (!ast) return;
        const cst = ast.$cstNode;
        if (!cst) return;

        // check if the previous CST node is a scope token (`::` or `.`)
        const previous = getPreviousNode(cst, false);
        if (!previous || ![".", "::"].includes(previous.text)) {
            const owner = ast.$container;
            if (isNamedArgument(owner)) {
                return owner.$container.type?.$meta.to.target?.element ?? "error";
            }
            return;
        }

        // if it is, traverse one CST node backward again and find the reference node
        let contextCst = getPreviousNode(previous, false);
        if (!contextCst) return;
        // need to use leaf in case the found node is composite and only
        // contains the single reference node inside
        if (!isLeafCstNode(contextCst)) {
            contextCst = findLeafNodeAtOffset(contextCst, contextCst.end);
        }
        const element = contextCst?.element;
        if (!element?.$meta) return;
        return this.getElementTarget(element.$meta);
    }

    /**
     * Construct parent nodes of {@link node}, including itself, for scope
     * resolution
     * @param node AST node that scope is being constructed for
     * @param document document that contains {@link node}
     */
    protected initializeParents(node: AstNode | undefined, document: LangiumDocument): void {
        while (node) {
            this.metamodelBuilder.preLink(node, document, CancellationToken.None);
            node = node.$container;
        }
    }
}
