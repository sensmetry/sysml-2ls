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

import { AstNode, CstNode, isAstNode, LangiumParser, Mutable, streamContents } from "langium";
import { createParser } from "langium/lib/parser/parser-builder-base";
import { CstNodeBuilder } from "langium/lib/parser/cst-node-builder";
import {
    ConjugatedPortDefinition,
    EndFeatureMembership,
    Expose,
    Feature,
    FeatureReferenceExpression,
    Import,
    isConjugatedPortDefinition,
    isEndFeatureMembership,
    Membership,
    MembershipExpose,
    MembershipImport,
    MembershipReference,
    NamespaceExpose,
    NamespaceImport,
    NamespaceReference,
    OperatorExpression,
    OwningMembership,
    Package,
    ParameterMembership,
    PortConjugation,
    PortDefinition,
    ReferenceUsage,
    ReturnParameterMembership,
    SuccessionAsUsage,
    TransitionFeatureMembership,
    TransitionUsage,
    TypeReference,
    Usage,
    WhileLoopActionUsage,
} from "../../generated/ast";
import { typeIndex, TypeMap } from "../../model/types";
import { SysMLDefaultServices } from "../services";
import { compareRanges } from "../../utils/ast-util";
import { isRuleCall } from "langium/lib/grammar/generated/ast";
import { SysMLType, SysMLTypeList } from "../sysml-ast-reflection";
import { erase } from "../../utils/common";
import { DefaultReference } from "../references/linker";
import { sanitizeName } from "../../model";

const ClassificationTestOperator = ["istype", "hastype", "@", "as"];

/**
 * The grammar rules that calls `SelfReferenceExpression` rule breaks parsing
 * with Langium, resolve it here.
 */
function fixOperatorExpression(expr: OperatorExpression, services: SysMLDefaultServices): void {
    if (!expr.operands) expr.operands = [];
    if (
        expr.operands.length === 0 &&
        expr.operator &&
        ClassificationTestOperator.includes(expr.operator)
    ) {
        const reflection = services.shared.AstReflection;
        const expression = reflection.createNode(FeatureReferenceExpression, {
            $container: expr,
            $containerProperty: "operands",
            $containerIndex: 0,
        });

        const member = reflection.createNode(ReturnParameterMembership, {
            $container: expression,
            $containerProperty: "expression",
        });

        reflection.createNode(Feature, {
            $container: member,
            $containerProperty: "element",
        });
    }
}

function addLoopMember(node: WhileLoopActionUsage, services: SysMLDefaultServices): void {
    // if there was `until`, the node would end with `;`, easy check here
    const expected = 2 + (node.$cstNode?.text.endsWith(";") ? 1 : 0);
    if (node.members.length !== expected) {
        const reflection = services.shared.AstReflection;
        const membership = reflection.createNode(ParameterMembership, {
            $container: node,
            $containerProperty: "members",
            $containerIndex: 0,
        });

        reflection.createNode(Usage, {
            $container: membership,
            $containerProperty: "element",
        });
    }
}

function finalizeImport(node: Import, services: SysMLDefaultServices): void {
    const type: string = node.$type;
    if (type !== Import && type !== Expose) return;
    if (node.isNamespace || node.element) {
        if (node.reference) {
            (node.reference as Mutable<AstNode>).$type = node.isNamespace
                ? NamespaceReference
                : MembershipReference;
        }
        (node as Mutable<Import>).$type = type === Expose ? NamespaceExpose : NamespaceImport;
        if (node.element && node.reference) {
            // need to reparent `node.reference`
            const pack = node.element as Package;
            const imp = services.shared.AstReflection.createNode(
                node.isNamespace ? NamespaceImport : MembershipImport,
                {
                    $container: pack,
                    $containerProperty: "imports",
                    $containerIndex: 0,
                    isRecursive: node.isRecursive,
                }
            );
            services.shared.AstReflection.assignNode(node.reference, {
                $container: imp,
                $containerProperty: "reference",
            });
            erase(node.$children, node.reference);
            delete node.reference;
        }

        // remove unneeded property
        delete node.isNamespace;
    } else {
        if (node.reference) (node.reference as Mutable<AstNode>).$type = MembershipReference;
        (node as Mutable<Import>).$type = type === Expose ? MembershipExpose : MembershipImport;
    }
}

