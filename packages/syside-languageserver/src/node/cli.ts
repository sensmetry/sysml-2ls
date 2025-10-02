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

import { Command, InvalidArgumentError, Option } from "commander";
import { assertUnreachable } from "langium";
import { Socket, createConnection } from "net";
import {
    createServerPipeTransport,
    IPCMessageReader,
    IPCMessageWriter,
    MessageReader,
    MessageWriter,
    RAL,
    SocketMessageReader,
    SocketMessageWriter,
} from "vscode-languageserver/node";
import { ArgParser, DefaultLauncherOptions } from "./arg-parser";
import { LauncherOptions } from "../launch";
import { Version } from "../version";

export interface StdioTransport {
    /**
     * LSP uses stdio for communication
     */
    stdio: true;
}
export interface IpcTransport {
    /**
     * LSP uses Node IPC for communication
     */
    nodeIpc: true;
}
export interface SocketTransport {
    /**
     * LSP uses a socket for communication
     */
    socket: number;
    host: string;
    encoding: RAL.MessageBufferEncoding;
}
export interface PipeTransport {
    /**
     * LSP uses named pipe for communication
     */
    pipe: string;
    encoding: RAL.MessageBufferEncoding;
}

export type TransportOptions = IpcTransport | StdioTransport | SocketTransport | PipeTransport;

export type NodeLauncherOptions = LauncherOptions & TransportOptions;

export function sanitizeArg(arg: string): string {
    return arg.startsWith("=") ? arg.substring(1) : arg;
}

export function sanitizedArgHandler<T>(
    handler: (arg: string, previous: T) => T
): (arg: string, previous: T) => T {
    return (arg, previous) => handler(sanitizeArg(arg), previous);
}

export const DefaultNodeLauncherOptions: LauncherOptions = {
    ...DefaultLauncherOptions,
};

export function createArgParser<O extends NodeLauncherOptions = NodeLauncherOptions>(
    options: LauncherOptions = DefaultNodeLauncherOptions
): ArgParser<O> {
    const command = new Command()
        .version(Version)
        .description("SysIDE Legacy")
        .showHelpAfterError(true)
        .name("Launch SysIDE Legacy");

    // need to sanitize args for leading `=` since that is what
    // vscode-languageclient passes
    // exposing all implicit vscode-languageserver options here
    command
        .addOption(
            new Option("--node-ipc", "Use Node IPC for LSP communication").conflicts([
                "stdio",
                "socket",
                "pipe",
                "host",
                "encoding",
            ])
        )
        .addOption(
            new Option("--stdio", "Use stdio for LSP communication").conflicts([
                "node-ipc",
                "socket",
                "pipe",
                "host",
                "encoding",
            ])
        )
        .addOption(
            new Option("-s, --socket <socket>", "Use socket for LSP communication")
                .conflicts(["node-ipc", "stdio", "pipe"])
                .argParser(sanitizedArgHandler(parsePort))
        )
        .addOption(
            new Option("--pipe <pipe>", "Use named pipe for LSP communication")
                .conflicts(["node-ipc", "stdio", "socket", "host"])
                .argParser(sanitizeArg)
        )
        .addOption(
            new Option("--host <hostname>", "Socket hostname")
                .default("localhost")
                .conflicts(["node-ipc", "stdio", "pipe"])
        )
        .addOption(
            new Option("-e, --encoding <encoding>", "Socket/pipe encoding")
                .default("utf-8")
                .choices(["utf-8", "ascii"])
                .conflicts(["node-ipc", "stdio"])
        )
        // clientProcessId is used implicitly by vscode-languageserver
        .option(
            "--clientProcessId <id>",
            "Client process ID. The server will shutdown if the client dies unexpectedly",
            sanitizedArgHandler(parsePositiveInt)
        );

    return {
        command,
        parse: (argv, opts): O => {
            command.parse(argv, opts);
            return { ...options, ...command.opts<O>() };
        },
    };
}

export function parsePositiveInt(value: string): number {
    const int = Number.parseInt(value, 10);
    if (isNaN(int)) {
        throw new InvalidArgumentError("Value is not a number!");
    }
    if (int < 0) {
        throw new InvalidArgumentError("Value has to be positive!");
    }

    return int;
}

export function parsePort(value: string): number {
    const port = Number.parseInt(value, 10);
    if (isNaN(port)) {
        throw new InvalidArgumentError("Port is not a number!");
    }
    if (port < 0 || port > 65535) {
        throw new InvalidArgumentError("Port has to be between in range (0, 65535)!");
    }

    return port;
}

export function createServerSocketTransport(
    port: number,
    host: string,
    encoding: RAL.MessageBufferEncoding = "utf-8"
): [MessageReader, MessageWriter] {
    const socket: Socket = createConnection(port, host);
    return [new SocketMessageReader(socket, encoding), new SocketMessageWriter(socket, encoding)];
}

export function createTransport(
    options: StdioTransport
): [NodeJS.ReadableStream, NodeJS.WritableStream];
export function createTransport(
    options: IpcTransport | SocketTransport | PipeTransport
): [MessageReader, MessageWriter];
export function createTransport(
    options: TransportOptions
): [MessageReader, MessageWriter] | [NodeJS.ReadableStream, NodeJS.WritableStream];

export function createTransport(
    options: TransportOptions
): [MessageReader, MessageWriter] | [NodeJS.ReadableStream, NodeJS.WritableStream] {
    if ("nodeIpc" in options) {
        return [new IPCMessageReader(process), new IPCMessageWriter(process)];
    }

    if ("stdio" in options) {
        return [process.stdin, process.stdout];
    }

    if ("pipe" in options) {
        return createServerPipeTransport(options.pipe, options.encoding);
    }

    if ("socket" in options) {
        return createServerSocketTransport(options.socket, options.host, options.encoding);
    }

    assertUnreachable(options);
}
