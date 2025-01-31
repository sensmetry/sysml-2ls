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
 * with the GNU Classpath Exception which is
 * available at https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { findNodeForKeyword } from "langium";
import * as ast from "../../generated/ast";
import {
    Doc,
    Text,
    brackets,
    breakParent,
    fill,
    getLabel,
    getPreviousNode,
    group,
    hardline,
    indent,
    join,
    keyword,
    line,
    literals,
    newLineCount,
    printInnerComments,
    softline,
    text,
} from "../../utils";
import {
    ElementMeta,
    ExpressionMeta,
    FeatureMeta,
    FeatureValueMeta,
    InheritanceMeta,
    InvariantMeta,
    MetadataFeatureMeta,
    MultiplicityMeta,
    MultiplicityRangeMeta,
    NamespaceMeta,
    RelationshipMeta,
    ResultExpressionMembershipMeta,
    TypeMeta,
} from "../KerML";
import { printChaining, printTarget } from "./edges";
import { DeclaredRelationshipFormat } from "./format-options";
import {
    DefaultElementPrinter,
    ModelPrinterContext,
    PrintModelElementOptions,
    assertKerML,
    assertSysML,
    printModelElement,
    printModelElements,
} from "./print";
import { formatPreserved, printIdentifiers, throwError } from "./utils";
import { printArgument } from "./expressions";

/**
 * Returns an array of printed metadata prefixes. Callee should handle
 * separators themselves.
 */
export function printPrefixes(
    prefixes: readonly RelationshipMeta<MetadataFeatureMeta>[],
    context: ModelPrinterContext,
    select: (prefix: RelationshipMeta<MetadataFeatureMeta>) => MetadataFeatureMeta | undefined = (
        prefix
    ): MetadataFeatureMeta | undefined => prefix.element()
): Doc[] {
    return prefixes.map((prefix) =>
        printModelElement(prefix, context, {
            printer: (prefix, context) => {
                const feature = select(prefix);
                /* istanbul ignore next */
                if (!feature)
                    throwError(
                        prefix,
                        "Invalid metadata prefix - relationship is missing target element"
                    );

                return printModelElement(feature, context, {
                    printer(prefix, context) {
                        const target = prefix.specializations(ast.FeatureTyping).at(0);

                        /* istanbul ignore next */
                        if (!target)
                            throwError(
                                prefix,
                                "Invalid metadata prefix - metadata feature is missing feature typing"
                            );

                        const doc = printModelElement(target, context, {
                            printer: (target, context) => printTarget(target, context),
                        });
                        return [
                            text(
                                target.notes.some((note) => note.localPlacement === "leading") ||
                                    getLabel(doc) === "with-leading-notes"
                                    ? "# "
                                    : "#"
                            ),
                            indent(doc),
                        ];
                    },
                });
            },
        })
    );
}

interface DeclaredRelationshipFormatInfo {
    keyword: Text;
    token?: Text;
    format: DeclaredRelationshipFormat;
    prefix?: Doc;
    groupable: boolean;
    separator?: Doc;
    merge: boolean;
}

type DeclarationRelationship = InheritanceMeta | ast.FeatureRelationship["$meta"];
type DeclarationRelationshipKey = NonNullable<ReturnType<DeclarationRelationship["ast"]>>["$type"];

