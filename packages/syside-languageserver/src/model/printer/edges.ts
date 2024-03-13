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
    Doc,
    Text,
    Visibility,
    brackets,
    fill,
    group,
    ifBreak,
    indent,
    indentIfBreak,
    join,
    keyword,
    line,
    lineSuffixBoundary,
    literals,
    softline,
    text,
} from "../../utils";
import {
    ConjugationMeta,
    DependencyMeta,
    DisjoiningMeta,
    ElementFilterMembershipMeta,
    ElementMeta,
    FeatureInvertingMeta,
    FeatureMembershipMeta,
    FeatureMeta,
    FeatureTypingMeta,
    FeatureValueMeta,
    IMPLICIT_OPERATORS,
    MembershipImportMeta,
    MembershipMeta,
    MetadataFeatureMeta,
    NamespaceImportMeta,
    OPERATORS,
    OwningMembershipMeta,
    RedefinitionMeta,
    RelationshipMeta,
    SpecializationMeta,
    SubclassificationMeta,
    SubsettingMeta,
    TargetType,
    TypeFeaturingMeta,
} from "../KerML";
import {
    ModelPrinterContext,
    PrintModelElementOptions,
    assertKerML,
    assertSysML,
    defaultPrintNotes,
    printModelElement,
} from "./print";
import * as ast from "../../generated/ast";
import {
    formatPreserved,
    printAstReference,
    printIdentifiers,
    printReference,
    throwError,
} from "./utils";
import { DeclaredRelationshipFormat, PreservableFormatting } from "./format-options";
import {
    featureValueAppender,
    printChildrenBlock,
    printGenericFeature,
    printPrefixes,
} from "./namespaces";
import { findNodeForKeyword } from "langium";
import {
    ActorMembershipMeta,
    FramedConcernMembershipMeta,
    ObjectiveMembershipMeta,
    OccurrenceUsageMeta,
    RequirementConstraintMembershipMeta,
    RequirementVerificationMembershipMeta,
    StakeholderMembershipMeta,
    SubjectMembershipMeta,
    UsageMeta,
    VariantMembershipMeta,
    ViewRenderingMembershipMeta,
} from "../SysML";
import {
    canPrintShorthandUsage,
    printGenericOccurrenceUsage,
    printShorthandUsage,
} from "./definition-usages";
import { printCondition } from "./actions";
import { PREC_LEVELS, getOperator, precedence } from "./expressions";

/**
 * Prints `target` as a chained reference. Should only be used by feature
 * relationships.
 */
export function printChaining(target: FeatureMeta, context: ModelPrinterContext): Doc {
    const chaining = fill(
        join(
            softline,
            target.chainings.map((chaining, index) => {
                const target = defaultPrintNotes(
                    printTarget(chaining, context),
                    chaining.ast()?.targetRef?.$meta ?? chaining,
                    context
                );

                if (index === 0) return target;
                return indent([literals.dot, target]);
            })
        )
    );

    return defaultPrintNotes(chaining, target, context);
}

/**
 * Default printer for relationship ends. Prints owned ends as-is and not as
 * references unless they are features owned by inheritance relationship in
 * which case it is printed as feature chaining.
 *
 * @see {@link printReference}
 * @see {@link printChaining}
 */
export function printEdgeEnd<T extends RelationshipMeta>(
    edge: T,
    value: {
        /**
         * Target end
         */
        target?: ElementMeta;

        /**
         * Associated target AST reference
         */
        astNode?: ast.ElementReference;

        /**
         * Target kind, used in case of errors
         */
        kind: string;
    },
    context: ModelPrinterContext,
    options?: PrintModelElementOptions<TargetType<T>>
): Doc {
    const { target, astNode } = value;

    if (target?.parent() === edge) {
        if (target.is(ast.Feature) && edge.isAny(ast.Inheritance, ast.FeatureRelationship))
            // only owned targets by inheritance relationships or by inline
            // expressions are feature chainings
            return printModelElement(target, context, {
                printer: (target, context) => indent(printChaining(target, context)),
            });

        return printModelElement(target, context, options);
    }

    return printReference(target, {
        scope: edge,
        context,
        astNode,
        errorMessage: `${edge.nodeType()} is missing ${value.kind} reference`,
    });
}

/**
 * Convenience function for printing relationship target.
 * @see {@link printSource}
 * @see {@link printEdgeEnd}
 */
