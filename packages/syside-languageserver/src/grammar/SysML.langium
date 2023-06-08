grammar SysML

import 'KerML.interfaces'
import 'SysML.interfaces'
import 'KerML.expressions'

// Tokens
// ===================================================================================================

fragment DefinedByToken returns string:
    ':' | 'defined' 'by'
;

// Enums
// ===================================================================================================

PortionKind returns string:
    'timeslice' | 'snapshot';
RequirementConstraintKind returns string:
    'assume' | 'require';

fragment Variation:
    isVariation?='variation'
;
fragment Individual:
    isIndividual?='individual'
;
fragment Portion:
    portionKind=PortionKind
;

// Entry
// ===================================================================================================

entry Model returns Namespace:
    PackageBodyItems
;

// Dependencies

Dependency returns Dependency:
    ( prefixes+=PrefixMetadataAnnotation)* 'dependency' Identification? 'from'?
    client+=ElementReference ( ',' client+=ElementReference )* 'to'
    supplier+=ElementReference ( ',' supplier+=ElementReference )*
    RelationshipBody
;

// Annotations
// ===================================================================================================

OwnedAnnotation returns Annotation:
    element=AnnotatingElement
;

AnnotatingMember returns OwningMembership:
    element=AnnotatingElement
;

AnnotatingElement returns AnnotatingElement:
    Comment 
    | Documentation
    | TextualRepresentation
    | MetadataUsage
;

fragment RelationshipBody:
    ';' | '{' RelationshipBodyElements '}'
;

fragment RelationshipBodyElements:
    ( elements+=OwnedAnnotation )*
;

// Metadata
// ===================================================================================================

MetadataDefinition returns MetadataDefinition:
    Abstract? 'metadata' 'def' DefinitionSuffix
;

PrefixMetadataAnnotation returns Annotation:
    element=PrefixMetadataUsage
;

PrefixMetadataMember returns OwningMembership:
    element=PrefixMetadataUsage
;

fragment PrefixMetadata:
    (prefixes+=PrefixMetadataMember)+
;

PrefixMetadataUsage returns MetadataUsage:
    '#' heritage+=MetadataTyping
;

MetadataUsage returns MetadataUsage:
    ('metadata' | '@') MetadataUsageDeclaration
    ( 'about' about+=Annotation ( ',' about+=Annotation )*)?
    MetadataBody
;

fragment MetadataUsageDeclaration:
    ( Identification? DefinedByToken )? heritage+=MetadataTyping
;

fragment MetadataBody:
    ';' | '{' MetadataBodyItems '}'
;

fragment MetadataBodyItems:
    ( children+=DefinitionMember
    | children+=RelationshipMember
    | children+=VisibleAnnotatingMember
    | children+=MetadataBodyUsageMember
    | children+=AliasMember
    | children+=Import
    )*
;

MetadataBodyUsageMember returns FeatureMembership:
    element=MetadataBodyUsage
;

MetadataBodyUsage returns ReferenceUsage:
    'ref'? RedefinesToken? heritage+=OwnedRedefinition
    FeatureSpecializationPart? ValuePart?
    MetadataBody
;

// Packages
// ===================================================================================================

Package returns Package:
    PrefixMetadata? PackageDeclaration PackageBody
;

LibraryPackage returns LibraryPackage:
    Standard? 'library' PrefixMetadata? PackageDeclaration PackageBody
;

fragment PackageDeclaration:
    'package' Identification?
;

fragment PackageBody:
    ';' | '{' PackageBodyItems '}'
;

fragment PackageBodyItems:
    ( PackageBodyElement )*
;

// Package bodies

fragment PackageBodyElement:
    children+=Import
    | children+=AliasMember
    | children+=ElementFilterMember
    | children+=VisibleAnnotatingMember
    | children+=UsageMember
    | children+=DefinitionMember
    | children+=RelationshipMember
;

UsageMember returns OwningMembership:
    Visibility? element=UsageElement
;

RelationshipMember returns OwningMembership:
    Visibility? element=Dependency
;

ElementFilterMember returns ElementFilterMembership:
    Visibility? 'filter' element=OwnedExpression ';'
;

AliasMember returns Membership:
    Visibility? 'alias' Identification? 'for' reference=ElementReference RelationshipBody
;

// Imports

fragment ImportPrefix:
    Visibility? 'import' ImportAll?
;

// see KerML.langium for the change
fragment ImportedReference:
    reference=ElementReference (isNamespace='::*')? ( isRecursive?='::**' )?
;

Import returns Import:
    ImportPrefix ImportedReference (element=FilterPackage)? RelationshipBody
;

FilterPackage returns Package:
    // imports+=FilterPackageImport
    ( children+=FilterPackageMember )+
;

FilterPackageMember returns ElementFilterMembership:
    // TODO: always private visibility
    '[' element=OwnedExpression ']'
;

// Package elements
// ===================================================================================================

DefinitionElement returns Namespace:
    Package
    | LibraryPackage
    // | AnnotatingElement // in a separate property
    // | Dependency // in a separate property
    | AttributeDefinition
    | EnumerationDefinition
    | OccurrenceDefinition
    | IndividualDefinition
    | ItemDefinition
    | MetadataDefinition
    | PartDefinition
    | ConnectionDefinition
    | FlowConnectionDefinition
    | InterfaceDefinition
    | AllocationDefinition
    | PortDefinition
    | ActionDefinition
    | CalculationDefinition
    | StateDefinition
    | ConstraintDefinition
    | RequirementDefinition
    | ConcernDefinition
    | CaseDefinition
    | AnalysisCaseDefinition
    | VerificationCaseDefinition
    | UseCaseDefinition
    | ViewDefinition
    | ViewpointDefinition
    | RenderingDefinition
    | ExtendedDefinition
;

UsageElement returns Usage:
    NonOccurrenceUsageElement
    | OccurrenceUsageElement
;

// Classifiers
// ===================================================================================================


fragment SubclassificationPart:
    SpecializesToken heritage+=OwnedSubclassification ( ',' heritage+=OwnedSubclassification )*
;

OwnedSubclassification returns Subclassification:
    reference=ClassifierReference
;

// Features
// ===================================================================================================

fragment FeatureDeclaration:
    Identification FeatureSpecializationPart?
    | FeatureSpecializationPart
;

fragment FeatureSpecializationPart:
    FeatureSpecialization+
    | FeatureSpecialization+ MultiplicityPart FeatureSpecialization*
    | MultiplicityPart FeatureSpecialization*
;


fragment MultiplicityPart:
    multiplicity=OwnedMultiplicity MultiplicityProperties?
    | MultiplicityProperties
;

fragment FeatureSpecialization:
    Typings | Subsettings | References | Redefinitions
;

fragment Typings:
    TypedBy ( ',' heritage+=FeatureTyping )*
;

fragment TypedBy:
    DefinedByToken heritage+=FeatureTyping
;

fragment Subsettings:
    Subsets ( ',' heritage+=OwnedSubsetting )*
;

fragment Subsets:
    SubsetsToken heritage+=OwnedSubsetting
;

fragment References:
    ReferencesToken heritage+=OwnedReferenceSubsetting
;

fragment Redefinitions:
    Redefines ( ',' heritage+=OwnedRedefinition )*
;

fragment Redefines:
    RedefinesToken heritage+=OwnedRedefinition
;

/* Feature Typing, Subsetting and Redefinition */

