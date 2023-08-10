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
    elements+=OwnedAnnotation
    | elements+=FeatureElement
    | elements+=NonFeatureElement
    | elements+=RelationshipElement
;

/* Dependencies */

Dependency returns Dependency:
    ( prefixes+=PrefixMetadataAnnotation )*
    'dependency' (Identification? 'from')?
    client+=ElementReference ( ',' client+=ElementReference )* 'to'
    supplier+=ElementReference ( ',' supplier+=ElementReference )*
    RelationshipBody
;

/* Annotations */

OwnedAnnotation returns Annotation:
    source=AnnotatingElement
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
    children+=Import
    | children+=AliasMember
    | children+=AnnotatingMember
    | children+=NonFeatureMember
    | children+=NamespaceFeatureMember
    | children+=RelationshipMember
;

NonFeatureMember returns OwningMembership:
    Visibility? target=NonFeatureElement
;

NamespaceFeatureMember returns OwningMembership:
    Visibility? target=FeatureElement
;

RelationshipMember returns OwningMembership:
    Visibility? target=RelationshipElement
;

AnnotatingMember returns OwningMembership:
    Visibility? target=AnnotatingElement
;

AliasMember returns Membership:
    Visibility? isAlias?='alias' Identification? 'for' targetRef=ElementReference RelationshipBody
;

// Imports

fragment ImportPrefix:
    Visibility? 'import' ImportAll?
;

fragment ImportedReference:
    // TODO: split '::**' into 2 tokens,
    // https://github.com/langium/chevrotain-allstar/issues/1
    targetRef=ElementReference (isNamespace='::*')? ( isRecursive?='::**' )?
;

// modified import to work with Langium parser and completion suggestions,
// the original rule is not parsed on reference errors and thus cannot
// compute completions. Postprocessed in code to fit the spec AST
Import returns Import:
    ImportPrefix ImportedReference (target=FilterPackage)? RelationshipBody
;

// MembershipImport returns MembershipImport:
//     ImportPrefix ImportedMembership
// ;

// fragment ImportedMembership:
//     targetRef=MembershipReference ( isRecursive?='::**' )?
// ;

// NamespaceImport returns NamespaceImport:
//     ImportPrefix
//     ( ImportedNamespace
// 	| target=FilterPackage
// 	)
// ;

// fragment ImportedNamespace:
//     targetRef=NamespaceReference '::*' ( isRecursive?='::**' )?
// ;

FilterPackage returns Package:
    // imports+=FilterPackageImport
    ( children+=FilterPackageMember )+
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
    '[' target=OwnedExpression ']'
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
    children+=NamespaceFeatureMember
    | children+=NonFeatureMember
    | children+=AnnotatingMember
    | children+=RelationshipMember
    | children+=Import
    | children+=AliasMember
    | children+=ElementFilterMember
;

ElementFilterMember returns ElementFilterMembership:
    Visibility? 'filter' target=OwnedExpression ';'
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
    SpecializesToken heritage+=OwnedSpecialization (',' heritage+=OwnedSpecialization)*
;

fragment ConjugationPart:
    ConjugatesToken heritage+=OwnedConjugation
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
    children+=FeatureMember
    | children+=NonFeatureMember
    | children+=AnnotatingMember
    | children+=RelationshipMember
    | children+=Import
    | children+=AliasMember
;

/* Feature Membership */

FeatureMember returns OwningMembership:
    TypeFeatureMember | OwnedFeatureMember
;

TypeFeatureMember returns OwningMembership:
    Visibility? 'member' target=FeatureElement
;

OwnedFeatureMember returns FeatureMembership:
    Visibility? target=FeatureElement
;

/* Specialization */

Specialization returns Specialization:
    ( 'specialization' Identification? )? 'subtype' 
    ( sourceRef=TypeReference | sourceChain=OwnedFeatureChain )
    SpecializesToken
    ( targetRef=TypeReference | targetChain=OwnedFeatureChain )
    RelationshipBody
;

OwnedSpecialization returns Specialization:
    targetRef=TypeReference | targetChain=OwnedFeatureChain
;

