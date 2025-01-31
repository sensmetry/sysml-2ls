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

import { DeepPartial } from "langium";
import { Disposable } from "vscode-languageserver";
import { recursiveObjectContaining, services } from "../../../../testing";
import { SysMLConfig } from "../../../config";
import { LanguageConfig } from "../../../events";
import { SETTINGS_KEY } from "../configuration-provider";

describe("Configuration provider", () => {
    const provider = services.shared.workspace.ConfigurationProvider;
    const disposables: Disposable[] = [];
    afterEach(() => {
        disposables.forEach((d) => d.dispose());
        disposables.length = 0;
    });

    test("sysml config change event is triggered", () => {
        const cb = jest.fn();
        disposables.push(services.shared.Events.onConfigurationChanged.add(cb));

        const old = provider.get();
        const config: DeepPartial<SysMLConfig> = {
            trace: {
                server: "verbose",
            },
            debug: {
                linkingTrace: true,
            },
        };
        provider.updateConfiguration({
            settings: {
                [SETTINGS_KEY]: config,
            },
        });

        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenCalledWith(old, recursiveObjectContaining(config));
    });

    test.each(["SysML", "KerML"] as const)(
        "%s language config change event is triggered",
        (lang) => {
            const cb = jest.fn();
            disposables.push(services[lang].Events.onConfigurationChanged.add(cb));

            const section = provider["toSectionName"](lang.toLowerCase());
            const old = provider["settings"][section];
            const config: LanguageConfig = {
                "editor.insertSpaces": true,
                "editor.tabSize": 2,
                "editor.autoIndent": "advanced",
            };
            provider.updateConfiguration({
                settings: {
                    [section]: config,
                },
            });

            expect(cb).toHaveBeenCalledTimes(1);
            expect(cb).toHaveBeenCalledWith(old, recursiveObjectContaining(config));
        }
    );
});