FeatureTyping returns FeatureTyping:
    OwnedFeatureTyping | ConjugatedPortTyping
;

// OwnedFeatureTyping inherited from Expression syntax.

OwnedSubsetting returns Subsetting:
    reference=FeatureReference | targetChain=OwnedFeatureChain
;

OwnedReferenceSubsetting returns ReferenceSubsetting:
    reference=FeatureReference | targetChain=OwnedFeatureChain
;

OwnedRedefinition returns Redefinition:
    reference=FeatureReference | targetChain=OwnedFeatureChain
;


// Multiplicity
// ---------------------------------------------------------------------------------------------------

OwnedMultiplicity returns OwningMembership:
    element=MultiplicityRange
;

MultiplicityRange returns MultiplicityRange:
    '[' range=MultiplicityExpressionMember ']'
;

MultiplicityExpressionMember returns OwningMembership:
    element=OwnedExpression
;

// Definition and Usage
// ===================================================================================================

// Definitions
// ---------------------------------------------------------------------------------------------------

fragment BasicDefinitionPrefix:
    Abstract | Variation
;

fragment DefinitionExtensionKeyword:
    prefixes+=PrefixMetadataMember
;

fragment DefinitionPrefix:
    BasicDefinitionPrefix? DefinitionExtensionKeyword*
;

fragment DefinitionSuffix:
    DefinitionDeclaration DefinitionBody
;

fragment DefinitionDeclaration:
    Identification? SubclassificationPart?
;

fragment DefinitionBody:
    ';' | '{' DefinitionBodyItems '}';

fragment DefinitionBodyItems:
    ( DefinitionBodyItem )*
;

fragment DefinitionBodyItem:
    children+=Import
    | children+=AliasMember
    | children+=VisibleAnnotatingMember
    | children+=RelationshipMember
    | children+=DefinitionMember
    | children+=VariantUsageMember
    | children+=NonOccurrenceUsageMember
    | children+=EmptySuccessionMember // TODO: must precede OccurrenceUsageMember
    | children+=OccurrenceUsageMember
;

DefinitionMember returns OwningMembership:
    Visibility? element=DefinitionElement
;

VisibleAnnotatingMember returns OwningMembership:
    Visibility? element=AnnotatingElement
;

VariantUsageMember returns VariantMembership:
    Visibility? 'variant' element=VariantUsageElement
;

NonOccurrenceUsageMember returns FeatureMembership:
    Visibility? element=NonOccurrenceUsageElement
;

OccurrenceUsageMember returns FeatureMembership:
    Visibility? element=OccurrenceUsageElement
;

StructureUsageMember returns FeatureMembership:
    Visibility? element=StructureUsageElement
;

BehaviorUsageMember returns FeatureMembership:
    Visibility? element=BehaviorUsageElement
;

// Usages
// ---------------------------------------------------------------------------------------------------

fragment RefPrefix:
    ( direction=FeatureDirectionKind )?
    BasicDefinitionPrefix? Readonly? Derived? End?
;

fragment Reference:
    isReference?='ref'
;

fragment BasicUsagePrefix:
    RefPrefix Reference?
;

fragment UsageExtensionKeyword:
    prefixes+=PrefixMetadataMember
;

fragment UsagePrefix:
    BasicUsagePrefix UsageExtensionKeyword*
;

fragment UsageSuffix:
    UsageDeclaration? UsageCompletion
;

fragment UsageDeclaration:
    FeatureDeclaration
;

fragment UsageCompletion:
    ValuePart? UsageBody
;

fragment UsageBody:
    DefinitionBody
;

fragment ValuePart:
    value=FeatureValue
    // TODO: empty rule
    | value=FeatureValueExpression /* write=EmptyAssignmentActionMember */
;

FeatureValue returns FeatureValue:
    ( '=' | isDefault?='default' ( '=' | isInitial?=':=' )? ) element=OwnedExpression
;

FeatureValueExpression returns FeatureValue:
    isInitial?=':=' element=OwnedExpression
;

EmptyAssignmentActionMember returns OwningMembership:
    element=EmptyAssignmentAction
;

EmptyAssignmentAction returns AssignmentActionUsage:
    targetMember=EmptyTargetMember
    assignedValue=EmptyParameterMember
;

EmptyTargetMember returns ParameterMembership:
    element=EmptyTargetParameter
;

EmptyTargetParameter returns ReferenceUsage:
    children+=TargetFeatureMember
;

// Reference Usages

DefaultReferenceUsage returns ReferenceUsage:
    RefPrefix UsageDeclaration ValuePart? UsageBody
;

ReferenceUsage returns ReferenceUsage:
    RefPrefix 'ref' UsageSuffix
;

VariantReference returns ReferenceUsage:
    heritage+=OwnedReferenceSubsetting FeatureSpecialization* UsageBody
;

// Body Elements

NonOccurrenceUsageElement returns Usage:
    DefaultReferenceUsage
    | ReferenceUsage
    | AttributeUsage
    | EnumerationUsage
    | BindingConnector
    | Succession
    | ExtendedUsage
;

OccurrenceUsageElement returns Usage:
    StructureUsageElement | BehaviorUsageElement
;

StructureUsageElement returns Usage:
    OccurrenceUsage
    | IndividualUsage
    | PortionUsage
    | EventOccurrenceUsage
    | ItemUsage
    | PartUsage
    | ViewUsage
    | RenderingUsage
    | PortUsage
    | ConnectionUsage
    | InterfaceUsage
    | AllocationUsage
    | Message
    | FlowConnectionUsage
    | SuccessionFlowConnectionUsage
;

BehaviorUsageElement returns Usage:
    ActionUsage
    | CalculationUsage
    | StateUsage
    | ConstraintUsage
    | RequirementUsage
    | ConcernUsage
    | CaseUsage
    | AnalysisCaseUsage
    | VerificationCaseUsage
    | UseCaseUsage
    | ViewpointUsage
    | PerformActionUsage
    | ExhibitStateUsage
    | IncludeUseCaseUsage
    | AssertConstraintUsage
    | SatisfyRequirementUsage
;

VariantUsageElement returns Usage:
    VariantReference
    | ReferenceUsage
    | AttributeUsage
    | BindingConnector
    | Succession
    | OccurrenceUsage
    | IndividualUsage
    | PortionUsage
    | EventOccurrenceUsage
    | ItemUsage
    | PartUsage
    | ViewUsage
    | RenderingUsage
    | PortUsage
    | ConnectionUsage
    | InterfaceUsage
    | AllocationUsage
    | Message
    | FlowConnectionUsage
    | SuccessionFlowConnectionUsage
    | BehaviorUsageElement
;

// Extension
// ===================================================================================================

ExtendedDefinition returns Definition:
    BasicDefinitionPrefix? DefinitionExtensionKeyword+ 'def' DefinitionSuffix
;

ExtendedUsage returns Usage:
    BasicUsagePrefix UsageExtensionKeyword+ UsageSuffix
;

// Attributes
// ===================================================================================================

AttributeDefinition returns AttributeDefinition:
    DefinitionPrefix 'attribute' 'def' DefinitionSuffix
;

AttributeUsage returns AttributeUsage:
    UsagePrefix 'attribute' UsageSuffix
;

// Enumerations
// ===================================================================================================

EnumerationDefinition returns EnumerationDefinition:
    'enum' 'def' DefinitionDeclaration EnumerationBody
