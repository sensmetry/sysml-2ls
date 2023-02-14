grammar SysML

import 'KerML.interfaces'
import 'SysML.interfaces'
import 'KerML.expressions'

//! NOTE: Body items have been expanded everywhere since fragments with non-unit
// multiplicity only assign the last parsed element. Also, the result members
// MUST be in the same fragment as the other elements so that the unbounded
// lookahead strategy can consider it as a valid parser rule instead of only the
// rules in the other fragment. Namely, ReferenceUsage and ResultExpression MUST
// be in the same fragment, otherwise parsing breaks!

// Tokens
// ===================================================================================================

fragment DefinedByToken returns string:
    ':' | 'defined' 'by';

// Enums
// ===================================================================================================

PortionKind returns string:
    'timeslice' | 'snapshot';
TriggerKind returns string:
    'when' | 'at' | 'after';
StateSubactionKind returns string:
    'entry' | 'do' | 'exit';
TransitionFeatureKind returns string:
    'trigger' | 'guard' | 'effect';
RequirementConstraintKind returns string:
    'assume' | 'require';

fragment Variation:
    isVariation?='variation';
fragment Individual:
    isIndividual?='individual';
fragment Portion:
    portionKind=PortionKind;

// Entry
// ===================================================================================================

entry Model returns Namespace:
    PackageBodyItems;

// Dependencies

Dependency<visible> returns Dependency:
    (<visible> Visibility?)? PrefixMetadataMembers? 'dependency' Identification? 'from'?
    client+=ElementReference ( ',' client+=ElementReference )* 'to'
    supplier+=ElementReference ( ',' supplier+=ElementReference )*
    RelationshipBody
;

// Annotations
// ===================================================================================================

// adding guard to base rules breaks KerML parsing...

VisibleComment returns Comment:
    Visibility? Comment;
VisibleDocumentation returns Documentation:
    Visibility? Documentation;
VisibleTextualRepresentation returns TextualRepresentation:
    Visibility? TextualRepresentation;

fragment AnnotatingMember:
    comments+=VisibleComment
	| docs+=VisibleDocumentation
	| reps+=VisibleTextualRepresentation
	| metadata+=MetadataUsage
;

fragment RelationshipBody:
    ';' | '{' 
    ( comments+=VisibleComment
	| docs+=VisibleDocumentation
	| reps+=VisibleTextualRepresentation
	| metadata+=MetadataUsage
    )* 
    '}'
;

// Metadata
// ===================================================================================================

MetadataDefinition<visible> returns MetadataDefinition:
    (<visible> Visibility?)? Abstract? 'metadata' 'def' DefinitionSuffix;
MetadataUsage returns MetadataUsage:
    Visibility? ('metadata' | '@') MetadataUsageDeclaration
	( 'about' about+=ElementReference ( ',' about+=ElementReference )*)?
	MetadataBody
;

fragment MetadataUsageDeclaration:
    ( Identification? DefinedByToken )? typedBy+=MetaclassReference
;
fragment MetadataBody:
    ';' | '{' MetadataBodyItems '}'
;
fragment MetadataBodyItems:
    (elements+=DefinitionElement<true>
    | comments+=VisibleComment
	| docs+=VisibleDocumentation
	| reps+=VisibleTextualRepresentation
	| metadata+=MetadataUsage
    | features+=MetadataBodyUsageFeature
    | aliases+=Alias
    | imports+=Import
    )*
;

MetadataBodyUsage returns ReferenceUsage:
    'ref'? RedefinesToken? OwnedRedefinition
	FeatureSpecializationPart? ValuePart?
	MetadataBody
;
MetadataBodyUsageFeature returns Feature:
    MetadataBodyUsage;

// Packages
// ===================================================================================================

Package<visible> returns Package:
    (<visible> Visibility?)? PrefixMetadataMembers? PackageDeclaration PackageBody;
LibraryPackage<visible> returns LibraryPackage:
    (<visible> Visibility?)? Standard? 'library' PrefixMetadataMembers? PackageDeclaration PackageBody;
fragment PackageDeclaration:
    'package' Identification?;
fragment PackageBody:
    ';' | '{' PackageBodyItems '}';
fragment PackageBodyItems:
    (elements+=DefinitionElement<true>
    | comments+=VisibleComment
	| docs+=VisibleDocumentation
	| reps+=VisibleTextualRepresentation
	| metadata+=MetadataUsage
    | features+=UsageElement<true>
    | filters+=ElementFilter
    | aliases+=Alias
    | imports+=Import
    )*
;

// Package bodies

ElementFilter returns ElementFilter:
    Visibility? 'filter' (expression=InlineExpression) ';';
Alias returns Alias:
    Visibility? 'alias' Identification? 'for' for=ElementReference RelationshipBody;
Import returns Import:
    Visibility? 'import' ImportAll? ImportedNamespace ('[' conditions+=InlineExpression ']')* RelationshipBody;

// Package elements
// ===================================================================================================

DefinitionElement<visible> returns Element:
    Package<visible>
	| LibraryPackage<visible>
	// | AnnotatingElement<visible>
    | Dependency<visible>
	| AttributeDefinition<visible>
	| EnumerationDefinition<visible>
	| OccurrenceDefinition<visible>
	| IndividualDefinition<visible>
	| ItemDefinition<visible>
	| MetadataDefinition<visible>
	| PartDefinition<visible>
	| ConnectionDefinition<visible>
	| FlowConnectionDefinition<visible>
	| InterfaceDefinition<visible>
	| AllocationDefinition<visible>
	| PortDefinition<visible>
	| ActionDefinition<visible>
	| CalculationDefinition<visible>
	| StateDefinition<visible>
	| ConstraintDefinition<visible>
	| RequirementDefinition<visible>
	| ConcernDefinition<visible>
	| CaseDefinition<visible>
	| AnalysisCaseDefinition<visible>
	| VerificationCaseDefinition<visible>
	| UseCaseDefinition<visible>
	| ViewDefinition<visible>
	| ViewpointDefinition<visible>
	| RenderingDefinition<visible>
	| ExtendedDefinition<visible>
;

UsageElement<visible> returns Feature:
    NonOccurrenceUsageElement<visible>
	| OccurrenceUsageElement<visible>
;

// Classifiers
// ===================================================================================================

fragment SubclassificationPart:
    SpecializesToken specializes+=ClassifierReference (',' specializes+=ClassifierReference)*;

// Features
// ===================================================================================================

fragment FeatureDeclaration:
    Identification FeatureSpecializationPart?
    | FeatureSpecializationPart
;

fragment FeatureSpecializationPart:
    ( -> FeatureSpecialization )+ MultiplicityPart? FeatureSpecialization*
    | MultiplicityPart FeatureSpecialization*
;


fragment MultiplicityPart:
    OwnedMultiplicity MultiplicityProperties?
    | MultiplicityProperties
;

fragment FeatureSpecialization:
    Typings | Subsettings | References | Redefinitions
;

fragment Typings:
    DefinedByToken FeatureTypingFrag ( ',' FeatureTypingFrag )*;

fragment Subsettings:
    SubsetsToken subsets+=FeatureChain ( ',' subsets+=FeatureChain )*;

fragment References:
    ReferencesToken references+=FeatureChain;

fragment Redefinitions:
    RedefinesToken redefines+=FeatureChain ( ',' redefines+=FeatureChain )*;

fragment FeatureTypingFrag:
    typedBy+=TypeReferenceOrFeatureChain | conjugates+=ConjugatedPortReference;

fragment OwnedSubsetting:
    subsets+=FeatureChain;

fragment OwnedReferenceSubsetting:
    references+=FeatureChain;

fragment OwnedRedefinition:
    redefines+=FeatureChain;

fragment ConjugatedPortTyping:
    conjugates+=ConjugatedPortReference;

// Multiplicity
// ---------------------------------------------------------------------------------------------------

fragment OwnedMultiplicity:
    multiplicity=MultiplicityBounds;

