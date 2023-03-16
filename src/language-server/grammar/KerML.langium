grammar KerML

import 'KerML.interfaces'
import 'KerML.expressions'

entry RootNamespace returns Namespace:
    NamespaceBodyElements
;

// Tokens

fragment TypedByToken returns string:
    ':' | 'typed' 'by'
;
fragment ConjugatesToken returns string:
    '~' | 'conjugates'
;

/* Elements */

// Relationships

fragment RelationshipBody:
    ';' | '{' RelationshipOwnedElements '}'
;

fragment RelationshipOwnedElements:
    RelationshipOwnedElement*
;

fragment RelationshipOwnedElement:
    annotations+=OwnedAnnotation
    | elements+=FeatureElement
    | elements+=NonFeatureElement
    | elements+=RelationshipElement
;

/* Dependencies */

Dependency returns Dependency:
    ( annotations+=PrefixMetadataAnnotation )*
    'dependency' (Identification 'from')?
    client+=ElementReference ( ',' client+=ElementReference )* 'to'
    supplier+=ElementReference ( ',' supplier+=ElementReference )*
    RelationshipBody
;

/* Annotations */

OwnedAnnotation returns Annotation:
    element=AnnotatingElement
;

AnnotatingElement returns AnnotatingElement:
    Comment
    | Documentation
    | TextualRepresentation
    | MetadataFeature
;

/* Namespaces */

Namespace returns Namespace:
    PrefixMetadata? 'namespace' Identification? NamespaceBody
;

fragment NamespaceBody:
    ';' | '{' NamespaceBodyElements '}'
;

fragment NamespaceBodyElements:
    NamespaceBodyElement*
;

fragment NamespaceBodyElement:
    imports+=Import
    | aliases+=AliasMember
    | annotatingMembers+=AnnotatingMember
    | namespaceMembers+=NonFeatureMember
    | members+=NamespaceFeatureMember
    | relationshipMembers+=RelationshipMember
;

NonFeatureMember returns OwningMembership:
    Visibility? element=NonFeatureElement
;

NamespaceFeatureMember returns OwningMembership:
    Visibility? element=FeatureElement
;

RelationshipMember returns OwningMembership:
    Visibility? element=RelationshipElement
;

AnnotatingMember returns OwningMembership:
    Visibility? element=AnnotatingElement
;

AliasMember returns Membership:
    Visibility? 'alias' Identification? 'for' reference=ElementReference RelationshipBody
;

// Imports

fragment ImportPrefix:
    Visibility? 'import' ImportAll?
;

fragment ImportedReference:
    // TODO: split '::**' into 2 tokens,
    // https://github.com/langium/chevrotain-allstar/issues/1
    reference=ElementReference (isNamespace='::*')? ( isRecursive?='::**' )?
;

// modified import to work with Langium parser and completion suggestions,
// the original rule is not parsed on reference errors and thus cannot
// compute completions. Postprocessed in code to fit the spec AST
Import returns Import:
    ImportPrefix ImportedReference (element=FilterPackage)? RelationshipBody
;

// MembershipImport returns MembershipImport:
//     ImportPrefix ImportedMembership
// ;

// fragment ImportedMembership:
//     reference=MembershipReference ( isRecursive?='::**' )?
// ;

// NamespaceImport returns NamespaceImport:
//     ImportPrefix
//     ( ImportedNamespace
// 	| element=FilterPackage
// 	)
// ;

// fragment ImportedNamespace:
//     reference=NamespaceReference '::*' ( isRecursive?='::**' )?
// ;

FilterPackage returns Package:
    // imports+=FilterPackageImport
    ( filters+=FilterPackageMember )+
;

// FilterPackageImport returns Import:
//     FilterPackageMembershipImport | FilterPackageNamespaceImport
// ;

// FilterPackageMembershipImport returns MembershipImport:
//     ImportedMembership
// ;

// FilterPackageNamespaceImport returns NamespaceImport:
//     ImportedNamespace
// ;

FilterPackageMember returns ElementFilterMembership:
    // TODO: always private visibility
    '[' element=OwnedExpression ']'