function getDeclaredRelationshipFormatInfo(
    node: DeclarationRelationship,
    context: ModelPrinterContext
): DeclaredRelationshipFormatInfo {
    const type = node.nodeType() as DeclarationRelationshipKey;
    switch (type) {
        case "ConjugatedPortTyping": {
            assertSysML(context, type);
            return {
                keyword: keyword("defined by"),
                token: literals.colon,
                format: context.format.declaration_conjugated_port_typing,
                prefix: literals.tilde,
                groupable: true,
                merge: false,
            };
        }
        case "Conjugation": {
            assertKerML(context, type);
            return {
                keyword: keyword("conjugates"),
                token: literals.tilde,
                format: context.format.declaration_conjugation,
                groupable: false,
                merge: false,
            };
        }
        case "FeatureTyping": {
            return {
                keyword: keyword(context.mode === "sysml" ? "defined by" : "typed by"),
                token: literals.colon,
                format: context.format.declaration_feature_typing,
                groupable: true,
                merge: false,
            };
        }
        case "Inheritance":
            /* istanbul ignore next */
            throw new Error("Cannot format abstract 'Inheritance'");
        case "PortConjugation": {
            /* istanbul ignore next */
            throw new Error(
                "Cannot print 'PortConjugation' - is an empty string in textual syntax"
            );
        }
        case "Redefinition":
            return {
                keyword: keyword("redefines"),
                token: text(":>>"),
                format: context.format.declaration_redefinition,
                groupable: true,
                merge: false,
            };
        case "ReferenceSubsetting":
            return {
                keyword: keyword("references"),
                token: text("::>"),
                format: context.format.declaration_reference_subsetting,
                groupable: false,
                merge: false,
            };
        case "Specialization":
            return {
                keyword: keyword("specializes"),
                token: text(":>"),
                format: context.format.declaration_specialization,
                groupable: true,
                merge: false,
            };
        case "Subclassification":
            return {
                keyword: keyword("specializes"),
                token: text(":>"),
                format: context.format.declaration_subclassification,
                groupable: true,
                merge: false,
            };
        case "Subsetting":
            return {
                keyword: keyword("subsets"),
                token: text(":>"),
                format: context.format.declaration_subsetting,
                groupable: true,
                merge: false,
            };
        case "Differencing":
            assertKerML(context, type);
            return {
                keyword: keyword("differences"),
                format: { default: "keyword", fallback: "keyword" },
                groupable: true,
                merge: context.format.merge_differencing,
            };
        case "Disjoining":
            assertKerML(context, type);
            return {
                keyword: keyword("disjoint from"),
                format: { default: "keyword", fallback: "keyword" },
                groupable: true,
                merge: context.format.merge_declaration_disjoining,
            };
        case "FeatureChaining":
            // only available in KerML, in SysML these should be printed by
            // associated elements directly
            assertKerML(context, type);
            return {
                keyword: keyword("chains"),
                format: { default: "keyword", fallback: "keyword" },
                groupable: true,
                merge: context.format.merge_feature_chaining,
                separator: [softline, literals.dot],
            };
        case "Intersecting":
            assertKerML(context, type);
            return {
                keyword: keyword("intersects"),
                format: { default: "keyword", fallback: "keyword" },
                groupable: true,
                merge: context.format.merge_intersecting,
            };
        case "Unioning":
            assertKerML(context, type);
            return {
                keyword: keyword("unions"),
                format: { default: "keyword", fallback: "keyword" },
                groupable: true,
                merge: context.format.merge_unioning,
            };
        case "FeatureInverting":
            assertKerML(context, type);
            return {
                keyword: keyword("inverse of"),
                format: { default: "keyword", fallback: "keyword" },
                groupable: false,
                merge: false,
            };
        case "TypeFeaturing":
            assertKerML(context, type);
            return {
                keyword: keyword("featured by"),
                format: { default: "keyword", fallback: "keyword" },
                groupable: true,
                merge: context.format.merge_declaration_type_featuring,
            };
    }
}

function selectDeclaredRelationshipToken(
    current: DeclarationRelationship,
    info: DeclaredRelationshipFormatInfo
): Doc {
    if (!info.token) return info.keyword;

    const token = info.token;
    const fallback = info.format.fallback || "token";
    return formatPreserved(current, info.format, fallback, {
        // have to look at the previous node since type declarations may have
        // multiple keywords/tokens
        find: (node) => getPreviousNode(node, false),
        choose: {
            keyword: () => info.keyword,
            token: () => token,
            preserve: (found) => {
                switch (found?.text) {
                    case token.contents:
                        return "token";
                    case info.keyword.contents:
                        return "keyword";
                    default:
                        // most likely a separator
                        return fallback;
                }
            },
        },
    });
}