MultiplicityBounds returns MultiplicityRange:
    '[' range=InlineExpression ']';

// Definition and Usage
// ===================================================================================================

// Definitions
// ---------------------------------------------------------------------------------------------------

fragment BasicDefinitionPrefix:
    Abstract | Variation;

fragment DefinitionPrefix:
    BasicDefinitionPrefix? PrefixMetadataMembers?;

fragment DefinitionSuffix:
    DefinitionDeclaration DefinitionBody;

fragment DefinitionDeclaration:
    Identification? SubclassificationPart?;

fragment DefinitionBody:
    ';' | '{' DefinitionBodyItems '}';

fragment DefinitionBodyItems:
    (elements+=DefinitionElement<true>
    | comments+=VisibleComment
	| docs+=VisibleDocumentation
	| reps+=VisibleTextualRepresentation
	| metadata+=MetadataUsage
    | variants+=VariantUsageMember<true>
    | features+=NonOccurrenceUsageElement<true>
    | (features+=EmptySuccessionFeature)? features+=OccurrenceUsageElement<true>
    | aliases+=Alias
    | => imports+=Import
    )*
;

VariantUsageMember<visible> returns Feature:
    (<visible> Visibility?)? 'variant' VariantUsageElement<false>;

// Usages
// ---------------------------------------------------------------------------------------------------

fragment RefPrefix:
    ( direction=FeatureDirectionKind )?
	BasicDefinitionPrefix? Readonly? Derived? End?
;

fragment Reference:
    isReference?='ref';

fragment BasicUsagePrefix:
    RefPrefix Reference?;

fragment UsagePrefix:
    BasicUsagePrefix PrefixMetadataMembers?;

fragment UsageSuffix:
    UsageDeclaration? UsageCompletion;

fragment UsageDeclaration:
    FeatureDeclaration;

fragment UsageCompletion:
    ValuePart? UsageBody;

fragment UsageBody:
    DefinitionBody;

fragment ValuePart:
    value=FeatureValue
    | value=FeatureValueExpression // pilot also assings another member with empty nodes...
;

FeatureValue returns FeatureValue:
    ( '=' | isInitial?=':=' | isDefault?='default' ( '=' | isInitial?=':=' )? ) expression=InlineExpression;
FeatureValueExpression returns FeatureValue:
    isInitial?=':=' expression=InlineExpression;

// Reference Usages

DefaultReferenceUsage<visible> returns ReferenceUsage:
    (<visible> Visibility?)? RefPrefix UsageDeclaration ValuePart? UsageBody;
ReferenceUsage<visible> returns ReferenceUsage:
    (<visible> Visibility?)? RefPrefix? 'ref' UsageSuffix;
VariantReference<visible> returns ReferenceUsage:
    (<visible> Visibility?)? OwnedReferenceSubsetting FeatureSpecialization* UsageBody;

// Body Elements

NonOccurrenceUsageElement<visible> returns Feature:
    DefaultReferenceUsage<visible>
	| ReferenceUsage<visible>
	| AttributeUsage<visible>
	| EnumerationUsage<visible>
	| BindingConnector<visible>
	| Succession<visible>
	| ExtendedUsage<visible>
;

OccurrenceUsageElement<visible> returns Feature:
    StructureUsageElement<visible> | BehaviorUsageElement<visible>
;

StructureUsageElement<visible> returns Feature:
    OccurrenceUsage<visible>
	| IndividualUsage<visible>
	| PortionUsage<visible>
	| EventOccurrenceUsage<visible>
	| ItemUsage<visible>
	| PartUsage<visible>
	| ViewUsage<visible>
	| RenderingUsage<visible>
	| PortUsage<visible>
	| ConnectionUsage<visible>
	| InterfaceUsage<visible>
	| AllocationUsage<visible>
	| Message<visible>
	| FlowConnectionUsage<visible>
	| SuccessionFlowConnectionUsage<visible>
;

BehaviorUsageElement<visible> returns Feature:
    ActionUsage<visible>
	| CalculationUsage<visible>
	| StateUsage<visible>
	| ConstraintUsage<visible>
	| RequirementUsage<visible>
	| ConcernUsage<visible>
	| CaseUsage<visible>
	| AnalysisCaseUsage<visible>
	| VerificationCaseUsage<visible>
	| UseCaseUsage<visible>
	| ViewpointUsage<visible>
	| PerformActionUsage<visible>
	| ExhibitStateUsage<visible>
	| IncludeUseCaseUsage<visible>
	| AssertConstraintUsage<visible>
	| SatisfyRequirementUsage<visible>
;

VariantUsageElement<visible> returns Feature:
    VariantReference<visible>
	| ReferenceUsage<visible>
	| AttributeUsage<visible>
	| BindingConnector<visible>
	| Succession<visible>
	| OccurrenceUsage<visible>
	| IndividualUsage<visible>
	| PortionUsage<visible>
	| EventOccurrenceUsage<visible>
	| ItemUsage<visible>
	| PartUsage<visible>
	| ViewUsage<visible>
	| RenderingUsage<visible>
	| PortUsage<visible>
	| ConnectionUsage<visible>
	| InterfaceUsage<visible>
	| AllocationUsage<visible>
	| Message<visible>
	| FlowConnectionUsage<visible>
	| SuccessionFlowConnectionUsage<visible>
	| BehaviorUsageElement<visible>
;

// Extension
// ===================================================================================================

ExtendedDefinition<visible> returns Definition:
    (<visible> Visibility?)? BasicDefinitionPrefix? PrefixMetadataMembers 'def' DefinitionSuffix;
ExtendedUsage<visible> returns Usage:
    (<visible> Visibility?)? BasicUsagePrefix PrefixMetadataMembers UsageSuffix;

// Attributes
// ===================================================================================================

AttributeDefinition<visible> returns AttributeDefinition:
    (<visible> Visibility?)? DefinitionPrefix 'attribute' 'def' DefinitionSuffix;
AttributeUsage<visible> returns AttributeUsage:
    (<visible> Visibility?)? UsagePrefix 'attribute' UsageSuffix;

// Enumerations
// ===================================================================================================

EnumerationDefinition<visible> returns EnumerationDefinition:
    (<visible> Visibility?)? 'enum' 'def' DefinitionDeclaration EnumerationBody;
EnumeratedValue<visible> returns EnumerationUsage:
    (<visible> Visibility?)? 'enum'? UsageSuffix;
EnumerationUsage<visible> returns EnumerationUsage:
    (<visible> Visibility?)? UsagePrefix 'enum' UsageSuffix;

fragment EnumerationBody:
    ';' | '{' EnumerationItems '}'
;

fragment EnumerationItems:
    (comments+=VisibleComment
	| docs+=VisibleDocumentation
	| reps+=VisibleTextualRepresentation
	| metadata+=MetadataUsage
    | values+=EnumeratedValue<true>
    )*
;

// Occurrences
// ===================================================================================================

// Occurrence Definitions

fragment OccurrenceDefinitionPrefix:
    BasicDefinitionPrefix?
	Individual? // pilot adds an empty node...
	PrefixMetadataMembers?
;

OccurrenceDefinition<visible> returns OccurrenceDefinition:
    (<visible> Visibility?)? OccurrenceDefinitionPrefix 'occurrence' 'def' DefinitionSuffix;
IndividualDefinition<visible> returns OccurrenceDefinition:
    (<visible> Visibility?)? BasicDefinitionPrefix? Individual 
	PrefixMetadataMembers? 'def' DefinitionSuffix
	// pilot adds an empty node
;

// OccurrenceUsages

fragment OccurrenceUsagePrefix:
    BasicUsagePrefix Individual? Portion? PrefixMetadataMembers?
    // pilot adds another empty node
;

OccurrenceUsage<visible> returns OccurrenceUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'occurrence' UsageSuffix;
IndividualUsage<visible> returns OccurrenceUsage:
    (<visible> Visibility?)? BasicUsagePrefix Individual PrefixMetadataMembers? UsageSuffix;
