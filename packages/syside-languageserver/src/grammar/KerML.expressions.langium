import './KerML.interfaces'

/* TERMINALS */

terminal fragment DECIMAL: /[0-9]+/;
terminal fragment FRACTION: '.' DECIMAL;
terminal fragment FLOAT: DECIMAL FRACTION? | FRACTION;
terminal fragment EXPONENT: /[eE][\-\+]*/ DECIMAL;
terminal NUMBER returns number: FLOAT EXPONENT?;
terminal ID returns string: /[_a-zA-Z][\w_\d]*/;
terminal UNRESTRICTED_NAME returns string: /'(\\['"bftnr\\]|[^'\\])*'/;
terminal STRING_VALUE returns string: /"[^"]*"/;
terminal REGULAR_COMMENT: /\/\*[\s\S]*?\*\//;

hidden terminal ML_NOTE: /\/\/\*[\s\S]*?\*\//;
hidden terminal SL_NOTE: /\/\/[^\n\r]*/;
hidden terminal WS: /\s+/;

Name returns string:
    ID | UNRESTRICTED_NAME
;

/* Literal Expressions */

LiteralBoolean returns LiteralBoolean:
    'false'
    | literal?='true'
;

LiteralString returns LiteralString:
    literal=STRING_VALUE
;

LiteralNumber returns LiteralNumber:
    literal=NUMBER
;

LiteralInfinity returns LiteralInfinity:
    {LiteralInfinity} '*'
;

LiteralExpression returns LiteralExpression:
    LiteralBoolean
    | LiteralString
    | LiteralNumber
    | LiteralInfinity
;

// Null Expressions

NullExpression returns NullExpression:
    {NullExpression} ('null' | '(' ')')
;

fragment ShortName:
    '<' declaredShortName=Name '>'
;

fragment RegularName:
    declaredName=Name
;

fragment Identification:
    ShortName RegularName? | RegularName
;

// Tokens

fragment SpecializesToken returns string:
    ':>' | 'specializes'
;
fragment SubsetsToken returns string:
    ':>' | 'subsets'
;
fragment ReferencesToken returns string:
    '::>' | 'references'
;
fragment RedefinesToken returns string:
    ':>>' | 'redefines'
;

// Enums

FeatureDirectionKind returns string:
    'in' | 'inout' | 'out'
;
VisibilityKind returns string:
    'private' | 'protected' | 'public'
;
ImportKind returns string:
    '::*' | '::**' | '::*::**'
;

// Common fragments

fragment Abstract:
    isAbstract='abstract'
;
fragment Visibility:
    visibility=VisibilityKind
;
fragment Readonly:
    isReadOnly='readonly'
;
fragment Derived:
    isDerived='derived'
;
fragment End:
    isEnd='end'
;
fragment Sufficient:
    isSufficient?='all'
;
fragment Standard:
    isStandard?='standard'
;
fragment ImportAll:
    importsAll?='all'
;
fragment MultiplicityProperties:
    isOrdered?='ordered' (isNonunique?='nonunique')?
    | isNonunique?='nonunique' (isOrdered?='ordered')?
;

/* Annotations */

Annotation returns Annotation:
    targetRef=ElementReference
;

// Comments and documentation

fragment TextualAnnotatingElementBody:
    body=REGULAR_COMMENT
;

Comment returns Comment:
    ('comment' Identification?
        ('about' about+=Annotation ( ',' about+=Annotation )*)?
    )?
    ( 'locale' locale=STRING_VALUE )?
    TextualAnnotatingElementBody
;

Documentation returns Documentation:
    'doc' Identification? 
    ( 'locale' locale=STRING_VALUE )?
    TextualAnnotatingElementBody
;

// Textual representation

TextualRepresentation returns TextualRepresentation:
    ( 'rep' Identification? )? 'language' language=STRING_VALUE TextualAnnotatingElementBody
;

// References

fragment QualifiedReferenceChain:
    parts+=[Element:Name] ('::' parts+=[Element:Name])*;

ElementReference returns ElementReference:
    QualifiedReferenceChain;
NamespaceReference returns NamespaceReference:
    QualifiedReferenceChain;
TypeReference returns TypeReference:
    QualifiedReferenceChain;
ClassifierReference returns ClassifierReference:
    QualifiedReferenceChain;
FeatureReference returns FeatureReference:
    QualifiedReferenceChain;
MetaclassReference returns MetaclassReference:
    QualifiedReferenceChain;
MembershipReference returns MembershipReference:
    QualifiedReferenceChain;

//! Cannot share expression parsing s since body expressions are parsed
//differently between KerML and SysML

UnaryOperator returns string:
    '+' | '-' | '~' | 'not'
;
ClassificationTestOperator returns string:
    'istype' | 'hastype' | '@'
;
RelationalOperator returns string:
    '<' | '>' | '<=' | '>='
;
EqualityOperator returns string:
    '==' | '!=' | '===' | '!=='
;

// Metadata

MetadataTyping returns FeatureTyping:
    targetRef=MetaclassReference
;

// Features

OwnedFeatureTyping returns FeatureTyping:
    FeatureType
;

fragment FeatureType:
    targetRef=TypeReference | targetChain=OwnedFeatureChain
;

// Classification Expressions

MetadataReference returns MetadataAccessExpression:
    reference=ElementReference
;

TypeReferenceMember returns FeatureMembership:
    target=TypeReferenceFeature
;

TypeResultMember returns ReturnParameterMembership:
    target=TypeReferenceFeature
;

TypeReferenceFeature returns Feature:
    heritage+=ReferenceTyping
;

ReferenceTyping returns FeatureTyping:
    targetRef=TypeReference
;

// Doesn't always work in Langium, so just disable them
// SelfReferenceExpression returns FeatureReferenceExpression:
//     expression=SelfReferenceMember
// ;

// SelfReferenceMember returns ReturnParameterMembership:
//     element=EmptyFeature
// ;

// EmptyFeature returns Feature:
//     {Feature}
// ;

// Primary Expressions

FunctionReferenceExpression returns FeatureReferenceExpression:
    expression=FunctionReferenceMember
;

FunctionReferenceMember returns FeatureMembership:
    target=FunctionReference
;

FunctionReference returns Expression:
    heritage+=ReferenceTyping
;

FeatureChainMember returns Membership:
    targetRef=FeatureReference | {OwningMembership} target=OwnedFeatureChain
;

// Invocation Expressions

OwnedFeatureChain returns Feature:
    FeatureChain
;

fragment FeatureChain:
    typeRelationships+=OwnedFeatureChaining ( '.' typeRelationships+=OwnedFeatureChaining )+
;

FeatureChainPrefix returns Feature:
    ( typeRelationships+=OwnedFeatureChaining '.' )+ typeRelationships+=OwnedFeatureChaining '.'
;

OwnedFeatureChaining returns FeatureChaining:
    targetRef=FeatureReference
;

// Feature Reference Expressions

FeatureReferenceExpression returns FeatureReferenceExpression:
    expression=FeatureReferenceMember
;

FeatureReferenceMember returns Membership:
    targetRef=FeatureReference
;

// Metadata Access Expressions

MetadataAccessExpression returns MetadataAccessExpression:
    reference=ElementReference '.' 'metadata'
;
