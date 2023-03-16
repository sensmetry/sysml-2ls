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
    ( annotations+=PrefixMetadataAnnotation)* 'dependency' Identification? 'from'?
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
    ( annotations+=OwnedAnnotation )*
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
    '#' typeRelationships+=MetadataTyping
;

MetadataUsage returns MetadataUsage:
    ('metadata' | '@') MetadataUsageDeclaration
    ( 'about' about+=Annotation ( ',' about+=Annotation )*)?
    MetadataBody
;

fragment MetadataUsageDeclaration:
    ( Identification? DefinedByToken )? typeRelationships+=MetadataTyping
;

fragment MetadataBody:
    ';' | '{' MetadataBodyItems '}'
;

fragment MetadataBodyItems:
    ( namespaceMembers+=DefinitionMember
    | relationshipMembers+=RelationshipMember
    | annotatingMembers+=VisibleAnnotatingMember
    | members+=MetadataBodyUsageMember
    | aliases+=AliasMember
    | imports+=Import
    )*
;

MetadataBodyUsageMember returns FeatureMembership:
    element=MetadataBodyUsage
;

MetadataBodyUsage returns ReferenceUsage:
    'ref'? RedefinesToken? typeRelationships+=OwnedRedefinition
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
    imports+=Import
    | aliases+=AliasMember
    | filters+=ElementFilterMember
    | annotatingMembers+=VisibleAnnotatingMember
    | members+=UsageMember
    | namespaceMembers+=DefinitionMember
    | relationshipMembers+=RelationshipMember
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
    ( filters+=FilterPackageMember )+
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
    SpecializesToken typeRelationships+=OwnedSubclassification ( ',' typeRelationships+=OwnedSubclassification )*
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
    TypedBy ( ',' typeRelationships+=FeatureTyping )*
;

fragment TypedBy:
    DefinedByToken typeRelationships+=FeatureTyping
;

fragment Subsettings:
    Subsets ( ',' typeRelationships+=OwnedSubsetting )*
;

fragment Subsets:
    SubsetsToken typeRelationships+=OwnedSubsetting
;

fragment References:
    ReferencesToken typeRelationships+=OwnedReferenceSubsetting
;

fragment Redefinitions:
    Redefines ( ',' typeRelationships+=OwnedRedefinition )*
;

fragment Redefines:
    RedefinesToken typeRelationships+=OwnedRedefinition
;

/* Feature Typing, Subsetting and Redefinition */

FeatureTyping returns FeatureTyping:
    OwnedFeatureTyping | ConjugatedPortTyping
;

// OwnedFeatureTyping inherited from Expression syntax.

OwnedSubsetting returns Subsetting:
    reference=FeatureReference | chains+=OwnedFeatureChain
;

OwnedReferenceSubsetting returns ReferenceSubsetting:
    reference=FeatureReference | chains+=OwnedFeatureChain
;

OwnedRedefinition returns Redefinition:
    reference=FeatureReference | chains+=OwnedFeatureChain
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
    imports+=Import
    | aliases+=AliasMember
    | annotatingMembers+=VisibleAnnotatingMember
    | relationshipMembers+=RelationshipMember
    | namespaceMembers+=DefinitionMember
    | members+=VariantUsageMember
    | members+=NonOccurrenceUsageMember
    | members+=EmptySuccessionMember // TODO: must precede OccurrenceUsageMember
    | members+=OccurrenceUsageMember
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
    members+=EmptyTargetMember
    members+=EmptyParameterMember
;

EmptyTargetMember returns ParameterMembership:
    element=EmptyTargetParameter
;

EmptyTargetParameter returns ReferenceUsage:
    members+=TargetFeatureMember
;

// Reference Usages

DefaultReferenceUsage returns ReferenceUsage:
    RefPrefix UsageDeclaration ValuePart? UsageBody
;

ReferenceUsage returns ReferenceUsage:
    RefPrefix 'ref' UsageSuffix
;

VariantReference returns ReferenceUsage:
    typeRelationships+=OwnedReferenceSubsetting FeatureSpecialization* UsageBody
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
    ( annotatingMembers+=AnnotatingMember
    | members+=EnumerationUsageMember
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
        typeRelationships+=OwnedReferenceSubsetting FeatureSpecializationPart?
        | 'occurrence' UsageDeclaration?
    ) UsageCompletion
