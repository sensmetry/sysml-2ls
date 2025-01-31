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

import { LangiumDocument, MaybePromise } from "langium";
import { Disposable, HoverParams } from "vscode-languageserver";
import { erase } from "../utils/common";
import { SysMLConfig } from "./config";

interface Callback<T extends unknown[], Return> {
    /**
     * The 'this' which will be used when calling the event listener.
     */
    context?: unknown;

    /**
     * The callback function itself
     */
    listener(...args: T): Return;
}

class BaseEvent<T extends unknown[], Return> {
    protected listeners: Callback<T, Return>[] = [];

    /**
     * Register a callback for the event
     * @param listener The listener function will be called when the event happens.
     * @param thisArg The 'this' which will be used when calling the event listener.
     * @param disposables An array to which a {@link Disposable} will be added.
     * @returns
     */
    add(
        listener: (...args: T) => Return,
        thisArg?: unknown,
        disposables?: Disposable[]
    ): Disposable {
        const data: Callback<T, Return> = {
            context: thisArg,
            listener: listener,
        };
        this.listeners.push(data);

        const disposable = Disposable.create(() => {
            erase(this.listeners, data);
        });

        if (disposables) disposables.push(disposable);

        return disposable;
    }

    /**
     * Log a message on listener error
     * @param index index of the listener in {@link listeners} array
     * @param reason error
     */
    protected reportFailure(index: number, reason: unknown): void {
        let message = `'${this.listeners[index].listener.name}' failed: ${reason}`;
        if (reason instanceof Error) message += "\n" + reason.stack;
        console.error(message);
    }

    protected dispatch(...args: T): Return[] {
        const resolved: Return[] = [];
        this.listeners.forEach((cb, index) => {
            try {
                resolved.push(cb.listener.call(cb.context, ...args));
            } catch (reason) {
                this.reportFailure(index, reason);
            }
        });
        return resolved;
    }
}

export class AsyncEvent<T extends unknown[], Return> extends BaseEvent<T, MaybePromise<Return>> {
    /**
     * Trigger an event
     * @param args event arguments
     * @returns successful listener return values
     */
    async emit(...args: T): Promise<Return[]> {
        const results = await Promise.allSettled(this.dispatch(...args));

        const resolved: Return[] = [];
        results.forEach((result, index) => {
            if (result.status === "rejected") {
                this.reportFailure(index, result.reason);
            } else {
                resolved.push(result.value);
            }
        });
        return resolved;
    }
}

export class Event<T extends unknown[], Return> extends BaseEvent<T, Return> {
    /**
     * Trigger an event
     * @param args event arguments
     * @returns successful listener return values
     */
    emit(...args: T): Return[] {
        return this.dispatch(...args);
    }
}

export class SharedEvents {
    /**
     * Event emitted when the language server configuration changes with (old,
     * new) config parameters
     */
    readonly onConfigurationChanged = new Event<[SysMLConfig, SysMLConfig], void>();
}

export type LanguageConfig = Record<string, unknown>;
export class LanguageEvents {
    readonly onHoverRequest = new AsyncEvent<[LangiumDocument, HoverParams], string | undefined>();
    /**
     * Event emitted when a language configuration changes with (old, new)
     * config parameters
     */
    readonly onConfigurationChanged = new Event<[LanguageConfig, LanguageConfig], void>();
}
