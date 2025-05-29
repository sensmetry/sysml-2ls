/********************************************************************************
 * Copyright (c) 2022-2025 Sensmetry UAB and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License, v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import {
    Doc,
    appendFill,
    brackets,
    group,
    indent,
    join,
    keyword,
    line,
    literals,
    unwrapIndent,
    softline,
    text,
    indentIfBreak,
} from "../../utils";
import {
    BindingConnectorMeta,
    ConnectorMeta,
    EndFeatureMembershipMeta,
    FeatureMeta,
    ItemFeatureMeta,
    ItemFlowEndMeta,
    ItemFlowMeta,
    ParameterMembershipMeta,
    SuccessionMeta,
} from "../KerML";
import { PreservableFormatting } from "./format-options";
import { ModelPrinterContext, printModelElement, printModelElements } from "./print";
import {
    computeHighlighting,
    formatPreserved,
    hasFeatureDeclaration,
    printIdentifier,
    printIdentifiers,
    selectDeclarationKeyword,
    shouldIgnoreRef,
    throwError,
} from "./utils";
import * as ast from "../../generated/ast";
import { findNodeForKeyword } from "langium";
import { printTarget } from "./edges";
import {
    printSpecializationPart,
    defaultSpecializationGrouper,
    printGenericFeature,
    kermlFeatureModifiers,
    TypePrinterOptions,
    featureValueAppender,
    printKerMLOwnedCrossFeature,
    printOwnedCrossMultiplicityPart,
} from "./namespaces";
import { BasicMetamodel } from "../metamodel";
import {
    occurrenceUsageModifiers,
    sysmlUsageModifiers,
    printSysmlOwnedCrossFeature,
} from "./definition-usages";
import {
    AllocationUsageMeta,
    BindingConnectorAsUsageMeta,
    ConnectionUsageMeta,
    ConnectorAsUsageMeta,
    FlowConnectionUsageMeta,
    InterfaceUsageMeta,
} from "../SysML";
import { actionBodyJoiner } from "./actions";

type EndMemberArray = readonly EndFeatureMembershipMeta[] | readonly ParameterMembershipMeta[];
type EndMember = EndMemberArray[number];

export function printEndReferenceSubsetting(
    node: EndMember,
    context: ModelPrinterContext,
    kind = "connector end"
): { target: FeatureMeta; doc: Doc } {
    const target = node.element();

    /* istanbul ignore next */
    if (!target) throwError(node, `Invalid ${kind} member - missing target element`);

    const ref = target.specializations(ast.ReferenceSubsetting).at(0);

    /* istanbul ignore next */
    if (!ref) throwError(target, `Invalid ${kind} feature - missing reference subsetting`);

    return { target, doc: printTarget(ref, context) };
}

/**
 * Printer for connector end members inside declarations.
 * @see {@link printItemFlowEndMember}
 */
export function printConnectorEndMember(node: EndMember, context: ModelPrinterContext): Doc {
    const { target, doc } = printEndReferenceSubsetting(node, context);

    const parts: Doc[] = [];
    const heritage: Doc[] = [];

    const cross = printOwnedCrossMultiplicityPart(target, context);
    if (cross) {
        parts.push(cross);
        parts.push(literals.space);
    }

    if (target.declaredName) {
        parts.push(
            printIdentifier(target.declaredName, {
                semantic: context.highlighting ? computeHighlighting(target) : {},
                restricted: context.keywords,
            })
        );

        heritage.push(
            line,
            formatPreserved(target, context.format.declaration_reference_subsetting, "token", {
                find: (node) => findNodeForKeyword(node, "::>"),
                choose: {
                    keyword: () => keyword("references "),
                    token: () => text("::> "),
                    preserve: (found) => (found ? "token" : "keyword"),
                },
            })
        );
    }

    heritage.push(doc);

    return [...parts, indent(group(heritage))];
}

export type EndMemberPrinter = typeof printConnectorEndMember;

/**
 * Default printer for item flow ends.
 */
export function printItemFlowEnd(node: ItemFlowEndMeta, context: ModelPrinterContext): Doc {
    const ref = node.specializations(ast.ReferenceSubsetting).at(0);
    const member = node.children.find(BasicMetamodel.is(ast.FeatureMembership))?.element();

    /* istanbul ignore next */
    if (!member) throwError(node, "Invalid item flow end - missing item flow feature member");
    const memberRedef = member.specializations(ast.Redefinition).find((r) => !r.isImplied);

    /* istanbul ignore next */
    if (!memberRedef) throwError(member, "Invalid item flow feature member - missing redefinition");

    if (!ref) {
        return printTarget(memberRedef, context);
    }

    return appendFill(unwrapIndent(printTarget(ref, context)), softline, [
        literals.dot,
        printTarget(memberRedef, context),
    ]);
}

