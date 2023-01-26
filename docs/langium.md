# Langium

Langium is implemented as a collection of services that can be customized. Shared services, shared between all registered languages:

* `ServiceRegistry` - register language services and retrieve services for a given URI (file extension)
* `lsp`
  * `Connection` - language server connection and request dispatcher [optional]
  * `DocumentLinkProvider` - language-specific service for handling document link requests [optional]
  * `ExecuteCommandHandler` - service for executing custom commands [optional]
  * `LanguageServer` - language server itself
* `workspace`
  * `DocumentBuilder` - service for building documents from parsing to validation
    * `build` - build the document (AST and CST). The build chain is:
      1. `IndexManager::updateContent` - computes document exports through `ScopeComputation::computeExports`
      1. `ScopeComputation::computeScopes` - computes local scopes
      1. `Linker::link` - finds and resolves all references
      1. `IndexManager::updateReferences` - collects and caches all resolved references to identify document dependencies through `ReferenceDescriptionProvider::createDescriptions`
      1. `DocumentValidator::validateDocument` - runs and collects all validation diagnostics to display in the editor
    * `update` - called when a document change is detected
    * `onUpdate` - register callback for document changes before rebuilding
    * `onBuildPhase` - register callback for when document build state changes, default builder skips `DocumentState.Parsed` step
  * `IndexManager` - the index manager is responsible for keeping metadata about symbols and cross-references in the workspace. It is used to look up symbols in the global scope, mostly during linking and completion. This service is shared between all languages of a language server.
    * `getAffectedDocuments` -- returns all documents that could be affected by the changes in documents with provided URIs
  * `LangiumDocuments` - shared service for managing Langium documents (add, create, get, has, invalidate)
  * `LangiumDocumentFactory` - create Langium documents
    * `fromTextDocument`
    * `fromString`
    * `fromModel` - create Langium document from an in-memory model (AST without CST)
  * `TextDocuments` - VSCode text documents manager
  * `WorkspaceManager` - service for collecting source files in the workspace, builds all found documents on initialization
  * `FileSystemProvider` - methods for reading files from an abstract file system
  * `MutexLock` - utility class to execute mutually exclusive actions
  * `ConfigurationProvider` - get and update language configurations
* `AstReflection` - reflection service for the superset of all registered languages

Each language also has its own specific services:

* `lsp`
  * `CompletionProvider` [optional]
  * `DocumentHighlightProvider` [optional]
  * `DocumentSymbolProvider` [optional]
  * `HoverProvider` [optional]
  * `FoldingRangeProvider` [optional]
  * `DefinitionProvider` [optional]
  * `TypeProvider` [optional]
  * `ImplementationProvider` [optional]
  * `ReferencesProvider` [optional]
  * `CodeActionProvider` [optional]
  * `SemanticTokenProvider` [optional]
  * `RenameProvider` [optional]
  * `Formatter` [optional]
  * `SignatureHelp` [optional]
  * `CallHierarchyProvider` [optional]
* `parser`
  * `GrammarConfig`
  * `ValueConverter`
  * `LangiumParser`
  * `CompletionParser`
  * `TokenBuilder`
* `references`
  * `Linker` - language-specific service for resolving cross-references in the AST
    * `(un)link` - (un)resolve references in a document
    * `getCandidate` - find the reference node or return an error
    * `buildReference` - actually create the reference object, unlikely to be needed to reimplement
  * `NameProvider` - utility service for retrieving the `name` of an `AstNode` or the `CstNode` containing a `name`
    * `getName` - get AST node name
    * `getNameNode` - get CST node for the name property
  * `References` - language-specific service for finding references and declaration of a given `CstNode`
    * `findDeclaration`
    * `findDeclarationNode`
    * `findReferences`
  * `ScopeProvider` - language-specific service for determining the scope of target elements visible in a specific cross-reference context
    * `getScope` - scope of all visible elements from the given reference or AST node
  * `ScopeComputation` - language-specific service for precomputing global and local scopes. The service methods are executed as the first and second phase in the `DocumentBuilder`
    * `computeExports` - return all visible elements from the global scope
    * `computeLocalScopes` - multimap mapping AST nodes to all locally visible elements (flat tree due to allowing multiple same keys)
* `serializer`
  * `JsonSerializer` - utility service for transforming an `AstNode` into a JSON string and vice versa
    * `serialize`
    * `deserialize`
* `validation`
  * `DocumentValidator` - language-specific service for validating `LangiumDocument`s
    * `validateDocument` - collect all validation diagnostics for a given document
  * `ValidationRegistry` - manages a set of `ValidationCheck`s to be applied when documents are validated
    * `register` - register validation checks per AST type
* `workspace`
  * `AstNodeLocator` - language-specific service for locating an `AstNode` in a document, path is in terms of the parsed AST so it is always unique for a given node
    * `getAstNodePath` - unique path of an AST node inside its document
    * `getAstNode` - AST node from its path
  * `AstNodeDescriptionProvider` - language-specific service for creating descriptions of AST nodes to be used for cross-reference resolutions
    * `createDescription` - create a description for a given AST node
  * `ReferenceDescriptionProvider` - language-specific service to create descriptions of all cross-references in a document. These are used by the `IndexManager` to determine which documents are affected and should be rebuilt when a document is changed
    * `createDescriptions` - collect all cross-references in a given document
* `shared` - shared langium services

## To Go Further

Documentation about the Langium framework is available at <https://langium.org>
