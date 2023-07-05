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

import { LangiumDocument } from "langium";
import { TypeClassifier } from "../../enums";
import { basicIdProvider } from "../../metamodel";
import { AssociationStructMeta } from "../association-structure";
import { emptyDocument } from "../../../testing/utils";
import { DataTypeMeta } from "../data-type";
import { TypeMeta } from "../type";
import { ClassMeta } from "../class";
import { StructureMeta } from "../structure";
import { AssociationMeta } from "../association";
import {
    DependencyMeta,
    DocumentationMeta,
    ElementFilterMembershipMeta,
    ExpressionMeta,
    InvariantMeta,
    LiteralBooleanMeta,
    LiteralNumberMeta,
    LiteralStringMeta,
    NamespaceImportMeta,
    NamespaceMeta,
    NullExpressionMeta,
    OperatorExpressionMeta,
    OwningMembershipMeta,
    RelationshipMeta,
    SuccessionItemFlowMeta,
    SuccessionItemFlowOptions,
    TextualRepresentationMeta,
} from "../_internal";
import { Visibility } from "../../../utils";
import { NullExpression } from "../../../generated/ast";

describe("Element factories", () => {
    const id = basicIdProvider();
    let document: LangiumDocument;

    beforeAll(() => {
        document = emptyDocument("factory_test", ".kerml");
    });

    it.each([
        ["assoc", AssociationMeta, TypeClassifier.Association],
        ["assoc struct", AssociationStructMeta, TypeClassifier.AssociationStruct],
        ["data type", DataTypeMeta, TypeClassifier.DataType],
        ["class", ClassMeta, TypeClassifier.Class],
        ["struct", StructureMeta, TypeClassifier.Structure],
    ])(
        "should construct %1 with the correct classifier flag",
        (_, proto: typeof TypeMeta, classifier) => {
            expect(proto.create(id, document)).toMatchObject({ classifier });
        }
    );

    it("should construct relationships", () => {
        const target = TypeMeta.create(id, document);
        const source = TypeMeta.create(id, document);
        const parent = OwningMembershipMeta.create(id, document);

        const relationship = RelationshipMeta["create"](id, document, {
            target,
            source,
            parent,
            isImplied: true,
            visibility: Visibility.private,
        });

        expect(relationship).toBeDefined();
        expect(relationship.element()).toBe(target);
        expect(relationship.source()).toBe(source);
        expect(relationship.parent()).toBe(parent);
        expect(relationship.owner()).toBeUndefined();
        expect(relationship).toMatchObject({ visibility: Visibility.private, isImplied: true });
    });

    test("element filter membership should be constructed with private visibility", () => {
        expect(
            ElementFilterMembershipMeta.create(id, document, {
                target: ExpressionMeta.create(id, document),
                visibility: Visibility.public,
            }).visibility
        ).toEqual(Visibility.private);
    });

    it("should assign client and supplier to dependency", () => {
        const client = TypeMeta.create(id, document);
        const supplier = TypeMeta.create(id, document);
        const dep = DependencyMeta.create(id, document, { client: [client], supplier: [supplier] });

        expect(dep.supplier.at(0)).toBe(supplier);
        expect(dep.client.at(0)).toBe(client);
    });

    it("should assign import properties", () => {
        const target = NamespaceMeta.create(id, document);
        const imp = NamespaceImportMeta.create(id, document, {
            target,
            importsAll: true,
            isRecursive: true,
        });

        expect(imp).toMatchObject({ importsAll: true, isRecursive: true });
    });

    describe("literals", () => {
        it("should assign literal boolean value", () => {
            expect(LiteralBooleanMeta.create(id, document, { value: true })).toMatchObject({
                literal: true,
            });
        });

        it("should assign literal number value", () => {
            expect(LiteralNumberMeta.create(id, document, { value: 42 })).toMatchObject({
                literal: 42,
                isInteger: true,
            });

            expect(LiteralNumberMeta.create(id, document, { value: 42.05 })).toMatchObject({
                literal: 42.05,
                isInteger: false,
            });
        });

        it("should assign literal string value", () => {
            expect(LiteralStringMeta.create(id, document, { value: "hello" })).toMatchObject({
                literal: "hello",
            });
        });
    });

    it("should create null expressions", () => {
        expect(NullExpressionMeta.create(id, document).nodeType()).toEqual(NullExpression);
    });

    it("should assign operator in operator expression", () => {
        expect(OperatorExpressionMeta.create(id, document, { operator: "'+'" })).toMatchObject({
            operator: "'+'",
        });
    });

    it("should assign text body to annotating elements", () => {
        expect(DocumentationMeta.create(id, document, { body: "hello" })).toMatchObject({
            body: "hello",
        });
    });

    it("should assign declared names", () => {
        expect(
            NamespaceMeta.create(id, document, { declaredName: "full", declaredShortName: "short" })
        ).toMatchObject({ name: "full", shortName: "short" });
    });

    it("should assign negation to invariant", () => {
        expect(InvariantMeta.create(id, document, { isNegated: true })).toMatchObject({
            isNegated: true,
        });
    });

    it("should assign language to textual representation", () => {
        expect(
            TextualRepresentationMeta.create(id, document, { body: "hello", language: "text" })
        ).toMatchObject({ body: "hello", language: "text" });
    });

    it("should assign abstract to types", () => {
        expect(ClassMeta.create(id, document, { isAbstract: true })).toMatchObject({
            isAbstract: true,
        });
    });

    it("should assign feature properties", () => {
        const options: SuccessionItemFlowOptions = {
            direction: "inout",
            isComposite: true,
            isDerived: true,
            isAbstract: true,
            isEnd: true,
            isNonUnique: true,
            isOrdered: true,
            isPortion: true,
            isReadonly: true,
        };
        expect(SuccessionItemFlowMeta.create(id, document, options)).toMatchObject(options);
    });
});
