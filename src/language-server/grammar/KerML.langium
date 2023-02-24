grammar KerML

import 'KerML.interfaces'
import 'KerML.expressions'

/* Element groups */

// For reference from KerML:

//! DO NOT USE UNIONS SINCE THEY CAN EASILY LEAD TO INFINITE RECURSION IN SUBTYPE COMPUTATION

NonFeatureElement<visible> returns Element:
    Namespace<visible>
	| Package<visible>
    | LibraryPackage<visible>
	| Multiplicity<visible>
	| Type<visible>
	| Classifier<visible>
	| Class<visible>
	| Structure<visible>
	| Metaclass<visible>
	| DataType<visible>
	| Association<visible>
    | AssociationStructure<visible>
	| Interaction<visible>
	| Behavior<visible>
    // prevent Function from also extending Element (again)
	| {Behavior} SysMLFunction<visible>
	| Predicate<visible>
;

RelationshipElement<visible> returns Relationship:
    Dependency<visible>
    | Specialization<visible>
	| Conjugation<visible>
    | FeatureTyping<visible>
	| Subclassification<visible>
	| Disjoining<visible>
	| FeatureInverting<visible>
	| Subsetting<visible>
	| Redefinition<visible>
	| TypeFeaturing<visible>
;

fragment CompositeOrPortion:
    // TODO: use boolean properties, Langium is bugged currently and always
    // parses them as false but strings work fine
    isComposite='composite' | isPortion='portion';

fragment FeaturePrefixSuffix:
    CompositeOrPortion? Readonly? Derived? End? PrefixMetadataMembers?;
fragment FeaturePrefix<visible>:
    (<visible> Visibility)? (direction=FeatureDirectionKind)? Abstract? FeaturePrefixSuffix;

FeatureElement<visible> returns Feature:
    (Feature<visible>
    | Connector<visible>
    | BindingConnector<visible>
    | Succession<visible>
    | Step<visible>
    | ItemFlow<visible>
    | SuccessionItemFlow<visible>
    | Expression<visible>
    | BooleanExpression<visible>
    | Invariant<visible>
    )
;

fragment AnnotatingMember:
    comments+=Comment
    | docs+=Documentation
    | reps+=TextualRepresentation
    | metadata+=MetadataFeature
;

entry Model returns Namespace:
    NamespaceMembers;

// Tokens

fragment TypedByToken returns string:
    ':' | 'typed' 'by';
fragment ConjugatesToken returns string:
    '~' | 'conjugates';

// Elements

fragment ElementFrag:
    PrefixMetadataMembers? Visibility? Identification? RelationshipBody;
DummyElement returns Element:
    ElementFrag;
DummyVisibleElement returns VisibilityElement:
    DummyElement;

// Relationships

fragment RelationshipBody:
    ';' | '{' RelationshipItems '}'
;

fragment RelationshipItems:
    ( comments+=Comment
    | docs+=Documentation
    | reps+=TextualRepresentation
    | metadata+=MetadataFeature
    | features+=FeatureElement<false>
    | elements+=NonFeatureElement<false>
    | relationships+=RelationshipElement<false>
    )*
;

DummyRelationship returns Relationship:
    ElementFrag source+=ElementReference target+=ElementReference;

// Dependencies

Dependency<visible> returns Dependency:
    (<visible> Visibility?)? PrefixMetadataMembers? 'dependency' Identification? 'from'?
    client+=ElementReference ( ',' client+=ElementReference )* 'to'
    supplier+=ElementReference ( ',' supplier+=ElementReference )*
    RelationshipBody
;

// Namespaces
Namespace<visible> returns Namespace:
    (<visible> Visibility)? PrefixMetadataMembers? 'namespace' Identification? NamespaceBody;
fragment NamespaceBody:
    ';' | '{' NamespaceMembers '}'