export function printTarget<T extends RelationshipMeta>(
    edge: T,
    context: ModelPrinterContext,
    options?: PrintModelElementOptions<TargetType<T>>
): Doc {
    return printEdgeEnd(
        edge,
        { target: edge.element(), astNode: edge.ast()?.targetRef, kind: "target" },
        context,
        options
    );
}

/**
 * Prints `edge` as its target
 * @see {@link printSource}
 * @see {@link printEdgeEnd}
 */
export function printAsTarget<T extends RelationshipMeta>(
    edge: T,
    context: ModelPrinterContext,
    options?: PrintModelElementOptions<TargetType<T>>
): Doc {
    return printModelElement(edge, context, {
        printer: (node: T, context: ModelPrinterContext, sibling?: ElementMeta): Doc =>
            printTarget(node, context, { ...options, previousSibling: sibling }),
        previousSibling: options?.previousSibling,
    });
}

/**
 * Convenience function for printing relationship source.
 * @see {@link printTarget}
 * @see {@link printEdgeEnd}
 */
export function printSource<T extends RelationshipMeta>(
    edge: T,
    context: ModelPrinterContext,
    options?: PrintModelElementOptions<TargetType<T>>
): Doc {
    return printEdgeEnd(
        edge,
        { target: edge.source(), astNode: edge.ast()?.sourceRef, kind: "source" },
        context,
        options
    );
}

/**
 * Returns `doc` with visibility prepended.
 */
export function printWithVisibility(
    edge: RelationshipMeta,
    doc: Doc,
    context: ModelPrinterContext
): Doc {
    const format = context.format.public_keyword;

    switch (edge.visibility) {
        case Visibility.public:
            return [
                formatPreserved(edge, format, {
                    find: (node) => findNodeForKeyword(node, "public"),
                    choose: {
                        always: () => keyword("public "),
                        never: () => literals.emptytext,
                        preserve: (found) => (found ? "always" : "never"),
                    },
                }),
                doc,
            ];
        case Visibility.protected:
            return [keyword("protected "), doc];
        case Visibility.private:
            return [keyword("private "), doc];
    }
}

/**
 * Default printer for generic membership.
 */
export function printGenericMembership<T extends MembershipMeta>(
    kw: string | undefined,
    node: T,
    context: ModelPrinterContext,
    options?: PrintModelElementOptions<TargetType<T>>
): Doc {
    if (!kw) return printWithVisibility(node, printTarget(node, context, options), context);
    return printWithVisibility(
        node,
        group([keyword(kw), literals.space, printTarget(node, context, options)]),
        context
    );
}

export function printMembership<T extends ElementMeta>(
    node: MembershipMeta<T>,
    context: ModelPrinterContext,
    options?: PrintModelElementOptions<T>
): Doc {
    if (node.owner()?.is(ast.InlineExpression)) {
        return indent(printTarget(node, context));
    }
    // ignore TransitionSourceMember since it should be printed directly

    if (node.isAlias) {
        return printWithVisibility(
            node,
            [
                group([
                    keyword("alias"),
                    indent(printIdentifiers(node, context, { leading: literals.space })),
                    indent([line, keyword("for "), indent(printTarget(node, context, options))]),
                ]),
                printChildrenBlock(node, node.children, context, {
                    insertSpaceBeforeBrackets: true,
                }),
            ],
            context
        );
    }

    assertSysML(context, "Membership (InitialNodeMember)");
    return [
        printGenericMembership("first", node, context, options),
        printChildrenBlock(node, node.children, context, {
            insertSpaceBeforeBrackets: true,
        }),
    ];
}

/**
 * Default printer for generic relationship members. Only used for relationships
 * related through owning memberships in KerML.
 */