/* Conjugation */

Conjugation returns Conjugation:
    ( 'conjugation' Identification? )? 'conjugate' 
    ( sourceRef=TypeReference | sourceChain=OwnedFeatureChain )
    ConjugatesToken
    ( targetRef=TypeReference | targetChain=OwnedFeatureChain )
    RelationshipBody
;

OwnedConjugation returns Conjugation:
    targetRef=TypeReference | targetChain=OwnedFeatureChain
;

/* Disjoining */

Disjoining returns Disjoining:
    ( 'disjoining' Identification? )? 'disjoint' 
    ( sourceRef=TypeReference  | sourceChain=OwnedFeatureChain )
    'from' 
    ( targetRef=TypeReference | targetChain=OwnedFeatureChain )
    RelationshipBody
;

OwnedDisjoining returns Disjoining:
    targetRef=TypeReference | targetChain=OwnedFeatureChain
;

/* Unioning, Intersecting and Differencing */

Unioning returns Unioning:
    targetRef=TypeReference | targetChain=OwnedFeatureChain
;

Intersecting returns Intersecting:
    targetRef=TypeReference | targetChain=OwnedFeatureChain
;

Differencing returns Differencing:
    targetRef=TypeReference | targetChain=OwnedFeatureChain
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
    SpecializesToken heritage+=OwnedSubclassification ( ',' heritage+=OwnedSubclassification )*
;

fragment ClassifierConjugationPart:
    ConjugatesToken heritage+=ClassifierConjugation
;

/* Subclassification */

Subclassification returns Subclassification:
    ( 'specialization' Identification? )?
    'subclassifier' sourceRef=ClassifierReference
    SpecializesToken targetRef=ClassifierReference
    RelationshipBody
;

OwnedSubclassification returns Subclassification:
    targetRef=ClassifierReference
;

/* Classifier Conjugation */

ClassifierConjugation returns Conjugation:
    targetRef=ClassifierReference
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
    TypedBy ( ',' heritage+=OwnedFeatureTyping )*
;

fragment TypedBy:
    TypedByToken heritage+=OwnedFeatureTyping
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

/* Feature Inverting */

FeatureInverting returns FeatureInverting:
    ( 'inverting' Identification? )? 'inverse' 
    ( sourceRef=FeatureReference | sourceChain=OwnedFeatureChain )
    'of' ( targetRef=FeatureReference | targetChain=OwnedFeatureChain )
    RelationshipBody
;

OwnedFeatureInverting returns FeatureInverting:
    targetRef=FeatureReference | targetChain=OwnedFeatureChain
;

/* Type Featuring */

TypeFeaturing returns TypeFeaturing:
    'featuring' ( Identification? 'of')? sourceRef=FeatureReference
    'by' targetRef=TypeReference
    RelationshipBody
;

OwnedTypeFeaturing returns TypeFeaturing:
    targetRef=TypeReference
;

/* Feature Typing */

FeatureTyping returns FeatureTyping:
    ( 'specialization' Identification? )?
    'typing' sourceRef=FeatureReference
    TypedByToken FeatureType
    RelationshipBody
;

/* Subsetting */

Subsetting returns Subsetting:
    ( 'specialization' Identification? )? 'subset' 
    ( sourceRef=FeatureReference | sourceChain=OwnedFeatureChain )
    SubsetsToken
    ( targetRef=FeatureReference | targetChain=OwnedFeatureChain )
    RelationshipBody
;

OwnedSubsetting returns Subsetting:
    targetRef=FeatureReference | targetChain=OwnedFeatureChain
;

OwnedReferenceSubsetting returns ReferenceSubsetting:
    targetRef=FeatureReference | targetChain=OwnedFeatureChain
;

/* Redefinition */

Redefinition returns Redefinition:
    ( 'specialization' Identification? )? 'redefinition' 
    ( sourceRef=FeatureReference | sourceChain=OwnedFeatureChain )
    RedefinesToken
    ( targetRef=FeatureReference | targetChain=OwnedFeatureChain )
    RelationshipBody
;

OwnedRedefinition returns Redefinition:
    targetRef=FeatureReference | targetChain=OwnedFeatureChain