;
fragment NamespaceMembers:
    ( features+=FeatureElement<true>
    | elements+=NonFeatureElement<true>
    | relationships+=RelationshipElement<true>
    | imports+=Import | aliases+=Alias
    | comments+=Comment
    | docs+=Documentation
    | reps+=TextualRepresentation
    | metadata+=MetadataFeature
    )*
;

Alias returns Alias:
    Visibility? 'alias' Identification? 'for' for=ElementReference TypeBody;

// Type
fragment TypePrefix<visible> returns Type:
    (<visible> Visibility)? Abstract? PrefixMetadataMembers?;
Type<visible> returns Type:
    TypePrefix<visible> 'type' TypeDeclaration TypeBody;
fragment TypeDeclaration:
    Sufficient? Identification? OwnedMultiplicity? (SpecializationPart | ConjugationPart)* TypeRelationshipPart*;
fragment SpecializationPart:
    SpecializesToken specializes+=TypeReference (',' specializes+=TypeReference)*;
fragment ConjugationPart:
    ConjugatesToken conjugates+=TypeReference;
fragment TypeRelationshipPart:
    DisjoiningPart | UnioningPart | IntersectingPart | DifferencingPart;
fragment DisjoiningPart:
    'disjoint' 'from' disjoins+=TypeReferenceOrFeatureChain (',' disjoins+=TypeReferenceOrFeatureChain)*;
fragment UnioningPart:
    'unions' unions+=TypeReferenceOrFeatureChain (',' unions+=TypeReferenceOrFeatureChain)*;
fragment IntersectingPart:
    'intersects' intersects+=TypeReferenceOrFeatureChain (',' intersects+=TypeReferenceOrFeatureChain)*;
fragment DifferencingPart:
    'differences' differences+=TypeReferenceOrFeatureChain (',' differences+=TypeReferenceOrFeatureChain)*;
fragment TypeBody:
    ';' | '{' TypeItems '}'
;
fragment TypeItems:
    ( features+=FeatureElement<true>
    | members+=MemberFeature
    | relationships+=RelationshipElement<true>
    | elements+=NonFeatureElement<true>
    | comments+=Comment
    | docs+=Documentation
    | reps+=TextualRepresentation
    | metadata+=MetadataFeature
    | imports+=Import | aliases+=Alias
    )*
;

// Datatypes
DataType<visible> returns DataType:
    TypePrefix<visible> 'datatype' ClassifierDeclaration TypeBody;

// Classes
Class<visible> returns Class:
    TypePrefix<visible> 'class' ClassifierDeclaration TypeBody;

// Structures
Structure<visible> returns Structure:
    TypePrefix<visible> 'struct' ClassifierDeclaration TypeBody;

// Associations
AssociationDeclaration returns Association:
    ClassifierDeclaration TypeBody;
AssociationStructure<visible> returns AssociationStructure:
    TypePrefix<visible> 'assoc' 'struct' ClassifierDeclaration TypeBody;
Association<visible> returns Association:
    TypePrefix<visible> 'assoc' AssociationDeclaration;

// Behaviours
Behavior<visible> returns Behavior:
    TypePrefix<visible> 'behavior' ClassifierDeclaration TypeBody;

// Interactions
Interaction<visible> returns Interaction:
    TypePrefix<visible> 'interaction' ClassifierDeclaration TypeBody;
// Metadata
Metaclass<visible> returns Metaclass:
    TypePrefix<visible> 'metaclass' ClassifierDeclaration TypeBody;

// Functions
SysMLFunction<visible> returns SysMLFunction:
    TypePrefix<visible> 'function' ClassifierDeclaration FunctionBody;
fragment FunctionBody returns Type:
    ';' | '{' FunctionBodyPart '}';
