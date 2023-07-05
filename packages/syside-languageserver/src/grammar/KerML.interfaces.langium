// Enums

type VisibilityKind = 'private' | 'protected' | 'public';
type FeatureDirectionKind = 'in' | 'inout' | 'out';
type UnaryOperator = '+' | '-' | 'not' | '~';
type ClassificationTestOperator = '@' | 'hastype' | 'istype';
type EqualityOperator = '!=' | '!==' | '==' | '===';
type ImportKind = '::*' | '::**' | '::*::**';
type RelationalOperator = '<' | '<=' | '>' | '>=';

// Unions

type InlineExpression =
    FeatureChainExpression
    | InvocationExpression
    | LiteralExpression
    | MetadataAccessExpression
    | NullExpression
    | OperatorExpression
    | CollectExpression
    | SelectExpression
    | FeatureReferenceExpression
;

type NonOwnerType = 
    Membership
    | Annotation
;

// Annotations

interface Annotation extends Relationship {}

interface AnnotatingElement extends Element {
    about: Annotation[];
}

interface TextualAnnotatingElement extends AnnotatingElement {
    body: string;
}

interface Comment extends TextualAnnotatingElement {}
interface Documentation extends Comment {}

interface TextualRepresentation extends TextualAnnotatingElement {
    language: string;
}

// Elements

interface Element {
    declaredName?: string;
    declaredShortName?: string;
}

interface Namespace extends Element {
    prefixes: OwningMembership[];
    children: (Import | Membership)[];
}

type TypeRelationship =
    Unioning
    | Differencing
    | Disjoining
    | Intersecting
;

type FeatureRelationship =
    TypeRelationship
    | FeatureChaining
    | FeatureInverting
    | TypeFeaturing
;

interface Type extends Namespace {
    isSufficient: boolean;
    isAbstract?: 'abstract';
    heritage: Inheritance[];
    typeRelationships: (TypeRelationship | FeatureRelationship)[];
    multiplicity?: OwningMembership;
}

interface Classifier extends Type {}
interface DataType extends Classifier {}
interface Class extends Classifier {}
interface Structure extends Class {}
interface Behavior extends Class {}
interface Association extends Classifier, Relationship {}
interface AssociationStructure extends Association, Structure {}
interface Metaclass extends Structure {}

interface SysMLFunction extends Behavior {
    result?: ResultExpressionMembership;
}

interface Predicate extends SysMLFunction {}
interface Interaction extends Association, Behavior {}

interface Feature extends Type {
    isNonunique: boolean;
    isOrdered: boolean;
    direction?: FeatureDirectionKind;
    isComposite?: 'composite';
    isDerived?: 'derived';
    isEnd?: 'end';
    isPortion?: 'portion';
    isReadOnly?: 'readonly';

    value?: FeatureValue;
    write?: Membership;
}

interface MetadataFeature extends Feature, AnnotatingElement {}

interface Multiplicity extends Feature {}

interface MultiplicityRange extends Multiplicity {
    range?: OwningMembership;
}
interface ItemFeature extends Feature {}
interface Step extends Feature {}

interface Connector extends Feature, Relationship {
    ends: EndFeatureMembership[];
}
interface ItemFlowEnd extends Feature {}

interface Succession extends Connector {}
interface BindingConnector extends Connector {}

interface Expression extends Step {
    result?: ResultExpressionMembership;
}

interface ItemFlow extends Connector, Step {
    item?: FeatureMembership;
}
interface SuccessionItemFlow extends ItemFlow, Succession {}
interface BooleanExpression extends Expression {}

interface Invariant extends BooleanExpression {
    isNegated: boolean;
}

interface Package extends Namespace {}

interface LibraryPackage extends Package {
    isStandard: boolean;
}

// Relationships

interface Relationship extends Element {
    visibility?: VisibilityKind;
    elements: (Namespace | Relationship | Feature | Annotation)[];
// edge source
    source?: Element;
    sourceRef?: ElementReference;
    sourceChain?: Feature;

// edge targets
    target?: Element;
    targetRef?: ElementReference;
    targetChain?: Feature;
}

// non-standard relationship type so that conjugation and specialization have
// common base type as both are INHERITING relationships
interface Inheritance extends Relationship {}

interface Unioning extends Relationship {}
interface Differencing extends Relationship {}
interface Intersecting extends Relationship {}
interface FeatureChaining extends Relationship {}
interface Specialization extends Inheritance {}
interface Disjoining extends Relationship {}
interface FeatureInverting extends Relationship {}
interface TypeFeaturing extends Featuring {}
interface FeatureTyping extends Specialization {}
interface Subclassification extends Specialization {}
interface Subsetting extends Specialization {}
interface Subtype extends Specialization {}

interface Conjugation extends Inheritance {}

interface Redefinition extends Subsetting {}
interface ReferenceSubsetting extends Subsetting {}

interface Dependency extends Relationship {
    prefixes: Annotation[];
    client: ElementReference[];
    supplier: ElementReference[];
}

interface Import extends Relationship {
    importsAll: boolean;
    isRecursive: boolean;
    isNamespace?: '::*';
}

interface MembershipImport extends Import {}
interface NamespaceImport extends Import {}

interface Membership extends Relationship {}
interface OwningMembership extends Membership {}
interface FeatureValue extends OwningMembership {
    isDefault: boolean;
    isInitial: boolean;
}
interface ElementFilterMembership extends OwningMembership {}
interface Featuring extends Relationship {}
interface FeatureMembership extends Featuring, OwningMembership {}
interface EndFeatureMembership extends FeatureMembership {}
interface ParameterMembership extends FeatureMembership {}
interface ResultExpressionMembership extends FeatureMembership {}
interface ReturnParameterMembership extends ParameterMembership {}

// References

interface ElementReference {
    parts: @Element[];
}

interface NamespaceReference extends ElementReference {}
interface TypeReference extends NamespaceReference {}
interface ClassifierReference extends TypeReference {}
interface FeatureReference extends TypeReference {}
interface MetaclassReference extends ClassifierReference {}
interface MembershipReference extends ElementReference {}

// Expressions

interface LiteralExpression extends Expression {}
interface LiteralBoolean extends LiteralExpression {
    literal: boolean;
}
interface LiteralString extends LiteralExpression {
    literal: string;
}
interface LiteralNumber extends LiteralExpression {
    literal: number;
}
interface LiteralInfinity extends LiteralExpression {}
interface NullExpression extends Expression {}
interface InvocationExpression extends Expression {}
interface OperatorExpression extends InvocationExpression {
    operator?: string;
    operands: Expression[];
}
interface FeatureChainExpression extends OperatorExpression {}
interface CollectExpression extends OperatorExpression {}
interface SelectExpression extends OperatorExpression {}
interface FeatureReferenceExpression extends Expression {
    expression: Membership;
}
interface MetadataAccessExpression extends Expression {
    reference: ElementReference;
}