PortionUsage<visible> returns OccurrenceUsage:
    // pilot adds empty node
    (<visible> Visibility?)? BasicUsagePrefix Individual? Portion PrefixMetadataMembers? UsageSuffix;
EventOccurrenceUsage<visible> returns EventOccurrenceUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'event' (
        OwnedReferenceSubsetting FeatureSpecializationPart?
        | 'occurrence' UsageDeclaration?
    ) UsageCompletion
;

// Occurrence Succession

EmptySuccession returns SuccessionAsUsage:
    // pilot adds an empty node
    'then' OwnedMultiplicity?;
EmptySuccessionFeature returns Feature:
    EmptySuccession;

// Items
// ===================================================================================================

ItemDefinition<visible> returns ItemDefinition:
    (<visible> Visibility?)? OccurrenceDefinitionPrefix 'item' 'def' DefinitionSuffix;
ItemUsage<visible> returns ItemUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'item' UsageSuffix;

// Parts
// ===================================================================================================

PartDefinition<visible> returns PartDefinition:
    (<visible> Visibility?)? OccurrenceDefinitionPrefix 'part' 'def' DefinitionSuffix;
PartUsage<visible> returns PartUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'part' UsageSuffix;

// Ports
// ===================================================================================================

PortDefinition<visible> returns PortDefinition:
    // more empty nodes in pilot
    (<visible> Visibility?)? DefinitionPrefix 'port' 'def' DefinitionSuffix;
ConjugatedPortReference2 returns ConjugatedPortReference:
    '~' QualifiedReferenceChain;
ConjugatedPortReference1 returns ClassifierReference:
    ConjugatedPortReference2;
ConjugatedPortReference returns TypeReference:
    ConjugatedPortReference1;

PortUsage<visible> returns PortUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'port' UsageSuffix;

// Connections
// ===================================================================================================

// Connectors

ConnectorEnd returns ConnectorEnd:
    ( RegularName ReferencesToken )? OwnedReferenceSubsetting OwnedMultiplicity?;

// Binding Connectors

BindingConnector<visible> returns BindingConnectorAsUsage:
    (<visible> Visibility?)? UsagePrefix ( 'binding' UsageDeclaration? )?
	'bind' ends+=ConnectorEnd '=' ends+=ConnectorEnd 
	DefinitionBody
;

// Successions

Succession<visible> returns SuccessionAsUsage:
    (<visible> Visibility?)? UsagePrefix ( 'succession' UsageDeclaration? )? 
	'first' ends+=ConnectorEnd 'then' ends+=ConnectorEnd 
	DefinitionBody
;

// Connection Definitions

ConnectionDefinition<visible> returns ConnectionDefinition:
    (<visible> Visibility?)? OccurrenceDefinitionPrefix 'connection' 'def' DefinitionSuffix;

// Connection Usages

ConnectionUsage<visible> returns ConnectionUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 
	( 'connection' UsageDeclaration?  ( 'connect' ConnectorPart )? 
	| 'connect' ConnectorPart
	) UsageBody
;

fragment ConnectorPart returns ConnectionUsage:
    BinaryConnectorPart | NaryConnectorPart
;

fragment BinaryConnectorPart returns Connector:
    ends+=ConnectorEnd 'to' ends+=ConnectorEnd
;

fragment NaryConnectorPart returns Connector:
    '(' ends+=ConnectorEnd ',' ends+=ConnectorEnd ( ',' ends+=ConnectorEnd )* ')'
;

// Flow Connections
// ===================================================================================================

// Flow Connection Definitions

FlowConnectionDefinition<visible> returns FlowConnectionDefinition:
    (<visible> Visibility?)? OccurrenceDefinitionPrefix 'flow' 'def' DefinitionSuffix;

// Messages

Message<visible> returns FlowConnectionUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'message' MessageDeclaration DefinitionBody;
fragment MessageDeclaration returns FlowConnectionUsage:
    UsageDeclaration? ValuePart? ( 'of' of=ItemFeature )? ( 'from' ends+=MessageEvent 'to' ends+=MessageEvent )?
    | ends+=MessageEvent 'to' ends+=MessageEvent
;
MessageEvent returns EventOccurrenceUsage:
    OwnedReferenceSubsetting;

// Flow Connection Usages

FlowConnectionUsage<visible> returns FlowConnectionUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'flow' FlowConnectionDeclaration DefinitionBody;
SuccessionFlowConnectionUsage<visible> returns SuccessionFlowConnectionUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'succession' 'flow' FlowConnectionDeclaration DefinitionBody;

fragment FlowConnectionDeclaration:
    UsageDeclaration? ValuePart? ( 'of'  of=ItemFeature )? ( 'from' ends+=FlowEnd 'to' ends+=FlowEnd )?
    | ends+=FlowEnd 'to' ends+=FlowEnd
;

// Flow Members

ItemFeature returns ItemFeature:
    PayloadFeature
;

fragment PayloadFeature returns Feature:
    Identification? PayloadFeatureSpecializationPart ValuePart?
	| Identification? ValuePart
    | OwnedFeatureTyping OwnedMultiplicity?
    | OwnedMultiplicity OwnedFeatureTyping
;

// TODO: optimize
fragment PayloadFeatureSpecializationPart returns Feature:
    ( -> FeatureSpecialization )+ MultiplicityPart? FeatureSpecialization*
	| MultiplicityPart FeatureSpecialization+
;

FlowEnd returns ItemFlowEnd:
    redefines+=FeatureChain; // TODO: chain.length >= 2, first chain reference is referenced feature

FlowFeature returns ReferenceUsage:
    redefines+=QualifiedFeatureReference;

// Interfaces
// ===================================================================================================

// Interface Definitions

InterfaceDefinition<visible> returns InterfaceDefinition:
    (<visible> Visibility?)? OccurrenceDefinitionPrefix 'interface' 'def' DefinitionDeclaration InterfaceBody;

fragment InterfaceBody returns Type:
    ';' | '{' InterfaceItems '}'
;

fragment InterfaceItems:
    (elements+=DefinitionElement<true>
    | comments+=VisibleComment
	| docs+=VisibleDocumentation
	| reps+=VisibleTextualRepresentation
	| metadata+=MetadataUsage
    | variants+=VariantUsageMember<true>
    | elements+=InterfaceNonOccurrenceUsageElement<true>
    | (features+=EmptySuccessionFeature)? features+=InterfaceOccurrenceUsageElement<true>
    | aliases+=Alias
    | => imports+=Import
    )*
;

InterfaceNonOccurrenceUsageElement<visible> returns Feature:
    ReferenceUsage<visible>
	| AttributeUsage<visible>
	| EnumerationUsage<visible>
	| BindingConnector<visible>
	| Succession<visible>
;

InterfaceOccurrenceUsageElement<visible> returns Feature:
    DefaultInterfaceEnd | StructureUsageElement<visible> | BehaviorUsageElement<visible>
;

DefaultInterfaceEnd returns PortUsage:
    ( direction=FeatureDirectionKind )? BasicDefinitionPrefix? End UsageSuffix;

// Interface Usages

InterfaceUsage<visible> returns InterfaceUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'interface' InterfaceUsageDeclaration InterfaceBody;
fragment InterfaceUsageDeclaration returns InterfaceUsage:
    UsageDeclaration? ( 'connect' InterfacePart )?
    | InterfacePart
;
fragment InterfacePart returns ConnectionUsage:
    BinaryInterfacePart | NaryInterfacePart;
fragment BinaryInterfacePart:
    ends+=InterfaceEnd 'to' ends+=InterfaceEnd;
fragment NaryInterfacePart:
    '(' ends+=InterfaceEnd ',' ends+=InterfaceEnd ( ',' ends+=InterfaceEnd )* ')';
InterfaceEnd returns PortUsage:
    ( RegularName ReferencesToken )? OwnedReferenceSubsetting OwnedMultiplicity?;


// Allocations
// ===================================================================================================