fragment FunctionBodyPart:
    ( elements+=NonFeatureElement<true>
    | relationships+=RelationshipElement<true>
    | features+=FeatureElement<true>
    | members+=MemberFeature
	| imports+=Import | aliases+=Alias
    | comments+=Comment
    | docs+=Documentation
    | reps+=TextualRepresentation
    | metadata+=MetadataFeature
	| return+=ReturnFeature
	)* 
	( result=ResultExpression )?
;
ReturnFeature returns Feature:
    Visibility? 'return' FeatureElement<false>;
ResultExpression returns Result:
    Visibility? expression=InlineExpression;
ResultHierarchy returns VisibilityElement:
    ResultExpression;

// Feature values
FeatureValue returns FeatureValue:
    ( '=' | isInitial?=':=' | isDefault?='default' ( '=' | isInitial?=':=' )? ) expression=InlineExpression;

// Packages
Filter returns ElementFilter:
    Visibility? 'filter' expression=InlineExpression ';';
Package<visible> returns Package:
    (<visible> Visibility)? PrefixMetadataMembers? 'package' Identification? PackageBody;
LibraryPackage<visible> returns LibraryPackage:
    (<visible> Visibility)? Standard? 'library' PrefixMetadataMembers? 'package' Identification? PackageBody;
fragment PackageBody:
    ';' | '{' PackageItems '}'
;
fragment PackageItems:
    ( features+=FeatureElement<true>
    | elements+=NonFeatureElement<true>
    | relationships+=RelationshipElement<true>
    | imports+=Import | aliases+=Alias
    | comments+=Comment
    | docs+=Documentation
    | reps+=TextualRepresentation
    | metadata+=MetadataFeature
    | filters+=Filter
    )*
;

// Multiplicity
Multiplicity<visible> returns Multiplicity:
    (<visible> Visibility)? 'multiplicity' Identification? (MultiplicityBounds | Subsets?) TypeBody;
fragment MultiplicityBounds:
    '[' range=InlineExpression ']';
MultiplicityRange returns MultiplicityRange:
    MultiplicityBounds;
fragment OwnedMultiplicity:
    multiplicity=MultiplicityRange;
fragment MultiplicityPart:
    OwnedMultiplicity MultiplicityProperties?
    | MultiplicityProperties
;

fragment Subsets:
    SubsetsToken subsets+=FeatureChain (',' subsets+=FeatureChain)*;

Import returns Import:
    Visibility? 'import' ImportAll? ImportedNamespace ('[' conditions+=InlineExpression ']')*  RelationshipBody;

// Features

Feature<visible> returns Feature:
    FeaturePrefix<visible>
    ( 'feature'? FeatureDeclaration
	| 'feature'
	)
    ValuePart? TypeBody;

fragment FeatureDeclarationSuffixPart:
    ( Identification (FeatureSpecializationPart | FeatureConjugationPart)?
    | FeatureSpecializationPart
    | FeatureConjugationPart
    )
	FeatureRelationshipPart*
;

fragment FeatureDeclaration:
    Sufficient? FeatureDeclarationSuffixPart
;

// TODO: use validation to check for either specialization or multiplicity since
// unbounded lookahead complains about ambiguous alternatives
fragment FeatureSpecializationPart:
    FeatureSpecialization+ MultiplicityPart? FeatureSpecialization* | MultiplicityPart FeatureSpecialization*
;
fragment FeatureTypingFrag returns Feature:
    TypedByToken OwnedFeatureTypings;
fragment FeatureSpecialization:
    FeatureTypingFrag | Subsets | FeatureReferences | FeatureRedefinition;
fragment FeatureReferences:
    ReferencesToken references+=FeatureChain (',' references+=FeatureChain)*;
fragment FeatureRedefinition:
    RedefinesToken redefines+=FeatureChain (',' redefines+=FeatureChain)*;
fragment FeatureConjugationPart:
    ConjugatesToken conjugates+=FeatureAsTypeReference;
FeatureAsTypeReference returns TypeReference:
    QualifiedFeatureReference;

fragment ValuePart:
    value=FeatureValue;

