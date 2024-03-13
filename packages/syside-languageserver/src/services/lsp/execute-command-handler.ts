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

import {
    AbstractExecuteCommandHandler,
    AstNode,
    DocumentBuilder,
    ExecuteCommandAcceptor,
    ExecuteCommandFunction,
    findDeclarationNodeAtOffset,
    LangiumDocuments,
    ServiceRegistry,
    stream,
} from "langium";
import { CancellationToken, Connection, Disposable } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { UriComponents } from "vscode-uri/lib/umd/uri";
import {
    Element,
    Feature,
    FeatureValue,
    InlineExpression,
    isElement,
    Type,
} from "../../generated/ast";
import { JSONMetaReplacer, JSONreplacer, toJSON } from "../../utils/common";
import { SysMLSharedServices } from "../services";
import { FeatureMeta, Metamodel } from "../../model";
import { RegisterTextEditorCommandsRequest } from "syside-protocol";
import { makeLinkingScope } from "../../utils/scopes";

type EditorCommand<T> = (
    editor: RegisterTextEditorCommandsRequest.Parameters,
    cancelToken: CancellationToken
) => T;
type DocumentCommand<T> = (doc: UriComponents, cancelToken: CancellationToken) => T;
type SimpleCommand<T> = (cancelToken: CancellationToken) => T;

const CommandMap = Map<string, ExecuteCommandFunction>;

const TEXT_EDITOR_FUNCTIONS = new CommandMap();
const SIMPLE_COMMANDS = new CommandMap();
const DOCUMENT_COMMANDS = new CommandMap();

/**
 * Wrap function to print the result to console.
 */
function withConsole(fn: ExecuteCommandFunction): ExecuteCommandFunction {
    return async function (this: SysMLExecuteCommandHandler, args, token) {
        const ret = fn.call(this, args, token);
        Promise.resolve(ret).then((value) => {
            if (typeof value === "string") console.log(value);
            else console.log(JSON.stringify(value, undefined, 2));
        });
        return ret;
    };
}

/**
 * Register a custom command
 * @param map map of custom commands
 * @param name custom command identifier
 * @param fn custom command
 */
function addCommand(
    map: Map<string, ExecuteCommandFunction>,
    name: string,
    fn: ExecuteCommandFunction
): void {
    map.set(name, fn);
    map.set(name + ".console", withConsole(fn));
}

function wrapEditorCommand<T>(
    name: string,
    command: EditorCommand<T>,
    thisObj?: ThisParameterType<unknown>
): ExecuteCommandFunction {
    return function (this: unknown, args, cancelToken) {
        if (args.length > 0) return command.call(thisObj ?? this, args[0], cancelToken);
        else throw new Error(`No arguments provided for ${name}`);
    };
}

/**
 * Register an editor command. Use:
 * ```ts
 * \@editorCommand("myCommand")
 * myCommandMethod(editor: RegisterTextEditorCommandsRequest.Parameters, token: CancellationToken): unknown {
 *     ...
 * }
 * ```
 */
function editorCommand(name: string) {
    return function <T>(
        _target: SysMLExecuteCommandHandler,
        _propertyKey: string,
        descriptor: TypedPropertyDescriptor<EditorCommand<T>>
    ): void {
        const fn = descriptor.value;
        if (!fn) return;
        addCommand(TEXT_EDITOR_FUNCTIONS, name, wrapEditorCommand(name, fn));
    };
}

function wrapSimpleCommand<T>(
    name: string,
    command: SimpleCommand<T>,
    thisObj?: ThisParameterType<unknown>
): ExecuteCommandFunction {
    return function (this: unknown, _args, cancelToken) {
        return command.call(thisObj ?? this, cancelToken);
    };
}

/**
 * Register a simple command. Use:
 * ```ts
 * \@simpleCommand("myCommand")
 * myCommandMethod(token: CancellationToken): unknown {
 *     ...
 * }
 * ```
 */
function simpleCommand(name: string) {
    return <T>(
        _target: SysMLExecuteCommandHandler,
        _propertyKey: string,
        descriptor: TypedPropertyDescriptor<SimpleCommand<T>>
    ): void => {
        const fn = descriptor.value;
        if (!fn) return;
        addCommand(SIMPLE_COMMANDS, name, wrapSimpleCommand(name, fn));
    };
}

function wrapDocumentCommand<T>(
    name: string,
    command: DocumentCommand<T>,
    thisObj?: ThisParameterType<unknown>
): ExecuteCommandFunction {
    return function (this: unknown, args, cancelToken) {
        if (args.length > 0) return command.call(thisObj ?? this, args[0], cancelToken);
        else throw new Error(`No arguments provided for ${name}`);
    };
}

/**
 * Register a document command. Use:
 * ```ts
 * \@documentCommand("myCommand")
 * myCommandMethod(doc: UriComponents, token: CancellationToken): unknown {
 *     ...
 * }
 * ```
 */