/**
 * Printer for item flow end members inside declarations.
 * @see {@link printConnectorEndMember}
 */
export function printItemFlowEndMember(node: EndMember, context: ModelPrinterContext): Doc {
    const target = node.element();

    /* istanbul ignore next */
    if (!target) throwError(node, "Invalid connector end member - missing target element");

    /* istanbul ignore next */
    if (!target.is(ast.ItemFlowEnd))
        throwError(
            node,
            `Invalid connector end member - bad target element type (${target.nodeType()}`
        );
    return printItemFlowEnd(target, context);
}

export interface BinaryEndsPrinterOptions {
    /**
     * Keyword leading the first end options, if not set nothing is printed.
     */
    source: {
        /**
         * Keyword leading the first end.
         */
        keyword: string;
        /**
         * Format option associated with `keyword`.
         */
        format: PreservableFormatting<"always" | "as_needed">;
    };

    /**
     * Keyword leading the second end member.
     */
    binding: Doc;

    /**
     * Override for default end member printer.
     * @default printConnectorEndMember
     */
    printer?: EndMemberPrinter;
}

export const SourceFormatAlways = {
    default: "always",
    fallback: "always",
} as const;

/**
 * Printer for binary end member declaration.
 *
 * @param ends array of end members of length 2
 */
export function printBinaryEnds(
    node: FeatureMeta,
    ends: EndMemberArray,
    context: ModelPrinterContext,
    options: {
        source: {
            keyword: string;
            format: PreservableFormatting<"always" | "as_needed">;
        };
        binding: Doc;
        printer?: EndMemberPrinter;
    }
): Doc {
    const printer = options.printer ?? printConnectorEndMember;
    const [src, dst] = ends.map((end) => printModelElement(end, context, { printer }));

    const format = options.source.format;
    const kw = options.source.keyword;
    const sourceKeyword = format
        ? formatPreserved(node, format, "always", {
              find: (node) => findNodeForKeyword(node, kw),
              choose: {
                  always: () => [keyword(kw), literals.space],
                  as_needed: () =>
                      hasFeatureDeclaration(node) ? [keyword(kw), literals.space] : [],
                  preserve: (found) => (found ? "always" : "as_needed"),
              },
          })
        : [keyword(kw), literals.space];

    return group([
        group([...sourceKeyword, indent(src)]),
        group([line, options.binding, literals.space, indent(dst)]),
    ]);
}

/**
 * Default printer for nary end member declaration.
 */
export function printNaryEnds(
    ends: EndMemberArray,
    context: ModelPrinterContext,
    printer = printConnectorEndMember
): Doc {
    return group([
        brackets.round.open,
        indent([
            softline,
            join([literals.comma, line], printModelElements(ends, context, { printer })),
        ]),
        softline,
        brackets.round.close,
    ]);
}

export interface ConnectorPrinterOptions
    extends BinaryEndsPrinterOptions,
        Pick<TypePrinterOptions, "join"> {
    /**
     * Connector end member declaration format.
     */
    format: PreservableFormatting<"always" | "never"> | "binary" | "nary";

    /**
     * Doc to prepend to nary connector parts, e.g. `keyword("connect")` for
     * connection usages.
     */
    naryPrefix?: Doc;

    /**
     * Additional doc to prepend to the end member declaration. Callee should
     * prepend any leading whitespace.
     */
    suffix?: Doc | ((declaration: Doc[]) => void);

    ends?: EndMemberArray;
}

/**
 * Printer for generic connectors.
 */
export function printGenericConnector(
    modifiers: Doc[],
    kw: string | undefined,
    crossFeature: Doc | undefined,
    node: ConnectorMeta,
    context: ModelPrinterContext,
    options: ConnectorPrinterOptions
): Doc {
    const ends = options.ends ?? node.ends;
    const suffix = options.suffix;
    const push_suffix = (decl: Doc[]): void => {
        if (!suffix) {
            return;
        }
        typeof suffix == "function" ? suffix(decl) : decl.push(suffix);
    };

    if (ends.length === 0) {
        return printGenericFeature(modifiers, kw, crossFeature, node, context, {
            appendToDeclaration: push_suffix,
        });
    }

    /* istanbul ignore next */
    if (ends.length === 1)
        throwError(node, `Invalid ${node.nodeType()} - must have at least 2 ends`);

    const printNary = (): Doc => {
        return printGenericFeature(modifiers, kw, crossFeature, node, context, {
            appendToDeclaration(decl) {
                push_suffix(decl);

                const linebreak = indent(group(line, { id: "nary-ends" }));
                if (decl.length > 0) decl.push(options.naryPrefix ? literals.space : linebreak);
                if (options.naryPrefix) decl.push(options.naryPrefix, linebreak);

                decl.push(
                    indentIfBreak(printNaryEnds(ends, context, options.printer), {
                        groupId: "nary-ends",
                    })
                );
            },
            join: options.join,
        });
    };

    const printBinary = (): Doc => {
        return printGenericFeature(modifiers, kw, crossFeature, node, context, {
            appendToDeclaration(decl) {
                push_suffix(decl);
                if (decl.length > 0) decl.push(indent(line));

                decl.push(indent(printBinaryEnds(node, ends, context, options)));
            },
            join: options.join,
        });
    };

    if (options.format === "binary") return printBinary();
    if (options.format === "nary") return printNary();
    if (ends.length > 2) return printNary();

    return formatPreserved(node, options.format, "always", {
        find: (node) => findNodeForKeyword(node, "("),
        choose: {
            always: printBinary,
            never: printNary,
            preserve: (found) => (found ? "never" : "always"),
        },
    });
}