AllocationDefinition<visible> returns AllocationDefinition:
    (<visible> Visibility?)? OccurrenceDefinitionPrefix 'allocation' 'def' DefinitionSuffix;
AllocationUsage<visible> returns AllocationUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix AllocationUsageDeclaration UsageBody;
fragment AllocationUsageDeclaration:
    'allocation' UsageDeclaration? ('allocate' ConnectorPart)?
    | 'allocate' ConnectorPart
;

// Action
// ===================================================================================================

ActionDefinition<visible> returns ActionDefinition:
    (<visible> Visibility?)? OccurrenceDefinitionPrefix 'action' 'def' DefinitionDeclaration ActionBody;
ActionUsage<visible> returns ActionUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'action' ActionUsageDeclaration ActionBody;
PerformActionUsage<visible> returns PerformActionUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'perform' PerformActionUsageDeclaration ActionBody;
fragment ActionUsageDeclaration:
    UsageDeclaration? ValuePart?;
fragment PerformActionUsageDeclaration:
    (OwnedReferenceSubsetting FeatureSpecializationPart? | 'action' UsageDeclaration?) ValuePart?;

fragment ActionBody:
    ';' | '{' ActionBodyItems '}';
fragment ActionBodyItems:
    (imports+=Import
    | aliases+=Alias
    | elements+=DefinitionElement<true>
    | comments+=VisibleComment
	| docs+=VisibleDocumentation
	| reps+=VisibleTextualRepresentation
	| metadata+=MetadataUsage
    | variants+=VariantUsageMember<true>
    | features+=NonOccurrenceUsageElement<true>
    | (features+=EmptySuccessionFeature)? features+=StructureUsageElement<true>
    | features+=InitialNodeFeature
    | features+=ActionTargetSuccessionFeature<true> // TODO: must be after initial node, behavior usage or action node
    | (features+=EmptySuccessionFeature)? features+=BehaviorUsageElement<true>
    | (features+=EmptySuccessionFeature)? features+=ActionNodeFeature<true>
    | features+=GuardedSuccessionFeature
    )*
;

GuardedSuccessionFeature returns Feature:
    GuardedSuccession;
ActionTargetSuccessionFeature<visible> returns Feature:
    ActionTargetSuccession<visible>;
ActionNodeFeature<visible> returns Feature:
    ActionNode<visible>;

InitialNode infers InitialNode:
    Visibility? 'first' element=QualifiedFeatureReference RelationshipBody;
InitialNodeFeature returns Feature:
    InitialNode;

// Action Nodes

ActionNode<visible> returns ActionUsage:
    SendNode<visible>
    | AcceptNode<visible>
    | AssignmentNode<visible>
	| IfNode<visible>
    | WhileLoopNode<visible>
    | ForLoopNode<visible>
	| ControlNode<visible>
;

fragment ActionNodeUsageDeclaration returns ActionUsage:
    'action' UsageDeclaration?;

fragment ActionNodePrefix returns ActionUsage:
    OccurrenceUsagePrefix ActionNodeUsageDeclaration?;

AcceptNode<visible> returns AcceptActionUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix AcceptNodeDeclaration ActionBody;

fragment AcceptNodeDeclaration returns ActionUsage:
    ActionNodeUsageDeclaration? 'accept' AcceptParameterPart;

fragment AcceptParameterPart returns ActionUsage:
    parameters+=PayloadParameter ( 'via' via=InlineExpression )?
    // pilot adds an empty node if not 'via'
;

PayloadParameter returns ReferenceUsage:
    PayloadFeature
	| Identification? PayloadFeatureSpecializationPart? trigger=TriggerExpression
;

TriggerExpression infers TriggerInvocationExpression:
    kind=TriggerKind expression=InlineExpression;

SendNode<visible> returns SendActionUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix SendNodeDeclaration ActionBody;

fragment SendNodeDeclaration returns ActionUsage:
    ActionNodeUsageDeclaration? 'send' send=InlineExpression 
	( 'via' via=InlineExpression )?
	( 'to' to=InlineExpression )?
;

AssignmentNode<visible> returns AssignmentActionUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix AssignmentNodeDeclaration ActionBody;

fragment AssignmentNodeDeclaration returns ActionUsage:
    // TODO: something may need to be done with the last chained feature in .left
    ActionNodeUsageDeclaration? 'assign' left=TargetExpression ':=' right=InlineExpression
;

TargetExpression returns InlineExpression:
    BaseExpression
	( {infer FeatureChainExpression.args+=current} '.' args+=FeatureChain)?
	(   ( {OperatorExpression.args+=current} operator='[' args+=SequenceExpression ']' // indexing
        | {InvocationExpression.args+=current} '->' type=TypeReference 
            ( args+=BodyExpression
            | args+=TypeReference // FunctionReferenceExpression in pilot
            | '(' (args+=Argument (',' args+=Argument)* | args+=NamedArgument (',' args+=NamedArgument)*)? ')'
            )
        | {CollectExpression.args+=current} '.' args+=BodyExpression // collect
        | {SelectExpression.args+=current} '.?' args+=BodyExpression // select
        )
	)*
;

IfNode<visible> returns IfActionUsage:
    (<visible> Visibility?)? ActionNodePrefix 'if' condition=InlineExpression body=ActionBodyParameter
	( 'else' else=( ActionBodyParameter | IfNode<false> ) )?
;

ActionBodyParameter returns ActionUsage:
    ( 'action' UsageDeclaration? )? '{' => ActionBodyItems '}';

WhileLoopNode<visible> returns WhileLoopActionUsage:
    (<visible> Visibility?)? ActionNodePrefix
	( 'while' expression=InlineExpression | 'loop' )
	body=ActionBodyParameter
	( 'until' until=InlineExpression ';' )?
;

ForLoopNode<visible> returns ForLoopActionUsage:
    (<visible> Visibility?)? ActionNodePrefix 'for' for=ForVariableDeclaration 'in' expression=InlineExpression body=ActionBodyParameter
;

DummyLoopActionUsage returns LoopActionUsage:
    // force interface instead of a union
    (expression=InlineExpression)? body=ActionBodyParameter;

ForVariableDeclaration returns ReferenceUsage:
    UsageDeclaration
;

ControlNode<visible> returns ControlNode:
    MergeNode<visible>
	| DecisionNode<visible>
	| JoinNode<visible>
	| ForkNode<visible>
;

DummyControlNode returns ControlNode:
    // force ControlNode interface instead of a union
    Visibility? ControlNodePrefix UsageDeclaration? ActionNodeBody;

fragment ControlNodePrefix returns OccurrenceUsage:
    RefPrefix Individual? Portion?;

MergeNode<visible> returns MergeNode:
    (<visible> Visibility?)? ControlNodePrefix 'merge' UsageDeclaration? ActionNodeBody;

DecisionNode<visible> returns DecisionNode:
    (<visible> Visibility?)? ControlNodePrefix 'decide' UsageDeclaration? ActionNodeBody;

JoinNode<visible> returns JoinNode:
    (<visible> Visibility?)? ControlNodePrefix 'join' UsageDeclaration? ActionNodeBody;

ForkNode<visible> returns ForkNode:
    (<visible> Visibility?)? ControlNodePrefix 'fork' UsageDeclaration? ActionNodeBody;

fragment ActionNodeBody returns ControlNode:
    ';' | '{' 
    ( comments+=VisibleComment
	| docs+=VisibleDocumentation
	| reps+=VisibleTextualRepresentation
	| metadata+=MetadataUsage
    )* 
    '}'
;

/* Action Succession */

ActionTargetSuccession<visible> returns Usage:
    (<visible> Visibility?)?
    ( TargetSuccession | GuardedTargetSuccession | DefaultTargetSuccession )
	UsageBody
;

TargetSuccession returns SuccessionAsUsage:
    'then' OwnedMultiplicity? ends+=ConnectorEnd // TODO: validation check
;

GuardedTargetSuccession returns TransitionUsage:
    'if' guard=InlineExpression
	'then' then=TransitionSuccession
;

