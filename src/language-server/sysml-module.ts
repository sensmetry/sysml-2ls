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
    createDefaultModule,
    createDefaultSharedModule,
    DeepPartial,
    DefaultSharedModuleContext,
    inject,
    Module,
    PartialLangiumSharedServices,
} from "langium";
import {
    SysMlGeneratedSharedModule,
    KerMLGeneratedModule,
    SysMLGeneratedModule,
} from "./generated/module";
import { SysMLValidationRegistry } from "./services/validation/sysml-validation-registry";
import { SysMLScopeComputation } from "./services/references/scope-computation";
import { SysMLNameProvider } from "./services/references/name-provider";
import { SysMLDocumentBuilder } from "./services/shared/workspace/document-builder";
import { SysMLLinker } from "./services/references/linker";
import { SysMLIndexManager } from "./services/shared/workspace/index-manager";
import { SysMLScopeProvider } from "./services/references/scope-provider";
import { SysMLCompletionProvider } from "./services/lsp/completion-provider";
import { SysMLDocumentValidator } from "./services/validation/document-validator";
import { SysMLAstReflection } from "./services/sysml-ast-reflection";
import { SysMLMetamodelBuilder } from "./services/shared/workspace/metamodel-builder";
import {
    SysMLServices,
    SysMLAddedServices,
    KerMLServices,
    KerMLAddedServices,
    SysMLSharedServices,
    SysMLAddedSharedServices,
    PartialSysMLDefaultServices,
    SysMLDefaultServices,
} from "./services/services";
import { createSysMLParser } from "./services/parser/parser";
import { DefaultAstNodeLocator } from "langium/lib/workspace/ast-node-locator";
import { SysMLNodeDescriptionProvider } from "./services/shared/workspace/ast-descriptions";
import { SysMLExecuteCommandHandler } from "./services/lsp/execute-command-handler";
import { SysMLWorkspaceManager } from "./services/shared/workspace/workspace-manager";
import { SysMLDocumentFactory } from "./services/shared/workspace/documents";
import { DefaultSysMLConfig, SysMLConfig } from "./services/config";
import { BuiltinFunctionEvaluator } from "./model/expressions/evaluator";
import { mergeWithPartial, PartialKeys, Statistics } from "./utils/common";
import { SysMLSemanticTokenProvider } from "./services/lsp/semantic-token-provider";
import { SysMLLanguageServer } from "./services/lsp/language-server";
import { SysMLConfigurationProvider } from "./services/shared/workspace/configuration-provider";
import { SysMLHoverProvider } from "./services/lsp/hover-provider";
import { SysMLFormatter } from "./services/lsp/formatter";
import { createSysMLGrammarConfig } from "./services/parser/grammar-config";
import { KerMLValidationRegistry } from "./services/validation/kerml-validation-registry";
import { KerMLValidator } from "./services/validation/kerml-validator";
import { SysMLValidator } from "./services/validation/sysml-validator";
import { SysMLFileSystemProvider } from "./services/shared/workspace/file-system-provider";

/**
 * Dependency injection module that overrides Langium default services and
 * contributes the declared custom services. The Langium defaults can be
 * partially specified to override only selected services, while the custom
 * services must be fully specified.
 */
export const SysMLDefaultModule: Module<SysMLDefaultServices, PartialSysMLDefaultServices> = {
    parser: {
        LangiumParser: (services) => createSysMLParser(services),
        GrammarConfig: (services) => createSysMLGrammarConfig(services),
    },
    references: {
        ScopeComputation: (services) => new SysMLScopeComputation(services),
        ScopeProvider: (services) => new SysMLScopeProvider(services),
        NameProvider: () => new SysMLNameProvider(),
        Linker: (services) => new SysMLLinker(services),
    },
    validation: {
        DocumentValidator: (services) => new SysMLDocumentValidator(services),
    },
    lsp: {
        Formatter: () => new SysMLFormatter(),
        // RenameProvider: (services) => new SysMLRenameProvider(services),
        CompletionProvider: (services) => new SysMLCompletionProvider(services),
        SemanticTokenProvider: (services) => new SysMLSemanticTokenProvider(services),
        HoverProvider: (services) => new SysMLHoverProvider(services),
    },
    workspace: {
        AstNodeDescriptionProvider: (services) => new SysMLNodeDescriptionProvider(services.shared),
    },
};