;

fragment EnumerationBody:
    ';' | '{' EnumerationItems '}'
;

fragment EnumerationItems:
    ( children+=AnnotatingMember
    | children+=EnumerationUsageMember
    )*
;

EnumerationUsageMember returns VariantMembership:
    Visibility? element=EnumeratedValue
;

EnumeratedValue returns EnumerationUsage:
    'enum'? UsageSuffix
;

EnumerationUsage returns EnumerationUsage:
    UsagePrefix 'enum' UsageSuffix
;

// Occurrences
// ===================================================================================================

// Occurrence Definitions

fragment OccurrenceDefinitionPrefix:
    BasicDefinitionPrefix?
    // TODO: empty rule
    ( Individual /* members+=LifeClassMembership */ )?
    DefinitionExtensionKeyword*
;

OccurrenceDefinition returns OccurrenceDefinition:
    OccurrenceDefinitionPrefix 'occurrence' 'def' DefinitionSuffix
;

IndividualDefinition returns OccurrenceDefinition:
    BasicDefinitionPrefix? Individual
    DefinitionExtensionKeyword* 'def' DefinitionSuffix
    // TODO: empty rule
    /* members+=LifeClassMembership */
;

// LifeClassMembership returns OwningMembership:
//     element=LifeClass
// ;

// LifeClass returns LifeClass:
//     {LifeClass}
// ;


// Occurrence Usages

fragment OccurrenceUsagePrefix:
    BasicUsagePrefix Individual? Portion? UsageExtensionKeyword*
;

OccurrenceUsage returns OccurrenceUsage:
    OccurrenceUsagePrefix 'occurrence' UsageSuffix
;

IndividualUsage returns OccurrenceUsage:
    BasicUsagePrefix Individual UsageExtensionKeyword* UsageSuffix
;

PortionUsage returns OccurrenceUsage:
    BasicUsagePrefix Individual? Portion UsageExtensionKeyword* UsageSuffix
;

EventOccurrenceUsage returns EventOccurrenceUsage:
    OccurrenceUsagePrefix 'event' (
        heritage+=OwnedReferenceSubsetting FeatureSpecializationPart?
        | 'occurrence' UsageDeclaration?
    ) UsageCompletion
;

// Occurrence Succession

EmptySuccessionMember returns FeatureMembership:
    element=EmptySuccession
;

EmptySuccession returns SuccessionAsUsage:
    'then' (ends+=MultiplicitySourceEndMember)?
    /* ends+=EmptyTargetEndMember */
;

MultiplicitySourceEndMember returns EndFeatureMembership:
    element=MultiplicitySourceEnd
;

MultiplicitySourceEnd returns Feature:
    multiplicity=OwnedMultiplicity
;

// rules that can match empty strings don't always work in langium, commenting
// out to show that they are handled in code instead

// EmptyTargetEndMember returns EndFeatureMembership:
//     element=EmptyTargetEnd
// ;

// EmptyTargetEnd returns Feature:
//     {Feature}
// ;

// Items
// ===================================================================================================

ItemDefinition returns ItemDefinition:
    OccurrenceDefinitionPrefix 'item' 'def' DefinitionSuffix
;

ItemUsage returns ItemUsage:
    OccurrenceUsagePrefix 'item' UsageSuffix
;

// Parts
// ===================================================================================================

PartDefinition returns PartDefinition:
    OccurrenceDefinitionPrefix 'part' 'def' DefinitionSuffix
;

PartUsage returns PartUsage:
    OccurrenceUsagePrefix 'part' UsageSuffix
;

// Ports
// ===================================================================================================

PortDefinition returns PortDefinition:
    DefinitionPrefix 'port' 'def' DefinitionSuffix
    conjugated=ConjugatedPortDefinitionMember
;

ConjugatedPortDefinitionMember returns OwningMembership:
    element=ConjugatedPortDefinition
;

ConjugatedPortDefinition returns ConjugatedPortDefinition:
    heritage+=PortConjugation
;

PortConjugation returns PortConjugation:
    {PortConjugation}
;

ConjugatedPortTyping returns ConjugatedPortTyping:
    '~' reference=ConjugatedPortReference
;

ConjugatedPortReference returns ConjugatedPortReference:
    QualifiedReferenceChain
;

// Port Usages

PortUsage returns PortUsage:
    OccurrenceUsagePrefix 'port' UsageSuffix
;

// Connections
// ===================================================================================================

// Connectors

ConnectorEndMember returns EndFeatureMembership:
    element=ConnectorEnd
;

ConnectorEnd returns Feature:
    ( RegularName ReferencesToken )? heritage+=OwnedReferenceSubsetting (multiplicity=OwnedMultiplicity)?
;

// Binding Connectors

BindingConnector returns BindingConnectorAsUsage:
    UsagePrefix ( 'binding' UsageDeclaration? )?
    'bind' ends+=ConnectorEndMember '=' ends+=ConnectorEndMember 
    DefinitionBody
;

// Successions

Succession returns SuccessionAsUsage:
    UsagePrefix ( 'succession' UsageDeclaration? )? 
    'first' ends+=ConnectorEndMember 'then' ends+=ConnectorEndMember 
    DefinitionBody
;

// Connection Definitions

ConnectionDefinition returns ConnectionDefinition:
    OccurrenceDefinitionPrefix 'connection' 'def' DefinitionSuffix
;

// Connection Usages

ConnectionUsage returns ConnectionUsage:
    OccurrenceUsagePrefix 
    ( 'connection' UsageDeclaration?  ( 'connect' ConnectorPart )? 
    | 'connect' ConnectorPart
    ) UsageBody
;

fragment ConnectorPart:
    BinaryConnectorPart | NaryConnectorPart
;

fragment BinaryConnectorPart:
    ends+=ConnectorEndMember 'to' ends+=ConnectorEndMember
;

fragment NaryConnectorPart:
    '(' ends+=ConnectorEndMember ( ',' ends+=ConnectorEndMember )+ ')'
;

EmptySourceEndMember returns EndFeatureMembership:
    element=EmptySourceEnd
;

EmptySourceEnd returns Feature:
    {Feature}
;


// Flow Connections
// ===================================================================================================

// Flow Connection Definitions

FlowConnectionDefinition returns FlowConnectionDefinition:
    OccurrenceDefinitionPrefix 'flow' 'def' DefinitionSuffix
;

// Messages

Message returns FlowConnectionUsage:
    OccurrenceUsagePrefix 'message' MessageDeclaration DefinitionBody
;

fragment MessageDeclaration:
    UsageDeclaration? ValuePart? ( 'of' item=ItemFeatureMember )?
        ( 'from' ends+=MessageEventMember 'to' ends+=MessageEventMember )?
    | ends+=MessageEventMember 'to' ends+=MessageEventMember
;

MessageEventMember returns ParameterMembership:
    element=MessageEvent
;

MessageEvent returns EventOccurrenceUsage:
    heritage+=OwnedReferenceSubsetting
;

// Flow Connection Usages

FlowConnectionUsage returns FlowConnectionUsage:
    OccurrenceUsagePrefix 'flow' FlowConnectionDeclaration DefinitionBody
;

SuccessionFlowConnectionUsage returns SuccessionFlowConnectionUsage:
    OccurrenceUsagePrefix 'succession' 'flow' FlowConnectionDeclaration DefinitionBody
;