type RelationshipGroup = {
    token?: Doc;
    parts: Doc[];
};

/**
 * Prints relationships that are a part of type declaration. Returns an array of
 * once indented relationship groups. `options.skipFirstKeyword` can be used to
 * print the first relationship without a token or keyword, which can be useful
 * for e.g. connector ends.
 */
export function printDeclaredRelationships(
    node: TypeMeta,
    heritage: readonly DeclarationRelationship[],
    context: ModelPrinterContext,
    options: {
        skipFirstKeyword?: boolean;
    } = {}
): Doc[] {
    const explicit = heritage.filter((h) => !h.isImplied && h.parent() === node);
    if (explicit.length === 0) return [];

    // split all items into groups, if an item starts with a comma, it's a part
    // of a current group
    const merged: Record<string, RelationshipGroup | undefined> = {};
    const groups: RelationshipGroup[] = [];
    explicit.forEach((r, i) => {
        const type = r.nodeType() as DeclarationRelationshipKey;
        const info = getDeclaredRelationshipFormatInfo(r, context);
        const token = selectDeclaredRelationshipToken(r, info);

        let subgroup: RelationshipGroup;
        if (info.merge) {
            subgroup = merged[type] ??= { parts: [] };
        } else {
            const previous = i > 0 ? explicit[i - 1] : undefined;
            if (info.groupable && previous?.nodeType() === type) {
                subgroup = groups[groups.length - 1];
            } else {
                subgroup = { parts: [] };
            }
        }

        let target = printTarget(r, context);
        if (info.prefix) target = [info.prefix, target];

        if (subgroup.parts.length === 0) {
            groups.push(subgroup);
            if (i !== 0 || !options.skipFirstKeyword) subgroup.token = token;
        } else {
            if (info.separator) subgroup.parts.push(info.separator);
            else subgroup.parts.push(literals.comma, line);
        }
        subgroup.parts.push(target);
    });

    return groups.map((g, i) => {
        const sub = g.token
            ? group([g.token, indent([line, group(g.parts)])])
            : indent(group(g.parts));
        return i === 0 ? sub : group([line, sub]);
    });
}

/**
 * Function that joins printed children.
 * @param children model elements corresponding to `printed`
 * @param printed `chilren` printed to `Doc`, always equal size to `children`
 * @param leading unprinted children that appear before the first element in
 * `chilren`
 */
export type ChildrenJoiner = (
    children: readonly ElementMeta[],
    printed: Doc[],
    leading?: readonly ElementMeta[]
) => Doc;

export interface ChildrenBlockOptions extends Omit<PrintModelElementOptions, "previousSibling"> {
    /**
     * Result expression member that will be appended to the the children block
     * if it exists.
     */
    result?: ResultExpressionMembershipMeta;

    /**
     * If true, a space will be added before the opening bracket. This should be
     * true in nearly all cases, except when printing expression bodies.
     */
    insertSpaceBeforeBrackets: boolean;

    /**
     * If true, brackets will be printed in all cases, even when there are no
     * children and format options would replace such blocks with semicolons.
     */
    forceEmptyBrackets?: boolean;

    /**
     * If true, empty brackets will be broken.
     */
    forceBreak?: boolean;

    /**
     * Override printed semicolon.
     */
    semicolon?: Doc;

    /**
     * Override how child elements are joined. Can be used to add additional
     * contextual indentation to child elements.
     */
    join?: ChildrenJoiner;
}

/**
 * Print children block `{ ... }`.
 */