export function printSourceTargetRelationship(
    kw: string,
    node: RelationshipMeta,
    context: ModelPrinterContext,
    options: {
        /**
         * Format option for `kw`, if not set `kw` is always printed
         */
        format?: PreservableFormatting<"always" | "as_needed">;
        /**
         * Keyword leading the source end.
         */
        sourceKw: Text;
        /**
         * Keyword leading the target end.
         */
        targetKw: Text;
    }
): Doc {
    assertKerML(context, node.nodeType());

    const declaration: Doc[] = [];
    const prefix = options.format
        ? formatPreserved(node, options.format, {
              find: (node) => findNodeForKeyword(node, kw),
              choose: {
                  always: () => keyword(kw),
                  as_needed: () =>
                      node.declaredName || node.declaredShortName
                          ? keyword(kw)
                          : literals.emptytext,
                  preserve: (found) => (found ? "always" : "as_needed"),
              },
          })
        : keyword(kw);

    if (prefix !== literals.emptytext) declaration.push(prefix);
    const identifiers = printIdentifiers(node, context);
    if (identifiers.length > 0) declaration.push(identifiers);

    return [
        group([
            group(join(literals.space, declaration)),
            indent(declaration.length > 0 ? line : literals.emptytext),
            indent(
                group([
                    options.sourceKw,
                    options.sourceKw.contents ? literals.space : literals.emptytext,
                    printSource(node, context),
                    line,
                    options.targetKw,
                    literals.space,
                    printTarget(node, context),
                ])
            ),
        ]),
        printChildrenBlock(node, node.children, context, { insertSpaceBeforeBrackets: true }),
    ];
}

/**
 * Returns a target end token or keyword based on formatting options.
 */
export function selectToken(
    kw: Text,
    token: Text,
    node: RelationshipMeta,
    option: DeclaredRelationshipFormat
): Text {
    return formatPreserved(node, option, {
        find: (node) => findNodeForKeyword(node, token.contents),
        choose: {
            keyword: () => kw,
            token: () => token,
            preserve: (found) => (found ? "token" : "keyword"),
        },
    });
}

/**
 * Default printer for dependencies.
 */
export function printDependency(node: DependencyMeta, context: ModelPrinterContext): Doc {
    // prefixes are source elements of the annotations
    const prefixes = join(
        line,
        printPrefixes(node.prefixes, context, (prefix) => prefix.source() as MetadataFeatureMeta)
    );

    const declaration: Doc[] = [];
    if (prefixes.length > 0) {
        declaration.push(indent(fill(prefixes)), line);
    }

    declaration.push(keyword("dependency"));

    const identifiers = printIdentifiers(node, context, { leading: literals.space });
    const from: Doc[] = [];
    const to: Doc[] = [keyword("to"), line];
    if (identifiers.length > 0) {
        declaration.push(indent(identifiers));
        from.push(keyword("from"), line);
    } else {
        const kw = formatPreserved(node, context.format.dependency_from_keyword, {
            find: (node) => findNodeForKeyword(node, "from"),
            choose: {
                always: () => keyword("from"),
                as_needed: () => literals.emptytext,
                preserve: (found) => (found ? "always" : "as_needed"),
            },
        });
        if (kw !== literals.emptytext) from.push(kw, line);
        else from.push(ifBreak([keyword("from"), line], literals.emptytext));
    }

    const printRefs = (
        refs: readonly ElementMeta[],
        astProp: undefined | readonly ast.ElementReference[],
        kind: string
    ): Doc[] => {
        let targets: Doc[];
        if (refs.length === 0) {
            /* istanbul ignore if */
            if (!astProp) throwError(node, `Invalid dependency - missing ${kind}`);
            targets = astProp.map((ref) => printAstReference(ref, context));
        } else {
            targets = refs.map((target) => {
                const source = astProp?.find((ref) => ref.$meta.to.target === target);
                return printEdgeEnd(
                    node,
                    {
                        target,
                        astNode: source,
                        kind,
                    },
                    context
                );
            });
        }

        return join([literals.comma, line], targets);
    };

    from.push(...printRefs(node.client, node.ast()?.client, "client"));
    to.push(...printRefs(node.supplier, node.ast()?.supplier, "supplier"));

    return [
        group([
            group(declaration),
            indent([line, group(indent(from))]),
            indent([line, group(indent(to))]),
        ]),
        printChildrenBlock(node, node.children, context, {
            insertSpaceBeforeBrackets: true,
        }),
    ];
}