export function printKerMLConnector(
    kw: string,
    node: ConnectorMeta,
    context: ModelPrinterContext,
    options: ConnectorPrinterOptions
): Doc {
    return printGenericConnector(
        kermlFeatureModifiers(node),
        node.isSufficient ? `${kw} all` : kw,
        printKerMLOwnedCrossFeature(node, context),
        node,
        context,
        options
    );
}

/**
 * Default printer for item features.
 */
export function printItemFeature(node: ItemFeatureMeta, context: ModelPrinterContext): Doc {
    const parts = printIdentifiers(node, context);

    const specialization = printSpecializationPart(node, context, {
        skipFirstKeyword:
            // shorthand requires no identifiers
            parts.length === 0 &&
            // shorthand requires no feature value
            !node.value &&
            // shorthand requires a single specialization
            node.specializations().reduce((count, s) => (s.isImplied ? count : count + 1), 0) ===
                1 &&
            // shorthand requires a single feature typing
            node.specializations(ast.FeatureTyping).filter((s) => !s.isImplied).length === 1,
        specializations: defaultSpecializationGrouper(context),
    });

    if (specialization.length > 0) {
        if (parts.length > 0) parts.push(indent(line));
        parts.push(...specialization);
    }

    if (node.value) {
        parts.push(literals.space, printModelElement(node.value, context));
    }

    return group(parts);
}

/**
 * Default printer for item flows.
 */
export function printGenericItemFlow(
    modifiers: Doc[],
    kw: string,
    crossFeature: Doc | undefined,
    node: ItemFlowMeta,
    context: ModelPrinterContext,
    options: Pick<TypePrinterOptions, "join"> & {
        sourceFormat: PreservableFormatting<"always" | "as_needed">;
        printer?: EndMemberPrinter;
        ends?: EndMemberArray;
    }
): Doc {
    const { printer = printItemFlowEndMember } = options;
    const suffix: Doc[] = [];
    if (node.value) suffix.push(indent([literals.space, printModelElement(node.value, context)]));
    if (node.item) {
        suffix.push(indent([line, keyword("of "), printModelElement(node.item, context)]));
    }

    return printGenericConnector(modifiers, kw, crossFeature, node, context, {
        format: "binary",
        binding: keyword("to"),
        printer,
        ends: options.ends,
        source: {
            keyword: "from",
            format: options.sourceFormat,
        },
        suffix: suffix.length > 0 ? suffix.map((doc) => group(doc)) : undefined,
        join: options.join,
    });
}

export function printItemFlow(
    kw: string,
    node: ItemFlowMeta,
    context: ModelPrinterContext,
    options: {
        sourceFormat: PreservableFormatting<"always" | "as_needed">;
        printer?: EndMemberPrinter;
        ends?: EndMemberArray;
    }
): Doc {
    return printGenericItemFlow(
        kermlFeatureModifiers(node),
        kw,
        printKerMLOwnedCrossFeature(node, context),
        node,
        context,
        options
    );
}

export function printGenericFlowConnectionUsage(
    kw: string,
    node: FlowConnectionUsageMeta,
    context: ModelPrinterContext,
    options: {
        sourceFormat: PreservableFormatting<"always" | "as_needed">;
        printer?: EndMemberPrinter;
        ends?: EndMemberArray;
    }
): Doc {
    return printGenericItemFlow(
        occurrenceUsageModifiers(
            node,
            shouldIgnoreRef(node, context.format.connection_usage_reference_keyword)
        ),
        kw,
        printSysmlOwnedCrossFeature(node, context),
        node,
        context,
        {
            ...options,
            join: actionBodyJoiner(),
        }
    );
}