export function printChildrenBlock(
    node: ElementMeta,
    children: readonly ElementMeta[],
    context: ModelPrinterContext,
    options?: ChildrenBlockOptions
): Doc {
    if (children.length === 0 && !options?.result) {
        const innerNotes = (semi: boolean): Doc =>
            printInnerComments(
                node.notes,
                { ...context, indent: !semi },
                semi
                    ? undefined
                    : (note): Doc => (note.kind === "line" || options?.forceBreak ? hardline : line)
            );
        const asBrackets = (): Doc => {
            const body = innerNotes(false);
            let contents: Doc[] = [brackets.curly.open, brackets.curly.close];
            if (body !== literals.emptytext)
                contents = [group([contents[0], indent(line), body, contents[1]])];
            else if (options?.forceBreak) contents = [contents[0], hardline, contents[1]];
            if (options?.insertSpaceBeforeBrackets) return [literals.space, ...contents];
            return contents;
        };
        const asSemi = (): Doc => {
            const body = innerNotes(true);
            const token = options?.semicolon ?? literals.semicolon;
            if (body === literals.emptytext) return token;
            return group([token, line, body]);
        };

        if (options?.forceEmptyBrackets) return asBrackets();
        return formatPreserved(node, context.format.empty_namespace_brackets, "always", {
            find: (node) => findNodeForKeyword(node, "{"),
            choose: {
                always: asBrackets,
                never: asSemi,
                preserve: (found) => (found ? "always" : "never"),
            },
        });
    }

    const linebreak = options?.forceBreak
        ? hardline
        : context.format.bracket_spacing
          ? line
          : softline;

    const printed = printModelElements(children, context, options);
    let joined = options?.join ? options.join(children, printed) : join(linebreak, printed);

    if (options?.result) {
        const result = printModelElement(options.result, context, {
            previousSibling: children.at(-1),
            printer: options.printer,
        });

        joined = printed.length > 0 ? [joined, linebreak, result] : [joined, result];
    }

    const contents: Doc[] = [
        brackets.curly.open,
        indent([linebreak, joined]),
        linebreak,
        brackets.curly.close,
    ];

    const first = (children.at(0) ?? options?.result)?.cst();
    if (first && newLineCount(getPreviousNode(first, false), first) > 0) {
        contents.push(breakParent);
    }

    if (options?.insertSpaceBeforeBrackets) return [literals.space, contents];
    return contents;
}

function printNamespaceLeadingParts(
    node: NamespaceMeta,
    context: ModelPrinterContext,
    parts: { modifiers: Doc[]; keyword: string | undefined }
): Doc[] {
    const groups: Doc[] = [];

    // group modifiers and prefixes into a single fill
    const prefix: Doc[] = [];
    if (parts.modifiers.length > 0) {
        prefix.push(...parts.modifiers);
    }
    const prefixes = printPrefixes(node.prefixes, context);
    if (prefixes.length > 0) {
        prefix.push(...prefixes);
    }
    if (prefix.length > 0) {
        groups.push(indent(fill(join(line, prefix))));
    }

    // group keyword and identifiers into a single group
    const id: Doc[] = [];
    if (parts.keyword) {
        id.push(keyword(parts.keyword));
    }
    const identifiers = printIdentifiers(node, context);
    if (identifiers.length > 0) {
        id.push(identifiers);
    }
    if (id.length > 0) {
        groups.push(group(indent(join(literals.space, id))));
    }

    switch (groups.length) {
        case 0:
            return [];
        case 1:
            return [groups[0]];
        default:
            // group modifiers, prefixes, keyword and identifiers into a single
            // group, prefer braking around type relationships first
            return [group(join(line, groups))];
    }
}

export function printDeclaredMultiplicityRange(
    node: ExpressionMeta,
    context: ModelPrinterContext
): Doc[] {
    return [
        brackets.square.open,
        indent([softline, printModelElement(node, context)]),
        softline,
        brackets.square.close,
    ];
}

