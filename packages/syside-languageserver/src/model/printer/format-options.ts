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

// these options will eventually be parsed from some config file so using
// snake_case naming since it is far more readable

/**
 * Declares formatting option that can be preserved based on the source
 * formatting with fallback formatting in case the element has no associated
 * source text.
 */
export type PreservableFormatting<Alts extends string> = {
    /**
     * Controls formatting in majority of cases.
     * * `preserve`: element preserves source text formatting
     * @default "preserve"
     */
    default: Alts | "preserve";

    /**
     * Controls `preserve` formatting for cases when there is no associated
     * source text.
     */
    fallback?: Alts;
};

/**
 * Controls type and feature relationship formatting inside declarations:
 * * `keyword`: relationships will be formatted using associated word keywords
 * * `token`: relationships will be formatted using associated short tokens
 */
export type DeclaredRelationshipFormat = PreservableFormatting<"keyword" | "token">;

/**
 * @default DefaultFormatOptions
 */
export interface FormatOptions {
    /**
     * Controls `NullExpression` formatting:
     * * `null`: always formatted as `null`
     * * `brackets`: always formatted as `()`
     */
    null_expression: PreservableFormatting<"null" | "brackets">;

    /**
     * Controls `LiteralReal` formatting. Only applies to those numbers that are
     * not in the source text.
     * @default "none"
     */
    literal_real: "exp" | "prec" | "none";

    /**
     * Controls identifier formatting. If true, strips quotes from identifiers
     * if the name doesn't have restricted characters
     * @default true
     */
    strip_unnecessary_quotes: boolean;

    /**
     * Controls `SequenceExpression` formatting. If true, sequence expressions
     * will be printed with a trailing comma if broken.
     * @default true
     */
    sequence_expression_trailing_comma: boolean;

    /**
     * Controls binary operator placement on line breaks.
     * * `after`: operators are placed on the same line as the LHS expression
     * * `before`: operators are placed on the same line as the RHS expression
     * @default "after"
     */
    operator_break: "before" | "after";

    /**
     * If true, adds a space around brackets on a single line
     * @default true
     */
    bracket_spacing: boolean;

    /**
     * Controls `comment` keyword formatting:
     * * `always`: `comment` will always be printed
     * * `as_needed`: `comment` will only be printed as needed
     */
    comment_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls line break preceding `about` in `Comment`:
     * * `always`: about list is always on a new line
     * * `as_needed`: printer tries to fit about list on the previous line
     * @default "as_needed"
     */
    comment_about_break: "always" | "as_needed";

    /**
     * Controls `Comment` and `Documentation` body formatting. If true, trailing
     * whitespace is preserved on each line but last.
     * @default true
     */
    markdown_comments: boolean;

    /**
     * Controls `rep` keyword formatting:
     * * `always`: `rep` will always be printed
     * * `as_needed`: `rep` will only be printed as needed
     */
    textual_representation_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls line break preceding `language` in `TextualRepresentation`:
     * * `always`: language is always on a new line
     * * `as_needed`: printer tries to fit language on the previous line
     * @default "always"
     */
    textual_representation_language_break: "always" | "as_needed";

    /**
     * Controls formatting of empty children blocks:
     * * `always`: empty blocks are always formatted as `{}`
     * * `never`: empty blocks are always formatted as `;`
     */
    empty_namespace_brackets: PreservableFormatting<"always" | "never">;

    /**
     * Controls disjoining formatting in type declarations. If true, all
     * disjoinings are merged into a single group. Requires KerML.
     * @default false
     */
    merge_declaration_disjoining: boolean;

    /**
     * Controls unioning formatting in type declarations. If true, all unionings
     * are merged into a single group. Requires KerML.
     * @default false
     */
    merge_unioning: boolean;

    /**
     * Controls intersecting formatting in type declarations. If true, all
     * intersectings are merged into a single group. Requires KerML.
     * @default false
     */
    merge_intersecting: boolean;

    /**
     * Controls differencing formatting in type declarations. If true, all
     * differencings are merged into a single group. Requires KerML.
     * @default false
     */
    merge_differencing: boolean;

    /**
     * Controls feature chaining formatting in feature declarations. If true,
     * all feature chainings are merged into a single group. Requires KerML.
     * @default false
     */
    merge_feature_chaining: boolean;

