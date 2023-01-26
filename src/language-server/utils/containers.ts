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

import { JSONConvertible } from "./common";

export class Target<T extends object = object> implements JSONConvertible<T | undefined> {
    protected ref: T | null | undefined;

    constructor(value?: T) {
        this.ref = value;
    }

    get target(): T | undefined {
        return this.ref ?? undefined;
    }

    get cached(): boolean {
        return this.ref !== undefined;
    }

    set(value?: T): void {
        this.ref = value ?? null;
    }

    toJSON(): T | undefined {
        return this.target;
    }

    reset(): void {
        this.ref = undefined;
    }
}