export function printFlowConnectionUsage(
    node: FlowConnectionUsageMeta,
    context: ModelPrinterContext
): Doc {
    // can't actually infer if meant message or flow without any ends so
    // have to check CST
    const cst = node.cst();
    const isMessage =
        node.isMessageConnection ||
        (node.ends.length === 0 && cst && findNodeForKeyword(cst, "message"));
    if (isMessage)
        return printGenericFlowConnectionUsage("message", node, context, {
            printer(node, context) {
                return printEndReferenceSubsetting(node, context).doc;
            },
            ends: node.messages,
            sourceFormat: context.format.flow_connection_usage_from_keyword,
        });

    return printGenericFlowConnectionUsage("flow", node, context, {
        sourceFormat: context.format.flow_connection_usage_from_keyword,
    });
}

export function printConnectorAsUsage(
    kw: string | undefined,
    node: ConnectorAsUsageMeta,
    context: ModelPrinterContext,
    options: ConnectorPrinterOptions
): Doc {
    return printGenericConnector(
        sysmlUsageModifiers(
            node,
            shouldIgnoreRef(node, context.format.connector_as_usage_reference_keyword)
        ),
        kw,
        printSysmlOwnedCrossFeature(node, context),
        node,
        context,
        {
            ...options,
            join: actionBodyJoiner(),
        }
    );
}

export function printAllocationUsage(node: AllocationUsageMeta, context: ModelPrinterContext): Doc {
    return printConnectorAsUsage(
        selectDeclarationKeyword(node, "allocation", context.format.allocation_usage_keyword),
        node,
        context,
        {
            binding: keyword("to"),
            format: context.format.binary_allocation_usages,
            naryPrefix: keyword("allocate"),
            source: {
                keyword: "allocate",
                format: SourceFormatAlways,
            },
            printer: printConnectorEndMember,
        }
    );
}

export function printBindingConnector(
    node: BindingConnectorMeta,
    context: ModelPrinterContext
): Doc {
    return printKerMLConnector("binding", node, context, {
        format: context.format.binary_binding_connectors,
        binding: text("="),
        printer: printConnectorEndMember,
        source: {
            keyword: "of",
            format: context.format.binary_binding_connector_of_keyword,
        },
        suffix: undefined,
    });
}

export function printBindingConnectorAsUsage(
    node: BindingConnectorAsUsageMeta,
    context: ModelPrinterContext
): Doc {
    return printConnectorAsUsage(
        selectDeclarationKeyword(
            node,
            "binding",
            context.format.binding_connector_as_usage_keyword
        ),
        node,
        context,
        {
            format: "binary",
            binding: text("="),
            printer: printConnectorEndMember,
            source: {
                keyword: "bind",
                format: SourceFormatAlways,
            },
            suffix: undefined,
        }
    );
}

export function printConnectionUsage(node: ConnectionUsageMeta, context: ModelPrinterContext): Doc {
    return printConnectorAsUsage(
        selectDeclarationKeyword(node, "connection", context.format.connection_usage_keyword),
        node,
        context,
        {
            binding: keyword("to"),
            format: context.format.binary_connection_usages,
            naryPrefix: keyword("connect"),
            source: {
                keyword: "connect",
                format: SourceFormatAlways,
            },
            printer: printConnectorEndMember,
            suffix: node.value ? featureValueAppender(node, context) : undefined,
        }
    );
}

export function printConnector(node: ConnectorMeta, context: ModelPrinterContext): Doc {
    return printKerMLConnector("connector", node, context, {
        format: context.format.binary_connectors,
        binding: text("to"),
        printer: printConnectorEndMember,
        source: {
            keyword: "from",
            format: context.format.binary_connectors_from_keyword,
        },
        suffix: node.value ? featureValueAppender(node, context) : undefined,
    });
}

export function printInterfaceUsage(node: InterfaceUsageMeta, context: ModelPrinterContext): Doc {
    const connect = selectDeclarationKeyword(
        node,
        "connect",
        context.format.interface_usage_connect_keyword
    );
    return printConnectorAsUsage("interface", node, context, {
        binding: keyword("to"),
        format: context.format.binary_interface_usages,
        naryPrefix: connect ? keyword(connect) : undefined,
        source: {
            keyword: "connect",
            format: context.format.interface_usage_connect_keyword,
        },
        printer: printConnectorEndMember,
    });
}

export function printSuccession(node: SuccessionMeta, context: ModelPrinterContext): Doc {
    return printKerMLConnector("succession", node, context, {
        format: context.format.binary_successions,
        binding: text("then"),
        printer: printConnectorEndMember,
        source: {
            keyword: "first",
            format: context.format.binary_succession_first_keyword,
        },
        suffix: undefined,
    });
}