fragment FeatureRelationshipPart:
    TypeRelationshipPart | ChainingPart | InvertingPart | TypeFeaturingPart;

fragment ChainingPart:
    'chains' chains+=FeatureChain;
fragment InvertingPart:
    'inverse' 'of' inverseOf+=FeatureChain;
fragment TypeFeaturingPart:
    'featured' 'by' featuredBy+=TypeReference (',' featuredBy+=TypeReference)*;

// Classifiers
fragment ClassifierDeclaration:
    Sufficient? Identification?
	( OwnedMultiplicity )?
	( SpecializesToken specializes+=ClassifierReference (',' specializes+=ClassifierReference)* | 
        ConjugatesToken conjugates+=ClassifierReference (',' conjugates+=ClassifierReference)* )?
	TypeRelationshipPart*
;
Classifier<visible> returns Classifier:
    TypePrefix<visible> 'classifier' ClassifierDeclaration TypeBody;
fragment SuperclassingPart:
    SpecializesToken OwnedSubclassification ( ',' OwnedSubclassification )*;
fragment OwnedSubclassification:
    superclassifies=TypeReference;

// Specialization
FeatureTyping<visible> returns FeatureTyping:
    (<visible> Visibility)? ('specialization' Identification?)? 'typing' specific=QualifiedFeatureReference TypedByToken GeneralType RelationshipBody;
Subclassification<visible> returns Subclassification:
    (<visible> Visibility)? ('specialization' Identification?)? 'subclassifier' specific=ClassifierReference SpecializesToken general=ClassifierReference RelationshipBody;
Subsetting<visible> returns Subsetting:
    (<visible> Visibility)? ('specialization' Identification?)? 'subset' SpecificFeature SubsetsToken GeneralFeature RelationshipBody;
Redefinition<visible> returns Redefinition:
    (<visible> Visibility)? ('specialization' Identification?)? 'redefinition' SpecificFeature RedefinesToken GeneralFeature RelationshipBody;
Specialization<visible> returns Specialization:
    (<visible> Visibility)? ('specialization' Identification?)? 'subtype' SpecificType SpecializesToken GeneralType RelationshipBody;

// Conjugation
Conjugation<visible> returns Conjugation:
    (<visible> Visibility)? ( 'conjugation' Identification? )?
    'conjugate' 
    SpecificType
    ConjugatesToken 
    GeneralType
	RelationshipBody
;

// Disjoining
Disjoining<visible> returns Disjoining:
    (<visible> Visibility)? ('disjoining' Identification? )? 'disjoint' disjoined=TypeReferenceOrFeatureChain 'from' OwnedDisjoining TypeBody;
fragment OwnedDisjoining:
    disjoining=TypeReferenceOrFeatureChain;

// Feature membership
MemberFeature returns Feature:
    Visibility? 'member' FeatureElement<false>;

// Metadata

MetadataFeature returns MetadataFeature:
    ( '@' | 'metadata' ) (Identification TypedByToken)? typedBy+=MetaclassReference ( 'about' about+=ElementReference ( ',' about+=ElementReference)* )? MetadataBody;
fragment MetadataBody:
    ';' | '{' MetadataItems '}'
;
fragment MetadataItems:
    ( elements+=NonFeatureElement<true>
    | relationships+=RelationshipElement<true>
    | comments+=Comment
    | docs+=Documentation
    | reps+=TextualRepresentation
    | metadata+=MetadataFeature
    | features+=MetadataBodyFeature
    | imports+=Import | aliases+=Alias
    )*
;
MetadataBodyFeature returns Feature:
    'feature'? RedefinesToken? redefines+=FeatureChain 
	FeatureSpecializationPart? ValuePart?
	MetadataBody
;

// Feature inverting
FeatureInverting<visible> returns FeatureInverting:
    (<visible> Visibility)? ( 'inverting' Identification? )? 'inverse' ( featureInverted=FeatureChain) 'of' ( invertingFeature=FeatureChain ) TypeBody;