fragment FlowConnectionDeclaration:
    UsageDeclaration? ValuePart? ( 'of'  item=ItemFeatureMember )?
        ( 'from' ends+=FlowEndMember 'to' ends+=FlowEndMember )?
    | ends+=FlowEndMember 'to' ends+=FlowEndMember
;

// Flow Members

ItemFeatureMember returns FeatureMembership:
    element=ItemFeature
;

ItemFeature returns ItemFeature:
    PayloadFeature
;

fragment PayloadFeature:
    Identification? PayloadFeatureSpecializationPart ValuePart?
    | Identification? ValuePart
    | heritage+=OwnedFeatureTyping (multiplicity=OwnedMultiplicity)?
    | multiplicity=OwnedMultiplicity heritage+=OwnedFeatureTyping
;

fragment PayloadFeatureSpecializationPart:
    FeatureSpecialization+ (MultiplicityPart FeatureSpecialization*)?
    | MultiplicityPart FeatureSpecialization+
;

FlowEndMember returns EndFeatureMembership:
    element=FlowEnd
;

FlowEnd returns ItemFlowEnd:
    ( heritage+=FlowEndSubsetting )? children+=FlowFeatureMember
;

FlowEndSubsetting returns ReferenceSubsetting:
    reference=FeatureReference '.' | targetChain=FeatureChainPrefix
;

FlowFeatureMember returns FeatureMembership:
    element=FlowFeature
;

FlowFeature returns ReferenceUsage:
    heritage+=FlowRedefinition
;

FlowRedefinition returns Redefinition:
    reference=FeatureReference
;


// Interfaces
// ===================================================================================================

// Interface Definitions

InterfaceDefinition returns InterfaceDefinition:
    OccurrenceDefinitionPrefix 'interface' 'def' DefinitionDeclaration InterfaceBody
;

fragment InterfaceBody:
    ';' | '{' InterfaceBodyItems '}'
;

fragment InterfaceBodyItems:
    InterfaceBodyItem*
;

fragment InterfaceBodyItem:
    children+=DefinitionMember
    | children+=RelationshipMember
    | children+=VisibleAnnotatingMember
    | children+=VariantUsageMember
    | children+=InterfaceNonOccurrenceUsageMember
    | children+=EmptySuccessionMember // must precede InterfaceOccurrenceUsageMember
    | children+=InterfaceOccurrenceUsageMember
    | children+=AliasMember
    | children+=Import
;

InterfaceNonOccurrenceUsageMember returns FeatureMembership:
    Visibility? element=InterfaceNonOccurrenceUsageElement
;

InterfaceNonOccurrenceUsageElement returns Usage:
    ReferenceUsage
    | AttributeUsage
    | EnumerationUsage
    | BindingConnector
    | Succession
;

InterfaceOccurrenceUsageMember returns FeatureMembership:
    Visibility? element=InterfaceOccurrenceUsageElement
;

InterfaceOccurrenceUsageElement returns Usage:
    DefaultInterfaceEnd | StructureUsageElement | BehaviorUsageElement
;

DefaultInterfaceEnd returns PortUsage:
    ( direction=FeatureDirectionKind )? BasicDefinitionPrefix? End UsageSuffix
;

// Interface Usages

InterfaceUsage returns InterfaceUsage:
    OccurrenceUsagePrefix 'interface' InterfaceUsageDeclaration InterfaceBody
;

fragment InterfaceUsageDeclaration:
    UsageDeclaration? ( 'connect' InterfacePart )? | InterfacePart
;

fragment InterfacePart:
    BinaryInterfacePart | NaryInterfacePart
;

fragment BinaryInterfacePart:
    ends+=InterfaceEndMember 'to' ends+=InterfaceEndMember
;

fragment NaryInterfacePart:
    '(' ends+=InterfaceEndMember ( ',' ends+=InterfaceEndMember )+ ')'
;

InterfaceEndMember returns EndFeatureMembership:
    element=InterfaceEnd
;

InterfaceEnd returns PortUsage:
    ( RegularName ReferencesToken )? heritage+=OwnedReferenceSubsetting (multiplicity=OwnedMultiplicity)?
;


// Allocations
// ===================================================================================================

AllocationDefinition returns AllocationDefinition:
    OccurrenceDefinitionPrefix 'allocation' 'def' DefinitionSuffix
;

AllocationUsage returns AllocationUsage:
    OccurrenceUsagePrefix AllocationUsageDeclaration UsageBody
;

fragment AllocationUsageDeclaration:
    'allocation' UsageDeclaration? ('allocate' ConnectorPart)?
    | 'allocate' ConnectorPart
;

// Action
// ===================================================================================================

ActionDefinition returns ActionDefinition:
    OccurrenceDefinitionPrefix 'action' 'def' DefinitionDeclaration ActionBody
;

fragment ActionBody:
    ';' | '{' ActionBodyItems '}'
;

fragment ActionBodyItems:
    ActionBodyItem*
;

fragment ActionBodyItem:
    children+=Import
    | children+=AliasMember
    | children+=DefinitionMember
    | children+=RelationshipMember
    | children+=VisibleAnnotatingMember
    | children+=VariantUsageMember
    | children+=NonOccurrenceUsageMember
    | children+=InitialNodeMember
    | children+=GuardedSuccessionMember
    | children+=EmptySuccessionMember // TODO: must precede the 4 members below
    | children+=StructureUsageMember
    | children+=BehaviorUsageMember
    | children+=ActionNodeMember
    | children+=TargetSuccessionMember // TODO: must be after initial node, behavior usage or action node
;

InitialNodeMember returns Membership:
    Visibility? 'first' reference=FeatureReference
    RelationshipBody
;

ActionNodeMember returns FeatureMembership:
    Visibility? element=ActionNode
;

TargetSuccessionMember returns FeatureMembership:
    Visibility? element=ActionTargetSuccession
;

GuardedSuccessionMember returns FeatureMembership:
    element=GuardedSuccession
;

// Action Usages

ActionUsage returns ActionUsage:
    OccurrenceUsagePrefix 'action' ActionUsageDeclaration ActionBody
;

PerformActionUsage returns PerformActionUsage:
    OccurrenceUsagePrefix 'perform' PerformActionUsageDeclaration ActionBody
;

fragment PerformActionUsageDeclaration:
    (heritage+=OwnedReferenceSubsetting FeatureSpecializationPart?
    | 'action' UsageDeclaration?
    )
    ValuePart?
;

fragment ActionUsageDeclaration:
    UsageDeclaration? ValuePart?
;

// Action Nodes

ActionNode returns ActionUsage:
    SendNode
    | AcceptNode
    | AssignmentNode
    | IfNode
    | WhileLoopNode
    | ForLoopNode
    | ControlNode
;

fragment ActionNodeUsageDeclaration:
    'action' UsageDeclaration?
;

fragment ActionNodePrefix:
    OccurrenceUsagePrefix ActionNodeUsageDeclaration?
;

AcceptNode returns AcceptActionUsage:
    OccurrenceUsagePrefix AcceptNodeDeclaration ActionBody
;

fragment AcceptNodeDeclaration:
    ActionNodeUsageDeclaration? 'accept' AcceptParameterPart
;

fragment AcceptParameterPart:
    payload=PayloadParameterMember
    ( 'via' receiver=NodeParameterMember 
    // TODO: empty rule
    /* | members += EmptyParameterMember
    ) */ )?