    /**
     * Controls type featuring formatting in feature declarations. If true, all
     * type featurings are merged into a single group. Requires KerML.
     * @default false
     */
    merge_declaration_type_featuring: boolean;

    /**
     * Controls specialization formatting.
     */
    declaration_specialization: DeclaredRelationshipFormat;

    /**
     * Controls conjugation formatting. Requires KerML.
     */
    declaration_conjugation: DeclaredRelationshipFormat;

    /**
     * Controls subsetting formatting.
     */
    declaration_subsetting: DeclaredRelationshipFormat;

    /**
     * Controls subclassification formatting.
     */
    declaration_subclassification: DeclaredRelationshipFormat;

    /**
     * Controls redefinition formatting.
     */
    declaration_redefinition: DeclaredRelationshipFormat;

    /**
     * Controls reference subsetting formatting in feature declarations.
     */
    declaration_reference_subsetting: DeclaredRelationshipFormat;

    /**
     * Controls feature typing formatting.
     */
    declaration_feature_typing: DeclaredRelationshipFormat;

    /**
     * Controls conjugated port typing formatting in port declarations.
     */
    declaration_conjugated_port_typing: DeclaredRelationshipFormat;

    /**
     * Controls feature value equals token formatting whenever it can be
     * omitted:
     * * `as_needed`: `=` will only be printed if it is required by the grammar
     * * `always`: `=` will be always printed when it is acceptable by the
     *   grammar
     */
    feature_value_equals: PreservableFormatting<"as_needed" | "always">;

    /**
     * Controls `feature` keyword formatting in KerML:
     * * `always`: `feature` keyword is always printed
     * * `as_needed`: `feature` keyword is printed only when required by the
     *   grammar
     */
    feature_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `public` keyword formatting:
     * * `always`: `public` will always be printed
     * * `never`: `public` will never be printed
     */
    public_keyword: PreservableFormatting<"always" | "never">;

    /**
     * Controls `specialization` keyword formatting in specialization members:
     * * `always`: `specialization` will always be printed.
     * * `as_needed`: `specialization` will be printed only if required by the
     *   grammar
     */
    specialization_keyword_specialization: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `specialization` keyword formatting in subclassification
     * members:
     * * `always`: `specialization` will always be printed.
     * * `as_needed`: `specialization` will be printed only if required by the
     *   grammar
     */
    specialization_keyword_subclassification: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `specialization` keyword formatting in feature typing members:
     * * `always`: `specialization` will always be printed.
     * * `as_needed`: `specialization` will be printed only if required by the
     *   grammar
     */
    specialization_keyword_feature_typing: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `specialization` keyword formatting in subsetting members:
     * * `always`: `specialization` will always be printed.
     * * `as_needed`: `specialization` will be printed only if required by the
     *   grammar
     */
    specialization_keyword_subsetting: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `specialization` keyword formatting in redefinition members:
     * * `always`: `specialization` will always be printed.
     * * `as_needed`: `specialization` will be printed only if required by the
     *   grammar
     */
    specialization_keyword_redefinition: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `conjugation` keyword formatting in conjugation members:
     * * `always`: `conjugation` will always be printed.
     * * `as_needed`: `conjugation` will be printed only if required by the
     *   grammar
     */
    conjugation_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `disjoining` keyword formatting in disjoining members:
     * * `always`: `disjoining` will always be printed.
     * * `as_needed`: `disjoining` will be printed only if required by the
     *   grammar
     */
    disjoining_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `inverting` keyword formatting in inverting members:
     * * `always`: `inverting` will always be printed.
     * * `as_needed`: `inverting` will be printed only if required by the
     *   grammar
     */
    inverting_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `of` keyword formatting in type featuring members:
     * * `always`: `of` will always be printed.
     * * `as_needed`: `of` will be printed only if required by the grammar
     */
    featuring_of_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `from` keyword formatting in dependencies:
     * * `always`: `from` will always be printed.
     * * `as_needed`: `from` will be printed only if required by the grammar
     */
    dependency_from_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `true` keyword formatting in invariants:
     * * `never`: `true` is never printed
     * * `always`: `true` is always printed if invariant is not negated
     */
    invariant_true_keyword: PreservableFormatting<"never" | "always">;