;

/* Namespace Elements */

RelationshipElement returns Relationship:
    Dependency
    | Specialization
    | Conjugation
    | FeatureTyping
    | Subclassification
    | Disjoining
    | FeatureInverting
    | Subsetting
    | Redefinition
    | TypeFeaturing
;

NonFeatureElement returns Namespace:
    Namespace
    | Package
    | LibraryPackage 
    | Multiplicity
    | Type
    | Classifier 
    | Class
    | Structure
    | Metaclass
    | DataType 
    | Association
    | AssociationStructure
    | Interaction
    | Behavior
    | SysMLFunction
    | Predicate
;

FeatureElement returns Feature:
    Feature
    | Step
    | Expression
    | BooleanExpression
    | Invariant
    | Connector
    | BindingConnector
    | Succession
    | ItemFlow
    | SuccessionItemFlow
;

/* Packages */

Package returns Package:
    PrefixMetadata? 'package' Identification? PackageBody
;

LibraryPackage returns LibraryPackage:
    Standard? 'library' PrefixMetadata? 'package' Identification? PackageBody
;

fragment PackageBody:
    ';' | '{' PackageBodyElements '}'
;

fragment PackageBodyElements:
    PackageBodyElement*
;

fragment PackageBodyElement:
    members+=NamespaceFeatureMember
    | namespaceMembers+=NonFeatureMember
    | annotatingMembers+=AnnotatingMember
    | relationshipMembers+=RelationshipMember
    | imports+=Import
    | aliases+=AliasMember
    | filters+=ElementFilterMember
;

ElementFilterMember returns ElementFilterMembership:
    Visibility? 'filter' element=OwnedExpression ';'
;

/* Types */

fragment TypePrefix:
    Abstract? PrefixMetadata?
;

Type returns Type:
    TypePrefix 'type' TypeDeclaration TypeBody
;

fragment TypeDeclaration:
    Sufficient? Identification? (multiplicity=OwnedMultiplicity)?
    (SpecializationPart | ConjugationPart)+ TypeRelationshipPart*
;

fragment SpecializationPart:
    SpecializesToken typeRelationships+=OwnedSpecialization (',' typeRelationships+=OwnedSpecialization)*
;

fragment ConjugationPart:
    ConjugatesToken typeRelationships+=OwnedConjugation
;

fragment TypeRelationshipPart:
    DisjoiningPart | UnioningPart | IntersectingPart | DifferencingPart
;

fragment DisjoiningPart:
    'disjoint' 'from' typeRelationships+=OwnedDisjoining (',' typeRelationships+=OwnedDisjoining)*
;

fragment UnioningPart:
    'unions' typeRelationships+=Unioning (',' typeRelationships+=Unioning)*
;

fragment IntersectingPart:
    'intersects' typeRelationships+=Intersecting (',' typeRelationships+=Intersecting)*
;

fragment DifferencingPart:
    'differences' typeRelationships+=Differencing (',' typeRelationships+=Differencing)*
;

fragment TypeBody:
    ';' | '{' TypeBodyElements '}'
;

fragment TypeBodyElements:
    TypeBodyElement*
;

fragment TypeBodyElement:
    members+=FeatureMember
    | namespaceMembers+=NonFeatureMember
    | annotatingMembers+=AnnotatingMember
    | relationshipMembers+=RelationshipMember
    | imports+=Import
    | aliases+=AliasMember
;

/* Feature Membership */

FeatureMember returns OwningMembership:
    TypeFeatureMember | OwnedFeatureMember
;

TypeFeatureMember returns OwningMembership:
    Visibility? 'member' element=FeatureElement
;

OwnedFeatureMember returns FeatureMembership:
    Visibility? element=FeatureElement
;

/* Specialization */

Specialization returns Specialization:
    ( 'specialization' Identification? )? 'subtype' 
    ( source=TypeReference | chains+=OwnedFeatureChain )
    SpecializesToken
    ( reference=TypeReference | chains+=OwnedFeatureChain )
    RelationshipBody
