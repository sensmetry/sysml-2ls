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
import { emptyDocument } from "../../testing/utils";
import { CommentMeta, ElementMeta, NamespaceMeta } from "../KerML";
import { ElementContainer, removeIfObserved, removeObserved } from "../containers";
import { basicIdProvider } from "../metamodel";
import { Namespace } from "../../generated/ast";

describe("Containers", () => {
    const id = basicIdProvider();
    let document: LangiumDocument;

    beforeAll(() => {
        document = emptyDocument("factory_test", ".sysml");
    });

    describe("Element container", () => {
        let container: ElementContainer;

        beforeEach(() => {
            container = new ElementContainer(NamespaceMeta.create(id, document));
        });

        it("should convert to JSON without the caches", () => {
            expect(JSON.stringify(container)).toEqual(JSON.stringify([...container]));
        });

        it("should add new elements and invalidate caches", () => {
            container.get(Namespace);

            expect(container["caches"].size).toBeGreaterThan(0);
            container.push(NamespaceMeta.create(id, document));
            expect(container["caches"].size).toEqual(0);
            expect(container.length).toEqual(2);
        });

        it("should allow filtering by predicate", () => {
            const predicate = (e: ElementMeta): boolean => e.is(Namespace);
            container.push(CommentMeta.create(id, document));

            expect(container.get(predicate)).toHaveLength(1);
            expect(container["caches"].size).toEqual(1);
            expect(container.get(predicate)).toHaveLength(1);
        });

        it("should remove elements by value and invalidate caches", () => {
            container.invalidateCaches = jest.fn();
            expect(container.remove(container.all[0])).toBeTruthy();
            expect(container.invalidateCaches).toHaveBeenCalledTimes(1);
            expect(container).toHaveLength(0);
        });

        it("should not remove elements by value and invalidate caches if value is not in the container", () => {
            const mock = jest.fn();
            container.invalidateCaches = mock;
            expect(container.remove(NamespaceMeta.create(id, document))).toBeFalsy();
            expect(mock).toHaveBeenCalledTimes(0);
            expect(container).toHaveLength(1);
        });

        it("should remove elements by predicate and invalidate caches", () => {
            container.push(container.all[0]);
            const mock = jest.fn();
            container.invalidateCaches = mock;
            expect(container.removeIf(() => true)).toEqual(0);
            expect(mock).toHaveBeenCalledTimes(1);
        });

        it("should be clearable", () => {
            container.clear();
            expect(container).toHaveLength(0);
        });
    });

    describe("array extensions", () => {
        let array: number[];

        beforeEach(() => {
            array = [0, 1, 2, 3, 4, 5, 6, 7];
        });

        it("should remove elements by value", () => {
            expect(array.remove(2)).toEqual(true);
            expect(array).not.toEqual(expect.arrayContaining([2]));
        });

        it("should not remove values not in array", () => {
            expect(array.remove(100)).toEqual(false);
            expect(array).toHaveLength(8);
        });

        it("should remove values by predicate", () => {
            const pred = (v: number): boolean => v % 2 === 0;
            const original = [...array];
            expect(array.removeIf(pred)).toEqual(4);
            expect(array).toEqual(original.filter((v) => !pred(v)));
        });

        it("should call observer when removing values", () => {
            const observer = jest.fn();
            removeObserved(array, observer, 2);
            expect(observer).toHaveBeenCalledTimes(1);
            expect(array).not.toEqual(expect.arrayContaining([2]));
        });

        it("should not call observer when removing values not in array", () => {
            const observer = jest.fn();
            removeObserved(array, observer, 200);
            expect(observer).toHaveBeenCalledTimes(0);
        });

        it("should call observer when removing values by predicate", () => {
            const observer = jest.fn();
            removeIfObserved(array, observer, (v) => v % 2 === 0);
            expect(observer).toHaveBeenCalledTimes(4);
        });
    });
});