    /**
     * Controls multiplicity placement in type declarations:
     * * `first`: multiplicity is printed before any specializations
     * * `first-specialization`: multiplicity is printed after the first
     *   specialization
     * * `last`: multiplicity is printed after all specializations
     * @default "first-specialization"
     */
    multiplicity_placement: "first" | "first-specialization" | "last";

    /**
     * Controls metadata feature keyword used.
     */
    metadata_feature_keyword: PreservableFormatting<"@" | "metadata">;

    /**
     * Controls `feature` (KerML) and `ref` (SysML) keyword formatting in
     * metadata features:
     * * `always`: keywords are always printed
     * * `never`: keywords are never printed
     */
    metadata_body_feature_keyword: PreservableFormatting<"always" | "never">;

    /**
     * Controls first feature redefinition formatting inside MetadataFeature
     * bodies:
     * * `keyword`: `redefines` is printed
     * * `token`: `:>>` is printed
     * * `none`: nothing is printed
     */
    metadata_body_feature_redefines: PreservableFormatting<"keyword" | "token" | "none">;

    /**
     * Controls allocation usage ends formatting:
     * * `always`: binary ends are printed as binary declaration
     * * `never: binary ends are printed as nary declaration
     */
    binary_allocation_usages: PreservableFormatting<"always" | "never">;

    /**
     * Controls connector ends formatting:
     * * `always`: binary ends are printed as binary declaration
     * * `never: binary ends are printed as nary declaration
     */
    binary_connectors: PreservableFormatting<"always" | "never">;

    /**
     * Controls `from` keyword formatting in binary connectors:
     * * `always`: `from` is always printed
     * * `as_needed`: `from` is only printed when required by the grammar
     */
    binary_connectors_from_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls binding connector ends formatting:
     * * `always`: binary ends are printed as binary declaration
     * * `never: binary ends are printed as nary declaration
     */
    binary_binding_connectors: PreservableFormatting<"always" | "never">;

    /**
     * Controls `of` keyword formatting in binary binding connectors:
     * * `always`: `of` is always printed
     * * `as_needed`: `of` is only printed when required by the grammar
     */
    binary_binding_connector_of_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls succession ends formatting:
     * * `always`: binary ends are printed as binary declaration
     * * `never: binary ends are printed as nary declaration
     */
    binary_successions: PreservableFormatting<"always" | "never">;

    /**
     * Controls `first` keyword formatting in binary successions:
     * * `always`: `first` is always printed
     * * `as_needed`: `first` is only printed when required by the grammar
     */
    binary_succession_first_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `from` keyword formatting in item flows:
     * * `always`: `from` is always printed
     * * `as_needed`: `from` is only printed when required by the grammar
     */
    item_flow_from_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `from` keyword formatting in succession item flows:
     * * `always`: `from` is always printed
     * * `as_needed`: `from` is only printed when required by the grammar
     */
    succession_item_flow_from_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `from` keyword formatting in flow connection usages:
     * * `always`: `from` is always printed
     * * `as_needed`: `from` is only printed when required by the grammar
     */
    flow_connection_usage_from_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `from` keyword formatting in succession flow connection usages:
     * * `always`: `from` is always printed
     * * `as_needed`: `from` is only printed when required by the grammar
     */
    succession_flow_connection_usage_from_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `ordered` and `nonunique` print order:
     * * `ordered`: `ordered` is printed first
     * * `nonunique`: `nonunique` is printed first
     */
    ordered_nonunique_priority: PreservableFormatting<"ordered" | "nonunique">;

    /**
     * Controls `enum` keyword formatting inside enum definitions:
     * * `always`: `enum` is always printed
     * * `never`: `enum` is never printed
     */
    enum_member_keyword: PreservableFormatting<"always" | "never">;