;

// Occurrence Succession

EmptySuccessionMember returns FeatureMembership:
    element=EmptySuccession
;

EmptySuccession returns SuccessionAsUsage:
    'then' members+=MultiplicitySourceEndMember
    // TODO: empty rule
    /* members+=EmptyTargetEndMember */
;

MultiplicitySourceEndMember returns EndFeatureMembership:
    element=MultiplicitySourceEnd
;

MultiplicitySourceEnd returns Feature:
    {Feature} ( multiplicity=OwnedMultiplicity )?
;

EmptyTargetEndMember returns EndFeatureMembership:
    element=EmptyTargetEnd
;

EmptyTargetEnd returns Feature:
    {Feature}
;

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
    namespaceMembers+=ConjugatedPortDefinitionMember
;

ConjugatedPortDefinitionMember returns OwningMembership:
    element=ConjugatedPortDefinition
;

ConjugatedPortDefinition returns ConjugatedPortDefinition:
    typeRelationships+=PortConjugation
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
    ( RegularName ReferencesToken )? typeRelationships+=OwnedReferenceSubsetting (multiplicity=OwnedMultiplicity)?
;

// Binding Connectors

BindingConnector returns BindingConnectorAsUsage:
    UsagePrefix ( 'binding' UsageDeclaration? )?
    'bind' members+=ConnectorEndMember '=' members+=ConnectorEndMember 
    DefinitionBody
;

// Successions

Succession returns SuccessionAsUsage:
    UsagePrefix ( 'succession' UsageDeclaration? )? 
    'first' members+=ConnectorEndMember 'then' members+=ConnectorEndMember 
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
    members+=ConnectorEndMember 'to' members+=ConnectorEndMember
;

fragment NaryConnectorPart:
    '(' members+=ConnectorEndMember ( ',' members+=ConnectorEndMember )+ ')'
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
    UsageDeclaration? ValuePart? ( 'of' members+=ItemFeatureMember )?
        ( 'from' members+=MessageEventMember 'to' members+=MessageEventMember )?
    | members+=MessageEventMember 'to' members+=MessageEventMember
;

MessageEventMember returns ParameterMembership:
    element=MessageEvent
;

MessageEvent returns EventOccurrenceUsage:
    typeRelationships+=OwnedReferenceSubsetting
;

// Flow Connection Usages

FlowConnectionUsage returns FlowConnectionUsage:
    OccurrenceUsagePrefix 'flow' FlowConnectionDeclaration DefinitionBody
;

SuccessionFlowConnectionUsage returns SuccessionFlowConnectionUsage:
    OccurrenceUsagePrefix 'succession' 'flow' FlowConnectionDeclaration DefinitionBody
;

fragment FlowConnectionDeclaration:
    UsageDeclaration? ValuePart? ( 'of'  members+=ItemFeatureMember )?
        ( 'from' members+=FlowEndMember 'to' members+=FlowEndMember )?
    | members+=FlowEndMember 'to' members+=FlowEndMember
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
    | typeRelationships+=OwnedFeatureTyping (multiplicity=OwnedMultiplicity)?
    | multiplicity=OwnedMultiplicity typeRelationships+=OwnedFeatureTyping
;

// TODO: optimize
fragment PayloadFeatureSpecializationPart:
    FeatureSpecialization+
    | FeatureSpecialization+ MultiplicityPart FeatureSpecialization*
    | MultiplicityPart FeatureSpecialization+
;

FlowEndMember returns EndFeatureMembership:
    element=FlowEnd
;

FlowEnd returns ItemFlowEnd:
    ( typeRelationships+=FlowEndSubsetting )? members+=FlowFeatureMember
;

FlowEndSubsetting returns ReferenceSubsetting:
    reference=FeatureReference '.' | chains+=FeatureChainPrefix
;

FlowFeatureMember returns FeatureMembership:
    element=FlowFeature
;