function createConjugatedPort(node: PortDefinition, services: SysMLDefaultServices): void {
    if (!node.members) node.members = [];
    if (isConjugatedPortDefinition(node.members.at(-1)?.element)) return;

    const reflection = services.shared.AstReflection;
    const membership = reflection.createNode(OwningMembership, {
        $container: node,
        $containerProperty: "namespaceMembers",
    });

    const conjugated = reflection.createNode(ConjugatedPortDefinition, {
        $container: membership,
        $containerProperty: "element",
    });

    if (node.declaredName) conjugated.declaredName = `'~${sanitizeName(node.declaredName)}'`;
    if (node.declaredShortName)
        conjugated.declaredShortName = `'~${sanitizeName(node.declaredShortName)}'`;

    const conjugation = reflection.createNode(PortConjugation, {
        $container: conjugated,
        $containerProperty: "typeRelationships",
    });

    const ref = reflection.createNode(TypeReference, {
        $container: conjugation,
        $containerProperty: "reference",
        text: node.declaredName ?? node.declaredShortName ?? "",
    });

    ref.parts.push(<DefaultReference>{
        // we are not inside a generic grammar so we can create a resolved
        // reference
        $refText: ref.text ?? "",
        ref: node,
        _ref: node,
    });
}

function createEmptyParametersInTransitionUsage(
    node: TransitionUsage,
    services: SysMLDefaultServices
): void {
    const hasSourceTransitionMember =
        node.members[0].$type === Membership ||
        (node.members[0].$type === OwningMembership && node.members[0].element?.$type === Feature);

    // insert the first empty reference usage, always after source transition member if one exists
    const reflection = services.shared.AstReflection;
    {
        const membership = reflection.createNode(ParameterMembership, {
            $container: node,
            $containerProperty: "members",
            $containerIndex: hasSourceTransitionMember ? 1 : 0,
        });

        reflection.createNode(ReferenceUsage, {
            $container: membership,
            $containerProperty: "element",
        });
    }

    // also insert one parameter before accept usage if one exists
    const index = node.members.findIndex(
        (m) =>
            m.$type === TransitionFeatureMembership &&
            (m as TransitionFeatureMembership).kind === "accept"
    );
    if (index < 0) return;

    {
        const membership = reflection.createNode(ParameterMembership, {
            $container: node,
            $containerProperty: "members",
            $containerIndex: index,
        });

        reflection.createNode(ReferenceUsage, {
            $container: membership,
            $containerProperty: "element",
        });
    }
}

function createMissingEndsInSuccessionAsUsage(
    node: SuccessionAsUsage,
    services: SysMLDefaultServices
): void {
    // `members` may not have been created yet so it may be undefined
    const ends = (node.members as Membership[] | undefined)?.filter(isEndFeatureMembership).length;
    if (ends !== undefined && ends >= 2) return;

    const reflection = services.shared.AstReflection;
    // NB: adding CST nodes to the owning element for better validation
    // locations
    if (ends === undefined) node.members = [];

    // ends === 0 or ends === undefined -> EmptySuccessionMember rule
    // ends === 1 -> missing MultiplicitySourceEndMember
    for (const index of [0, 1].slice(0, 2 - (ends ?? 0))) {
        const member = reflection.createNode(EndFeatureMembership, {
            $container: node,
            $containerProperty: "members",
            $containerIndex: index,
            $cstNode: node.$cstNode,
        });
        reflection.createNode(Feature, {
            $container: member,
            $containerProperty: "element",
            $cstNode: node.$cstNode,
        });
    }
}

type ProcessingFunction<T extends AstNode = AstNode> = (
    node: T,
    services: SysMLDefaultServices
) => void;
type ProcessingMap = { [K in SysMLType]?: ProcessingFunction<SysMLTypeList[K]> };

/**
 * Extension of Langium CST node builder that performs some postprocessing on
 * the parsed AST nodes.
 */
export class SysMLCstNodeBuilder extends CstNodeBuilder {
    protected readonly postprocessingMap;
    protected readonly services: SysMLDefaultServices;