    /**
     * Controls `occurrence` keyword formatting in  occurrence usages and
     * definitions:
     * * `always`: `occurrence` is always printed
     * * `as_needed`: `occurrence` is only printed when required by the grammar
     */
    occurrence_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `binding` formatting in binding connectors as usages:
     * * `always`: `binding` is always printed
     * * `as_needed`: `binding` is only printed when required by the grammar
     */
    binding_connector_as_usage_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `succession` formatting in successions as usages:
     * * `always`: `succession` is always printed
     * * `as_needed`: `succession` is only printed when required by the grammar
     */
    succession_as_usage_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `constraint` formatting in assert constraint usages:
     * * `always`: `constraint` is always printed
     * * `as_needed`: `constraint` is only printed when required by the grammar
     */
    assert_constraint_usage_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `occurrence` keyword formatting in event occurrence usages:
     * * `always`: `occurrence` is always printed
     * * `as_needed`: `occurrence` is only printed when required by the grammar
     */
    event_occurrence_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `state` formatting in exhibit state usages:
     * * `always`: `state` is always printed
     * * `as_needed`: `state` is only printed when required by the grammar
     */
    exhibit_state_usage_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `use case` formatting in include use case usages:
     * * `always`: `use case` is always printed
     * * `as_needed`: `use case` is only printed when required by the grammar
     */
    include_use_case_usage_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `action` formatting in perform action usages:
     * * `always`: `action` is always printed
     * * `as_needed`: `action` is only printed when required by the grammar
     */
    perform_action_usage_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `requirement` formatting in satisfy requirement usages:
     * * `always`: `requirement` is always printed
     * * `as_needed`: `requirement` is only printed when required by the grammar
     */
    satisfy_requirement_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `assert` formatting in satisfy requirement usages:
     * * `always`: `assert` is always printed
     * * `never`: `assert` is never printed
     */
    satisfy_requirement_assert_keyword: PreservableFormatting<"always" | "never">;

    /**
     * Controls `allocation` formatting in allocation usages:
     * * `always`: `allocation` is always printed
     * * `as_needed`: `allocation` is only printed when required by the grammar
     */
    allocation_usage_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `connection` formatting in connection usages:
     * * `always`: `connection` is always printed
     * * `as_needed`: `connection` is only printed when required by the grammar
     */
    connection_usage_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls connection usage ends formatting:
     * * `always`: binary ends are printed as binary declaration
     * * `never: binary ends are printed as nary declaration
     */
    binary_connection_usages: PreservableFormatting<"always" | "never">;

    /**
     * Controls interface usage ends formatting:
     * * `always`: binary ends are printed as binary declaration
     * * `never: binary ends are printed as nary declaration
     */
    binary_interface_usages: PreservableFormatting<"always" | "never">;

    /**
     * Controls `connect` formatting in interface usages:
     * * `always`: `connect` is always printed
     * * `as_needed`: `connect` is only printed when required by the grammar
     */
    interface_usage_connect_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `action` formatting in action nodes:
     * * `always`: `action` is always printed
     * * `as_needed`: `action` is printed only if required by the grammar
     */
    action_node_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `while (...)` while loop action condition expression formatting:
     * * `always`: expression is printed with parentheses
     * * `never`: expression is printed without parentheses
     * @default "on_break"
     */
    while_loop_parenthesize_condition: "always" | "never" | "on_break";

    /**
     * Controls `until (...)` while loop action condition expression formatting:
     * * `always`: expression is printed with parentheses
     * * `never`: expression is printed without parentheses
     * @default "on_break"
     */
    while_loop_parenthesize_until: "always" | "never" | "on_break";

    /**
     * Controls `if (...)` condition expression formatting:
     * * `always`: expression is printed with parentheses
     * * `never`: expression is printed without parentheses
     * @default "on_break"
     */
    if_parenthesize_condition: "always" | "never" | "on_break";

    /**
     * Controls `if (...)` condition expression in transition usages formatting:
     * * `always`: expression is printed with parentheses
     * * `never`: expression is printed without parentheses
     * @default "on_break"
     */
    transition_usage_parenthesize_guard: "always" | "never" | "on_break";

    /**
     * Controls `filter (...)` condition expression in element filter memberships
     * formatting:
     * * `always`: expression is printed with parentheses
     * * `never`: expression is printed without parentheses
     * @default "on_break"
     */
    element_filter_parenthesize: "always" | "never" | "on_break";