;

/* Feature Conjugation */

fragment FeatureConjugationPart:
    ConjugatesToken heritage+=FeatureConjugation
;

FeatureConjugation returns Conjugation:
    targetRef=FeatureReference
;

/* FEATURE VALUES */

fragment ValuePart:
    value=FeatureValue
    | value=FeatureValueExpression
    // not reliable in Langium
    //   write=EmptyFeatureWriteMember
;

FeatureValue returns FeatureValue:
    ( '=' | isDefault?='default' ( '=' | isInitial?=':=' )? ) target=OwnedExpression
;

FeatureValueExpression returns FeatureValue:
    isInitial?=':=' target=OwnedExpression
;

// EmptyFeatureWriteMember returns OwningMembership:
//     target=EmptyFeatureWrite
// ;

// EmptyFeatureWrite returns Step:
//     children+=EmptyTargetMember
//     children+=EmptyParameterMember
// ;

// EmptyTargetMember returns ParameterMembership:
//     target=EmptyTargetParameter
// ;

// SysML type in KerML? Really?
// EmptyTargetParameter returns Feature:
//     children+=TargetFeatureMember
// ;

// TargetFeatureMember returns FeatureMembership:
//     target=TargetFeature
// ;

// TargetFeature returns Feature:
//     children+=EmptyFeatureMember
// ;

// EmptyFeatureMember returns FeatureMembership:
//     target=EmptyFeature
// ;

// EmptyParameterMember returns ParameterMembership:
//     target=EmptyFeature
// ;

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
    target=OwnedMultiplicityRange
;

OwnedMultiplicityRange returns MultiplicityRange:
    MultiplicityBounds
;

fragment MultiplicityBounds:
    '[' range=MultiplicityExpressionMember ']'
;

MultiplicityExpressionMember returns OwningMembership:
    target=OwnedExpression
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
    ends+=ConnectorEndMember 'to' 
    ends+=ConnectorEndMember
;

fragment NaryConnectorDeclaration:
    FeatureDeclaration?
    ( '(' ends+=ConnectorEndMember ( ',' ends+=ConnectorEndMember )+ ')' )?
;

ConnectorEndMember returns EndFeatureMembership:
    target=ConnectorEnd
;

ConnectorEnd returns Feature:
    ( RegularName ReferencesToken )? heritage+=OwnedReferenceSubsetting
    ( multiplicity=OwnedMultiplicity )?
;

/* Binding Connectors */

BindingConnector returns BindingConnector:
    FeaturePrefix 'binding' BindingConnectorDeclaration TypeBody
;

fragment BindingConnectorDeclaration:
    FeatureDeclaration ( 'of' ends+=ConnectorEndMember '=' ends+=ConnectorEndMember )?
    | Sufficient? ( 'of'? ends+=ConnectorEndMember '=' ends+=ConnectorEndMember )?
;

/* Successions */

Succession returns Succession:
    FeaturePrefix 'succession' SuccessionDeclaration TypeBody
;

fragment SuccessionDeclaration:
    FeatureDeclaration ( 'first' ends+=ConnectorEndMember 'then' ends+=ConnectorEndMember )?
    | Sufficient? ( 'first'? ends+=ConnectorEndMember  'then' ends+=ConnectorEndMember )?
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
    ( children+=NonFeatureMember 
    | children+=AnnotatingMember
    | children+=RelationshipMember
    | children+=FeatureMember 
    | children+=AliasMember
    | children+=Import
    | children+=ReturnFeatureMember
    )* 
    ( result=ResultExpressionMember )?
;

ReturnFeatureMember returns ReturnParameterMembership:
    Visibility? 'return' target=FeatureElement
;

ResultExpressionMember returns ResultExpressionMembership:
    Visibility? target=OwnedExpression
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
    FeatureDeclaration? ValuePart? ( 'of'  item=ItemFeatureMember )?
      ( 'from' ends+=ItemFlowEndMember 'to' ends+=ItemFlowEndMember )?
    | Sufficient? ends+=ItemFlowEndMember 'to' ends+=ItemFlowEndMember