// Type featuring
TypeFeaturing<visible> returns TypeFeaturing:
    (<visible> Visibility)? 'featuring' ( Identification? 'of')? feature=QualifiedFeatureReference 'by' featuringType=TypeReference TypeBody;

// Connectors
Connector<visible> returns Connector:
    FeaturePrefix<visible>? 'connector' ConnectorDeclaration TypeBody;
fragment ConnectorDeclaration:
    BinaryConnectorDeclaration | NaryConnectorDeclaration
;
fragment BinaryConnectorDeclaration:
    ( FeatureDeclaration? 'from' | isSufficient?='all' 'from'? )?
	ends+=ConnectorEnd 'to' 
	ends+=ConnectorEnd
;
fragment NaryConnectorDeclaration:
    FeatureDeclaration?
	( '(' ends+=ConnectorEnd ',' ends+=ConnectorEnd ( ',' ends+=ConnectorEnd )* ')' )?
;
ConnectorEnd returns ConnectorEnd:
    ( RegularName ReferencesToken )? references+=FeatureChain OwnedMultiplicity?;

// Binding connectors
BindingConnector<visible> returns BindingConnector:
    FeaturePrefix<visible>? 'binding' BindingConnectorDeclaration TypeBody;
fragment BindingConnectorDeclaration returns BindingConnector:
    FeatureDeclaration ( 'of' ends+=ConnectorEnd '=' ends+=ConnectorEnd )?
	| Sufficient? ( 'of'? ends+=ConnectorEnd '=' ends+=ConnectorEnd )?
;

// Successions
Succession<visible> returns Succession:
    FeaturePrefix<visible>? 'succession' SuccessionDeclaration TypeBody;
SuccessionItemFlow<visible> returns SuccessionItemFlow:
    FeaturePrefix<visible>? 'succession' 'flow' ItemFlowDeclaration TypeBody;
fragment SuccessionDeclaration returns Succession:
    FeatureDeclaration ( 'first' ends+=ConnectorEnd 'then' ends+=ConnectorEnd )?
    | Sufficient? ( 'first'? ends+=ConnectorEnd 'then' ends+=ConnectorEnd )?
;
// Item flows
ItemFlow<visible> returns ItemFlow:
    FeaturePrefix<visible>? 'flow' ItemFlowDeclaration TypeBody;
fragment ItemFlowDeclaration:
    FeatureDeclaration? ValuePart?
      ( 'of'  of=ItemFeature )?
	  ( 'from' ends+=ItemFlowEnd 
	    'to' ends+=ItemFlowEnd )?
    | Sufficient?
      ends+=ItemFlowEnd 'to'
	  ends+=ItemFlowEnd
;
ItemFlowEnd returns ItemFlowEnd:
    redefines+=FeatureChain; // TODO: chain.length >= 2, first chain reference is referenced feature
ItemFeature returns ItemFeature:
    Identification? (ItemFeatureSpecializationPart ValuePart? | ValuePart)
    | typedBy+=TypeReferenceOrFeatureChain OwnedMultiplicity?
    | OwnedMultiplicity typedBy+=TypeReferenceOrFeatureChain
;
fragment ItemFeatureSpecializationPart:
    FeatureSpecialization+ MultiplicityPart? FeatureSpecialization* | MultiplicityPart FeatureSpecialization+
;

// Steps
Step<visible> returns Step:
    FeaturePrefix<visible>? 'step' StepDeclaration TypeBody;
fragment StepDeclaration:
    FeatureDeclaration ValuePart?;

// Expressions
Expression<visible> returns Expression:
    FeaturePrefix<visible>? 'expr' ExpressionDeclaration FunctionBody;
fragment ExpressionDeclaration:
    FeatureDeclaration? ValuePart?;

