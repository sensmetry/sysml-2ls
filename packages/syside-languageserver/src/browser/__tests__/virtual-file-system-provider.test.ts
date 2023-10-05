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

import { STDLIB } from "syside-base";
import { VirtualFileSystemProvider } from "../virtual-file-system-provider";
import { URI } from "vscode-uri";

describe("Virtual FS provider", () => {
    const fs = new VirtualFileSystemProvider();

    describe.each(STDLIB.files)("%s", (file) => {
        let uri: URI;

        beforeAll(() => {
            uri = URI.parse(STDLIB.raw + file);
        });

        it("should exist sync", () => {
            expect(fs.existsSync(uri)).toBeTruthy();
        });

        it("should exist async", () => {
            return expect(fs.exists(uri)).resolves.toBeTruthy();
        });

        it("should not sync read files not in cache", () => {
            expect(() => fs.readFileSync(uri)).toThrow();
        });
    });

    // not testing every file since otherwise it would take a long time to run
    // the test
    it("should read files async", async () => {
        const uri = URI.parse(STDLIB.raw + STDLIB.files[0]);
        const contents = await fs.readFile(uri);
        expect(contents).toBeDefined();
        expect(fs.readFileSync(uri)).toEqual(contents);
    });

    it("should throw on foreign urls", async () => {
        return expect(fs.readFile(URI.parse("file://a"))).rejects.toThrowError();
    });

    it("should not read foreign url directories", () => {
        return expect(fs.readDirectory(URI.parse("file://a"))).resolves.toEqual([]);
    });

    it("should read standard library url", async () => {
        const nodes = await fs.readDirectory(URI.parse(STDLIB.raw));
        expect(nodes).toHaveLength(STDLIB.files.length);
        expect(nodes.find((n) => n.isDirectory)).toBeUndefined();
        expect(nodes.find((n) => !n.isFile)).toBeUndefined();
    });
});