DefaultTargetSuccession returns TransitionUsage:
    'else' else=TransitionSuccession
;

GuardedSuccession returns TransitionUsage:
    ( 'succession' UsageDeclaration )? 'first'
	source=FeatureChain 
	'if' guard=InlineExpression
	'then' then=TransitionSuccession
	UsageBody
;

// States
// ===================================================================================================

StateDefinition<visible> returns StateDefinition:
    (<visible> Visibility?)? OccurrenceDefinitionPrefix 'state' 'def' DefinitionDeclaration StateBody;
StateUsage<visible> returns StateUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'state' ActionUsageDeclaration StateBody;
fragment StateBody:
    ';' | (isParallel?='parallel')? '{' StateBodyItems '}';
ExhibitStateUsage<visible> returns ExhibitStateUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'exhibit' (OwnedReferenceSubsetting FeatureSpecializationPart? | 'state' UsageDeclaration?) ValuePart? StateBody;

fragment StateBodyItems returns Type:
    (imports+=Import
	| aliases+=Alias
	| elements+=DefinitionElement<true>
    | comments+=VisibleComment
	| docs+=VisibleDocumentation
	| reps+=VisibleTextualRepresentation
	| metadata+=MetadataUsage
	| variants+=VariantUsageMember<true>
	| features+=NonOccurrenceUsageElement<true>
    | (features+=EmptySuccessionFeature)? features+=(StructureUsageElement<true> | BehaviorUsageElement<true>)
    | features+=TargetTransitionUsage<true> // TODO: must be after behavior usage element or another targettransitionusage
	| features+=TransitionUsage<true>
	| subactions+=Subaction<true>
    | features+=EntryTransitionFeature<true> // TODO: must follow entry action or other entry transition
    )*
;

fragment EntryAction<visible>:
    (<visible> Visibility?)? actionKind='entry' StateActionUsage;
fragment DoAction<visible>:
    (<visible> Visibility?)? actionKind='do' StateActionUsage;
fragment ExitAction<visible>:
    (<visible> Visibility?)? actionKind='exit' StateActionUsage;
fragment StateActionUsage:
    ';' | PerformedActionUsage ActionBody
;
Subaction<visible> returns ActionUsage:
    EntryAction<visible> 
	| DoAction<visible> 
	| ExitAction<visible>
;

EntryTransition<visible> returns Usage:
    (<visible> Visibility?)?
	( GuardedTargetSuccession 
	| {SuccessionAsUsage} 'then' then=TransitionSuccession 
	) ';'
;
EntryTransitionFeature<visible> returns Feature:
    EntryTransition<visible>;

fragment PerformedActionUsage:
    {PerformActionUsage} PerformActionUsageDeclaration 
	| {AcceptActionUsage} AcceptNodeDeclaration 
	| {SendActionUsage} SendNodeDeclaration
	| {AssignmentActionUsage} AssignmentNodeDeclaration
;

// Transition Usages

TransitionUsage<visible> returns TransitionUsage:
    (<visible> Visibility?)? 'transition' ( UsageDeclaration? 'first' )? 
	source=FeatureChain
	( trigger=TriggerAction )?
	( 'if' guard=InlineExpression )?
	( 'do' effect=EffectBehaviorUsage )?
	'then' then=TransitionSuccession
	ActionBody
;

TargetTransitionUsage<visible> returns TransitionUsage:
    (<visible> Visibility?)? ( 'transition'
	  ( trigger=TriggerAction )?
	  ( 'if' guard=InlineExpression )?
	  ( 'do' effect=EffectBehaviorUsage )?
	| trigger=TriggerAction
	  ( 'if' guard=InlineExpression )?
	  ( 'do' effect=EffectBehaviorUsage )?
	| 'if' guard=InlineExpression
	  ('do' effect=EffectBehaviorUsage )?
	)?
	'then' then=TransitionSuccession
	ActionBody
;

// TriggerActionMember infers TransitionFeatureMembership:
//     kind='accept' element=TriggerAction;
TriggerAction returns AcceptActionUsage:
    'accept' AcceptParameterPart;
// GuardExpressionMember infers TransitionFeatureMembership:
//     kind='if' element=InlineExpression;
// EffectBehaviorMember infers TransitionFeatureMembership:
//     kind='do' element=EffectBehaviorUsage;
EffectBehaviorUsage returns ActionUsage:
    (PerformedActionUsage ( '{' ActionBodyItems '}' )?)?;
TransitionSuccession returns SuccessionAsUsage:
    ends+=ConnectorEnd;

// Calculations
// ===================================================================================================

CalculationDefinition<visible> returns CalculationDefinition:
    (<visible> Visibility?)? OccurrenceDefinitionPrefix 'calc' 'def' DefinitionDeclaration CalculationBody;
CalculationUsage<visible> returns CalculationUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'calc' CalculationUsageDeclaration CalculationBody;

fragment CalculationUsageDeclaration:
    UsageDeclaration? ValuePart?;
fragment CalculationBody returns Type:
    ';' | '{' CalculationBodyPart '}';
fragment CalculationBodyPart returns Type:
    (imports+=Import
    | aliases+=Alias
    | elements+=DefinitionElement<true>
    | comments+=VisibleComment
	| docs+=VisibleDocumentation
	| reps+=VisibleTextualRepresentation
	| metadata+=MetadataUsage
    | variants+=VariantUsageMember<true>
    | features+=NonOccurrenceUsageElement<true>
    | (features+=EmptySuccessionFeature)? features+=StructureUsageElement<true>
    | features+=InitialNodeFeature
    | features+=ActionTargetSuccessionFeature<true> // TODO: must be after initial node, behavior usage or action node
    | (features+=EmptySuccessionFeature)? features+=BehaviorUsageElement<true>
    | (features+=EmptySuccessionFeature)? features+=ActionNodeFeature<true>
    | features+=GuardedSuccessionFeature
	| return+=ReturnParameter<true>
    )*
	( result=ResultExpression<true> )?
;

ReturnParameter<visible> returns Feature:
    (<visible> Visibility?)? 'return' UsageElement<false>
;
ResultExpression<visible> returns Result:
    (<visible> Visibility?)? expression=InlineExpression;

// Constraints
// ===================================================================================================

ConstraintDefinition<visible> returns ConstraintDefinition:
    (<visible> Visibility?)? OccurrenceDefinitionPrefix 'constraint' 'def' DefinitionDeclaration CalculationBody;
ConstraintUsage<visible> returns ConstraintUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'constraint' CalculationUsageDeclaration CalculationBody;
AssertConstraintUsage<visible> returns AssertConstraintUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'assert' (isNegated?='not')? (OwnedReferenceSubsetting FeatureSpecializationPart? | 'constraint' UsageDeclaration?) CalculationBody;

// Requirements
// ===================================================================================================

RequirementDefinition<visible> returns RequirementDefinition:
    (<visible> Visibility?)? OccurrenceDefinitionPrefix 'requirement' 'def' DefinitionDeclaration RequirementBody;

fragment RequirementBody:
    ';' | '{' RequirementBodyItems '}';

fragment RequirementBodyItems returns Type:
    (elements+=DefinitionElement<true>
    | comments+=VisibleComment
	| docs+=VisibleDocumentation
	| reps+=VisibleTextualRepresentation
	| metadata+=MetadataUsage
    | variants+=VariantUsageMember<true>
    | features+=NonOccurrenceUsageElement<true>
    | (features+=EmptySuccessionFeature)? features+=OccurrenceUsageElement<true>
    | aliases+=Alias
    | => imports+=Import
	| features+=SubjectUsage<true>
	| features+=RequirementConstraintUsage<true>
	| features+=FramedConcernUsage<true>
	| features+=RequirementVerificationUsage<true>
	| features+=ActorUsage<true>
	| features+=StakeholderUsage<true>
    )*
;

SubjectUsage<visible> returns ReferenceUsage:
    (<visible> Visibility?)? isSubject?='subject' PrefixMetadataMembers? UsageSuffix;
