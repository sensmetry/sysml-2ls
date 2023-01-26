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
    Argument
    | ConditionalExpression
// | FeatureChainExpression
// | FeatureChainMember
    | InvocationExpression
    | LiteralExpression
    | MetadataAccessExpression
    | NullExpression
    | OperatorExpression
    | SelfReferenceExpression
;

type Annotation =
    Comment
    | Documentation
    | MetadataFeature
    | TextualRepresentation
;

type LiteralExpression =
    LiteralBoolean
    | LiteralInfinity
    | LiteralNumber
    | LiteralString
;

type TypeOrFeatureReference = 
    FeatureReference | TypeReference
;

// Common interfaces

interface VisibilityElement {
    visibility?: VisibilityKind;
}

// Annotations

interface TextualAnnotatingElement extends Element {
    body: string;
}

interface Comment extends TextualAnnotatingElement {
    about: ElementReference[];
}
interface Documentation extends Comment {
}

interface TextualRepresentation extends TextualAnnotatingElement {
    language: string;
}

// Elements

interface Element extends VisibilityElement {
    aliases: Alias[];
    elements: Element[];
    imports: Import[];
    members: Feature[];
    relationships: Relationship[];
    comments: Comment[];
    docs: Documentation[];
    metadata: MetadataFeature[];
    reps: TextualRepresentation[];
    name?: string;
    shortName?: string;
}

interface Namespace extends Element {
}

interface Type extends Namespace {
    conjugates: TypeReference[];
    differences: TypeReference[];
    disjoins: TypeReference[];
    intersects: TypeReference[];
    isSufficient: boolean;
    multiplicity?: MultiplicityRange;
    specializes: TypeReference[];
    unions: TypeReference[];
    isAbstract?: 'abstract';
}

interface Classifier extends Type {
// conjugates: ClassifierReference[];
// specializes: ClassifierReference[];
}

interface DataType extends Classifier {
}

interface Class extends Classifier {
}

interface Structure extends Class {
}

interface Behavior extends Class {
}

interface Association extends Classifier {
}

interface AssociationStructure extends Association, Structure {
}

interface Metaclass extends Structure {
}

interface SysMLFunction extends Behavior {
    result?: Result
    return: Feature[];
}

interface Predicate extends SysMLFunction {
}

interface Interaction extends Association, Behavior {
}

interface Feature extends Type {
    chains: FeatureReference[];
    featuredBy: TypeReference[];
    inverseOf: FeatureReference[];
    isNonunique: boolean
    isOrdered: boolean;
    redefines: FeatureReference[];
    references: FeatureReference[];
    subsets: FeatureReference[];
    typedBy: TypeReference[];
    value?: FeatureValue;
    direction?: FeatureDirectionKind
    isComposite?: 'composite'
    isDerived?: 'derived'
    isEnd?: 'end'
    isPortion?: 'portion'
    isReadOnly?: 'readonly'
}

interface MetadataFeature extends Feature {
    about: ElementReference[];
    features: Feature[];
}

interface Multiplicity extends Feature {
}

interface MultiplicityRange extends Multiplicity {
    range: InlineExpression
}

interface ItemFeature extends Feature {
    refSuffix?: TypeReference
    scope?: '.' | '::'
}

interface ConnectorEnd extends Feature {
}

interface ItemFlowEnd extends ConnectorEnd {
}

interface Step extends Feature {
}

interface Connector extends Feature {
    ends: ConnectorEnd[];
}

interface Succession extends Connector {
}

interface BindingConnector extends Connector {
}

interface Expression extends Step {
    result?: Result
    return: Feature[];
}

interface ItemFlow extends Connector, Step {
    of?: ItemFeature
}

interface SuccessionItemFlow extends ItemFlow, Succession {
}

interface BooleanExpression extends Expression {
}

interface Invariant extends BooleanExpression {
    isNegated: boolean
}

interface ElementFilter extends VisibilityElement {
    expression: InlineExpression;
}

interface Import extends Relationship {
    conditions: InlineExpression[];
    importedNamespace?: ElementReference
    importsAll: boolean
    kind?: ImportKind
}

interface Package extends Namespace {
    filters: ElementFilter[];
}

interface LibraryPackage extends Package {
    isStandard: boolean
}

// Relationshipns

interface Alias extends Relationship {
    for: ElementReference
}

interface Relationship extends Element {
    source: ElementReference[];
    target: ElementReference[];
}

interface Specialization extends Relationship {
}

interface Disjoining extends Relationship {
    disjoined: TypeReference
    disjoining: TypeReference
}

interface FeatureInverting extends Relationship {
    featureInverted: FeatureReference
    invertingFeature: FeatureReference
}

interface TypeFeaturing extends Relationship {
    feature: FeatureReference
    featuringType: TypeReference
}

interface FeatureTyping extends Specialization {
    specific: FeatureReference
}

interface Subclassification extends Specialization {
    specific: ClassifierReference
}

interface Subsetting extends Specialization {
    specific: FeatureReference
}

interface Subtype extends Specialization {
    specific: TypeReference
}

interface Conjugation extends Specialization {
    specific: TypeReference
}

interface Redefinition extends Subsetting {
}

// References

interface ElementReference {
    chain: @Element[];
}

interface TypeReference extends ElementReference {
}

interface ClassifierReference extends TypeReference {
}

interface FeatureReference extends TypeReference {
    prefix?: ElementReference | TypeReference;
}

interface MetaclassReference extends TypeReference {
}

// Expressions

interface Argument {
    value: InlineExpression;
}

interface NamedArgument extends Argument {
    name: FeatureReference;
}

interface OperatorExpression extends InvocationExpression {
    operator: string;
}

interface ConditionalExpression extends OperatorExpression {
    condition: InlineExpression;
}

interface CollectExpression extends OperatorExpression {}
interface SelectExpression extends OperatorExpression {}

// interface FeatureChainMember {
//     value: ElementReference;
// }

// interface FeatureChainExpression {
//     left: InlineExpression;
//     right: InlineExpression;
// }

interface FeatureValue {
    expression: InlineExpression;
    isDefault: boolean;
    isInitial: boolean;
}

interface InvocationExpression {
    args: Argument[];
    type: TypeReference;
}

interface LiteralBoolean {
    value: boolean;
}

interface LiteralInfinity {
}

interface LiteralNumber {
    value: number;
}

interface LiteralString {
    value: string;
}

interface NullExpression { 
}

interface MetadataAccessExpression {
    reference: ElementReference;
}

interface Result extends VisibilityElement {
    expression: InlineExpression;
}

interface SelfReferenceExpression {
}