/**
 * Prints multiplicity part of `node`. Features will have `ordered` and
 * `nonunique` printed. `range` argument can be used to override multiplicity
 * expression, e.g. when printing `MultiplicityRange` in KerML.
 */
export function printMultiplicityPart(
    node: TypeMeta,
    context: ModelPrinterContext,
    range = node.multiplicity?.element()?.range?.element()
): Doc | undefined {
    const props: Text[] = [];

    let suffix: Doc[] = [];
    if (node.is(ast.Feature)) {
        if (node.isOrderedExplicitly) props.push(keyword("ordered"));
        if (node.isNonUnique) props.push(keyword("nonunique"));

        if (props.length > 1) {
            suffix = formatPreserved(node, context.format.ordered_nonunique_priority, "ordered", {
                find: (cst) => {
                    const ordered = findNodeForKeyword(cst, "ordered");
                    const nonunique = findNodeForKeyword(cst, "nonunique");
                    /* istanbul ignore next */
                    if (!ordered) return nonunique;
                    /* istanbul ignore next */
                    if (!nonunique) return ordered;
                    return ordered.offset < nonunique.offset ? ordered : nonunique;
                },
                choose: {
                    ordered: () => props,
                    nonunique: () => props.reverse(),
                    preserve: (found) => (found?.text === "ordered" ? "ordered" : "nonunique"),
                },
            });
        } else {
            suffix = props;
        }
    }

    if (!range) {
        if (suffix.length === 0) return;
        return group(join(literals.space, suffix));
    }

    const parts = printDeclaredMultiplicityRange(range, context);

    if (suffix.length > 0) {
        parts.push(literals.space, join(literals.space, suffix));
    }

    return group(parts);
}

/**
 * Returns specializations split into groups where multiplicity should be placed
 * after the first group. Return first group empty to place multiplicity as the
 * first element.
 */
export type SpecializationGrouper<T extends TypeMeta = TypeMeta> = (
    node: T
) => readonly (readonly InheritanceMeta[])[];

export function defaultSpecializationGrouper(context: ModelPrinterContext): SpecializationGrouper {
    return (node) => {
        let placement = context.format.multiplicity_placement;
        if (
            (!node.multiplicity &&
                (!node.is(ast.Feature) || !node.isNonUnique || !node.isOrdered)) ||
            (context.mode === "kerml" && node.is(ast.Type) && !node.is(ast.Feature))
        )
            // avoid splitting specializations if there is no multiplicity part
            // in KerML, non-feature types always have multiplicity as before
            // the specialization part
            placement = "first";

        const specializations = node.specializations().filter((s) => !s.isImplied);

        switch (placement) {
            case "first-specialization":
                if (specializations.length > 0)
                    return [[specializations[0]], specializations.slice(1)];
            // fallthrough
            case "first":
                return [[], specializations];

            case "last":
                return [specializations, []];
        }
    };
}

/**
 * Prints type specialization part, including multiplicity
 * ({@link printMultiplicityPart}). Use `options.auto` to select multiplicity
 * placement, i.e. `first` if an equivalent element in textual syntax started
 * with multiplicity or a specialization, and `last` otherwise.
 */
export function printSpecializationPart<T extends TypeMeta>(
    node: T,
    context: ModelPrinterContext,
    options: {
        skipFirstKeyword?: boolean;
        specializations: SpecializationGrouper<T>;
        ignoreMultiplicity?: boolean;
    }
): Doc[] {
    const multi = options.ignoreMultiplicity ? undefined : printMultiplicityPart(node, context);

    let skipFirstKeyword = Boolean(options.skipFirstKeyword);
    const groups = options.specializations(node).map((group) => {
        const printed = printDeclaredRelationships(node, group, context, { skipFirstKeyword });
        // skip should carry over to the first non-empty group
        skipFirstKeyword &&= printed.length === 0;
        return printed;
    });

    // cannot remove empty groups yet as multiplicity will be attached to either
    // one
    if (groups.length === 0 || groups.every((g) => g.length === 0)) {
        if (multi) return [indent(multi)];
        return [];
    }

    // attaching multiplicity to the first or last specialization group since it
    // will simply be as short as `[<number>]` in most cases, there's no reason
    // to put it on a separate line.
    if (multi) {
        const lhs = groups[0];
        if (lhs.length === 0) {
            groups[1][0] = [multi, line, groups[1][0]];
        } else {
            lhs[lhs.length - 1] = [lhs[lhs.length - 1], line, multi];
        }
    }

    return groups
        .filter((g) => g.length > 0)
        .map((g, i) => {
            const contents = g.map((sub) => group(sub));
            return indent(i === 0 ? contents : [line, contents]);
        });
}