RequirementConstraintUsage<visible> returns ConstraintUsage:
    (<visible> Visibility?)? constraintKind=RequirementConstraintKind
    (OwnedReferenceSubsetting FeatureSpecialization* RequirementBody
    | ( PrefixMetadataMembers? 'constraint' | PrefixMetadataMembers ) CalculationUsageDeclaration CalculationBody
    )
;
FramedConcernUsage<visible> returns ConcernUsage:
    (<visible> Visibility?)? isFramed?='frame'
    (OwnedReferenceSubsetting FeatureSpecialization* RequirementBody
    | ( PrefixMetadataMembers? 'concern' | PrefixMetadataMembers ) CalculationUsageDeclaration CalculationBody
    )
;
ActorUsage<visible> returns PartUsage:
    (<visible> Visibility?)? parameterKind='actor' PrefixMetadataMembers? UsageSuffix;
StakeholderUsage<visible> returns PartUsage:
    (<visible> Visibility?)? parameterKind='stakeholder' PrefixMetadataMembers? UsageSuffix;

RequirementUsage<visible> returns RequirementUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'requirement' CalculationUsageDeclaration RequirementBody;
SatisfyRequirementUsage<visible> returns SatisfyRequirementUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'assert'? (isNegated?='not')? 'satisfy'
    (OwnedReferenceSubsetting FeatureSpecializationPart? | 'requirement' UsageDeclaration?)
    ValuePart? ('by' by+=FeatureChain)? RequirementBody
;

// Concerns
// ===================================================================================================

ConcernDefinition<visible> returns ConcernDefinition:
    (<visible> Visibility?)? OccurrenceDefinitionPrefix 'concern' 'def' DefinitionDeclaration RequirementBody;
ConcernUsage<visible> returns ConcernUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'concern' CalculationUsageDeclaration RequirementBody;

// Cases
// ===================================================================================================

CaseDefinition<visible> returns CaseDefinition:
    (<visible> Visibility?)? OccurrenceDefinitionPrefix 'case' 'def' DefinitionDeclaration CaseBody;
fragment CaseBody:
    ';' | '{' => CaseBodyItems '}';
fragment CaseBodyItems returns Type:
    (imports+=Import
    | aliases+=Alias
    | elements+=DefinitionElement<true>
    | comments+=VisibleComment
	| docs+=VisibleDocumentation
	| reps+=VisibleTextualRepresentation
	| metadata+=MetadataUsage
    | variants+=VariantUsageMember<true>
    | features+=NonOccurrenceUsageElement<true>
    | (features+=EmptySuccessionFeature)? features+=StructureUsageElement<true>
    | features+=InitialNodeFeature
    | features+=ActionTargetSuccessionFeature<true> // TODO: must be after initial node, behavior usage or action node
    | (features+=EmptySuccessionFeature)? features+=BehaviorUsageElement<true>
    | (features+=EmptySuccessionFeature)? features+=ActionNodeFeature<true>
    | features+=GuardedSuccessionFeature
	| return+=ReturnParameter<true>
	| features+=SubjectUsage<true>
	| features+=ActorUsage<true>
	| features+=ObjectiveRequirementUsage<true>
    )*
    (result=ResultExpression<true>)?
;
ObjectiveRequirementUsage<visible> returns RequirementUsage:
    (<visible> Visibility?)? requirementKind='objective' PrefixMetadataMembers? CalculationUsageDeclaration RequirementBody;

CaseUsage<visible> returns CaseUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'case' CalculationUsageDeclaration CaseBody;

// Analysis Cases
// ===================================================================================================

AnalysisCaseDefinition<visible> returns AnalysisCaseDefinition:
    (<visible> Visibility?)? OccurrenceDefinitionPrefix 'analysis' 'def' DefinitionDeclaration CaseBody;
AnalysisCaseUsage<visible> returns AnalysisCaseUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'analysis' CalculationUsageDeclaration CaseBody;

// Verification Cases
// ===================================================================================================

VerificationCaseDefinition<visible> returns VerificationCaseDefinition:
    (<visible> Visibility?)? OccurrenceDefinitionPrefix 'verification' 'def' DefinitionDeclaration CaseBody;
VerificationCaseUsage<visible> returns VerificationCaseUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'verification' CalculationUsageDeclaration CaseBody;
RequirementVerificationUsage<visible> returns RequirementUsage:
    (<visible> Visibility?)? requirementKind='verify'
    (OwnedReferenceSubsetting FeatureSpecialization* RequirementBody
    | ( PrefixMetadataMembers? 'requirement' | PrefixMetadataMembers ) CalculationUsageDeclaration RequirementBody
    )
;

// Use Cases
// ===================================================================================================

UseCaseDefinition<visible> returns UseCaseDefinition:
    (<visible> Visibility?)? OccurrenceDefinitionPrefix 'use' 'case' 'def' DefinitionDeclaration CaseBody;
UseCaseUsage<visible> returns UseCaseUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'use' 'case' CalculationUsageDeclaration CaseBody;
IncludeUseCaseUsage<visible> returns IncludeUseCaseUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'include' (OwnedReferenceSubsetting FeatureSpecializationPart? | 'use' 'case' UsageDeclaration?) ValuePart? CaseBody;

// Views
// ===================================================================================================

ViewDefinition<visible> returns ViewDefinition:
    (<visible> Visibility?)? OccurrenceDefinitionPrefix 'view' 'def' DefinitionDeclaration ViewDefinitionBody;
fragment ViewDefinitionBody:
    ';' | '{' ViewDefinitionBodyItems '}'
;
fragment ViewDefinitionBodyItems:
    (elements+=DefinitionElement<true>
    | comments+=VisibleComment
	| docs+=VisibleDocumentation
	| reps+=VisibleTextualRepresentation
	| metadata+=MetadataUsage
    | variants+=VariantUsageMember<true>
    | features+=NonOccurrenceUsageElement<true>
    | (features+=EmptySuccessionFeature)? features+=OccurrenceUsageElement<true>
    | aliases+=Alias
    | => imports+=Import
	| filters+=ElementFilter
	| features+=ViewRenderingUsage<true>
    )*
;
ViewRenderingUsage<visible> returns RenderingUsage:
    (<visible> Visibility?)? 'render' OwnedReferenceSubsetting FeatureSpecialization* UsageBody;

ViewUsage<visible> returns ViewUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'view' UsageDeclaration? ValuePart? ViewBody;
fragment ViewBody:
    ';' | '{' ViewBodyItems '}'
;
fragment ViewBodyItems:
    (elements+=DefinitionElement<true>
    | comments+=VisibleComment
	| docs+=VisibleDocumentation
	| reps+=VisibleTextualRepresentation
	| metadata+=MetadataUsage
    | variants+=VariantUsageMember<true>
    | features+=NonOccurrenceUsageElement<true>
    | (features+=EmptySuccessionFeature)? features+=OccurrenceUsageElement<true>
    | aliases+=Alias
    | => imports+=Import
    | filters+=ElementFilter
    | imports+=Expose<true>
    | features+=ViewRenderingUsage<true>
    )*
;

Expose<visible> returns Expose:
    (<visible> Visibility?)?  'expose' ImportedNamespace ('[' conditions+=InlineExpression ']')* ';';

// Viewpoints
// ===================================================================================================

ViewpointDefinition<visible> returns ViewpointDefinition:
    (<visible> Visibility?)? OccurrenceDefinitionPrefix 'viewpoint' 'def' DefinitionDeclaration RequirementBody;
ViewpointUsage<visible> returns ViewpointUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'viewpoint' CalculationUsageDeclaration RequirementBody;

// Renderings
// ===================================================================================================

RenderingDefinition<visible> returns RenderingDefinition:
    (<visible> Visibility?)? OccurrenceDefinitionPrefix 'rendering' 'def' DefinitionSuffix;
RenderingUsage<visible> returns RenderingUsage:
    (<visible> Visibility?)? OccurrenceUsagePrefix 'rendering' UsageSuffix;