    /**
     * Controls `transition` formatting in transition usages:
     * * `always`: `transition` is always printed if permitted by the grammar
     * * `as_needed`: `transition` is only printed if required by the grammar
     */
    transition_usage_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `first` formatting in transition usages:
     * * `always`: `first` is always printed if permitted by the grammar
     * * `as_needed`: `first` is only printed if required by the grammar
     */
    transition_usage_first_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `concern` formatting in framed concern usages:
     * * `always`: `concern` is always printed
     * * `as_needed`: `concern` is only printed if required by the grammar
     */
    framed_concern_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `ref` formatting in reference usages:
     * * `always`: `ref` is always printed
     * * `as_needed`: `ref` is only printed if required by the grammar
     */
    reference_usage_keyword: PreservableFormatting<"always" | "as_needed">;

    /**
     * Controls `ref` formatting in attribute usages:
     * * `always`: `ref` is always printed
     * * `never`: `ref` is never printed
     */
    attribute_usage_reference_keyword: PreservableFormatting<"always" | "never">;

    /**
     * Controls `ref` formatting in event occurrence usages:
     * * `always`: `ref` is always printed
     * * `never`: `ref` is never printed
     */
    event_occurrence_reference_keyword: PreservableFormatting<"always" | "never">;

    /**
     * Controls `ref` formatting in attribute usages:
     * * `always`: `ref` is always printed
     * * `never`: `ref` is never printed
     */
    port_usage_reference_keyword: PreservableFormatting<"always" | "never">;

    /**
     * Controls `ref` formatting in connection usages:
     * * `always`: `ref` is always printed
     * * `never`: `ref` is never printed
     */
    connection_usage_reference_keyword: PreservableFormatting<"always" | "never">;

    /**
     * Controls `ref` formatting in connector as usages:
     * * `always`: `ref` is always printed
     * * `never`: `ref` is never printed
     */
    connector_as_usage_reference_keyword: PreservableFormatting<"always" | "never">;

    /**
     * Controls `ref` formatting in exhibit state usages:
     * * `always`: `ref` is always printed
     * * `never`: `ref` is never printed
     */
    exhibit_state_reference_keyword: PreservableFormatting<"always" | "never">;

    /**
     * Controls `ref` formatting in include use case usages:
     * * `always`: `ref` is always printed
     * * `never`: `ref` is never printed
     */
    include_use_case_reference_keyword: PreservableFormatting<"always" | "never">;

    /**
     * Controls `ref` formatting in perform action usages:
     * * `always`: `ref` is always printed
     * * `never`: `ref` is never printed
     */
    perform_action_reference_keyword: PreservableFormatting<"always" | "never">;
}

