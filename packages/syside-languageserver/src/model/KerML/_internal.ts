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

// internal module for circular dependencies with fixed import order

export * from "./element";
export * from "./references/element-reference";
export * from "./relationship";
export * from "./relationships/membership";

export * from "./relationships/annotation";
export * from "./annotating-element";
export * from "./textual-annotating-element";
export * from "./comment";
export * from "./documentation";
export * from "./textual-representation";

export * from "./namespace";
export * from "./references/namespace-reference";
export * from "./package";
export * from "./library-package";
export * from "./type";
export * from "./references/type-reference";
export * from "./classifier";
export * from "./references/classifier-reference";
export * from "./class";
export * from "./data-type";
export * from "./association";
export * from "./behavior";
export * from "./interaction";
export * from "./structure";
export * from "./association-structure";
export * from "./metaclass";
export * from "./references/metaclass-reference";

export * from "./feature";
export * from "./references/feature-reference";
export * from "./multiplicity";
export * from "./multiplicity-range";
export * from "./step";
export * from "./connector";
export * from "./binding-connector";
export * from "./function";
export * from "./item-feature";
export * from "./item-flow";
export * from "./item-flow-end";
export * from "./metadata-feature";
export * from "./succession";
export * from "./succession-item-flow";
export * from "./expression";
export * from "./predicate";
export * from "./boolean-expression";
export * from "./invariant";

export * from "./relationships/inheritance";
export * from "./relationships/specialization";
export * from "./relationships/subsetting";
export * from "./relationships/redefinition";
export * from "./relationships/reference-subsetting";
export * from "./relationships/subclassification";
export * from "./relationships/feature-typing";
export * from "./relationships/conjugation";

export * from "./expressions/invocation-expression";
export * from "./expressions/operator-expression";
export * from "./expressions/collect-expression";
export * from "./expressions/select-expression";
export * from "./expressions/feature-chain-expression";
export * from "./expressions/feature-reference-expression";
export * from "./expressions/literal-expression";
export * from "./expressions/literal-boolean";
export * from "./expressions/literal-infinity";
export * from "./expressions/literal-number";
export * from "./expressions/literal-string";
export * from "./expressions/metadata-access-expression";
export * from "./expressions/null-expression";

export * from "./relationships/dependency";

export * from "./relationships/featuring";
export * from "./relationships/type-featuring";

export * from "./references/membership-reference";
export * from "./relationships/owning-membership";
export * from "./relationships/feature-value";
export * from "./relationships/element-filter-membership";
export * from "./relationships/feature-membership";
export * from "./relationships/parameter-membership";
export * from "./relationships/result-expression-membership";
export * from "./relationships/end-feature-membership";
export * from "./relationships/return-parameter-membership";

export * from "./relationships/import";
export * from "./relationships/membership-import";
export * from "./relationships/namespace-import";

export * from "./relationships/differencing";
export * from "./relationships/disjoining";
export * from "./relationships/feature-chaining";
export * from "./relationships/feature-inverting";
export * from "./relationships/intersecting";
export * from "./relationships/unioning";
