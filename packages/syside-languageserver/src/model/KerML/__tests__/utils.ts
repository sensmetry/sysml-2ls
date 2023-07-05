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
import { OwningMembership } from "../../../generated/ast";
import { emptyDocument } from "../../../testing";
import { ElementIDProvider, basicIdProvider } from "../../metamodel";
import { Edge, ElementMeta } from "../_internal";
import { RelationshipMeta } from "../relationship";
import "../../../testing/utils";

type MetatypeProto<T extends ElementMeta = ElementMeta> = {
    prototype: T;
};

type Metatype<T extends ElementMeta = ElementMeta> = MetatypeProto<T> & {
    create(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: unknown
    ): T;
};

export interface EditCaseBase<
    T extends ElementMeta = ElementMeta,
    E extends RelationshipMeta = RelationshipMeta,
    V extends ElementMeta = ElementMeta
> {
    proto: Metatype<T>;
    edgeProto: Metatype<E>;
    targetProto: Metatype<V>;
    suffix?: ".kerml" | ".sysml";
    options?: (...edges: Edge<E>[]) => unknown;
}

export interface ArrayEditCase<
    T extends ElementMeta = ElementMeta,
    E extends RelationshipMeta = RelationshipMeta,
    V extends ElementMeta = ElementMeta
> extends EditCaseBase<T, E, V> {
    push(this: T, ...edges: readonly (readonly [E, V])[]): number;
    remove(this: T, ...edges: readonly E[]): number;
    removeIf(this: T, predicate: (value: E) => boolean): number;
}

function expectOwned(owner: ElementMeta, edge: RelationshipMeta, target: ElementMeta): void {
    expect(owner.ownedElements().toArray()).toEqual(expect.arrayContaining([edge]));
    if (edge.is(OwningMembership)) expect(target.parent()).toBe(edge);
    expect(edge.parent()).toBe(owner);
    expect([edge.source(), edge.element()]).toEqual(expect.arrayContaining([owner, target]));
}

function expectOrphan(edge: RelationshipMeta, target: ElementMeta): void {
    if (edge.is(OwningMembership)) {
        expect(target.owner()).toBe(undefined);
        expect(target.parent()).toBe(undefined);
    }
    expect(edge.parent()).toBeUndefined();
}

function expectFactoryAssigned(
    id: ElementIDProvider,
    document: LangiumDocument,
    info: EditCaseBase
): void {
    const edge = info.edgeProto.create(id, document);
    const child = info.targetProto.create(id, document);
    const options = info.options?.([edge, child]);
    const element = info.proto.create(id, document, options) as ElementMeta;

    expectOwned(element, edge, child);
}

export function testChildrenArray<
    T extends ElementMeta = ElementMeta,
    E extends RelationshipMeta = RelationshipMeta,
    V extends ElementMeta = ElementMeta
>(info: ArrayEditCase<T, E, V>): void {
    const id = basicIdProvider();
    let document: LangiumDocument;

    beforeAll(() => {
        document = emptyDocument("model_test", info.suffix ?? ".kerml");
    });

    let element: T;

    beforeEach(() => {
        element = info.proto.create(id, document) as T;
    });

    it("should take ownership of added children", () => {
        const edge = info.edgeProto.create(id, document);
        const child = info.targetProto.create(id, document);
        expect(info.push.call(element, [edge, child] as const)).toEqual(1);
        expectOwned(element, edge, child);
    });

    it("should remove children by value and break parents", () => {
        const edge = info.edgeProto.create(id, document);
        const child = info.targetProto.create(id, document);
        info.push.call(element, [edge, child] as const);

        expect(info.remove.call(element, edge)).toEqual(0);
        expectOrphan(edge, child);
    });

    it("should remove children by predicate and break parents", () => {
        const edge = info.edgeProto.create(id, document);
        const child = info.targetProto.create(id, document);
        info.push.call(element, [edge, child] as const);

        expect(info.removeIf.call(element, (e) => e === edge)).toEqual(0);
        expectOrphan(edge, child);
    });

    if (info.options) {
        it("should assign children when constructing through factory", () => {
            expectFactoryAssigned(id, document, info as EditCaseBase);
        });
    }
}

export interface PropertyEditCase<
    T extends ElementMeta = ElementMeta,
    E extends RelationshipMeta = RelationshipMeta,
    V extends ElementMeta = ElementMeta
> extends EditCaseBase<T, E, V> {
    property: keyof T;
}

export function testChildProperty<
    T extends ElementMeta = ElementMeta,
    E extends RelationshipMeta = RelationshipMeta,
    V extends ElementMeta = ElementMeta
>(info: PropertyEditCase<T, E, V>): void {
    const id = basicIdProvider();
    let document: LangiumDocument;

    beforeAll(() => {
        document = emptyDocument("model_test", info.suffix ?? ".kerml");
    });

    let element: T;

    beforeEach(() => {
        element = info.proto.create(id, document, info.options?.()) as T;
    });

    it("should take ownership of the added child", () => {
        const edge = info.edgeProto.create(id, document);
        const child = info.targetProto.create(id, document);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        element[info.property] = [edge, child] as any;
        expect(element[info.property]).toBe(edge);

        expectOwned(element, edge, child);
    });

    it("should break parents to old child", () => {
        const edge = info.edgeProto.create(id, document);
        const child = info.targetProto.create(id, document);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        element[info.property] = [edge, child] as any;

        const edge2 = info.edgeProto.create(id, document);
        const child2 = info.targetProto.create(id, document);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        element[info.property] = [edge2, child2] as any;
        expect(element[info.property]).toBe(edge2);

        expectOrphan(edge, child);
    });

    it("should assign children when constructing through factory", () => {
        expectFactoryAssigned(id, document, {
            ...info,
            options(...edges) {
                return {
                    ...(info.options?.(...(edges as Edge<E>[])) ?? {}),
                    [info.property]: edges[0],
                };
            },
        });
    });
}