// EXPRESSIONS
// ===================================================================================================

// Operator expressions

InlineExpressionReference infers FeatureReferenceExpression:
    expression=InlineExpression;

ConcreteConditionalExpression returns ConditionalExpression:
    operator='if' args+=NullCoalescingExpression '?' args+=InlineExpressionReference 'else' args+=InlineExpressionReference;
ConditionalExpression returns InlineExpression:
    NullCoalescingExpression | ConcreteConditionalExpression;

NullCoalescingExpression returns InlineExpression:
    ImpliesExpression ( {OperatorExpression.args+=current} operator='??' args+=ImpliesExpressionReference )*;

ImpliesExpression returns InlineExpression:
    OrExpression ( {OperatorExpression.args+=current} operator='implies' args+=OrExpressionReference )*;
ImpliesExpressionReference infers FeatureReferenceExpression:
    expression=ImpliesExpression;

OrExpression returns InlineExpression:
    XorExpression ( {OperatorExpression.args+=current}( operator='|' args+=XorExpression | operator='or' args+=XorExpressionReference) )*;
OrExpressionReference infers FeatureReferenceExpression:
    expression=OrExpression;

XorExpression returns InlineExpression:
    AndExpression ( {OperatorExpression.args+=current} operator='xor' args+=AndExpression )*;
XorExpressionReference infers FeatureReferenceExpression:
    expression=XorExpression;

AndExpression returns InlineExpression:
    EqualityExpression ( {OperatorExpression.args+=current} (operator='&'args+=EqualityExpression | operator='and' args+=EqualityExpressionReference) )*;

EqualityExpression returns InlineExpression:
    ClassificationExpression ( {OperatorExpression.args+=current} operator=EqualityOperator  args+=ClassificationExpression )*;
EqualityExpressionReference infers FeatureReferenceExpression:
    expression=EqualityExpression;

ClassificationExpression returns InlineExpression:
    RelationalExpression ( 
        {OperatorExpression.args+=current} operator=(ClassificationTestOperator | 'as') args+=TypeReference
        )?
    // Note: empty rule breaks parsing here 
	| {OperatorExpression} /* args+=SelfReferenceExpression */ operator=(ClassificationTestOperator | 'as') args+=TypeReference
	| {OperatorExpression} args+=MetadataReference operator=('@@' | 'meta') args+=TypeReference
;
MetadataReference returns MetadataAccessExpression:
    reference=ElementReference;

RelationalExpression returns InlineExpression:
    RangeExpression ( {OperatorExpression.args+=current} operator=RelationalOperator args+=RangeExpression )*;
RangeExpression returns InlineExpression:
    Addition ( {OperatorExpression.args+=current} operator='..' args+=Addition )?;
Addition returns InlineExpression:
    Multiplication ({OperatorExpression.args+=current} operator=('+' | '-') args+=Multiplication)*;
Multiplication returns InlineExpression:
    Exponentation ({OperatorExpression.args+=current} operator=('*' | '/' | '%') args+=Exponentation)*;
Exponentation returns InlineExpression:
    UnaryOperatorExpression ({OperatorExpression.args+=current} operator=('**' | '^') args+=UnaryOperatorExpression)*;
UnaryOperatorExpression returns InlineExpression:
    {OperatorExpression} operator=UnaryOperator args+=ExtentExpression | ExtentExpression;
ExtentExpression returns InlineExpression:
    {OperatorExpression} operator='all' args+=TypeReference | PrimaryExpression;
SequenceExpression returns InlineExpression:
    InlineExpression (',' | {OperatorExpression.args+=current} operator=',' args+=SequenceExpression)?;

Argument returns Argument:
    value=InlineExpression;
NamedArgument returns NamedArgument:
    name=QualifiedFeatureReference '=' value=InlineExpression;

fragment PositionalArguments:
    args+=Argument (',' args+=Argument)*;
fragment NamedArguments:
    args+=NamedArgument (',' args+=NamedArgument)*;

fragment ArgumentList:
    '(' (PositionalArguments | NamedArguments)? ')';

BaseExpression returns InlineExpression:
    NullExpression
    | LiteralExpression 
    | FeatureReferenceExpression 
	| MetadataAccessExpression
	| InvocationExpression 
	| BodyExpression
	| '(' SequenceExpression ')'
;

FeatureReferenceExpression infers FeatureReferenceExpression:
    expression=QualifiedFeatureReference;
MetadataAccessExpression returns MetadataAccessExpression:
    reference=ElementReference '.' 'metadata';
InvocationExpression returns InvocationExpression:
    type=TypeReferenceOrFeatureChain ArgumentList;

InlineExpression returns InlineExpression:
    ConditionalExpression;

PrimaryExpression returns InlineExpression:
    BaseExpression
	( {infer FeatureChainExpression.args+=current} '.' args+=FeatureChain)?
	(   ( {OperatorExpression.args+=current} operator='[' args+=SequenceExpression ']' // indexing
        | {InvocationExpression.args+=current} '->' type=TypeReference 
            ( args+=BodyExpression
            | args+=FunctionReferenceExpression
            | '(' (args+=Argument (',' args+=Argument)* | args+=NamedArgument (',' args+=NamedArgument)*)? ')'
            )
        | {CollectExpression.args+=current} '.' args+=BodyExpression // collect
        | {SelectExpression.args+=current} '.?' args+=BodyExpression // select
        )
        ( {infer FeatureChainExpression.args+=current} '.' args+=FeatureChain)?
	)*
;

FunctionReferenceExpression infers FeatureReferenceExpression:
    expression=TypeReference;

BodyExpression infers FeatureReferenceExpression:
    expression=ExpressionBody;

// The only different expression element to KerML
ExpressionBody returns Expression:
    CalculationBody;

// Hierarchies

MetadataUsageHierarchy1 returns MetadataFeature:
    MetadataUsage;
MetadataUsageHierarchy2 returns ItemUsage:
    MetadataUsage;
MetadataDefinitionHierarchy1 returns ItemDefinition:
    MetadataDefinition<true>;
MetadataDefinitionHierarchy2 returns Metaclass:
    MetadataDefinition<true>;

DefinitionHierarchy returns Classifier:
    ExtendedDefinition<true>;
UsageHierarchy returns Feature:
    ExtendedUsage<true>;

ReferenceUsageHierarchy returns Usage:
    MetadataBodyUsage;

OccurrenceDefinitionHierarchy1 returns Definition:
    OccurrenceDefinition<true>;
OccurrenceDefinitionHierarchy2 returns Class:
    OccurrenceDefinition<true>;
OccurrenceUsageHierarchy returns Usage:
    OccurrenceUsage<true>;

AttributeDefinitionHierarchy1 returns Definition:
    AttributeDefinition<true>;
AttributeDefinitionHierarchy2 returns DataType:
    AttributeDefinition<true>;
AttributeUsageHierarchy returns Usage:
    AttributeUsage<true>;

ItemDefinitionHierarchy1 returns OccurrenceDefinition:
    ItemDefinition<true>;
ItemDefinitionHierarchy2 returns Structure:
    ItemDefinition<true>;
ItemUsageHierarchy returns OccurrenceUsage:
    ItemUsage<true>;

PartDefinitionHierarchy returns ItemDefinition:
    PartDefinition<true>;
PartUsageHierarchy returns ItemUsage:
    PartUsage<true>;

PortUsageHierarchy returns OccurrenceUsage:
    PortUsage<true>;
PortDefinitionHierarchy1 returns OccurrenceDefinition:
    PortDefinition<true>;
PortDefinitionHierarchy2 returns Structure:
    PortDefinition<true>;

// ConjugatedPortReferenceHierarchy returns ClassifierReference:
//     ConjugatedPortReference;

ActionDefinitionHierarchy1 returns OccurrenceDefinition:
    ActionDefinition<true>;
ActionDefinitionHierarchy2 returns Behavior:
    ActionDefinition<true>;
ActionUsageHierarchy1 returns OccurrenceUsage:
    ActionUsage<true>;