;

ItemFeatureMember returns FeatureMembership:
    target=ItemFeature
;

ItemFeature returns ItemFeature:
    Identification? (ItemFeatureSpecializationPart ValuePart? | ValuePart)
    | heritage+=OwnedFeatureTyping ( multiplicity=OwnedMultiplicity )?
    | multiplicity=OwnedMultiplicity heritage+=OwnedFeatureTyping
;

fragment ItemFeatureSpecializationPart:
    FeatureSpecialization+ (MultiplicityPart FeatureSpecialization*)?
    | MultiplicityPart FeatureSpecialization+
;

ItemFlowEndMember returns EndFeatureMembership:
    target=ItemFlowEnd
;

ItemFlowEnd returns ItemFlowEnd:
    ( heritage+=ItemFlowEndSubsetting )? children+=ItemFlowFeatureMember
;

ItemFlowEndSubsetting returns ReferenceSubsetting:
    targetRef=FeatureReference '.' | targetChain=FeatureChainPrefix
;

ItemFlowFeatureMember returns FeatureMembership:
    target=ItemFlowFeature
;

ItemFlowFeature returns Feature:
    heritage+=ItemFlowRedefinition
;

ItemFlowRedefinition returns Redefinition:
    targetRef=FeatureReference
;

/* METADATA */

Metaclass returns Metaclass:
    TypePrefix 'metaclass' ClassifierDeclaration TypeBody
;

PrefixMetadataAnnotation returns Annotation:
    source=PrefixMetadataFeature
;

PrefixMetadataMember returns OwningMembership:
    target=PrefixMetadataFeature
;

fragment PrefixMetadata:
    (prefixes+=PrefixMetadataMember)+
;

PrefixMetadataFeature returns MetadataFeature:
    '#' heritage+=MetadataTyping
;

MetadataFeature returns MetadataFeature:
    ( '@' | 'metadata' ) MetadataFeatureDeclaration 
    ( 'about' about+=Annotation ( ',' about+=Annotation )* )?
    MetadataBody
;

fragment MetadataFeatureDeclaration:
    ( Identification TypedByToken )? heritage+=MetadataTyping
;

fragment MetadataBody:
    ';' | '{' MetadataBodyElements '}'
;

fragment MetadataBodyElements:
    MetadataBodyElement*
;

fragment MetadataBodyElement:
    children+=NonFeatureMember
    | children+=AnnotatingMember
    | children+=RelationshipMember
    | children+=MetadataBodyFeatureMember 
    | children+=AliasMember
    | children+=Import
;

MetadataBodyFeatureMember returns FeatureMembership:
    target=MetadataBodyFeature
;

MetadataBodyFeature returns Feature:
    'feature'? RedefinesToken? heritage+=OwnedRedefinition 
    FeatureSpecializationPart? ValuePart?
    MetadataBody
;


/* EXPRESSIONS */

ExpressionBody returns Expression:
    '{' FunctionBodyPart '}'
;

// Operator Expressions

OwnedExpressionMember returns FeatureMembership:
    target=OwnedExpression
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
    target=ImpliesExpression
;

ImpliesExpression returns Expression:
    OrExpression ( {OperatorExpression.operands+=current} operator='implies' operands+=OrExpressionReference )*
;

OrExpressionReference returns FeatureReferenceExpression:
    expression=OrExpressionMember
;

OrExpressionMember returns FeatureMembership:
    target=OrExpression
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
    target=XorExpression
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
    target=EqualityExpression
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
    target=ExpressionBody
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
    target=Argument
;

Argument returns Feature:
    value=ArgumentValue
;

fragment NamedArgumentList:
    children+=NamedArgumentMember ( ',' children+=NamedArgumentMember )*
;

NamedArgumentMember returns ParameterMembership:
    target=NamedArgument
;

NamedArgument returns Feature:
    heritage+=ParameterRedefinition '=' value=ArgumentValue
;

ParameterRedefinition returns Redefinition:
    targetRef=FeatureReference
;

ArgumentValue returns FeatureValue:
    target=OwnedExpression
;