;

PayloadParameterMember returns ParameterMembership:
    element=PayloadParameter
;

PayloadParameter returns ReferenceUsage:
    PayloadFeature
    | Identification? PayloadFeatureSpecializationPart? TriggerValuePart
;

fragment TriggerValuePart:
    value=TriggerFeatureValue
;

TriggerFeatureValue returns FeatureValue:
    element=TriggerExpression
;

TriggerExpression returns TriggerInvocationExpression:
    kind=('at' | 'after') children+=OwnedExpressionMember
    | kind='when' children+=ChangeExpressionMember
;

ChangeExpressionMember returns FeatureMembership:
    element=ChangeExpression
;

ChangeExpression returns Expression:
    result=ChangeResultExpressionMember
;

ChangeResultExpressionMember returns ResultExpressionMembership:
    element=OwnedExpression
;

SendNode returns SendActionUsage:
    OccurrenceUsagePrefix SendNodeDeclaration ActionBody
;

fragment SendNodeDeclaration:
    ActionNodeUsageDeclaration? 'send' payload=NodeParameterMember 
    ( 'via' sender=NodeParameterMember  )?
    ( 'to' receiver=NodeParameterMember )?
;

NodeParameterMember returns ParameterMembership:
    element=NodeParameter
;

NodeParameter returns Usage:
    {ReferenceUsage} value=FeatureBinding
;

FeatureBinding returns FeatureValue:
    element=OwnedExpression
;

AssignmentNode returns AssignmentActionUsage:
    OccurrenceUsagePrefix AssignmentNodeDeclaration ActionBody
;

fragment AssignmentNodeDeclaration:
    ActionNodeUsageDeclaration? 'assign' 
    // TODO: seems like https://github.com/langium/chevrotain-allstar/issues/1
    // target=AssignmentTargetMember
    targetMember=FeatureChainMember ':=' 
    assignedValue=NodeParameterMember
;

AssignmentTargetMember returns ParameterMembership:
    element=TargetParameter
;

TargetParameter returns ReferenceUsage:
    ( value=TargetBinding '.' )?
    // TODO: empty rule
    children+=TargetFeatureMember
;

TargetFeatureMember returns FeatureMembership:
    element=TargetFeature
;

TargetFeature returns ReferenceUsage:
    children+=TargetAccessedFeatureMember
;

TargetAccessedFeatureMember returns FeatureMembership:
    element=EmptyUsage
;

TargetBinding returns FeatureValue:
    element=TargetExpression
;

TargetExpression returns Expression:
    BaseExpression
    (  ( {FeatureChainExpression.operands+=current} '.' children+=FeatureChainMember)?
       ( {OperatorExpression.operands+=current} operator='[' operands+=SequenceExpression ']' // indexing
        | {OperatorExpression.operands+=current} '->' heritage+=ReferenceTyping 
            ( children+=ExpressionBodyMember
            | children+=FunctionReferenceMember
            | ArgumentList
            )
        | {CollectExpression.operands+=current} '.' children+=ExpressionBodyMember // collect
        | {SelectExpression.operands+=current} '.?' children+=ExpressionBodyMember // select
        )
    )*
;

ExpressionParameterMember returns ParameterMembership:
    element=OwnedExpression
;

IfNode returns IfActionUsage:
    ActionNodePrefix 
    'if' condition=ExpressionParameterMember
    then=ActionBodyParameterMember
    ( 'else' else=( ActionBodyParameterMember | IfNodeParameterMember ) )?
;

ActionBodyParameterMember returns ParameterMembership:
    element=ActionBodyParameter
;

ActionBodyParameter returns ActionUsage:
    ( 'action' UsageDeclaration? )? '{' ActionBodyItems '}'
;

IfNodeParameterMember returns ParameterMembership:
    element=IfNode
;

WhileLoopNode returns WhileLoopActionUsage:
    ActionNodePrefix
    ( 'while' condition=ExpressionParameterMember
    | 'loop' /* members+=EmptyParameterMember */
    )
    body=ActionBodyParameterMember
    ( 'until' until=ExpressionParameterMember ';' )?
;

ForLoopNode returns ForLoopActionUsage:
    ActionNodePrefix
    'for' variable=ForVariableDeclarationMember
    'in' sequence=NodeParameterMember
    body=ActionBodyParameterMember
;

ForVariableDeclarationMember returns FeatureMembership:
    element=ForVariableDeclaration
;

ForVariableDeclaration returns ReferenceUsage:
    UsageDeclaration
;

ControlNode returns ControlNode:
    MergeNode
    | DecisionNode
    | JoinNode
    | ForkNode
;

fragment ControlNodePrefix:
    RefPrefix Individual? Portion?
;

MergeNode returns MergeNode:
    ControlNodePrefix 'merge' UsageDeclaration? ActionNodeBody
;

DecisionNode returns DecisionNode:
    ControlNodePrefix 'decide' UsageDeclaration? ActionNodeBody
;

JoinNode returns JoinNode:
    ControlNodePrefix 'join' UsageDeclaration? ActionNodeBody
;

ForkNode returns ForkNode:
    ControlNodePrefix 'fork' UsageDeclaration? ActionNodeBody
;

fragment ActionNodeBody:
    ';' | '{' ActionNodeItems '}'
;

fragment ActionNodeItems:
    ( children+=AnnotatingMember )*
;

EmptyParameterMember returns ParameterMembership:
    element=EmptyUsage
;

EmptyUsage returns Usage:
    {ReferenceUsage}
;

/* Action Succession */

ActionTargetSuccession returns Usage:
    ( TargetSuccession | GuardedTargetSuccession | DefaultTargetSuccession )
    UsageBody
;

TargetSuccession returns SuccessionAsUsage:
    'then' ( ends+=MultiplicitySourceEndMember )?
    ends+=ConnectorEndMember
;

GuardedTargetSuccession returns TransitionUsage:
    /* transitionLinkSource+= EmptyParameterMember */
    guard=GuardExpressionMember
    'then' then=TransitionSuccessionMember
;

DefaultTargetSuccession returns TransitionUsage:
    /* transitionLinkSource+= EmptyParameterMember */
    'else' else=TransitionSuccessionMember
;

GuardedSuccession returns TransitionUsage:
    ( 'succession' UsageDeclaration )? 'first'
    source=TransitionSourceMember 
    /* transitionLinkSource=EmptyParameterMember */
    guard=GuardExpressionMember
    'then' then=TransitionSuccessionMember
    UsageBody
;

// States
// ===================================================================================================

StateDefinition returns StateDefinition:
    OccurrenceDefinitionPrefix 'state' 'def' DefinitionDeclaration StateBody
;

fragment StateBody:
    ';' | (isParallel?='parallel')? '{' StateBodyPart '}'
;

fragment StateBodyPart:
    StateBodyItem*
;

fragment StateBodyItem:
    children+=Import
    | children+=AliasMember
    | children+=DefinitionMember
    | children+=RelationshipMember
    | children+=VisibleAnnotatingMember
    | children+=VariantUsageMember
    | children+=NonOccurrenceUsageMember
    // parser doesn't like optional groups...
    | children+=EmptySuccessionMember // TODO: must be before Structure or Behavior usage member
    | children+=StructureUsageMember
    | children+=BehaviorUsageMember
    | children+=TargetTransitionUsageMember // TODO: must be after behavior usage element or another targettransitionusage
    | children+=TransitionUsageMember
    | children+=EntryActionMember
    | children+=EntryTransitionMember// TODO: must follow entry action or other entry transition
    | children+=DoActionMember
    | children+=ExitActionMember