export const SysMLModule: Module<SysMLServices, PartialSysMLDefaultServices & SysMLAddedServices> =
    {
        validation: {
            ValidationRegistry: (services) => new SysMLValidationRegistry(services),
            SysMLValidator: () => new SysMLValidator(),
        },
    };

export const KerMLModule: Module<KerMLServices, PartialSysMLDefaultServices & KerMLAddedServices> =
    {
        validation: {
            ValidationRegistry: (services) => new KerMLValidationRegistry(services),
            KerMLValidator: () => new KerMLValidator(),
        },
    };

export const SysMLSharedModule: Module<
    SysMLSharedServices,
    PartialLangiumSharedServices &
        Omit<SysMLAddedSharedServices, "workspace"> & {
            // provider is setup from the context parameter
            workspace: PartialKeys<SysMLAddedSharedServices["workspace"], "FileSystemProvider">;
        }
> = {
    AstReflection: () => new SysMLAstReflection(), // handling for chain references
    workspace: {
        DocumentBuilder: (services) => new SysMLDocumentBuilder(services),
        IndexManager: (services) => new SysMLIndexManager(services),
        MetamodelBuilder: (services) => new SysMLMetamodelBuilder(services),
        AstNodeLocator: () => new DefaultAstNodeLocator(),
        AstNodeDescriptionProvider: (services) => new SysMLNodeDescriptionProvider(services),
        WorkspaceManager: (services) => new SysMLWorkspaceManager(services),
        LangiumDocumentFactory: (services) => new SysMLDocumentFactory(services),
        ConfigurationProvider: (services) => new SysMLConfigurationProvider(services),
    },
    lsp: {
        ExecuteCommandHandler: (services) => new SysMLExecuteCommandHandler(services),
        LanguageServer: (services) => new SysMLLanguageServer(services),
    },
    config: () => DefaultSysMLConfig,
    modelLevelExpressionEvaluator: () => new BuiltinFunctionEvaluator(),
    statistics: () => new Statistics(),
};

export interface SharedModuleContext extends DefaultSharedModuleContext {
    fileSystemProvider: () => SysMLFileSystemProvider;
}

/**
 * Create the full set of services required by Langium.
 *
 * First inject the shared services by merging two modules:
 *  - Langium default shared services
 *  - Services generated by langium-cli
 *
 * Then inject the language-specific services by merging three modules:
 *  - Langium default language-specific services
 *  - Services generated by langium-cli
 *  - Services specified in this file
 *
 * @param context Optional module context with the LSP connection
 * @returns An object wrapping the shared services and the language-specific
 * services
 */
export function createSysMLServices(
    context: SharedModuleContext,
    config?: DeepPartial<SysMLConfig>
): {
    shared: SysMLSharedServices;
    SysML: SysMLServices;
    KerML: KerMLServices;
} {
    const sharedModule = {
        ...SysMLSharedModule,
        config: () => mergeWithPartial<SysMLConfig>(DefaultSysMLConfig, config),
    };

    const shared = inject(
        createDefaultSharedModule(context),
        SysMlGeneratedSharedModule,
        sharedModule
    );
    const SysML = inject(
        createDefaultModule({ shared }),
        SysMLGeneratedModule,
        SysMLDefaultModule,
        SysMLModule
    );
    const KerML = inject(
        createDefaultModule({ shared }),
        KerMLGeneratedModule,
        SysMLDefaultModule,
        KerMLModule
    );
    shared.ServiceRegistry.register(SysML);
    shared.ServiceRegistry.register(KerML);
    return { shared, SysML, KerML };
}