function documentCommand(name: string) {
    return <T>(
        _target: SysMLExecuteCommandHandler,
        _propertyKey: string,
        descriptor: TypedPropertyDescriptor<DocumentCommand<T>>
    ): void => {
        const fn = descriptor.value;
        if (!fn) return;
        addCommand(DOCUMENT_COMMANDS, name, wrapDocumentCommand(name, fn));
    };
}

export class SysMLExecuteCommandHandler extends AbstractExecuteCommandHandler {
    protected readonly documents: LangiumDocuments;
    protected readonly builder: DocumentBuilder;
    protected readonly registry: ServiceRegistry;
    protected readonly shared: SysMLSharedServices;
    protected readonly connection: Connection | undefined;

    constructor(services: SysMLSharedServices) {
        super();
        this.documents = services.workspace.LangiumDocuments;
        this.builder = services.workspace.DocumentBuilder;
        this.registry = services.ServiceRegistry;
        this.connection = services.lsp.Connection;
        this.shared = services;

        // editor functions require parameters that are not sent by default by
        // the language client so register them explicitly after initialization
        services.lsp.LanguageServer.onInitialized((_) => {
            this.registerCustomClientCommands();
            this.connection?.sendRequest(RegisterTextEditorCommandsRequest.type, {
                commands: Array.from(TEXT_EDITOR_FUNCTIONS.keys()),
            });
        });
    }

    /**
     * Register a custom command with the first {@link RegisterTextEditorCommandsRequest.Parameters} argument
     * @param name command name, should be unique
     * @param command command that will be executed
     * @param thisObj `this` that will be used to execute `command`
     * @returns a Disposable that will unregister the command
     */
    registerEditorCommand<T>(
        name: string,
        command: EditorCommand<T>,
        thisObj: ThisParameterType<unknown> = this
    ): Disposable {
        return this.registerCustomCommand(name, command, wrapEditorCommand, thisObj);
    }

    /**
     * Register a custom command with no argument
     * @param name command name, should be unique
     * @param command command that will be executed
     * @param thisObj `this` that will be used to execute `command`
     * @returns a Disposable that will unregister the command
     */
    registerSimpleCommand<T>(
        name: string,
        command: SimpleCommand<T>,
        thisObj: ThisParameterType<unknown> = this
    ): Disposable {
        return this.registerCustomCommand(name, command, wrapSimpleCommand, thisObj);
    }

    /**
     * Register a custom command with the first {@link UriComponents} argument,
     * this is the default argument that is passed by default by the IDE, at
     * least by VS Code.
     * @param name command name, should be unique
     * @param command command that will be executed
     * @param thisObj `this` that will be used to execute `command`
     * @returns a Disposable that will unregister the command
     */
    registerDocumentCommand<T>(
        name: string,
        command: DocumentCommand<T>,
        thisObj: ThisParameterType<unknown> = this
    ): Disposable {
        return this.registerCustomCommand(name, command, wrapDocumentCommand, thisObj);
    }

    protected registerCustomCommand<T>(
        name: string,
        command: T,
        wrapper: (
            name: string,
            command: T,
            thisObj?: ThisParameterType<unknown>
        ) => ExecuteCommandFunction,
        thisObj?: ThisParameterType<unknown>
    ): Disposable {
        const wrapped = wrapper(name, command, thisObj);
        this.registeredCommands.set(name, wrapped);

        return Disposable.create(() => {
            const current = this.registeredCommands.get(name);
            if (current === wrapped) this.registeredCommands.delete(name);
        });
    }

    registerCustomClientCommands(): void {
        for (const [command, fn] of TEXT_EDITOR_FUNCTIONS.entries())
            this.registeredCommands.set(command, fn);
    }

    registerCommands(acceptor: ExecuteCommandAcceptor): void {
        const register = (commands: Map<string, ExecuteCommandFunction>): void => {
            for (const [command, fn] of commands.entries()) acceptor(command, fn);
        };

        register(SIMPLE_COMMANDS);
        register(DOCUMENT_COMMANDS);
    }

    /**
     * @returns the AST under active cursor as JSON string
     */
    @editorCommand("syside.dumpAst")
    protected dumpAst(
        editor: RegisterTextEditorCommandsRequest.Parameters,
        _ = CancellationToken.None
    ): unknown | undefined {
        const node = this.findCursorNode(editor);
        if (!node) return;
        return toJSON(node, JSONreplacer);
    }

    /**
     * @returns the metamodel under active cursor as JSON string
     */
    @editorCommand("syside.dumpMeta")
    protected dumpMeta(
        editor: RegisterTextEditorCommandsRequest.Parameters,
        _ = CancellationToken.None
    ): unknown | undefined {
        const node = this.findCursorNode(editor);
        if (!node?.$meta) return;
        return toJSON(node.$meta, JSONMetaReplacer);
    }