// Predicates
Predicate<visible> returns Predicate:
    TypePrefix<visible> 'predicate' ClassifierDeclaration FunctionBody;

// Boolean expressions
BooleanExpression<visible> returns BooleanExpression:
    FeaturePrefix<visible>? 'bool' ExpressionDeclaration FunctionBody;
Invariant<visible> returns Invariant:
    FeaturePrefix<visible>? 'inv' ( 'true' | isNegated?='false' )? ExpressionDeclaration FunctionBody;

// Operator expressions
InlineExpressionReference returns FeatureReferenceExpression:
    expression=InlineExpression;

ConcreteConditionalExpression returns OperatorExpression:
    operator='if' args+=NullCoalescingExpression '?' args+=InlineExpressionReference 'else' args+=InlineExpressionReference;
ConditionalExpression returns InlineExpression:
    NullCoalescingExpression | ConcreteConditionalExpression;

NullCoalescingExpression returns InlineExpression:
    ImpliesExpression ( {OperatorExpression.args+=current} operator='??' args+=ImpliesExpressionReference )*;

ImpliesExpression returns InlineExpression:
    OrExpression ( {OperatorExpression.args+=current} operator='implies' args+=OrExpressionReference )*;
ImpliesExpressionReference returns FeatureReferenceExpression:
    expression=ImpliesExpression;

OrExpression returns InlineExpression:
    XorExpression ( {OperatorExpression.args+=current}( operator='|' args+=XorExpression | operator='or' args+=XorExpressionReference) )*;
OrExpressionReference returns FeatureReferenceExpression:
    expression=OrExpression;

XorExpression returns InlineExpression:
    AndExpression ( {OperatorExpression.args+=current} operator='xor' args+=AndExpression )*;
XorExpressionReference returns FeatureReferenceExpression:
    expression=XorExpression;

AndExpression returns InlineExpression:
    EqualityExpression ( {OperatorExpression.args+=current} (operator='&'args+=EqualityExpression | operator='and' args+=EqualityExpressionReference) )*;

EqualityExpression returns InlineExpression:
    ClassificationExpression ( {OperatorExpression.args+=current} operator=EqualityOperator  args+=ClassificationExpression )*;
EqualityExpressionReference returns FeatureReferenceExpression:
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

FeatureReferenceExpression returns FeatureReferenceExpression:
    expression=QualifiedFeatureReference;
MetadataAccessExpression returns MetadataAccessExpression:
    reference=ElementReference '.' 'metadata';
InvocationExpression returns InvocationExpression:
    type=TypeReferenceOrFeatureChain ArgumentList;

InlineExpression returns InlineExpression:
    ConditionalExpression;

PrimaryExpression returns InlineExpression:
    BaseExpression
	( {FeatureChainExpression.args+=current} '.' args+=FeatureChain)?
	(   ( {OperatorExpression.args+=current} operator='[' args+=SequenceExpression ']' // indexing
        | {InvocationExpression.args+=current} '->' type=TypeReference 
            ( args+=BodyExpression
            | args+=FunctionReferenceExpression
            | '(' (args+=Argument (',' args+=Argument)* | args+=NamedArgument (',' args+=NamedArgument)*)? ')'
            )
        | {CollectExpression.args+=current} '.' args+=BodyExpression // collect
        | {SelectExpression.args+=current} '.?' args+=BodyExpression // select
        )
        ( {FeatureChainExpression.args+=current} '.' args+=FeatureChain)?
	)*
;

FunctionReferenceExpression returns FeatureReferenceExpression:
    expression=TypeReference;

BodyExpression returns FeatureReferenceExpression:
    expression=ExpressionBody;

ExpressionBody returns Expression:
    '{' FunctionBodyPart '}';

// programmatic AST
SelfReferenceExpression returns SelfReferenceExpression:
    {SelfReferenceExpression};
SelfRefOperator returns OperatorExpression:
    args+=SelfReferenceExpression;