;

EntryActionMember returns StateSubactionMembership:
    Visibility? kind='entry' element=StateActionUsage
;

DoActionMember returns StateSubactionMembership:
    Visibility? kind='do' element=StateActionUsage
;

ExitActionMember returns StateSubactionMembership:
    Visibility? kind='exit' element=StateActionUsage
;

EntryTransitionMember returns FeatureMembership:
    Visibility? 
    ( element=GuardedTargetSuccession 
    | 'then' element=TransitionSuccession 
    ) ';'
;

StateActionUsage_1 returns ActionUsage:
    {ActionUsage} ';'
;
StateActionUsage_2 returns PerformActionUsage:
    PerformActionUsageDeclaration ActionBody
;
StateActionUsage_3 returns AcceptActionUsage:
    AcceptNodeDeclaration ActionBody
;
StateActionUsage_4 returns SendActionUsage:
    SendNodeDeclaration ActionBody
;
StateActionUsage_5 returns AssignmentActionUsage:
    AssignmentNodeDeclaration ActionBody
;

// expanded subrules explicitly with proper parser rules since actions generate
// bad parse trees, same for EffectBehaviorUsage below
StateActionUsage returns ActionUsage:
    StateActionUsage_1
    | StateActionUsage_2
    | StateActionUsage_3
    | StateActionUsage_4
    | StateActionUsage_5
;

TransitionUsageMember returns FeatureMembership:
    Visibility? element=TransitionUsage
;

TargetTransitionUsageMember returns FeatureMembership:
    Visibility? element=TargetTransitionUsage
;

// State Usages

StateUsage returns StateUsage:
    OccurrenceUsagePrefix 'state' ActionUsageDeclaration StateBody
;

ExhibitStateUsage returns ExhibitStateUsage:
    OccurrenceUsagePrefix 'exhibit' (
        heritage+=OwnedReferenceSubsetting FeatureSpecializationPart?
        | 'state' UsageDeclaration?
    )
    ValuePart? StateBody
;

// Transition Usages

TransitionUsage returns TransitionUsage:
    'transition' ( UsageDeclaration? 'first' )? 
    source=TransitionSourceMember
    /* transitionLinkSource=EmptyParameterMember */
    ( /* payload=EmptyParameterMember */ accepter=TriggerActionMember )?
    ( guard=GuardExpressionMember )?
    ( effect=EffectBehaviorMember )?
    'then' then=TransitionSuccessionMember
    ActionBody
;

TargetTransitionUsage returns TransitionUsage:
    /* transitionLinkSource=EmptyParameterMember */
    ( 'transition'
      ( /* payload=EmptyParameterMember  */
        accepter=TriggerActionMember )?
      ( guard=GuardExpressionMember )?
      ( effect=EffectBehaviorMember )?
    | /* payload=EmptyParameterMember */ 
      accepter=TriggerActionMember
      ( guard=GuardExpressionMember )?
      ( effect=EffectBehaviorMember )?
    | guard=GuardExpressionMember
      ( effect=EffectBehaviorMember )?
    )?
    'then' then=TransitionSuccessionMember
    ActionBody
;

TransitionSourceMember returns Membership:
    reference=FeatureReference
    | {OwningMembership} element=OwnedFeatureChain
;

TriggerActionMember returns TransitionFeatureMembership:
    kind='accept' element=TriggerAction
;

TriggerAction returns AcceptActionUsage:
    AcceptParameterPart
;

GuardExpressionMember returns TransitionFeatureMembership:
    kind='if' element=OwnedExpression
;

EffectBehaviorMember returns TransitionFeatureMembership:
    kind='do' element=EffectBehaviorUsage
;

fragment EffectBehaviorUsageBody:
    ( '{' ActionBodyItems '}' )?
;
EffectBehaviorUsage_1 returns ActionUsage:
    {ActionUsage}
;
EffectBehaviorUsage_2 returns PerformActionUsage:
    PerformActionUsageDeclaration EffectBehaviorUsageBody
;
EffectBehaviorUsage_3 returns AcceptActionUsage:
    AcceptNodeDeclaration EffectBehaviorUsageBody
;
EffectBehaviorUsage_4 returns SendActionUsage:
    SendNodeDeclaration EffectBehaviorUsageBody
;
EffectBehaviorUsage_5 returns AssignmentActionUsage:
    AssignmentNodeDeclaration EffectBehaviorUsageBody
;

EffectBehaviorUsage returns ActionUsage:
    EffectBehaviorUsage_1
    | EffectBehaviorUsage_2
    | EffectBehaviorUsage_3
    | EffectBehaviorUsage_4
    | EffectBehaviorUsage_5
;

TransitionSuccessionMember returns OwningMembership:
    element=TransitionSuccession
;

TransitionSuccession returns SuccessionAsUsage:
    ends+=EmptySourceEndMember
    ends+=ConnectorEndMember
;

// Calculations
// ===================================================================================================

// Calculation Definitions

CalculationDefinition returns CalculationDefinition:
    OccurrenceDefinitionPrefix 'calc' 'def' DefinitionDeclaration CalculationBody
;

fragment CalculationBody:
    ';' | '{' CalculationBodyPart '}'
;

fragment CalculationBodyPart:
    CalculationBodyItem* ( result=ResultExpressionMember )?
;

fragment CalculationBodyItem:
    ActionBodyItem | children+=ReturnParameterMember
;

ReturnParameterMember returns ReturnParameterMembership:
    Visibility? 'return' element=UsageElement
;

ResultExpressionMember returns ResultExpressionMembership:
    Visibility? element=OwnedExpression
;

// Calculation Usages

CalculationUsage returns CalculationUsage:
    OccurrenceUsagePrefix 'calc' CalculationUsageDeclaration CalculationBody
;

fragment CalculationUsageDeclaration:
    UsageDeclaration? ValuePart?
;

// Constraints
// ===================================================================================================

ConstraintDefinition returns ConstraintDefinition:
    OccurrenceDefinitionPrefix 'constraint' 'def' DefinitionDeclaration CalculationBody
;

ConstraintUsage returns ConstraintUsage:
    OccurrenceUsagePrefix 'constraint' CalculationUsageDeclaration CalculationBody
;

AssertConstraintUsage returns AssertConstraintUsage:
    OccurrenceUsagePrefix 'assert' (isNegated?='not')? (
        heritage+=OwnedReferenceSubsetting FeatureSpecializationPart?
        | 'constraint' UsageDeclaration?
    ) CalculationBody;

// Requirements
// ===================================================================================================

RequirementDefinition returns RequirementDefinition:
    OccurrenceDefinitionPrefix 'requirement' 'def' DefinitionDeclaration RequirementBody
;

fragment RequirementBody:
    ';' | '{' RequirementBodyItems '}'
;

fragment RequirementBodyItems:
    RequirementBodyItem*
;

fragment RequirementBodyItem:
    DefinitionBodyItem
    | children+=SubjectMember
    | children+=RequirementConstraintMember
    | children+=FramedConcernMember
    | children+=RequirementVerificationMember
    | children+=ActorMember
    | children+=StakeholderMember
;