;

OwnedSpecialization returns Specialization:
    reference=TypeReference | chains+=OwnedFeatureChain
;

/* Conjugation */

Conjugation returns Conjugation:
    ( 'conjugation' Identification? )? 'conjugate' 
    ( source=TypeReference | chains+=OwnedFeatureChain )
    ConjugatesToken
    ( reference=TypeReference | chains+=OwnedFeatureChain )
    RelationshipBody
;

OwnedConjugation returns Conjugation:
    reference=TypeReference | chains+=OwnedFeatureChain
;

/* Disjoining */

Disjoining returns Disjoining:
    ( 'disjoining' Identification? )? 'disjoint' 
    ( source=TypeReference  | chains+=OwnedFeatureChain )
    'from' 
    ( reference=TypeReference | chains+=OwnedFeatureChain )
    RelationshipBody
;

OwnedDisjoining returns Disjoining:
    reference=TypeReference | chains+=OwnedFeatureChain
;

/* Unioning, Intersecting and Differencing */

Unioning returns Unioning:
    reference=TypeReference | chains+=OwnedFeatureChain
;

Intersecting returns Intersecting:
    reference=TypeReference | chains+=OwnedFeatureChain
;

Differencing returns Differencing:
    reference=TypeReference | chains+=OwnedFeatureChain
;

/* CLASSIFIERS */

/* Classifiers */

Classifier returns Classifier:
    TypePrefix 'classifier' ClassifierDeclaration TypeBody
;

fragment ClassifierDeclaration:
    Sufficient? Identification? ( multiplicity=OwnedMultiplicity )?
    ( SuperclassingPart | ClassifierConjugationPart )?
    TypeRelationshipPart*
;

fragment SuperclassingPart:
    SpecializesToken typeRelationships+=OwnedSubclassification ( ',' typeRelationships+=OwnedSubclassification )*
;

fragment ClassifierConjugationPart:
    ConjugatesToken typeRelationships+=ClassifierConjugation
;

/* Subclassification */

Subclassification returns Subclassification:
    ( 'specialization' Identification? )?
    'subclassifier' source=ClassifierReference
    SpecializesToken reference=ClassifierReference
    RelationshipBody
;

OwnedSubclassification returns Subclassification:
    reference=ClassifierReference
;

/* Classifier Conjugation */

ClassifierConjugation returns Conjugation:
    reference=ClassifierReference
;

/* FEATURES */

/* Features */

fragment FeaturePrefix:
    ( direction=FeatureDirectionKind )?
    Abstract? ( isComposite='composite' | isPortion='portion' )? 
    Readonly? Derived? End? PrefixMetadata?
;

Feature returns Feature:
    FeaturePrefix
    ( 'feature'? FeatureDeclaration
    | prefixes+=PrefixMetadataMember
    | 'feature'
    ) 
    ValuePart? TypeBody
;

fragment FeatureDeclaration:
    Sufficient? 
    ( Identification ( FeatureSpecializationPart | FeatureConjugationPart )?
    | FeatureSpecializationPart
    | FeatureConjugationPart
    )
    FeatureRelationshipPart*
;

fragment FeatureRelationshipPart:
    TypeRelationshipPart | ChainingPart | InvertingPart | TypeFeaturingPart
;

fragment ChainingPart:
    'chains' ( typeRelationships+=OwnedFeatureChaining | FeatureChain )
;

fragment InvertingPart:
    'inverse' 'of' typeRelationships+=OwnedFeatureInverting
;

fragment TypeFeaturingPart:
    'featured' 'by' typeRelationships+=OwnedTypeFeaturing 
    ( ',' typeRelationships+=OwnedTypeFeaturing )*
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
    TypedBy ( ',' typeRelationships+=OwnedFeatureTyping )*
;

fragment TypedBy:
    TypedByToken typeRelationships+=OwnedFeatureTyping
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

/* Feature Inverting */