    constructor(services: SysMLDefaultServices) {
        super();

        this.services = services;

        // map to postprocess specific AST node types after parsing
        const map: ProcessingMap = {
            OperatorExpression: fixOperatorExpression,
            WhileLoopActionUsage: addLoopMember,
            Import: finalizeImport,
            PortDefinition: createConjugatedPort,
            TransitionUsage: createEmptyParametersInTransitionUsage,
            SuccessionAsUsage: createMissingEndsInSuccessionAsUsage,
        };

        this.postprocessingMap = typeIndex.expandToDerivedTypes(
            map as TypeMap<SysMLTypeList, ProcessingFunction>
        );
    }

    override construct(item: { $type: string | symbol | undefined; $cstNode: CstNode }): void {
        super.construct(item);
        if (typeof item.$type === "string") {
            this.postprocessingMap.get(item.$type)?.call(undefined, item as AstNode, this.services);
        }
    }
}

interface MutableLangiumParser extends Mutable<LangiumParser> {
    nodeBuilder: CstNodeBuilder;
}

/**
 * Collect and cache children AST nodes
 * @param node Node to collect children nodes for
 */
function collectChildren(node: AstNode): void {
    node.$children.length = 0;
    node.$children.push(...streamContents(node).toArray());
    node.$children.sort((a, b) => compareRanges(a.$cstNode?.range, b.$cstNode?.range));
    node.$children.forEach((child, index) => ((child as Mutable<AstNode>).$childIndex = index));
}

export class SysMLParser extends LangiumParser {
    constructor(services: SysMLDefaultServices) {
        super(services);
        (this as unknown as MutableLangiumParser).nodeBuilder = new SysMLCstNodeBuilder(services);
    }

    fillNode(node: { $type: string }): void {
        super["assignMandatoryProperties"](node);
        if (isAstNode(node)) collectChildren(node);
    }

    override construct(pop?: boolean | undefined): unknown {
        const value = super.construct(pop);
        if (isAstNode(value)) collectChildren(value);
        return value;
    }
}

/**
 * Create and finalize a Langium parser. The parser rules are derived from the
 * grammar, which is available at `services.Grammar`.
 */
export function createSysMLParser(services: SysMLDefaultServices): SysMLParser {
    const parser = prepareSysMLParser(services);
    parser.finalize();
    return parser;
}

/**
 * Create a Langium parser without finalizing it. This is used to extract more
 * detailed error information when the parser is initially validated.
 */
export function prepareSysMLParser(services: SysMLDefaultServices): SysMLParser {
    const grammar = services.Grammar;
    const lexer = services.parser.Lexer;
    const parser = new SysMLParser(services);
    return createParser(grammar, parser, lexer.definition);
}

declare module "../../generated/ast" {
    interface ElementReference {
        text?: string;
    }
}

declare module "langium" {
    interface AstNode {
        /**
         * Direct children of this AST node
         */
        readonly $children: AstNode[];

        /**
         * Index of this AST node in parent {@link $children} container
         */
        readonly $childIndex: number;
    }
}

// TODO: temporary patch until we can update Langium with https://github.com/langium/langium/pull/898
LangiumParser.prototype["assignWithoutOverride"] = function (
    target: Record<string, unknown> & { $cstNode: CstNode },
    source: object & { $cstNode?: CstNode }
): Record<string, unknown> {
    for (const [name, existingValue] of Object.entries(source)) {
        const newValue = target[name];
        if (newValue === undefined) {
            target[name] = existingValue;
        } else if (Array.isArray(newValue) && Array.isArray(existingValue)) {
            existingValue.push(...newValue);
            target[name] = existingValue;
        }
    }

    if (source.$cstNode) {
        const feature = source.$cstNode.feature;
        if (isRuleCall(feature) && feature.rule.ref && !feature.rule.ref.fragment) {
            // Merging `source` from a subrule into target, need to update the
            // source CST node to point to the merged AST node instead.
            Object.defineProperty(source.$cstNode, "element", {
                get() {
                    // lazy getter to handle cases where this subrule
                    // multiple layers deep
                    return target.$cstNode.element ?? target;
                },
                set(element: object) {
                    Object.defineProperty(source.$cstNode, "element", element);
                },
                configurable: true,
            });
        }
    }

    return target;
};