SubjectMember returns SubjectMembership:
    Visibility? 'subject' element=SubjectUsage
;

SubjectUsage returns ReferenceUsage:
    UsageExtensionKeyword* UsageSuffix
;

RequirementConstraintMember returns RequirementConstraintMembership:
    Visibility? kind=RequirementConstraintKind 
    element=RequirementConstraintUsage
;

RequirementConstraintUsage returns ConstraintUsage:
    heritage+=OwnedReferenceSubsetting FeatureSpecialization* RequirementBody
    | ( UsageExtensionKeyword* 'constraint' | UsageExtensionKeyword+ ) CalculationUsageDeclaration CalculationBody
;

FramedConcernMember returns FramedConcernMembership:
    Visibility? 'frame' element=FramedConcernUsage
;

FramedConcernUsage returns ConcernUsage:
    (heritage+=OwnedReferenceSubsetting FeatureSpecialization* RequirementBody
    | ( UsageExtensionKeyword* 'concern' | UsageExtensionKeyword+ ) CalculationUsageDeclaration CalculationBody
    )
;

ActorMember returns ActorMembership:
    Visibility? 'actor' element=ActorUsage
;

ActorUsage returns PartUsage:
    UsageExtensionKeyword* UsageSuffix
;

StakeholderMember returns StakeholderMembership:
    Visibility? 'stakeholder' element=StakeholderUsage
;

StakeholderUsage returns PartUsage:
    UsageExtensionKeyword* UsageSuffix
;

// Requirement Usages

RequirementUsage returns RequirementUsage:
    OccurrenceUsagePrefix 'requirement' CalculationUsageDeclaration RequirementBody
;

SatisfyRequirementUsage returns SatisfyRequirementUsage:
    OccurrenceUsagePrefix 'assert'? (isNegated?='not')? 'satisfy'
    ( heritage+=OwnedReferenceSubsetting FeatureSpecializationPart?
    | 'requirement' UsageDeclaration?
    )
    ValuePart? ('by' satisfactionSubject=SatisfactionSubjectMember)? RequirementBody
;

SatisfactionSubjectMember returns SubjectMembership:
    element=SatisfactionParameter
;

SatisfactionParameter returns ReferenceUsage:
    value=SatisfactionFeatureValue
;

SatisfactionFeatureValue returns FeatureValue:
    element=SatisfactionReferenceExpression
;

SatisfactionReferenceExpression returns FeatureReferenceExpression:
    expression=FeatureChainMember
;

// Concerns
// ===================================================================================================

ConcernDefinition returns ConcernDefinition:
    OccurrenceDefinitionPrefix 'concern' 'def' DefinitionDeclaration RequirementBody
;

ConcernUsage returns ConcernUsage:
    OccurrenceUsagePrefix 'concern' CalculationUsageDeclaration RequirementBody
;

// Cases
// ===================================================================================================

// Case Definitions

CaseDefinition returns CaseDefinition:
    OccurrenceDefinitionPrefix 'case' 'def' DefinitionDeclaration CaseBody
;

fragment CaseBody:
    ';' | '{' CaseBodyItems '}'
;

fragment CaseBodyItems:
    CaseBodyItem* (result=ResultExpressionMember)?
;

fragment CaseBodyItem:
    CalculationBodyItem
    | children+=SubjectMember
    | children+=ActorMember
    | children+=ObjectiveMember
;

ObjectiveMember returns ObjectiveMembership:
    Visibility? 'objective' element=ObjectiveRequirementUsage
;

ObjectiveRequirementUsage returns RequirementUsage:
    UsageExtensionKeyword* CalculationUsageDeclaration RequirementBody
;

// Case Usages

CaseUsage returns CaseUsage:
    OccurrenceUsagePrefix 'case' CalculationUsageDeclaration CaseBody;

// Analysis Cases
// ===================================================================================================

AnalysisCaseDefinition returns AnalysisCaseDefinition:
    OccurrenceDefinitionPrefix 'analysis' 'def' DefinitionDeclaration CaseBody
;

AnalysisCaseUsage returns AnalysisCaseUsage:
    OccurrenceUsagePrefix 'analysis' CalculationUsageDeclaration CaseBody
;

// Verification Cases
// ===================================================================================================

VerificationCaseDefinition returns VerificationCaseDefinition:
    OccurrenceDefinitionPrefix 'verification' 'def' DefinitionDeclaration CaseBody
;

VerificationCaseUsage returns VerificationCaseUsage:
    OccurrenceUsagePrefix 'verification' CalculationUsageDeclaration CaseBody
;

RequirementVerificationMember returns RequirementVerificationMembership:
    Visibility? 'verify' element=RequirementVerificationUsage
;

RequirementVerificationUsage returns RequirementUsage:
    heritage+=OwnedReferenceSubsetting FeatureSpecialization* RequirementBody
    | ( UsageExtensionKeyword* 'requirement' | UsageExtensionKeyword+ ) CalculationUsageDeclaration RequirementBody
;

// Use Cases
// ===================================================================================================

UseCaseDefinition returns UseCaseDefinition:
    OccurrenceDefinitionPrefix 'use' 'case' 'def' DefinitionDeclaration CaseBody
;

UseCaseUsage returns UseCaseUsage:
    OccurrenceUsagePrefix 'use' 'case' CalculationUsageDeclaration CaseBody
;

IncludeUseCaseUsage returns IncludeUseCaseUsage:
    OccurrenceUsagePrefix 'include' (
        heritage+=OwnedReferenceSubsetting FeatureSpecializationPart?
        | 'use' 'case' UsageDeclaration?
    ) ValuePart? CaseBody
;

// Views
// ===================================================================================================

ViewDefinition returns ViewDefinition:
    OccurrenceDefinitionPrefix 'view' 'def' DefinitionDeclaration ViewDefinitionBody
;

fragment ViewDefinitionBody:
    ';' | '{' ViewDefinitionBodyItems '}'
;

fragment ViewDefinitionBodyItems:
    ViewDefinitionBodyItem*
;

fragment ViewDefinitionBodyItem:
    DefinitionBodyItem
    | children+=ElementFilterMember
    | children+=ViewRenderingMember
;

ViewRenderingMember returns ViewRenderingMembership:
    Visibility? 'render' element=ViewRenderingUsage
;

ViewRenderingUsage returns RenderingUsage:
    heritage+=OwnedReferenceSubsetting FeatureSpecialization* UsageBody
;

// View Usages

ViewUsage returns ViewUsage:
    OccurrenceUsagePrefix 'view' UsageDeclaration? ValuePart? ViewBody
;

fragment ViewBody:
    ';' | '{' ViewBodyItems '}'
;
fragment ViewBodyItems:
    ViewBodyItem*
;

fragment ViewBodyItem:
    DefinitionBodyItem
    | children+=ElementFilterMember
    | children+=Expose
    | children+=ViewRenderingMember
;

fragment ExposePrefix:
    Visibility? 'expose';

Expose returns Expose:
    ExposePrefix ImportedReference (element=FilterPackage)?
    RelationshipBody
;

// Viewpoints
// ===================================================================================================

ViewpointDefinition returns ViewpointDefinition:
    OccurrenceDefinitionPrefix 'viewpoint' 'def' DefinitionDeclaration RequirementBody
;

ViewpointUsage returns ViewpointUsage:
    OccurrenceUsagePrefix 'viewpoint' CalculationUsageDeclaration RequirementBody