export function printNamespaceImport(
    kw: string,
    node: NamespaceImportMeta,
    context: ModelPrinterContext
): Doc {
    const declaration: Doc[] = [keyword(kw), literals.space];
    const doc: Doc[] = [group(declaration)];

    const target = node.element();
    if (target?.parent() === node && target.nodeType() === ast.Package) {
        // owned package implies FilterPackage
        const children = target.children;
        declaration.push(indent(printTarget(children[0], context)));
        if (children[0].is(ast.NamespaceImport)) declaration.push(text("::*"));
        doc.push(indent(children.slice(1).map((child) => printModelElement(child, context))));
    } else {
        declaration.push(indent(printTarget(node, context)), text("::*"));
    }

    if (node.isRecursive) {
        declaration.push(text("::**"));
    }

    doc.push(
        printChildrenBlock(node, node.children, context, {
            insertSpaceBeforeBrackets: true,
        })
    );

    return printWithVisibility(node, doc, context);
}

export function printMembershipImport(
    kw: string,
    node: MembershipImportMeta,
    context: ModelPrinterContext
): Doc {
    return printWithVisibility(
        node,
        [
            group([
                keyword(kw),
                literals.space,
                indent(printTarget(node, context)),
                node.isRecursive ? text("::**") : literals.emptytext,
            ]),
            printChildrenBlock(node, node.children, context, {
                insertSpaceBeforeBrackets: true,
            }),
        ],
        context
    );
}

export function printConjugation(node: ConjugationMeta, context: ModelPrinterContext): Doc {
    assertKerML(context, node.nodeType());
    return printSourceTargetRelationship("conjugation", node, context, {
        format: context.format.conjugation_keyword,
        sourceKw: keyword("conjugate"),
        targetKw: selectToken(
            keyword("conjugates"),
            text("~"),
            node,
            context.format.declaration_conjugation
        ),
    });
}

export function printDisjoining(node: DisjoiningMeta, context: ModelPrinterContext): Doc {
    assertKerML(context, node.nodeType());
    return printSourceTargetRelationship("disjoining", node, context, {
        format: context.format.disjoining_keyword,
        sourceKw: keyword("disjoint"),
        targetKw: keyword("from"),
    });
}

export function printElementFilterMembership(
    node: ElementFilterMembershipMeta,
    context: ModelPrinterContext
): Doc {
    if (
        node.parent()?.nodeType() === ast.Package &&
        node.parent()?.parent()?.is(ast.NamespaceImport)
    ) {
        // filter import
        return group([
            brackets.square.open,
            indent([softline, printTarget(node, context)]),
            softline,
            brackets.square.close,
        ]);
    }

    const contents = [
        printCondition(
            keyword("filter"),
            node,
            context,
            context.format.element_filter_parenthesize
        ),
        literals.semicolon,
    ];
    return printWithVisibility(node, group(contents), context);
}

export function printFeatureInverting(
    node: FeatureInvertingMeta,
    context: ModelPrinterContext
): Doc {
    assertKerML(context, node.nodeType());
    return printSourceTargetRelationship("inverting", node, context, {
        format: context.format.inverting_keyword,
        sourceKw: keyword("inverse"),
        targetKw: keyword("of"),
    });
}

export function printFeatureTyping(node: FeatureTypingMeta, context: ModelPrinterContext): Doc {
    assertKerML(context, node.nodeType());
    return printSourceTargetRelationship("specialization", node, context, {
        format: context.format.specialization_keyword_feature_typing,
        sourceKw: keyword("typing"),
        targetKw: selectToken(
            keyword("typed by"),
            text(":"),
            node,
            context.format.declaration_feature_typing
        ),
    });
}

export function printAssignmentExpression(
    prefix: Doc[],
    node: FeatureMeta | undefined,
    context: ModelPrinterContext,
    doc?: Doc
): Doc {
    let target: Doc;
    if (doc) {
        target = doc;
    } else {
        /* istanbul ignore next */
        if (!node) throw new Error("Cannot print an undefined expression");
        target = printModelElement(node, context);
    }

    if (prefix.length === 0) return target;

    if (node) {
        const op = getOperator(node);
        if (
            node.nodeType() === ast.InvocationExpression ||
            (precedence(node) === PREC_LEVELS.ACCESS &&
                op !== IMPLICIT_OPERATORS.DOT &&
                op !== IMPLICIT_OPERATORS.METADATA) ||
            op === OPERATORS.COMMA
        ) {
            // these expressions can break nicely themselves so prefer keeping their
            // LHS on the same line
            return group([
                ...prefix,
                group(indent(line), { id: "assignment-expr" }),
                lineSuffixBoundary,
                indentIfBreak(group(target), { groupId: "assignment-expr" }),
            ]);
        }
    }

    return group([...prefix, indent([line, group(target)])]);
}