ActionUsageHierarchy2 returns Step:
    ActionUsage<true>;

IfActionUsageHierarchy returns ActionUsage:
    IfNode<true>;

StateDefinitionHierarchy returns ActionDefinition:
    StateDefinition<true>;
StateUsageHierarchy returns ActionUsage:
    StateUsage<true>;
ExhibitStateUsageHierarchy1 returns StateUsage:
    ExhibitStateUsage<true>;
ExhibitStateUsageHierarchy2 returns PerformActionUsage:
    ExhibitStateUsage<true>;

ConstraintDefinitionHierarchy1 returns OccurrenceDefinition:
    ConstraintDefinition<true>;
ConstraintDefinitionHierarchy2 returns Predicate:
    ConstraintDefinition<true>;
ConstraintUsageHierarchy1 returns OccurrenceUsage:
    ConstraintUsage<true>;
ConstraintUsageHierarchy2 returns BooleanExpression:
    ConstraintUsage<true>;
AssertConstraintUsageHierarchy1 returns ConstraintUsage:
    AssertConstraintUsage<true>;
AssertConstraintUsageHierarchy2 returns Invariant:
    AssertConstraintUsage<true>;

TransitionUsageHierarchy returns ActionUsage:
    TransitionUsage<true>;
AcceptActionUsageHierarchy returns ActionUsage:
    AcceptNode<true>;

RequirementDefinitionHierarchy returns ConstraintDefinition:
    RequirementDefinition<true>;
RequirementUsageHierarchy returns ConstraintUsage:
    RequirementUsage<true>;
SatisfyRequirementUsageHierarchy1 returns RequirementUsage:
    SatisfyRequirementUsage<true>;
SatisfyRequirementUsageHierarchy2 returns AssertConstraintUsage:
    SatisfyRequirementUsage<true>;

ConcernDefinitionHierarchy returns RequirementDefinition:
    ConcernDefinition<true>;
ConcernUsageHierarchy returns RequirementUsage:
    ConcernUsage<true>;

CalculationDefinitionHierarchy1 returns ActionDefinition:
    CalculationDefinition<true>;
CalculationDefinitionHierarchy2 returns SysMLFunction:
    CalculationDefinition<true>;
CalculationUsageHierarchy1 returns ActionUsage:
    CalculationUsage<true>;
CalculationUsageHierarchy2 returns Expression:
    CalculationUsage<true>;

CaseDefinitionHierarchy returns CalculationDefinition:
    CaseDefinition<true>;
CaseUsageHierarchy returns CalculationUsage:
    CaseUsage<true>;

AnalysisCaseDefinitionHierarchy returns CaseDefinition:
    AnalysisCaseDefinition<true>;
AnalysisCaseUsageHierarchy returns CaseUsage:
    AnalysisCaseUsage<true>;

DummyConnectorAsUsage returns ConnectorAsUsage:
    // force interface instead of a union
    UsageSuffix;
ConnectorAsUsageHierarchy1 returns Usage:
    DummyConnectorAsUsage;
ConnectorAsUsageHierarchy2 returns Connector:
    DummyConnectorAsUsage;
BindingConnectorAsUsageHierarchy1 returns ConnectorAsUsage:
    BindingConnector<true>;
BindingConnectorAsUsageHierarchy2 returns BindingConnector:
    BindingConnector<true>;

ConnectionDefinitionHierarchy1 returns PartDefinition:
    ConnectionDefinition<true>;
ConnectionDefinitionHierarchy2 returns AssociationStructure:
    ConnectionDefinition<true>;
ConnectionUsageHierarchy1 returns PartUsage:
    ConnectionUsage<true>;
ConnectionUsageHierarchy2 returns ConnectorAsUsage:
    ConnectionUsage<true>;

InterfaceDefinitionHierarchy returns ConnectionDefinition:
    InterfaceDefinition<true>;
InterfaceUsageHierarchy returns ConnectionUsage:
    InterfaceUsage<true>;

ViewDefinitionHierarchy returns PartDefinition:
    ViewDefinition<true>;
ViewUsageHierarchy returns PartUsage:
    ViewUsage<true>;

ViewpointDefinitionHierarchy returns RequirementDefinition:
    ViewpointDefinition<true>;
ViewpointUsageHierarchy returns RequirementUsage:
    ViewpointUsage<true>;

RenderingDefinitionHierarchy returns PartDefinition:
    RenderingDefinition<true>;
RenderingUsageHierarchy returns PartUsage:
    RenderingUsage<true>;

VerificationCaseDefinitionHierarchy returns CaseDefinition:
    VerificationCaseDefinition<true>;
VerificationCaseUsageHierarchy returns CaseUsage:
    VerificationCaseUsage<true>;

EnumerationDefinitionHierarchy returns AttributeDefinition:
    EnumerationDefinition<true>;
EnumerationUsageHierarchy returns AttributeUsage:
    EnumerationUsage<true>;

AllocationDefinitionHierarchy returns ConnectionDefinition:
    AllocationDefinition<true>;
AllocationUsageHierarchy returns ConnectionUsage:
    AllocationUsage<true>;

UseCaseDefinitionHierarchy returns CaseDefinition:
    UseCaseDefinition<true>;
UseCaseUsageHierarchy returns CaseUsage:
    UseCaseUsage<true>;
IncludeUseCaseUsageHierarchy1 returns UseCaseUsage:
    IncludeUseCaseUsage<true>;
IncludeUseCaseUsageHierarchy2 returns PerformActionUsage:
    IncludeUseCaseUsage<true>;

FlowConnectionDefinitionHierarchy1 returns ConnectionDefinition:
    FlowConnectionDefinition<true>;
FlowConnectionDefinitionHierarchy2 returns ActionDefinition:
    FlowConnectionDefinition<true>;
FlowConnectionDefinitionHierarchy3 returns Interaction:
    FlowConnectionDefinition<true>;
FlowConnectionUsageHierarchy1 returns ConnectionUsage:
    FlowConnectionUsage<true>;
FlowConnectionUsageHierarchy2 returns ActionUsage:
    FlowConnectionUsage<true>;
FlowConnectionUsageHierarchy3 returns ItemFlow:
    FlowConnectionUsage<true>;
SuccessionFlowConnectionUsageHierarchy2 returns FlowConnectionUsage:
    SuccessionFlowConnectionUsage<true>;
SuccessionFlowConnectionUsageHierarchy3 returns SuccessionItemFlow:
    SuccessionFlowConnectionUsage<true>;

AssignmentActionUsageHierarchy returns ActionUsage:
    AssignmentNode<true>;
TriggerInvocationExpressionHierarchy returns InvocationExpression:
    TriggerExpression;

PerformActionUsageHierarchy1 returns ActionUsage:
    PerformActionUsage<true>;
PerformActionUsageHierarchy2 returns EventOccurrenceUsage:
    PerformActionUsage<true>;

EventOccurrenceUsageHierarchy returns OccurrenceUsage:
    EventOccurrenceUsage<true>;

WhileLoopActionUsageHierarchy returns LoopActionUsage:
    WhileLoopNode<true>;
ForLoopActionUsageHierarchy returns LoopActionUsage:
    ForLoopNode<true>;
LoopActionUsageHierarchy returns ActionUsage:
    WhileLoopActionUsageHierarchy;

SendActionUsageHierarchy returns ActionUsage:
    SendNode<true>;

ControlNodeHierarchy returns ActionUsage:
    ControlNode<true>;
ForkNodeHierarchy returns ControlNode:
    ForkNode<true>;
MergeNodeHierarchy returns ControlNode:
    MergeNode<true>;
JoinNodeHierarchy returns ControlNode:
    JoinNode<true>;
DecisionNodeHierarchy returns ControlNode:
    DecisionNode<true>;

SuccessionAsUsageHierarchy1 returns ConnectorAsUsage:
    Succession<true>;
SuccessionAsUsageHierarchy2 returns Succession:
    Succession<true>;

ExposeHierarchy returns Import:
    Expose<true>;