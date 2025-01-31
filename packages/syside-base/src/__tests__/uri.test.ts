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

import { isUriLike, pathToURI, resolvePathURI } from "../uri";
import { URI } from "vscode-uri";

describe("isUriLike", () => {
    it("should return true for URIs", () => {
        expect(isUriLike(URI.file("some/file").toString())).toBeTruthy();
    });

    it("should return false for paths", () => {
        expect(isUriLike("/some/file")).toBeFalsy();
    });

    it("should return false for absolute windows paths", () => {
        expect(isUriLike("C:/some/file")).toBeFalsy();
    });
});

describe("pathToURI", () => {
    it("should return file URI for path", () => {
        expect(pathToURI("/bin/sh").toString()).toEqual("file:///bin/sh");
    });

    it("should return same URI for URIs", () => {
        expect(pathToURI("https://github.com").toString()).toEqual("https://github.com/");
    });

    it("should return file URI absolute windows paths", () => {
        expect(pathToURI("C:/some/file").toString()).toEqual("file:///c%3A/some/file");
    });
});

describe("resolvePathURI", () => {
    it("should return file URI for path", () => {
        expect(resolvePathURI("./a").toString()).toMatch(/^file:\/\/.*\/a$/);
    });

    it("should return same URI for URIs", () => {
        expect(resolvePathURI("https://github.com").toString()).toEqual("https://github.com/");
    });
});
