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

interface RangeValues {
    start: number;
    stop: number;
    step?: number;
}

/**
 * Lazy range generator (end inclusive)
 */
export class RangeGenerator implements Iterable<number> {
    start: number;
    stop: number;
    step: number;

    constructor(r: RangeValues) {
        this.start = r.start;
        // inclusive end
        this.stop = r.stop + 1;
        this.step = r.step ?? 1;
    }

    [Symbol.iterator](): Iterator<number, undefined, undefined> {
        let current = this.start;
        const stop = this.stop;
        const step = this.step;
        return {
            next(): IteratorResult<number> {
                if (current >= stop) {
                    return {
                        done: true,
                        value: undefined,
                    };
                }

                const value = current;
                current += step;
                return {
                    done: false,
                    value,
                };
            },
        };
    }

    toArray(): number[] {
        return Array.from(this);
    }

    get length(): number {
        return Math.max(0, Math.floor((this.stop - this.start + this.step - 1) / this.step));
    }

    at(index: number): number | undefined {
        if (index < 0) {
            index += this.length;
            if (index < 0) return undefined;
        }
        const value = this.start + index * this.step;
        return value >= this.stop ? undefined : value;
    }

    some(predicate: (value: number) => boolean): boolean {
        for (const v of this) if (predicate(v)) return true;
        return false;
    }

    every(predicate: (value: number) => boolean): boolean {
        for (const v of this) if (!predicate(v)) return false;
        return true;
    }
}