export function printFeatureValue(node: FeatureValueMeta, context: ModelPrinterContext): Doc {
    if (node.element().is(ast.TriggerInvocationExpression)) return printTarget(node, context);

    const parts: Doc[] = [];
    const prefix: Doc[] = [];
    if (node.isDefault) {
        prefix.push(keyword("default"));
        if (node.isInitial) {
            prefix.push(text(":="));
        } else {
            const equals = formatPreserved(node, context.format.feature_value_equals, {
                find: (node) => findNodeForKeyword(node, "="),
                choose: {
                    as_needed: () => undefined,
                    always: () => text("="),
                    preserve: (found) => (found ? "always" : "as_needed"),
                },
            });
            if (equals) prefix.push(equals);
        }
    } else if (node.isInitial) {
        prefix.push(text(":="));
    } else {
        prefix.push(text("="));
    }

    parts.push(...join(literals.space, prefix));
    return printAssignmentExpression(parts, node.element(), context);
}

export function printOwningMembership<T extends ElementMeta>(
    node: OwningMembershipMeta<T>,
    context: ModelPrinterContext,
    previousSibling?: ElementMeta
): Doc {
    if (
        context.mode === "kerml" &&
        node.element().nodeType() !== ast.MetadataFeature &&
        node.element()?.is(ast.Feature) &&
        !node.element().is(ast.Multiplicity) &&
        node.parent()?.is(ast.Type)
    )
        // TypeFeatureMember
        return printGenericMembership("member", node, context, { previousSibling });
    return printGenericMembership(undefined, node, context, { previousSibling });
}

export function printSpecialization(node: SpecializationMeta, context: ModelPrinterContext): Doc {
    assertKerML(context, node.nodeType());
    return printSourceTargetRelationship("specialization", node, context, {
        format: context.format.specialization_keyword_specialization,
        sourceKw: keyword("subtype"),
        targetKw: selectToken(
            keyword("specializes"),
            text(":>"),
            node,
            context.format.declaration_specialization
        ),
    });
}

export function printSubclassification(
    node: SubclassificationMeta,
    context: ModelPrinterContext
): Doc {
    assertKerML(context, node.nodeType());
    return printSourceTargetRelationship("specialization", node, context, {
        format: context.format.specialization_keyword_subclassification,
        sourceKw: keyword("subclassifier"),
        targetKw: selectToken(
            keyword("specializes"),
            text(":>"),
            node,
            context.format.declaration_subclassification
        ),
    });
}

export function printSubsetting(node: SubsettingMeta, context: ModelPrinterContext): Doc {
    assertKerML(context, node.nodeType());
    return printSourceTargetRelationship("specialization", node, context, {
        format: context.format.specialization_keyword_subsetting,
        sourceKw: keyword("subset"),
        targetKw: selectToken(
            keyword("subsets"),
            text(":>"),
            node,
            context.format.declaration_subsetting
        ),
    });
}

export function printTypeFeaturing(node: TypeFeaturingMeta, context: ModelPrinterContext): Doc {
    assertKerML(context, node.nodeType());
    return printSourceTargetRelationship("featuring", node, context, {
        sourceKw: formatPreserved(node, context.format.featuring_of_keyword, {
            find: (node) => findNodeForKeyword(node, "of"),
            choose: {
                always: () => keyword("of"),
                as_needed: () =>
                    node.declaredName || node.declaredShortName
                        ? keyword("of")
                        : literals.emptytext,
                preserve: (found) => (found ? "always" : "as_needed"),
            },
        }),
        targetKw: keyword("by"),
    });
}

export function printVariantMembership<T extends UsageMeta>(
    node: VariantMembershipMeta<T>,
    context: ModelPrinterContext,
    previousSibling?: ElementMeta
): Doc {
    assertSysML(context, node.nodeType());

    // enum values are implicitly variants without `variant` keyword
    return printGenericMembership(
        node.parent()?.is(ast.EnumerationDefinition) ? undefined : "variant",
        node,
        context,
        { previousSibling }
    );
}