FeatureInverting returns FeatureInverting:
    ( 'inverting' Identification? )? 'inverse' 
    ( source=FeatureReference | chains+=OwnedFeatureChain )
    'of' ( reference=FeatureReference | chains+=OwnedFeatureChain )
    RelationshipBody
;

OwnedFeatureInverting returns FeatureInverting:
    reference=FeatureReference | chains+=OwnedFeatureChain
;

/* Type Featuring */

TypeFeaturing returns TypeFeaturing:
    'featuring' ( Identification? 'of')? source=FeatureReference
    'by' reference=TypeReference
    RelationshipBody
;

OwnedTypeFeaturing returns TypeFeaturing:
    reference=TypeReference
;

/* Feature Typing */

FeatureTyping returns FeatureTyping:
    ( 'specialization' Identification? )?
    'typing' source=FeatureReference
    TypedByToken FeatureType
    RelationshipBody
;

/* Subsetting */

Subsetting returns Subsetting:
    ( 'specialization' Identification? )? 'subset' 
    ( source=FeatureReference | chains+=OwnedFeatureChain )
    SubsetsToken
    ( reference=FeatureReference | chains+=OwnedFeatureChain )
    RelationshipBody
;

OwnedSubsetting returns Subsetting:
    reference=FeatureReference | chains+=OwnedFeatureChain
;

OwnedReferenceSubsetting returns ReferenceSubsetting:
    reference=FeatureReference | chains+=OwnedFeatureChain
;

/* Redefinition */

Redefinition returns Redefinition:
    ( 'specialization' Identification? )? 'redefinition' 
    ( source=FeatureReference | chains+=OwnedFeatureChain )
    RedefinesToken
    ( reference=FeatureReference | chains+=OwnedFeatureChain )
    RelationshipBody
;

OwnedRedefinition returns Redefinition:
    reference=FeatureReference | chains+=OwnedFeatureChain
;

/* Feature Conjugation */

fragment FeatureConjugationPart:
    ConjugatesToken typeRelationships+=FeatureConjugation
;

FeatureConjugation returns Conjugation:
    reference=FeatureReference
;

/* FEATURE VALUES */

fragment ValuePart:
    value=FeatureValue
    | value=FeatureValueExpression
      write=EmptyFeatureWriteMember
;

FeatureValue returns FeatureValue:
    ( '=' | isDefault?='default' ( '=' | isInitial?=':=' )? ) element=OwnedExpression
;

FeatureValueExpression returns FeatureValue:
    isInitial?=':=' element=OwnedExpression
;

EmptyFeatureWriteMember returns OwningMembership:
    element=EmptyFeatureWrite
;

EmptyFeatureWrite returns Step:
    members+=EmptyTargetMember
    members+=EmptyParameterMember
;

EmptyTargetMember returns ParameterMembership:
    element=EmptyTargetParameter
;

// SysML type in KerML? Really?
EmptyTargetParameter returns Feature:
    members+=TargetFeatureMember
;

TargetFeatureMember returns FeatureMembership:
    element=TargetFeature
;

TargetFeature returns Feature:
    members+=EmptyFeatureMember
;

EmptyFeatureMember returns FeatureMembership:
    element=EmptyFeature
;

EmptyParameterMember returns ParameterMembership:
    element=EmptyFeature
;

/* MULTIPLICITIES */

Multiplicity returns Multiplicity:
    MultiplicitySubset | MultiplicityRange
;

MultiplicitySubset returns Multiplicity:
    'multiplicity' Identification? Subsets TypeBody
;

MultiplicityRange returns MultiplicityRange:
    'multiplicity' Identification? MultiplicityBounds TypeBody
;

OwnedMultiplicity returns OwningMembership:
    element=OwnedMultiplicityRange
;

OwnedMultiplicityRange returns MultiplicityRange:
    MultiplicityBounds
;

fragment MultiplicityBounds:
    '[' range=MultiplicityExpressionMember ']'
;

MultiplicityExpressionMember returns OwningMembership:
    element=OwnedExpression
;

/* CLASSIFICATION */

/* Data Types */

DataType returns DataType:
    TypePrefix 'datatype' ClassifierDeclaration TypeBody
