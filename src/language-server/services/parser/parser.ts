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
    CstNode,
    isAstNode,
    LangiumParser,
    Mutable,
    streamContents,
    streamCst,
} from "langium";
import { createParser } from "langium/lib/parser/parser-builder-base";
import { CstNodeBuilder } from "langium/lib/parser/cst-node-builder";
import {
    ActionUsage,
    OperatorExpression,
    SelfReferenceExpression,
    SysMlAstType,
} from "../../generated/ast";
import { typeIndex, TypeMap } from "../../model/types";
import { SysMLDefaultServices } from "../services";
import { cstNodeRuleName } from "../../utils/common";
import { compareRanges } from "../../utils/ast-util";
import { isRuleCall } from "langium/lib/grammar/generated/ast";

const ClassificationTestOperator = ["istype", "hastype", "@", "as"];

/**
 * The grammar rules that calls `SelfReferenceExpression` rule breaks parsing
 * with Langium, resolve it here.
 */
function fixOperatorExpression(expr: OperatorExpression, services: SysMLDefaultServices): void {
    if (expr.args.length === 1 && ClassificationTestOperator.includes(expr.operator)) {
        expr.args.forEach((arg, index) => ((arg as Mutable<AstNode>).$containerIndex = index + 1));
        // Langium discards unused explicit union types
        (expr.args as Array<AstNode>).unshift(
            services.shared.AstReflection.createNode(SelfReferenceExpression, {
                $container: expr,
                $containerProperty: "args",
                $containerIndex: 0,
            })
        );
    }
}

/**
 * Find a first CST node with a rule named {@link name} and replace its element with {@link element}
 * @param node Root CST node
 * @param name Rule name to change element for
 * @param element New element
 */
function fixCstNode(node: CstNode, name: string, element: AstNode): void {
    for (const cst of streamCst(node)) {
        if (cstNodeRuleName(cst) === name) {
            (cst as Mutable<CstNode>).element = element;
            return;
        }
    }
}

/**
 * Fragments that construct nodes (i.e. with {[infer] ...}) construct their
 * nodes but they are not reachable from the AST afterwards. It seems that the
 * constructed nodes are spread onto the nodes from the parent rules but the CST
 * nodes are not updated to reflect that. This causes LSP services to find
 * these malformed nodes as they use CST to find target nodes. Fix that here.
 */
function fixSubaction(node: ActionUsage): void {
    if (!node.actionKind || !node.$cstNode) return;

    fixCstNode(node.$cstNode, "PerformedActionUsage", node);
}

type ProcessingFunction<T extends AstNode = AstNode> = (
    node: T,
    services: SysMLDefaultServices
) => void;
type ProcessingMap = { [K in keyof SysMlAstType]?: ProcessingFunction<SysMlAstType[K]> };

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
            ActionUsage: fixSubaction,
        };

        this.postprocessingMap = typeIndex.expandToDerivedTypes(
            map as TypeMap<SysMlAstType, ProcessingFunction>
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