export function printRedefinition(node: RedefinitionMeta, context: ModelPrinterContext): Doc {
    assertKerML(context, node.nodeType());
    return printSourceTargetRelationship("specialization", node, context, {
        format: context.format.specialization_keyword_redefinition,
        sourceKw: keyword("redefinition"),
        targetKw: selectToken(
            keyword("redefines"),
            text(":>>"),
            node,
            context.format.declaration_redefinition
        ),
    });
}

function printRequirementParticipant(
    node: FeatureMembershipMeta,
    context: ModelPrinterContext,
    options: {
        previousSibling?: ElementMeta;
        keyword: string;
    }
): Doc {
    assertSysML(context, node.nodeType());
    return printGenericMembership(options.keyword, node, context, {
        previousSibling: options.previousSibling,
        printer(node, context) {
            return printGenericFeature([], undefined, node, context);
        },
    });
}

export function printActorMembership(
    node: ActorMembershipMeta,
    context: ModelPrinterContext,
    previousSibling?: ElementMeta
): Doc {
    return printRequirementParticipant(node, context, { previousSibling, keyword: "actor" });
}

export function printSubjectMembership(
    node: SubjectMembershipMeta,
    context: ModelPrinterContext,
    previousSibling?: ElementMeta
): Doc {
    return printRequirementParticipant(node, context, { previousSibling, keyword: "subject" });
}

export function printStakeholderMembership(
    node: StakeholderMembershipMeta,
    context: ModelPrinterContext,
    previousSibling?: ElementMeta
): Doc {
    return printRequirementParticipant(node, context, { previousSibling, keyword: "stakeholder" });
}

function printSpecialRequirementMember(
    node: FeatureMembershipMeta<OccurrenceUsageMeta>,
    context: ModelPrinterContext,
    options: {
        previousSibling?: ElementMeta;
        memberKeyword: string;
        targetKeyword: string;
    }
): Doc {
    assertSysML(context, node.nodeType());
    return printGenericMembership(options.memberKeyword, node, context, {
        previousSibling: options.previousSibling,
        printer(node, context) {
            const allowShorthand = canPrintShorthandUsage(node, ast.ReferenceSubsetting);

            const kw = formatPreserved(node, context.format.framed_concern_keyword, {
                find: (node) => findNodeForKeyword(node, options.targetKeyword),
                choose: {
                    always: () => options.targetKeyword,
                    as_needed: () =>
                        allowShorthand || node.prefixes.length > 0
                            ? undefined
                            : options.targetKeyword,
                    preserve: (found) => (found ? "always" : "as_needed"),
                },
            });

            if (kw || !allowShorthand) {
                return printGenericOccurrenceUsage([], kw, node, context);
            }

            return printShorthandUsage(node, context);
        },
    });
}

export function printFramedConcernMembership(
    node: FramedConcernMembershipMeta,
    context: ModelPrinterContext,
    previousSibling?: ElementMeta
): Doc {
    return printSpecialRequirementMember(node, context, {
        previousSibling,
        memberKeyword: "frame",
        targetKeyword: "concern",
    });
}

export function printRequirementConstraintMembership(
    node: RequirementConstraintMembershipMeta,
    context: ModelPrinterContext,
    previousSibling?: ElementMeta
): Doc {
    return printSpecialRequirementMember(node, context, {
        previousSibling,
        memberKeyword: node.kind === "assumption" ? "assume" : "require",
        targetKeyword: "constraint",
    });
}

export function printRequirementVerificationMembership(
    node: RequirementVerificationMembershipMeta,
    context: ModelPrinterContext,
    previousSibling?: ElementMeta
): Doc {
    return printSpecialRequirementMember(node, context, {
        previousSibling,
        memberKeyword: "verify",
        targetKeyword: "requirement",
    });
}

export function printObjectiveMembership(
    node: ObjectiveMembershipMeta,
    context: ModelPrinterContext,
    previousSibling?: ElementMeta
): Doc {
    assertSysML(context, node.nodeType());
    return printGenericMembership("objective", node, context, {
        previousSibling,
        printer(node, context) {
            return printGenericFeature([], undefined, node, context, {
                appendToDeclaration: featureValueAppender(node, context),
            });
        },
    });
}

export function printViewRenderingMembership(
    node: ViewRenderingMembershipMeta,
    context: ModelPrinterContext,
    previousSibling?: ElementMeta
): Doc {
    assertSysML(context, node.nodeType());
    return printGenericMembership("render", node, context, {
        previousSibling,
        printer: printShorthandUsage,
    });
}