    /**
     * @return array of `"{qualified name} ({specialization kind}, implicit: {is
     * implicit})"` strings of types used in name resolution in the same order
     */
    @editorCommand("syside.mro")
    protected mro(
        editor: RegisterTextEditorCommandsRequest.Parameters,
        _ = CancellationToken.None
    ): string[] {
        const node = this.findCursorNode(editor)?.$meta;
        if (!node?.is(Type)) return [];
        return stream([[node.qualifiedName, node.nodeType(), "self"]])
            .concat(
                node
                    .allSpecializations()
                    .map((s) => [
                        s.element()?.qualifiedName,
                        s.nodeType(),
                        s.isImplied ? "implicit" : "explicit",
                    ])
            )
            .map(([name, type, kind]) => `${name} (${type}, ${kind})`)
            .toArray();
    }

    /**
     * @returns array of qualified children names visible to the linker in the
     * scope of the AST node under active cursor
     */
    @editorCommand("syside.children")
    protected children(
        editor: RegisterTextEditorCommandsRequest.Parameters,
        _ = CancellationToken.None
    ): string[] {
        const node = this.findCursorNode(editor)?.$meta;
        if (!node?.is(Element)) return [];
        // also return private children
        return makeLinkingScope(node, { skipParents: true })
            .getAllElements()
            .map((d) => `${d.name} [${isElement(d.node) ? d.node.$meta.qualifiedName : ""}]`)
            .toArray();
    }

    /**
     * @returns array of all qualified names visible to linker in the scope of
     * the AST node under active cursor
     */
    @editorCommand("syside.scope")
    protected scope(
        editor: RegisterTextEditorCommandsRequest.Parameters,
        _ = CancellationToken.None
    ): string[] {
        const node = this.findCursorNode(editor)?.$meta;
        if (!node?.is(Element)) return [];
        // also return private children
        return makeLinkingScope(node)
            .getAllExportedElements()
            .map(([name, d]) => `${name} [${d.element()?.qualifiedName}]`)
            .toArray();
    }

    /**
     * Evaluate the inline expression or the feature value of the AST node under
     * active cursor
     * @returns result of the evaluated inline expression
     */
    @editorCommand("syside.evaluate")
    protected evaluate(
        editor: RegisterTextEditorCommandsRequest.Parameters,
        _ = CancellationToken.None
    ): unknown | undefined {
        const node = this.findCursorNode(editor)?.$meta;
        if (!node) return;
        const evaluator = this.shared.Evaluator;
        if (node.is(InlineExpression)) {
            let parent: Metamodel | undefined = node.owner();
            while (parent && !parent.is(Element)) parent = parent.owner();
            if (parent) return toJSON(evaluator.evaluate(node, parent), JSONreplacer);
        } else if (node.is(Feature)) {
            if (!node.value) return;
            const expression = node.value.element();
            if (!expression) return;
            return toJSON(evaluator.evaluate(expression, node), JSONreplacer);
        } else if (node.is(FeatureValue)) {
            const expression = node.element();
            if (!expression) return;
            return toJSON(
                evaluator.evaluate(expression, node.parent() as FeatureMeta),
                JSONreplacer
            );
        }
        return;
    }

    /**
     * @see {@link editorCommand}
     * @returns array of available editor commands
     */
    @simpleCommand("syside.editorCommands")
    protected getEditorCommands(_ = CancellationToken.None): string[] {
        return Array.from(TEXT_EDITOR_FUNCTIONS.keys());
    }

    /**
     * @see {@link simpleCommand}
     * @returns array of available simple commands
     */
    @simpleCommand("syside.simpleCommands")
    protected getSimpleCommands(_ = CancellationToken.None): string[] {
        return Array.from(SIMPLE_COMMANDS.keys());
    }

    /**
     * @see {@link editorCommand}
     * @see {@link simpleCommand}
     * @see {@link documentCommand}
     * @returns array of all available commands
     */
    @simpleCommand("syside.allCommands")
    protected getAllCommands(_ = CancellationToken.None): string[] {
        return this.commands;
    }

    /**
     * Try updating a document
     * @param uriComp URI components of the document to update
     * @param token cancellation token
     */
    @documentCommand("syside.updateDocument")
    protected async updateDocument(
        uriComp: UriComponents,
        token = CancellationToken.None
    ): Promise<void> {
        const uri = URI.from(uriComp);
        await this.builder.update([uri], [], token);
    }

    override async executeCommand(
        name: string,
        args: unknown[],
        cancelToken: CancellationToken
    ): Promise<unknown> {
        const command = this.registeredCommands.get(name);
        if (command) {
            return command.call(this, args, cancelToken);
        } else {
            return undefined;
        }
    }

    /**
     * Find node under current selection
     * @param editor
     * @returns `AstNode` if found, undefined otherwise
     */
    protected findCursorNode(
        editor: RegisterTextEditorCommandsRequest.Parameters
    ): AstNode | undefined {
        const uri = URI.parse(editor.document.uri);
        if (!this.documents.hasDocument(uri)) return;
        const document = this.documents.getOrCreateDocument(uri);
        const rootNode = document.parseResult.value.$cstNode;
        if (!rootNode) return;
        const leaf = findDeclarationNodeAtOffset(
            rootNode,
            document.textDocument.offsetAt(editor.selection.active)
        );
        return leaf?.element;
    }
}