FlowFeature returns ReferenceUsage:
    typeRelationships+=FlowRedefinition
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
    namespaceMembers+=DefinitionMember
    | relationshipMembers+=RelationshipMember
    | annotatingMembers+=VisibleAnnotatingMember
    | members+=VariantUsageMember
    | members+=InterfaceNonOccurrenceUsageMember
    | members+=EmptySuccessionMember // must precede InterfaceOccurrenceUsageMember
    | members+=InterfaceOccurrenceUsageMember
    | aliases+=AliasMember
    | imports+=Import
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
    members+=InterfaceEndMember 'to' members+=InterfaceEndMember
;

fragment NaryInterfacePart:
    '(' members+=InterfaceEndMember ( ',' members+=InterfaceEndMember )+ ')'
;

InterfaceEndMember returns EndFeatureMembership:
    element=InterfaceEnd
;

InterfaceEnd returns PortUsage:
    ( RegularName ReferencesToken )? typeRelationships+=OwnedReferenceSubsetting (multiplicity=OwnedMultiplicity)?
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
    imports+=Import
    | aliases+=AliasMember
    | namespaceMembers+=DefinitionMember
    | relationshipMembers+=RelationshipMember
    | annotatingMembers+=VisibleAnnotatingMember
    | members+=VariantUsageMember
    | members+=NonOccurrenceUsageMember
    | members+=InitialNodeMember
    | members+=GuardedSuccessionMember
    | members+=EmptySuccessionMember // TODO: must precede the 4 members below
    | members+=StructureUsageMember
    | members+=BehaviorUsageMember
    | members+=ActionNodeMember
    | members+=TargetSuccessionMember // TODO: must be after initial node, behavior usage or action node
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
    (typeRelationships+=OwnedReferenceSubsetting FeatureSpecializationPart?
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
    members+=PayloadParameterMember
    ( 'via' members+=NodeParameterMember 
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
    kind=('at' | 'after') members+=OwnedExpressionMember
    | kind='when' members+=ChangeExpressionMember
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
    ActionNodeUsageDeclaration? 'send' members+=NodeParameterMember 
    ( 'via' members+=NodeParameterMember 
    // TODO: empty rule
    /* | members+=EmptyParameterMember
    ) */ )?
    ( 'to' members+=NodeParameterMember
    // TODO: empty rule
    /* | members+=EmptyParameterMember	
    ) */ )?
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
    // members+=AssignmentTargetMember
    members+=FeatureChainMember ':=' 
    members+=NodeParameterMember
;

AssignmentTargetMember returns ParameterMembership:
    element=TargetParameter
;

TargetParameter returns ReferenceUsage:
    ( value=TargetBinding '.' )?
    // TODO: empty rule
    members+=TargetFeatureMember
;

TargetFeatureMember returns FeatureMembership:
    element=TargetFeature
;

TargetFeature returns ReferenceUsage:
    members+=TargetAccessedFeatureMember
;

TargetAccessedFeatureMember returns FeatureMembership:
    element=EmptyUsage
;

TargetBinding returns FeatureValue:
    element=TargetExpression
;

TargetExpression returns Expression:
    BaseExpression
    (  ( {FeatureChainExpression.operands+=current} '.' members+=FeatureChainMember)?
       ( {OperatorExpression.operands+=current} operator='[' operands+=SequenceExpression ']' // indexing
        | {OperatorExpression.operands+=current} '->' typeRelationships+=ReferenceTyping 
            ( members+=ExpressionBodyMember
            | members+=FunctionReferenceMember
            | ArgumentList
            )
        | {CollectExpression.operands+=current} '.' members+=ExpressionBodyMember // collect
        | {SelectExpression.operands+=current} '.?' members+=ExpressionBodyMember // select
        )
    )*
;

ExpressionParameterMember returns ParameterMembership:
    element=OwnedExpression
;

IfNode returns IfActionUsage:
    ActionNodePrefix 
    'if' members+=ExpressionParameterMember
    members+=ActionBodyParameterMember
    ( 'else' members+=( ActionBodyParameterMember | IfNodeParameterMember ) )?
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
    ( 'while' members+=ExpressionParameterMember
    // TODO: empty rule
    | 'loop' members+=EmptyParameterMember
    )
    members+=ActionBodyParameterMember
    ( 'until' members+=ExpressionParameterMember ';' )?
;

ForLoopNode returns ForLoopActionUsage:
    ActionNodePrefix
    'for' members+=ForVariableDeclarationMember
    'in' members+=NodeParameterMember
    members+=ActionBodyParameterMember
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
    ( annotatingMembers+=AnnotatingMember )*
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
    'then' members+=MultiplicitySourceEndMember 
    members+=ConnectorEndMember
;

GuardedTargetSuccession returns TransitionUsage:
    // TODO: empty rule
    /* members += EmptyParameterMember */
    members+=GuardExpressionMember
    'then' members+=TransitionSuccessionMember
;

DefaultTargetSuccession returns TransitionUsage:
    // TODO: empty rule
    /* members += EmptyParameterMember */
    'else' members+=TransitionSuccessionMember
;

GuardedSuccession returns TransitionUsage:
    ( 'succession' UsageDeclaration )? 'first'
    members+=TransitionSourceMember 
    // TODO: empty rule
    /* members+=EmptyParameterMember */
    members+=GuardExpressionMember
    'then' members+=TransitionSuccessionMember
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
    imports+=Import
    | aliases+=AliasMember
    | namespaceMembers+=DefinitionMember
    | relationshipMembers+=RelationshipMember
    | annotatingMembers+=VisibleAnnotatingMember
    | members+=VariantUsageMember
    | members+=NonOccurrenceUsageMember
    // parser doesn't like optional groups...
    | members+=EmptySuccessionMember // TODO: must be before Structure or Behavior usage member
    | members+=StructureUsageMember
    | members+=BehaviorUsageMember
    | members+=TargetTransitionUsageMember // TODO: must be after behavior usage element or another targettransitionusage
    | members+=TransitionUsageMember
    | members+=EntryActionMember
    | members+=EntryTransitionMember// TODO: must follow entry action or other entry transition
    | members+=DoActionMember
    | members+=ExitActionMember
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

StateActionUsage returns ActionUsage:
    EmptyActionUsage ';' | PerformedActionUsage ActionBody
;

EmptyActionUsage returns ActionUsage:
    {ActionUsage}
;

fragment PerformedActionUsage:
    {PerformActionUsage} PerformActionUsageDeclaration 
    | {AcceptActionUsage} AcceptNodeDeclaration 
    | {SendActionUsage} SendNodeDeclaration
    | {AssignmentActionUsage} AssignmentNodeDeclaration
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
        typeRelationships+=OwnedReferenceSubsetting FeatureSpecializationPart?
        | 'state' UsageDeclaration?
    )
    ValuePart? StateBody
;

// Transition Usages

TransitionUsage returns TransitionUsage:
    'transition' ( UsageDeclaration? 'first' )? 
    members+=TransitionSourceMember
    // TODO: empty rule
    /* members+=EmptyParameterMember */
    // TODO: empty rule
    ( /* members+=EmptyParameterMember */ members+=TriggerActionMember )?
    ( members+=GuardExpressionMember )?
    ( members+=EffectBehaviorMember )?
    'then' members+=TransitionSuccessionMember
    ActionBody
;

TargetTransitionUsage returns TransitionUsage:
    // TODO: empty rule
    /* members+=EmptyParameterMember */
    ( 'transition'
    // TODO: empty rule
      ( /* members+=EmptyParameterMember  */
        members+=TriggerActionMember )?
      ( members+=GuardExpressionMember )?
      ( members+=EffectBehaviorMember )?
    // TODO: empty rule
    | /* members+=EmptyParameterMember */ 
      members+=TriggerActionMember
      ( members+=GuardExpressionMember )?
      ( members+=EffectBehaviorMember )?
    | members+=GuardExpressionMember
      ( members+=EffectBehaviorMember )?
    )?
    'then' members+=TransitionSuccessionMember
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

EffectBehaviorUsage returns ActionUsage:
    EmptyActionUsage | PerformedActionUsage ( '{' ActionBodyItems '}' )?
;

TransitionSuccessionMember returns OwningMembership:
    element=TransitionSuccession
;

TransitionSuccession returns SuccessionAsUsage:
    members+=EmptySourceEndMember
    members+=ConnectorEndMember
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
    ActionBodyItem | members+=ReturnParameterMember
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
        typeRelationships+=OwnedReferenceSubsetting FeatureSpecializationPart?
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
    | members+=SubjectMember
    | members+=RequirementConstraintMember
    | members+=FramedConcernMember
    | members+=RequirementVerificationMember
    | members+=ActorMember
    | members+=StakeholderMember
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
    typeRelationships+=OwnedReferenceSubsetting FeatureSpecialization* RequirementBody
    | ( UsageExtensionKeyword* 'constraint' | UsageExtensionKeyword+ ) CalculationUsageDeclaration CalculationBody
;

FramedConcernMember returns FramedConcernMembership:
    Visibility? 'frame' element=FramedConcernUsage
;

FramedConcernUsage returns ConcernUsage:
    (typeRelationships+=OwnedReferenceSubsetting FeatureSpecialization* RequirementBody
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
    ( typeRelationships+=OwnedReferenceSubsetting FeatureSpecializationPart?
    | 'requirement' UsageDeclaration?
    )
    ValuePart? ('by' members+=SatisfactionSubjectMember)? RequirementBody
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
    | members+=SubjectMember
    | members+=ActorMember
    | members+=ObjectiveMember
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
    typeRelationships+=OwnedReferenceSubsetting FeatureSpecialization* RequirementBody
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
        typeRelationships+=OwnedReferenceSubsetting FeatureSpecializationPart?
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
    | filters+=ElementFilterMember
    | members+=ViewRenderingMember
;

ViewRenderingMember returns ViewRenderingMembership:
    Visibility? 'render' element=ViewRenderingUsage
;

ViewRenderingUsage returns RenderingUsage:
    typeRelationships+=OwnedReferenceSubsetting FeatureSpecialization* UsageBody
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
    | filters+=ElementFilterMember
    | imports+=Expose
    | members+=ViewRenderingMember
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
            operator=ClassificationTestOperator members+=TypeReferenceMember
            | operator='as' members+=TypeResultMember
        )
    )?
    // Note: empty rule breaks parsing here 
    | {OperatorExpression} /* operands+=SelfReferenceExpression */ operator=ClassificationTestOperator members+=TypeReferenceMember
    | {OperatorExpression} operands+=MetadataReference operator='@@' members+=TypeReferenceMember
    | {OperatorExpression} /* operands+=SelfReferenceExpression */ operator='as' members+=TypeResultMember
    | {OperatorExpression} operands+=MetadataReference operator='meta' members+=TypeResultMember
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
    {OperatorExpression} operator='all' members+=TypeResultMember
    | PrimaryExpression