export const DefaultFormatOptions: FormatOptions = {
    null_expression: { default: "preserve", fallback: "null" },
    literal_real: "none",
    strip_unnecessary_quotes: true,
    sequence_expression_trailing_comma: true,
    operator_break: "after",
    bracket_spacing: true,
    comment_keyword: { default: "preserve", fallback: "as_needed" },
    comment_about_break: "as_needed",
    markdown_comments: true,
    textual_representation_keyword: { default: "preserve", fallback: "as_needed" },
    textual_representation_language_break: "always",
    empty_namespace_brackets: { default: "preserve", fallback: "always" },
    merge_declaration_disjoining: false,
    merge_differencing: false,
    merge_intersecting: false,
    merge_unioning: false,
    merge_feature_chaining: false,
    merge_declaration_type_featuring: false,
    declaration_specialization: { default: "preserve", fallback: "token" },
    declaration_conjugation: { default: "preserve", fallback: "token" },
    declaration_subsetting: { default: "preserve", fallback: "token" },
    declaration_subclassification: { default: "preserve", fallback: "token" },
    declaration_redefinition: { default: "preserve", fallback: "token" },
    declaration_reference_subsetting: { default: "preserve", fallback: "token" },
    declaration_feature_typing: { default: "preserve", fallback: "token" },
    declaration_conjugated_port_typing: { default: "preserve", fallback: "token" },
    feature_value_equals: { default: "preserve", fallback: "as_needed" },
    feature_keyword: { default: "preserve", fallback: "as_needed" },
    public_keyword: { default: "preserve", fallback: "never" },
    conjugation_keyword: { default: "preserve", fallback: "as_needed" },
    specialization_keyword_specialization: { default: "preserve", fallback: "as_needed" },
    specialization_keyword_subclassification: { default: "preserve", fallback: "as_needed" },
    specialization_keyword_feature_typing: { default: "preserve", fallback: "as_needed" },
    specialization_keyword_subsetting: { default: "preserve", fallback: "as_needed" },
    specialization_keyword_redefinition: { default: "preserve", fallback: "as_needed" },
    disjoining_keyword: { default: "preserve", fallback: "as_needed" },
    inverting_keyword: { default: "preserve", fallback: "as_needed" },
    featuring_of_keyword: { default: "preserve", fallback: "as_needed" },
    dependency_from_keyword: { default: "always", fallback: "always" },
    invariant_true_keyword: { default: "preserve", fallback: "always" },
    multiplicity_placement: "first-specialization",
    metadata_feature_keyword: { default: "preserve", fallback: "@" },
    metadata_body_feature_keyword: { default: "preserve", fallback: "never" },
    metadata_body_feature_redefines: { default: "preserve", fallback: "none" },
    binary_allocation_usages: { default: "preserve", fallback: "always" },
    binary_connectors: { default: "preserve", fallback: "always" },
    binary_connectors_from_keyword: { default: "preserve", fallback: "always" },
    binary_binding_connectors: { default: "preserve", fallback: "always" },
    binary_binding_connector_of_keyword: { default: "preserve", fallback: "always" },
    binary_successions: { default: "preserve", fallback: "always" },
    binary_succession_first_keyword: { default: "preserve", fallback: "always" },
    item_flow_from_keyword: { default: "preserve", fallback: "always" },
    succession_item_flow_from_keyword: { default: "preserve", fallback: "always" },
    flow_connection_usage_from_keyword: { default: "preserve", fallback: "always" },
    succession_flow_connection_usage_from_keyword: { default: "preserve", fallback: "always" },
    ordered_nonunique_priority: { default: "preserve", fallback: "ordered" },
    enum_member_keyword: { default: "preserve", fallback: "never" },
    occurrence_keyword: { default: "preserve", fallback: "always" },
    event_occurrence_keyword: { default: "preserve", fallback: "always" },
    binding_connector_as_usage_keyword: { default: "preserve", fallback: "always" },
    assert_constraint_usage_keyword: { default: "preserve", fallback: "always" },
    succession_as_usage_keyword: { default: "preserve", fallback: "always" },
    exhibit_state_usage_keyword: { default: "preserve", fallback: "always" },
    include_use_case_usage_keyword: { default: "preserve", fallback: "always" },
    perform_action_usage_keyword: { default: "preserve", fallback: "always" },
    satisfy_requirement_keyword: { default: "preserve", fallback: "always" },
    satisfy_requirement_assert_keyword: { default: "preserve", fallback: "always" },
    allocation_usage_keyword: { default: "preserve", fallback: "always" },
    connection_usage_keyword: { default: "preserve", fallback: "always" },
    binary_connection_usages: { default: "preserve", fallback: "always" },
    binary_interface_usages: { default: "preserve", fallback: "always" },
    interface_usage_connect_keyword: { default: "preserve", fallback: "always" },
    action_node_keyword: { default: "preserve", fallback: "as_needed" },
    while_loop_parenthesize_condition: "on_break",
    while_loop_parenthesize_until: "on_break",
    if_parenthesize_condition: "on_break",
    transition_usage_parenthesize_guard: "on_break",
    element_filter_parenthesize: "on_break",
    transition_usage_keyword: { default: "preserve", fallback: "always" },
    transition_usage_first_keyword: { default: "preserve", fallback: "always" },
    framed_concern_keyword: { default: "preserve", fallback: "always" },
    reference_usage_keyword: { default: "preserve", fallback: "always" },
    attribute_usage_reference_keyword: { default: "preserve", fallback: "never" },
    event_occurrence_reference_keyword: { default: "preserve", fallback: "never" },
    port_usage_reference_keyword: { default: "preserve", fallback: "never" },
    connection_usage_reference_keyword: { default: "preserve", fallback: "never" },
    connector_as_usage_reference_keyword: { default: "preserve", fallback: "never" },
    exhibit_state_reference_keyword: { default: "preserve", fallback: "never" },
    include_use_case_reference_keyword: { default: "preserve", fallback: "never" },
    perform_action_reference_keyword: { default: "preserve", fallback: "never" },
};