export interface NamespacePrinterParts {
    /**
     * Array of ordered namespace modifiers without any line breaks, e.g.
     * `[keyword("abstract")]`
     */
    modifiers: Doc[];

    /**
     * Optional keyword of the namespace, can be skipped for e.g. `Feature` or
     * `Usage`.
     */
    keyword: string | undefined;

    /**
     * Additional suffix to append to the declaration, e.g. printed
     * `FeatureValue`. Note that the suffix will be appended as is so callee
     * should handle any leading line breaks.
     */
    appendToDeclaration?: (declaration: Doc[]) => void;

    /**
     * If true, empty children blocks will always be printed as `{}`
     */
    forceBrackets?: boolean;

    /**
     * Result expression member that will be appended at the end of the children
     * block.
     * @see {@link printChildrenBlock}
     */
    result?: ResultExpressionMembershipMeta;

    /**
     * If true, children block will not be printed.
     */
    skipChildren?: boolean;

    /**
     * Override for how children elements are joined together.
     */
    join?: ChildrenJoiner;

    /**
     * If true, children block will always break
     */
    forceBreakChildren?: boolean;
}

export interface TypePrinterOptions<T extends TypeMeta = TypeMeta>
    extends Pick<
        NamespacePrinterParts,
        "forceBrackets" | "appendToDeclaration" | "skipChildren" | "join" | "forceBreakChildren"
    > {
    skipFirstSpecializationKeyword?: boolean;
    specializations?: SpecializationGrouper<T>;
}

export type NamespacePrinterOptions<T extends NamespaceMeta = NamespaceMeta> =
    NamespacePrinterParts & (T extends TypeMeta ? TypePrinterOptions<T> : object);

/**
 * Default printer for namespaces. Should be configurable enough for any
 * namespace element.
 */
export function printGenericNamespace<T extends NamespaceMeta>(
    node: T,
    context: ModelPrinterContext,
    parts: NamespacePrinterOptions<T>
): Doc {
    let declaration = printNamespaceLeadingParts(node, context, parts);

    const pushGroup = (doc: Doc, linebreak: Doc = indent(line)): void => {
        if (declaration.length > 0) declaration.push(linebreak);
        declaration.push(doc);
    };

    // print heritage and other relationships in declaration
    if (node.is(ast.Type)) {
        const options = parts as TypePrinterOptions;
        const specialization = printSpecializationPart(node, context, {
            specializations: options.specializations ?? defaultSpecializationGrouper(context),
            skipFirstKeyword: options.skipFirstSpecializationKeyword,
        });

        const other = printDeclaredRelationships(node, node.typeRelationships, context);
        if (other.length > 0) {
            const relationships = indent(group(other));
            if (specialization.length > 0) specialization.push(indent(line));
            specialization.push(relationships);
        }

        if (specialization.length > 0) {
            pushGroup(group(specialization));
        }
    }

    if (parts.appendToDeclaration) {
        if (declaration.length > 0) declaration = [group(declaration)];
        parts.appendToDeclaration(declaration);
    }
    if (parts.skipChildren === true) return group(declaration);

    const children = printChildrenBlock(node, node.children, context, {
        result: parts.result,
        insertSpaceBeforeBrackets: declaration.length > 0,
        forceEmptyBrackets: parts.forceBrackets,
        forceBreak: parts.forceBreakChildren,
        join: parts.join,
    });

    return [group(declaration), children];
}