;

// Renderings
// ===================================================================================================

RenderingDefinition returns RenderingDefinition:
    OccurrenceDefinitionPrefix 'rendering' 'def' DefinitionSuffix
;

RenderingUsage returns RenderingUsage:
    OccurrenceUsagePrefix 'rendering' UsageSuffix
;

// EXPRESSIONS
// ===================================================================================================

// The only different expression element to KerML
ExpressionBody returns Expression:
    CalculationBody
;

// Operator Expressions

OwnedExpressionMember returns FeatureMembership:
    element=OwnedExpression
;

OwnedExpression returns Expression:
    ConditionalExpression
;

OwnedExpressionReference returns FeatureReferenceExpression:
    expression=OwnedExpressionMember
;

// Conditional Expressions

ConcreteConditionalExpression returns OperatorExpression:
    operator='if' operands+=NullCoalescingExpression '?' operands+=OwnedExpressionReference 'else' operands+=OwnedExpressionReference
;

ConditionalExpression returns Expression:
    NullCoalescingExpression | ConcreteConditionalExpression
;

NullCoalescingExpression returns Expression:
    ImpliesExpression ( {OperatorExpression.operands+=current} operator='??' operands+=ImpliesExpressionReference )*
;

// Logical Expressions

ImpliesExpressionReference returns FeatureReferenceExpression:
    expression=ImpliesExpressionMember
;

ImpliesExpressionMember returns FeatureMembership:
    element=ImpliesExpression
;

ImpliesExpression returns Expression:
    OrExpression ( {OperatorExpression.operands+=current} operator='implies' operands+=OrExpressionReference )*
;

OrExpressionReference returns FeatureReferenceExpression:
    expression=OrExpressionMember
;

OrExpressionMember returns FeatureMembership:
    element=OrExpression
;

OrExpression returns Expression:
    XorExpression ( {OperatorExpression.operands+=current}(
        operator='|' operands+=XorExpression
        | operator='or' operands+=XorExpressionReference
        )
    )*
;

XorExpressionReference returns FeatureReferenceExpression:
    expression=XorExpressionMember
;

XorExpressionMember returns FeatureMembership:
    element=XorExpression
;

XorExpression returns Expression:
    AndExpression ( {OperatorExpression.operands+=current} operator='xor' operands+=AndExpression )*
;

AndExpression returns Expression:
    EqualityExpression ( {OperatorExpression.operands+=current} (
        operator='&'operands+=EqualityExpression
        | operator='and' operands+=EqualityExpressionReference
        )
    )*
;

// Equality Expressions

EqualityExpressionReference returns FeatureReferenceExpression:
    expression=EqualityExpressionMember
;

EqualityExpressionMember returns FeatureMembership:
    element=EqualityExpression
;

EqualityExpression returns Expression:
    ClassificationExpression ( {OperatorExpression.operands+=current} operator=EqualityOperator operands+=ClassificationExpression )*
;

// Classification Expressions

ClassificationExpression returns Expression:
    RelationalExpression ( 
        {OperatorExpression.operands+=current} (
            operator=ClassificationTestOperator children+=TypeReferenceMember
            | operator='as' children+=TypeResultMember
        )
    )?
    // Note: empty rule breaks parsing here 
    | {OperatorExpression} /* operands+=SelfReferenceExpression */ operator=ClassificationTestOperator children+=TypeReferenceMember
    | {OperatorExpression} operands+=MetadataReference operator='@@' children+=TypeReferenceMember
    | {OperatorExpression} /* operands+=SelfReferenceExpression */ operator='as' children+=TypeResultMember
    | {OperatorExpression} operands+=MetadataReference operator='meta' children+=TypeResultMember
;

// Relational Expressions

RelationalExpression returns Expression:
    RangeExpression ( {OperatorExpression.operands+=current} operator=RelationalOperator operands+=RangeExpression )*
;

// Range Expressions

RangeExpression returns Expression:
    AdditiveExpression ( {OperatorExpression.operands+=current} operator='..' operands+=AdditiveExpression )?
;

// Arithmetic Expressions

AdditiveExpression returns Expression:
    MultiplicativeExpression ({OperatorExpression.operands+=current} operator=('+' | '-') operands+=MultiplicativeExpression)*
;

MultiplicativeExpression returns Expression:
    ExponentiationExpression ({OperatorExpression.operands+=current} operator=('*' | '/' | '%') operands+=ExponentiationExpression)*
;

ExponentiationExpression returns Expression:
    UnaryExpression ({OperatorExpression.operands+=current} operator=('**' | '^') operands+=UnaryExpression)*
;

// Unary Expressions

UnaryExpression returns Expression:
    {OperatorExpression} operator=UnaryOperator operands+=ExtentExpression
    | ExtentExpression
;

// Extent Expressions

ExtentExpression returns Expression:
    {OperatorExpression} operator='all' children+=TypeResultMember
    | PrimaryExpression
;

// Primary Expressions

PrimaryExpression returns Expression:
    BaseExpression
    ( {FeatureChainExpression.operands+=current} '.' children+=FeatureChainMember)?
    (   ( {OperatorExpression.operands+=current} operator='#' '(' operands+=SequenceExpression ')' // indexing
        | {OperatorExpression.operands+=current} operator='[' operands+=SequenceExpression ']' // indexing
        | {OperatorExpression.operands+=current} '->' heritage+=ReferenceTyping 
            ( children+=ExpressionBodyMember
            | children+=FunctionReferenceMember
            | ArgumentList
            )
        | {CollectExpression.operands+=current} '.' children+=ExpressionBodyMember // collect
        | {SelectExpression.operands+=current} '.?' children+=ExpressionBodyMember // select
        )
        ( {FeatureChainExpression.operands+=current} '.' children+=FeatureChainMember)?
    )*
;

// Base Expressions

BaseExpression returns Expression:
    NullExpression
    | LiteralExpression 
    | FeatureReferenceExpression 
    | MetadataAccessExpression
    | InvocationExpression 
    | BodyExpression
    | '(' SequenceExpression ')'
;

// Expression Bodies

BodyExpression returns FeatureReferenceExpression:
    expression=ExpressionBodyMember
;

ExpressionBodyMember returns FeatureMembership:
    element=ExpressionBody
;

// Sequence Expressions

SequenceExpression returns Expression:
    OwnedExpression (
        ','
        | {OperatorExpression.operands+=current} operator=',' operands+=SequenceExpression
    )?
;

// Invocation Expressions

InvocationExpression returns InvocationExpression:
    heritage+=OwnedFeatureTyping ArgumentList
;

fragment ArgumentList:
    '(' ( PositionalArgumentList | NamedArgumentList )? ')'
;

fragment PositionalArgumentList:
    children+=ArgumentMember ( ',' children+=ArgumentMember )*
;

ArgumentMember returns ParameterMembership:
    element=Argument
;

Argument returns Feature:
    value=ArgumentValue
;

fragment NamedArgumentList:
    children+=NamedArgumentMember ( ',' children+=NamedArgumentMember )*
;

NamedArgumentMember returns ParameterMembership:
    element=NamedArgument
;

NamedArgument returns Feature:
    heritage+=ParameterRedefinition '=' value=ArgumentValue
;

ParameterRedefinition returns Redefinition:
    reference=FeatureReference
;

ArgumentValue returns FeatureValue:
    element=OwnedExpression
;
