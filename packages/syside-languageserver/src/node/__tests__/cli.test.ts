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

import { ArgParser } from "../arg-parser";
import { createArgParser, DefaultNodeLauncherOptions, NodeLauncherOptions } from "../cli";

describe("Node CLI", () => {
    let parser: ArgParser<NodeLauncherOptions>;

    beforeEach(() => {
        parser = createArgParser({ ...DefaultNodeLauncherOptions, host: "my-host " });
    });

    const parse = (args: string): NodeLauncherOptions => {
        return parser.parse(args.split(/\s+/), { from: "user" });
    };

    it.each([
        ["--node-ipc", { nodeIpc: true }],
        ["--stdio", { stdio: true }],
        ["--socket=42 --host=localhost", { socket: 42, host: "localhost" }],
        ["--socket 42 --host localhost", { socket: 42, host: "localhost" }],
        ["--pipe=my-pipe --encoding=ascii", { pipe: "my-pipe", encoding: "ascii" }],
        ["--pipe my-pipe --encoding ascii", { pipe: "my-pipe", encoding: "ascii" }],
        ["--clientProcessId=42", { clientProcessId: 42 }],
        ["--clientProcessId 42", { clientProcessId: 42 }],
    ])("should parse %s", (args, expected) => {
        expect(parse(args)).toMatchObject(expected);
    });

    it.each([
        "--socket -1",
        "--socket 100000000",
        "--socket socket",
        "--clientProcessId -1",
        "--clientProcessId id",
    ])("should fail on invalid input: %s", (args) => {
        parser.command.configureOutput({
            writeErr: jest.fn(),
            writeOut: jest.fn(),
        });
        parser.command.exitOverride();
        expect(() => parse(args)).toThrow();
    });
});
