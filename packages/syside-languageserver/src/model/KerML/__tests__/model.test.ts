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
import { emptyDocument } from "../../../testing";
import { basicIdProvider } from "../../metamodel";
import { DocumentationMeta } from "../documentation";
import {
    AnnotationMeta,
    CommentMeta,
    ConnectorMeta,
    DependencyMeta,
    DisjoiningMeta,
    EdgeContainer,
    EndFeatureMembershipMeta,
    ExpressionMeta,
    FeatureInvertingMeta,
    FeatureMembershipMeta,
    FeatureMeta,
    FeatureReferenceExpressionMeta,
    FeatureValueMeta,
    FunctionMeta,
    ItemFeatureMeta,
    ItemFlowMeta,
    MembershipMeta,
    MetadataFeatureMeta,
    MultiplicityRangeMeta,
    NamespaceImportMeta,
    NamespaceMeta,
    OwningMembershipMeta,
    RedefinitionMeta,
    ResultExpressionMembershipMeta,
    SpecializationMeta,
    TextualRepresentationMeta,
    TypeFeaturingMeta,
    TypeMeta,
    UnioningMeta,
    namespaceChildren,
} from "../_internal";
import {
    Dependency,
    Disjoining,
    Documentation,
    FeatureInverting,
    FeatureReferenceExpression,
    Import,
    Inheritance,
    Membership,
    MetadataFeature,
    TextualRepresentation,
    TypeFeaturing,
    Comment,
    Namespace,
    Type,
    Feature,
    MultiplicityRange,
    Connector,
    SysMLFunction,
    Expression,
    ItemFlow,
} from "../../../generated/ast";
import { SysMLEmptyFileSystem, SysMLInterface } from "../../../services";
import { testChildProperty, testChildrenArray } from "./utils";
import { createSysMLServices } from "../../../sysml-module";
import { URI } from "vscode-uri";

