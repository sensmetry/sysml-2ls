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

import { createSysMLServices } from "../../../sysml-module";
import { SysMLNodeFileSystem } from "../../../node/node-file-system-provider";
import { ExtensionManager } from "../extension-manager";
import { URI } from "vscode-uri";
import path from "path";

const SAMPLES_DIR = path.join(__dirname, "samples");
const SAMPLES = [
    URI.file(path.join(SAMPLES_DIR, "sample.js")),
    URI.file(path.join(SAMPLES_DIR, "sample2.js")),
];

describe("Extension manager", () => {
    const { shared } = createSysMLServices(SysMLNodeFileSystem);

    it.each([[SAMPLES[0]], SAMPLES])(
        "should attempt to load scripts by path",
        async (...uris: URI[]) => {
            const manager = new ExtensionManager(shared);

            const mock = jest.fn();
            manager["loadScript"] = mock;

            await manager.loadScripts(uris);
            expect(mock).toHaveBeenCalledTimes(uris.length);
            uris.forEach((uri, index) => expect(mock).toHaveBeenNthCalledWith(index + 1, uri));
        }
    );

    it("should attempt to load scripts from a directory", async () => {
        const manager = new ExtensionManager(shared);

        const mock = jest.fn();
        manager["loadScript"] = mock;

        await manager.loadScripts(URI.file(SAMPLES_DIR));
        expect(mock).toHaveBeenCalledTimes(SAMPLES.length);
        SAMPLES.forEach((uri, index) => expect(mock).toHaveBeenNthCalledWith(index + 1, uri));
    });

    it("should call activation method of the loaded script", async () => {
        const manager = new ExtensionManager(shared);
        const module = await import(SAMPLES[0].fsPath);
        const mock = jest.fn();
        module.setMock(mock);

        await manager.loadScripts(SAMPLES[0]);

        expect(mock).toHaveBeenCalledTimes(1);
    });
});