;

// Primary Expressions

PrimaryExpression returns Expression:
    BaseExpression
    ( {FeatureChainExpression.operands+=current} '.' members+=FeatureChainMember)?
    (   ( {OperatorExpression.operands+=current} operator='#' '(' operands+=SequenceExpression ')' // indexing
        | {OperatorExpression.operands+=current} operator='[' operands+=SequenceExpression ']' // indexing
        | {OperatorExpression.operands+=current} '->' typeRelationships+=ReferenceTyping 
            ( members+=ExpressionBodyMember
            | members+=FunctionReferenceMember
            | ArgumentList
            )
        | {CollectExpression.operands+=current} '.' members+=ExpressionBodyMember // collect
        | {SelectExpression.operands+=current} '.?' members+=ExpressionBodyMember // select
        )
        ( {FeatureChainExpression.operands+=current} '.' members+=FeatureChainMember)?
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
    typeRelationships+=OwnedFeatureTyping ArgumentList
;

fragment ArgumentList:
    '(' ( PositionalArgumentList | NamedArgumentList )? ')'
;

fragment PositionalArgumentList:
    members+=ArgumentMember ( ',' members+=ArgumentMember )*
;

ArgumentMember returns ParameterMembership:
    element=Argument
;

Argument returns Feature:
    value=ArgumentValue
;

fragment NamedArgumentList:
    members+=NamedArgumentMember ( ',' members+=NamedArgumentMember )*
;

NamedArgumentMember returns ParameterMembership:
    element=NamedArgument
;

NamedArgument returns Feature:
    typeRelationships+=ParameterRedefinition '=' value=ArgumentValue
;

ParameterRedefinition returns Redefinition:
    reference=FeatureReference
;

ArgumentValue returns FeatureValue:
    element=OwnedExpression
;