describe("Model elements", () => {
    const id = basicIdProvider();
    let document: LangiumDocument;

    beforeAll(() => {
        document = emptyDocument("model_test", ".kerml");
    });

    describe.each([
        [Documentation, DocumentationMeta, "documentation"],
        [Comment, CommentMeta, "comments"],
        [MetadataFeature, MetadataFeatureMeta, "metadata"],
        [TextualRepresentation, TextualRepresentationMeta, "textualRepresentation"],
    ] as const)("%s annotations", (_, proto, prop) => {
        it("should set parent annotating elements as its source", () => {
            // @ts-expect-error incompatible `ast()`...
            const doc = proto.create(id, document);
            const annotation = AnnotationMeta.create(id, document);
            const target = NamespaceMeta.create(id, document);
            doc.addAnnotation([annotation, target]);

            expect(annotation.source()).toBe(doc);
            // @ts-expect-error doesn't like stream constructor argument...
            expect(Array.from(target[prop])).toEqual(expect.arrayContaining([doc]));

            doc.removeAnnotation(annotation);
            // @ts-expect-error doesn't like stream constructor argument...
            expect(Array.from(target[prop])).toHaveLength(0);
        });

        it("should set parent non-annotating elements as its target", () => {
            const dep = DependencyMeta.create(id, document);
            const comment = CommentMeta.create(id, document);
            const annotation = AnnotationMeta.create(id, document, {
                parent: dep,
                source: comment,
            });
            expect(annotation.element()).toBe(dep);
            expect(annotation.source()).toBe(comment);
        });

        it("should construct elements with annotations set", () => {
            const annotation = AnnotationMeta.create(id, document);
            const target = NamespaceMeta.create(id, document);
            // @ts-expect-error incompatible `ast()`...
            const doc = proto.create(id, document, {
                annotations: [[annotation, target]],
            });

            expect(annotation.source()).toBe(doc);
            // @ts-expect-error doesn't like stream constructor argument...
            expect(Array.from(target[prop])).toEqual(expect.arrayContaining([doc]));

            doc.removeAnnotation(annotation);
            // @ts-expect-error doesn't like stream constructor argument...
            expect(Array.from(target[prop])).toHaveLength(0);
        });

        testChildrenArray({
            proto: proto,
            edgeProto: AnnotationMeta,
            targetProto: NamespaceMeta,
            push: proto.prototype.addAnnotation,
            remove: proto.prototype.removeAnnotation,
            removeIf: proto.prototype.removeAnnotationIf,
        });
    });

    describe("Out-of-file annotations", () => {
        let services: ReturnType<typeof createSysMLServices>;
        let main: LangiumDocument;
        let other: LangiumDocument;

        beforeAll(() => {
            services = createSysMLServices(SysMLEmptyFileSystem, {
                standardLibrary: false,
                skipWorkspaceInit: true,
                logStatistics: false,
                defaultBuildOptions: {
                    ignoreMetamodelErrors: true,
                    standalone: false,
                    standardLibrary: "none",
                    validationChecks: "all",
                },
            });
        });

        beforeEach(async () => {
            main = services.shared.workspace.LangiumDocumentFactory.fromString(
                "package P;",
                URI.file("main.kerml")
            );
            other = services.shared.workspace.LangiumDocumentFactory.fromString(
                "comment C about P /* comment */",
                URI.file("other.kerml")
            );

            services.shared.workspace.LangiumDocuments.addDocument(main);
            services.shared.workspace.LangiumDocuments.addDocument(other);
            await services.shared.workspace.DocumentBuilder.build([main, other]);
        });

        afterEach(() => {
            services.shared.workspace.LangiumDocuments.deleteDocument(main.uri);
            services.shared.workspace.LangiumDocuments.deleteDocument(other.uri);
        });

        const getComment = (): CommentMeta | undefined => {
            const root = main.parseResult.value.$meta as NamespaceMeta;
            expect(root).toBeDefined();

            const pack = root.children[0].element();
            expect(pack).toBeDefined();

            const comment = pack?.comments[0];
            return comment;
        };

        it("should resolve related comment from another doc", () => {
            const comment = getComment();
            expect(comment).toBeDefined();

            expect(comment?.document).toBe(other);
            expect(comment?.name).toEqual("C");
        });

        it("should remove related comment on deleting the document", async () => {
            await services.shared.workspace.DocumentBuilder.update([], [other.uri]);
            const comment = getComment();
            expect(comment).toBeUndefined();
        });

        it("should remove related comment on document change", () => {
            services.shared.workspace.LangiumDocuments.invalidateDocument(other.uri);
            const comment = getComment();
            expect(comment).toBeUndefined();
        });
    });

    describe.each([
        [Dependency, DependencyMeta],
        [Disjoining, DisjoiningMeta],
        [FeatureInverting, FeatureInvertingMeta],
        [TypeFeaturing, TypeFeaturingMeta],
        [Membership, MembershipMeta],
        [Import, NamespaceImportMeta],
        [Inheritance, SpecializationMeta],
    ] as const)("%s children", (_, proto) => {
        let element: SysMLInterface<typeof _>["$meta"];

        beforeEach(() => {
            // @ts-expect-error TS doesn't like intersection of static types...
            element = proto.create(id, document);
        });

        it("should take ownership of added children", () => {
            const child = CommentMeta.create(id, document);
            expect(element.addChild(child)).toEqual(1);
            expect(element.ownedElements().toArray()).toEqual(expect.arrayContaining([child]));
            expect(child.parent()).toBe(element);
        });

        it("should remove children by value and break parents", () => {
            const child = CommentMeta.create(id, document);
            element.addChild(child);
            expect(element.removeChild(child)).toEqual(0);
            expect(child.parent()).toBeUndefined();
        });

        it("should remove children by predicate and break parents", () => {
            const child = CommentMeta.create(id, document);
            element.addChild(child);
            expect(element.removeChildIf((e) => e === child)).toEqual(0);
            expect(child.parent()).toBeUndefined();
        });
    });

    describe("Dependency prefixes", () => {
        testChildrenArray({
            proto: DependencyMeta,
            edgeProto: AnnotationMeta,
            targetProto: MetadataFeatureMeta,
            push: DependencyMeta.prototype.addPrefix,
            remove: DependencyMeta.prototype.removePrefix,
            removeIf: DependencyMeta.prototype.removePrefixIf,
            options(...edges) {
                return {
                    client: [],
                    supplier: [],
                    prefixes: edges,
                };
            },
        });
    });

    describe(`${FeatureReferenceExpression} expression`, () => {
        testChildProperty<FeatureReferenceExpressionMeta>({
            proto: FeatureReferenceExpressionMeta,
            edgeProto: OwningMembershipMeta,
            targetProto: FeatureMeta,
            property: "expression",
        });
    });

    describe(`${Namespace} elements`, () => {
        describe("prefixes", () => {
            testChildrenArray({
                proto: NamespaceMeta,
                edgeProto: OwningMembershipMeta,
                targetProto: MetadataFeatureMeta,
                push: NamespaceMeta.prototype.addPrefix,
                remove: NamespaceMeta.prototype.removePrefix,
                removeIf: NamespaceMeta.prototype.removePrefixIf,
                options(...edges) {
                    return { prefixes: edges };
                },
            });
        });

        describe("children", () => {
            testChildrenArray({
                proto: NamespaceMeta,
                edgeProto: OwningMembershipMeta,
                targetProto: FeatureMeta,
                push: NamespaceMeta.prototype.addChild,
                remove: NamespaceMeta.prototype.removeChild,
                removeIf: NamespaceMeta.prototype.removeChildIf,
                options(...edges) {
                    return { children: EdgeContainer.make(...edges) };
                },
            });

            test("adding or removing children updates lookup table", () => {
                const child = FeatureMeta.create(id, document, {
                    declaredName: "child",
                });
                const member = OwningMembershipMeta.create(id, document);
                const ns = NamespaceMeta.create(id, document, {
                    children: namespaceChildren([member, child]),
                });

                expect(ns.findMember("child")).toBe(member);

                ns.removeChild(member);
                expect(ns.findMember("child")).toBeUndefined();
            });

            it("should construct namespace with prefixes", () => {
                const ns = NamespaceMeta.create(id, document, {
                    prefixes: [
                        [
                            OwningMembershipMeta.create(id, document),
                            MetadataFeatureMeta.create(id, document),
                        ],
                    ],
                });

                expect(ns.prefixes).toHaveLength(1);
            });
        });
    });

    describe(`${Type} elements`, () => {
        describe("heritage", () => {
            testChildrenArray({
                proto: TypeMeta,
                edgeProto: SpecializationMeta,
                targetProto: TypeMeta,
                push: TypeMeta.prototype.addHeritage,
                remove: TypeMeta.prototype.removeHeritage,
                removeIf: TypeMeta.prototype.removeHeritageIf,
                options(...edges) {
                    return { heritage: EdgeContainer.make(...edges) };
                },
            });

            describe("effective feature names", () => {
                let redefined: FeatureMeta;
                let redefining: FeatureMeta;
                let redef: RedefinitionMeta;
                let type: TypeMeta;

                beforeEach(() => {
                    redefined = FeatureMeta.create(id, document, {
                        declaredName: "regular",
                        declaredShortName: "short",
                        isOrdered: true,
                    });

                    redefining = FeatureMeta.create(id, document);
                    type = TypeMeta.create(id, document);
                    type.addChild([FeatureMembershipMeta.create(id, document), redefining]);

                    redef = RedefinitionMeta.create(id, document);
                    redefining.addHeritage([redef, redefined]);
                });

                test("redefining a feature inherits its name", () => {
                    expect(redefining.name).toEqual(redefined.name);
                    expect(redefining.shortName).toEqual(redefined.shortName);
                    expect(redefining.isOrdered).toBeTruthy();
                    expect(type.findMember(redefined.name as string)).toBe(redefining.parent());
                    expect(type.findMember(redefined.shortName as string)).toBe(
                        redefining.parent()
                    );
                });

                test("removing redefinition updates effective name", () => {
                    redefining.removeHeritage(redef);

                    expect(redefining.name).toBeUndefined();
                    expect(redefining.shortName).toBeUndefined();
                    expect(redefining.isOrdered).toBeFalsy();

                    expect(type.findMember(redefined.name as string)).toBeUndefined();
                    expect(type.findMember(redefined.shortName as string)).toBeUndefined();
                });
            });
        });

        describe("type relationships", () => {
            testChildrenArray({
                proto: TypeMeta,
                edgeProto: UnioningMeta,
                targetProto: TypeMeta,
                push: TypeMeta.prototype.addTypeRelationship,
                remove: TypeMeta.prototype.removeTypeRelationship,
                removeIf: TypeMeta.prototype.removeTypeRelationshipIf,
                options(...edges) {
                    return { typeRelationships: EdgeContainer.make(...edges) };
                },
            });
        });

        describe("multiplicity", () => {
            testChildProperty<TypeMeta>({
                proto: TypeMeta,
                edgeProto: OwningMembershipMeta,
                targetProto: MultiplicityRangeMeta,
                property: "multiplicity",
            });
        });
    });

    describe(`${Feature} elements`, () => {
        describe("value", () => {
            testChildProperty<FeatureMeta>({
                proto: FeatureMeta,
                edgeProto: FeatureValueMeta,
                targetProto: ExpressionMeta,
                property: "value",
            });
        });

        describe("feature relationships", () => {
            testChildrenArray({
                proto: FeatureMeta,
                edgeProto: TypeFeaturingMeta,
                targetProto: TypeMeta,
                push: FeatureMeta.prototype.addFeatureRelationship,
                remove: FeatureMeta.prototype.removeFeatureRelationship,
                removeIf: FeatureMeta.prototype.removeFeatureRelationshipIf,
                options(...edges) {
                    return { typeRelationships: EdgeContainer.make(...edges) };
                },
            });
        });
    });

    describe(`${MultiplicityRange} elements`, () => {
        describe("range", () => {
            testChildProperty<MultiplicityRangeMeta>({
                proto: MultiplicityRangeMeta,
                edgeProto: OwningMembershipMeta,
                targetProto: ExpressionMeta,
                property: "range",
            });
        });
    });

    describe(`${Connector} elements`, () => {
        describe("ends", () => {
            testChildrenArray({
                proto: ConnectorMeta,
                edgeProto: EndFeatureMembershipMeta,
                targetProto: FeatureMeta,
                push: ConnectorMeta.prototype.addEnd,
                remove: ConnectorMeta.prototype.removeEnd,
                removeIf: ConnectorMeta.prototype.removeEndIf,
                options(...edges) {
                    return { ends: edges };
                },
            });
        });
    });

    describe.each([
        [SysMLFunction, FunctionMeta],
        [Expression, ExpressionMeta],
    ] as const)("%s elements", (_, proto) => {
        describe("result", () => {
            testChildProperty<ExpressionMeta>({
                proto: proto as typeof ExpressionMeta,
                edgeProto: ResultExpressionMembershipMeta,
                targetProto: ExpressionMeta,
                property: "result",
            });
        });
    });

    describe(`${ItemFlow} elements`, () => {
        describe("item", () => {
            testChildProperty<ItemFlowMeta>({
                proto: ItemFlowMeta,
                edgeProto: FeatureMembershipMeta,
                targetProto: ItemFeatureMeta,
                property: "item",
            });
        });
    });
});