/**
 * Default printer for `Namespace`, `Package` and `LibraryPackage`.
 */
export function printNonTypeNamespace(
    modifiers: string | undefined,
    kw: string,
    node: NamespaceMeta,
    context: ModelPrinterContext
): Doc {
    return printGenericNamespace(node, context, {
        modifiers: modifiers ? [keyword(modifiers)] : [],
        keyword: kw,
    });
}

/**
 * Default printed for KerML types that are not features.
 */
export function printType<T extends TypeMeta>(
    modifiers: Doc[] | "auto",
    kw: string,
    node: T & { result?: ResultExpressionMembershipMeta },
    context: ModelPrinterContext,
    options: TypePrinterOptions<T> = {}
): Doc {
    return printGenericNamespace<TypeMeta>(node, context, <NamespacePrinterOptions<TypeMeta>>{
        modifiers:
            modifiers === "auto" ? (node.isAbstract ? [keyword("abstract")] : []) : modifiers,
        keyword: node.isSufficient ? `${kw} all` : kw,
        result: node.result,
        ...options,
    });
}

/**
 * Returns an array of feature modifiers for KerML syntax. Can be used with
 * {@link printGenericFeature} and {@link printNonTypeNamespace}.
 */
export function kermlFeatureModifiers(node: FeatureMeta): Doc[] {
    const modifiers: Doc[] = [];

    if (node.explicitDirection !== "none") modifiers.push(keyword(node.explicitDirection));
    if (node.isAbstract) modifiers.push(keyword("abstract"));

    // portion implies composite so print it first
    if (node.isPortion) modifiers.push(keyword("portion"));
    else if (node.isComposite) modifiers.push(keyword("composite"));
    if (node.isReadonly) modifiers.push(keyword("readonly"));
    if (node.isDerived) modifiers.push(keyword("derived"));
    if (node.isEnd) modifiers.push(keyword("end"));

    return modifiers;
}

export interface FeaturePrinterOptions<T extends FeatureMeta = FeatureMeta>
    extends Omit<TypePrinterOptions<T>, "appendToDeclaration"> {
    appendToDeclaration: ((declaration: Doc[]) => void) | undefined | "default";
}

export function featureValueAppender(
    node: FeatureMeta,
    context: ModelPrinterContext,
    printer: (node: FeatureValueMeta, context: ModelPrinterContext) => Doc = DefaultElementPrinter
): (decl: Doc[]) => void {
    return (decl) => {
        if (!node.value) return;
        if (decl.length > 0) decl.push(literals.space);
        decl.push(printModelElement(node.value, context, { printer }));
    };
}

/**
 * Generic printer for feature elements.
 *
 * @param modifiers array of ordered feature modifiers
 * @param kw feature keyword, may be skipped in certain cases
 * @param node
 * @param context
 * @param appendToDeclaration declaration suffix override, `"default"` will
 * print feature value if one exists
 */
export function printGenericFeature<T extends FeatureMeta>(
    modifiers: Doc[],
    kw: string | undefined,
    node: T & { result?: ResultExpressionMembershipMeta },
    context: ModelPrinterContext,
    options: TypePrinterOptions<T> = { appendToDeclaration: featureValueAppender(node, context) }
): Doc {
    return printGenericNamespace<FeatureMeta>(node, context, <NamespacePrinterOptions<FeatureMeta>>{
        modifiers,
        keyword: kw,
        result: node.result,
        ...options,
    });
}

/**
 * Generic printer for KerML features.
 * @see {@link printGenericFeature}
 */