;

/* Classes */

Class returns Class:
    TypePrefix 'class' ClassifierDeclaration TypeBody
;

/* STRUCTURES */

Structure returns Structure:
    TypePrefix 'struct' ClassifierDeclaration TypeBody
;


/* ASSOCIATIONS */

Association returns Association:
    TypePrefix 'assoc' ClassifierDeclaration TypeBody
;

AssociationStructure returns AssociationStructure:
    TypePrefix 'assoc' 'struct' ClassifierDeclaration TypeBody
;

/* CONNECTORS */

/* Connectors */

Connector returns Connector:
    FeaturePrefix 'connector' ConnectorDeclaration TypeBody
;

fragment ConnectorDeclaration:
    BinaryConnectorDeclaration | NaryConnectorDeclaration
;

fragment BinaryConnectorDeclaration:
    ( FeatureDeclaration? 'from' | Sufficient 'from'? )?
    members+=ConnectorEndMember 'to' 
    members+=ConnectorEndMember
;

fragment NaryConnectorDeclaration:
    FeatureDeclaration?
    ( '(' members+=ConnectorEndMember ( ',' members+=ConnectorEndMember )+ ')' )?
;

ConnectorEndMember returns EndFeatureMembership:
    element=ConnectorEnd
;

ConnectorEnd returns Feature:
    ( RegularName ReferencesToken )? typeRelationships+=OwnedReferenceSubsetting
    ( multiplicity=OwnedMultiplicity )?
;

/* Binding Connectors */

BindingConnector returns BindingConnector:
    FeaturePrefix 'binding' BindingConnectorDeclaration TypeBody
;

fragment BindingConnectorDeclaration:
    FeatureDeclaration ( 'of' members+=ConnectorEndMember '=' members+=ConnectorEndMember )?
    | Sufficient? ( 'of'? members+=ConnectorEndMember '=' members+=ConnectorEndMember )?
;

/* Successions */

Succession returns Succession:
    FeaturePrefix 'succession' SuccessionDeclaration TypeBody
;

fragment SuccessionDeclaration:
    FeatureDeclaration ( 'first' members+=ConnectorEndMember 'then' members+=ConnectorEndMember )?
    | Sufficient? ( 'first'? members+=ConnectorEndMember  'then' members+=ConnectorEndMember )?
;

/* BEHAVIORS */

/* Behaviors */

Behavior returns Behavior:
    TypePrefix 'behavior'  ClassifierDeclaration TypeBody
;

/* Steps */

Step returns Step:
    FeaturePrefix 'step' StepDeclaration TypeBody
;

fragment StepDeclaration:
    FeatureDeclaration? ValuePart?
;

/* FUNCTIONS */

/* Functions */

SysMLFunction returns SysMLFunction:
    TypePrefix 'function' ClassifierDeclaration FunctionBody
;

fragment FunctionBody:
    ';' | '{' FunctionBodyPart '}'
;

fragment FunctionBodyPart:
    ( namespaceMembers+=NonFeatureMember 
    | annotatingMembers+=AnnotatingMember
    | relationshipMembers+=RelationshipMember
    | members+=FeatureMember 
    | aliases+=AliasMember
    | imports+=Import
    | members+=ReturnFeatureMember
    )* 
    ( result=ResultExpressionMember )?
;

ReturnFeatureMember returns ReturnParameterMembership:
    Visibility? 'return' element=FeatureElement
;

ResultExpressionMember returns ResultExpressionMembership:
    Visibility? element=OwnedExpression
;

/* Expressions */

Expression returns Expression:
    FeaturePrefix 'expr' ExpressionDeclaration FunctionBody
;

fragment ExpressionDeclaration:
    FeatureDeclaration? ValuePart?
;

/* Predicates */

Predicate returns Predicate:
    TypePrefix 'predicate' ClassifierDeclaration FunctionBody
;

/* Boolean Expressions */

BooleanExpression returns BooleanExpression:
    FeaturePrefix 'bool' ExpressionDeclaration FunctionBody
