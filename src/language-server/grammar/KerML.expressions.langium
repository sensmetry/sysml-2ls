import './KerML.interfaces'

/* TERMINALS */

terminal fragment DECIMAL: /[0-9]+/;
terminal fragment FRACTION: '.' DECIMAL;
terminal fragment FLOAT: DECIMAL FRACTION? | FRACTION;
terminal fragment EXPONENT: /[eE][\-\+]*/ DECIMAL;
terminal NUMBER returns number: FLOAT EXPONENT?;

terminal ID returns string: /[_a-zA-Z][\w_\d]*/;

terminal UNRESTRICTED_NAME returns string: /'(\\['"bftn\\]|[^'\\])*'/;

terminal STRING_VALUE returns string: /"[^"]*"/;

terminal REGULAR_COMMENT: /\/\*[\s\S]*?\*\//;

hidden terminal ML_NOTE: /\/\/\*[\s\S]*?\*\//;

hidden terminal SL_NOTE: /\/\/[^\n\r]*/;

hidden terminal WS: /\s+/;

Name returns string:
    ID | UNRESTRICTED_NAME;

fragment ScopeToken returns string:
    '::';
fragment ChainToken returns string:
    '.';

/* Literal Expressions */

LiteralBoolean returns LiteralBoolean:
    'false' | value?='true';

LiteralString returns LiteralString:
    value=STRING_VALUE;

LiteralNumber returns LiteralNumber:
    value=NUMBER;

LiteralInfinity returns LiteralInfinity:
    {LiteralInfinity} '*';

LiteralExpression returns LiteralExpression:
    LiteralBoolean | LiteralString | LiteralNumber | LiteralInfinity;

// Null Expressions

NullExpression returns NullExpression:
    {NullExpression} ('null' | '(' ')');

fragment ShortName:
    '<' declaredShortName=Name '>';
fragment RegularName:
    declaredName=Name;
fragment Identification:
    ShortName RegularName? | RegularName;

// Tokens

fragment SpecializesToken returns string:
    ':>' | 'specializes';
fragment SubsetsToken returns string:
    ':>' | 'subsets';
fragment ReferencesToken returns string:
    '::>' | 'references';
fragment RedefinesToken returns string:
    ':>>' | 'redefines';

// Enums

FeatureDirectionKind returns string:
    'in' | 'inout' | 'out';
VisibilityKind returns string:
    'private' | 'protected' | 'public';
ImportKind returns string:
    '::*' | '::**' | '::*::**';

// Common fragments

fragment Abstract:
    isAbstract='abstract';
fragment Visibility:
    visibility=VisibilityKind;
VisibleElement returns VisibilityElement:
    Visibility?;
fragment Readonly:
    isReadOnly='readonly';
fragment Derived:
    isDerived='derived';
fragment End:
    isEnd='end';
fragment Sufficient:
    isSufficient?='all';
fragment Standard:
    isStandard?='standard';
fragment ImportAll:
    importsAll?='all';
fragment MultiplicityProperties:
    isOrdered?='ordered' (isNonunique?='nonunique')?
    | isNonunique?='nonunique' (isOrdered?='ordered')?;

fragment ImportedNamespace:
    // the parser is greedy so cannot split at the last scope '::', instead the
    // importedNamespace can be any namespace element need to use Element
    // reference to allow importing aliases
    ( importedNamespace=ElementReference)? (kind=ImportKind)?;

fragment SpecificType:
    specific=TypeReferenceOrFeatureChain;
fragment SpecificFeature:
    specific=FeatureChain;
fragment GeneralType:
    general=TypeReferenceOrFeatureChain;
fragment GeneralFeature:
    general=FeatureChain;

fragment OwnedFeatureTypings:
    typedBy+=TypeReferenceOrFeatureChain (',' typedBy+=TypeReferenceOrFeatureChain)*;
fragment OwnedFeatureTyping:
    typedBy+=TypeReferenceOrFeatureChain;

// Comments and documentation

fragment TextualAnnotatingElementBody:
    body=REGULAR_COMMENT;
TextualAnnotatingElement returns TextualAnnotatingElement:
    TextualAnnotatingElementBody;
DummyTextualAnnotatingElement returns Element:
    TextualAnnotatingElement;
Comment returns Comment:
    ('comment' Identification? ('about' about+=ElementReference ( ',' about+=ElementReference )*)?)?  TextualAnnotatingElementBody;
DummyComment returns TextualAnnotatingElement: // dummy  to force Comment extend TextualAnnotatingElement
    Comment;
Documentation returns Documentation:
    'doc' Identification? TextualAnnotatingElementBody;
DummyDocumentation returns Comment:
    Documentation;

// Textual representation

TextualRepresentation returns TextualRepresentation:
    ( 'rep' Identification? )? 'language' language=STRING_VALUE TextualAnnotatingElementBody;
DummyTextualRepresentation returns TextualAnnotatingElement:
    TextualRepresentation;

// References

fragment QualifiedReferenceChain:
    chain+=[Element:Name] (ScopeToken chain+=[Element:Name])*;
fragment AnyReferenceChain:
    chain+=[Element:Name] (ScopeToken chain+=[Element:Name])* (ChainToken chain+=[Element:Name] (ScopeToken chain+=[Element:Name])*)*;

ElementReference returns ElementReference:
    QualifiedReferenceChain;
TypeReference returns TypeReference:
    QualifiedReferenceChain;
DummyTypeReference returns ElementReference:
    TypeReference;
ClassifierReference returns ClassifierReference:
    QualifiedReferenceChain;
DummyClassifierReference returns TypeReference:
    ClassifierReference;
QualifiedFeatureReference returns FeatureReference:
    chain+=[Element:Name] (ScopeToken chain+=[Element:Name])*;
FeatureChain returns FeatureReference:
    AnyReferenceChain;
DummyFeatureReference returns TypeReference:
    QualifiedFeatureReference;
TypeReferenceOrFeatureChain returns TypeReference:
    TypeReference | FeatureChain;
DummyTypeOrFeatureReference returns TypeReference:
    TypeReferenceOrFeatureChain;
ElementReferenceOrFeatureChain returns ElementReference:
    ElementReference | FeatureChain;
MetaclassReference returns MetaclassReference:
    QualifiedReferenceChain;
DummyMetaclassReference returns TypeReference:
    MetaclassReference;

//! Cannot share expression parsing s since body expressions are parsed
//differently between KerML and SysML

UnaryOperator returns string:
    '+' | '-' | '~' | 'not';
ClassificationTestOperator returns string:
    'istype' | 'hastype' | '@';
RelationalOperator returns string:
    '<' | '>' | '<=' | '>=';
EqualityOperator returns string:
    '==' | '!=' | '===' | '!==';

// Metadata
MetadataPrefix returns MetadataFeature:
    '#' typedBy+=MetaclassReference;
fragment PrefixMetadataMember:
    prefixes+=MetadataPrefix;
fragment PrefixMetadataMembers:
    PrefixMetadataMember (prefixes+=MetadataPrefix)*;