export function printKerMLFeature<T extends FeatureMeta>(
    kw: string | undefined,
    node: T & { result?: ResultExpressionMembershipMeta },
    context: ModelPrinterContext,
    options: TypePrinterOptions<T> = { appendToDeclaration: featureValueAppender(node, context) }
): Doc {
    assertKerML(context, node.nodeType());
    return printGenericFeature(
        kermlFeatureModifiers(node),
        node.isSufficient ? (kw ? `${kw} all` : "all") : kw,
        node,
        context,
        options
    );
}

export function printFeature(node: FeatureMeta, context: ModelPrinterContext): Doc {
    const owner = node.owner();
    if (owner) {
        if (
            node.parent()?.nodeType() == ast.ParameterMembership &&
            owner.is(ast.InvocationExpression)
        ) {
            return printArgument(node, context);
        }
        switch (owner.nodeType()) {
            case ast.FeatureChainExpression:
                return printChaining(node, context);
            case ast.OperatorExpression: {
                const typing = node.specializations(ast.FeatureTyping)[0];
                /* istanbul ignore next */
                if (!typing)
                    throwError(
                        node,
                        "Invalid operator expression argument feature - missing feature typing"
                    );
                return printTarget(typing, context);
            }
            case ast.FeatureReferenceExpression: {
                if (node.parent()?.nodeType() === ast.ReturnParameterMembership)
                    // self reference expression
                    return literals.emptytext;
                break;
            }
            default:
                break;
        }
    }

    const kw = formatPreserved(node, context.format.feature_keyword, "always", {
        find: (node) => findNodeForKeyword(node, "feature"),
        choose: {
            always: () => "feature",
            as_needed: () => {
                if (
                    node.prefixes.length > 0 ||
                    node.isSufficient ||
                    node.declaredName ||
                    node.declaredShortName ||
                    node.specializations().some((s) => !s.isImplied)
                ) {
                    // feature contains FeatureDeclaration fragment or has some
                    // prefixes, don't need to print keyword
                    return undefined;
                }

                return "feature";
            },
            preserve: (found) => (found ? "always" : "as_needed"),
        },
    });

    return printKerMLFeature(kw, node, context);
}

export function printInvariant(node: InvariantMeta, context: ModelPrinterContext): Doc {
    const kw = node.isNegated
        ? literals.false
        : formatPreserved(node, context.format.invariant_true_keyword, "always", {
              find: (node) => findNodeForKeyword(node, "true"),
              choose: {
                  always: () => literals.true,
                  never: () => literals.emptytext,
                  preserve: (found) => (found ? "always" : "never"),
              },
          });
    return printKerMLFeature(kw.contents ? `inv ${kw.contents}` : "inv", node, context);
}
export function printMultiplicity(node: MultiplicityMeta, context: ModelPrinterContext): Doc {
    assertKerML(context, node.nodeType());
    return [
        group([
            group([
                keyword("multiplicity"),
                indent(printIdentifiers(node, context, { leading: literals.space })),
            ]),
            indent([[line, ...printDeclaredRelationships(node, node.specializations(), context)]]),
        ]),
        printChildrenBlock(node, node.children, context, { insertSpaceBeforeBrackets: true }),
    ];
}

export function printMultiplicityRange(
    node: MultiplicityRangeMeta,
    context: ModelPrinterContext
): Doc {
    assertKerML(context, node.nodeType());
    return [
        group([
            keyword("multiplicity"),
            indent(printIdentifiers(node, context, { leading: literals.space })),
            literals.space,
            indent(
                printMultiplicityPart(node, context, node.range?.element()) ?? literals.emptytext
            ),
        ]),
        printChildrenBlock(node, node.children, context, { insertSpaceBeforeBrackets: true }),
    ];
}

export function printNamespace(node: NamespaceMeta, context: ModelPrinterContext): Doc {
    if (!node.parent()) {
        // root namespace
        return join(hardline, printModelElements(node.children, context));
    }

    assertKerML(context, node.nodeType());
    return printNonTypeNamespace(undefined, "namespace", node, context);
}