;

/* Invariants */

Invariant returns Invariant:
    FeaturePrefix 'inv' ( 'true' | isNegated?='false' )? ExpressionDeclaration FunctionBody
;

/* INTERACTIONS */

/* Interactions */

Interaction returns Interaction:
    TypePrefix 'interaction' ClassifierDeclaration TypeBody
;

/* Item Flows */

ItemFlow returns ItemFlow:
    FeaturePrefix 'flow' ItemFlowDeclaration TypeBody
;

SuccessionItemFlow returns SuccessionItemFlow:
    FeaturePrefix 'succession' 'flow' ItemFlowDeclaration TypeBody
;

fragment ItemFlowDeclaration:
    FeatureDeclaration? ValuePart? ( 'of'  members+=ItemFeatureMember )?
      ( 'from' members+=ItemFlowEndMember 'to' members+=ItemFlowEndMember )?
    | Sufficient? members+=ItemFlowEndMember 'to' members+=ItemFlowEndMember
;

ItemFeatureMember returns FeatureMembership:
    element=ItemFeature
;

ItemFeature returns ItemFeature:
    Identification? (ItemFeatureSpecializationPart ValuePart? | ValuePart)
    | typeRelationships+=OwnedFeatureTyping ( multiplicity=OwnedMultiplicity )?
    | multiplicity=OwnedMultiplicity typeRelationships+=OwnedFeatureTyping
;

fragment ItemFeatureSpecializationPart:
    ( FeatureSpecialization )+ MultiplicityPart? FeatureSpecialization*
    | MultiplicityPart FeatureSpecialization+
;

ItemFlowEndMember returns EndFeatureMembership:
    element=ItemFlowEnd
;

ItemFlowEnd returns ItemFlowEnd:
    ( typeRelationships+=ItemFlowEndSubsetting )? members+=ItemFlowFeatureMember
;

ItemFlowEndSubsetting returns ReferenceSubsetting:
    reference=FeatureReference '.' | chains+=FeatureChainPrefix
;

ItemFlowFeatureMember returns FeatureMembership:
    element=ItemFlowFeature
;

ItemFlowFeature returns Feature:
    typeRelationships+=ItemFlowRedefinition
;

ItemFlowRedefinition returns Redefinition:
    reference=FeatureReference
;

/* METADATA */

Metaclass returns Metaclass:
    TypePrefix 'metaclass' ClassifierDeclaration TypeBody
;

PrefixMetadataAnnotation returns Annotation:
    element=PrefixMetadataFeature
;

PrefixMetadataMember returns OwningMembership:
    element=PrefixMetadataFeature
;

fragment PrefixMetadata:
    (prefixes+=PrefixMetadataMember)+
;

PrefixMetadataFeature returns MetadataFeature:
    '#' typeRelationships+=MetadataTyping
;

MetadataFeature returns MetadataFeature:
    ( '@' | 'metadata' ) MetadataFeatureDeclaration 
    ( 'about' about+=Annotation ( ',' about+=Annotation )* )?
    MetadataBody
;

fragment MetadataFeatureDeclaration:
    ( Identification TypedByToken )? typeRelationships+=MetadataTyping
;

fragment MetadataBody:
    ';' | '{' MetadataBodyElements '}'
;

fragment MetadataBodyElements:
    MetadataBodyElement*
;

fragment MetadataBodyElement:
    namespaceMembers+=NonFeatureMember
    | annotatingMembers+=AnnotatingMember
    | relationshipMembers+=RelationshipMember
    | members+=MetadataBodyFeatureMember 
    | aliases+=AliasMember
    | imports+=Import
;

MetadataBodyFeatureMember returns FeatureMembership:
    element=MetadataBodyFeature
;

MetadataBodyFeature returns Feature:
    'feature'? RedefinesToken? typeRelationships+=OwnedRedefinition 
    FeatureSpecializationPart? ValuePart?
    MetadataBody
;


/* EXPRESSIONS */

ExpressionBody returns Expression:
    '{' FunctionBodyPart '}'
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
