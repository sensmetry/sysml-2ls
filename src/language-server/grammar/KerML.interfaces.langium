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
// | FeatureChainMember
    | InvocationExpression
    | LiteralExpression
    | MetadataAccessExpression
    | NullExpression
    | OperatorExpression
    | SelfReferenceExpression
    | CollectExpression
    | SelectExpression
    | FeatureReferenceExpression
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
    features: Feature[];
    imports: Import[];
    members: Feature[];
    relationships: Relationship[];
    comments: Comment[];
    docs: Documentation[];
    metadata: MetadataFeature[];
    prefixes: MetadataFeature[]
    reps: TextualRepresentation[];
    declaredName?: string;
    declaredShortName?: string;
}

interface Namespace extends Element {
    filters: ElementFilter[];
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
}

interface Multiplicity extends Feature {
    range?: InlineExpression
}

interface MultiplicityRange extends Multiplicity {
}

interface ItemFeature extends Feature {
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
    variants: Feature[];
}

interface ItemFlow extends Connector, Step {
    of?: ItemFeature;
}

interface SuccessionItemFlow extends ItemFlow, Succession {
}

interface BooleanExpression extends Expression {
}

interface Invariant extends BooleanExpression {
    isNegated: boolean;
}

interface ElementFilter extends VisibilityElement {
    expression: InlineExpression;
}

interface Import extends Relationship {
    conditions: InlineExpression[];
    importedNamespace?: ElementReference;
    importsAll: boolean;
    kind?: ImportKind;
}

interface Package extends Namespace {

}

interface LibraryPackage extends Package {
    isStandard: boolean;
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
    specific: TypeReference;
    general: TypeReference;
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
}

interface Subclassification extends Specialization {
}

interface Subsetting extends Specialization {
}

interface Subtype extends Specialization {
}

interface Conjugation extends Relationship {
    specific: TypeReference;
    general: TypeReference;
}

interface Redefinition extends Subsetting {
}

interface Dependency extends Relationship {
    client: ElementReference[];
    supplier: ElementReference[];
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
}

interface MetaclassReference extends TypeReference {
}

interface ConjugatedPortReference extends ClassifierReference {}

// Expressions

interface Argument {
    value: InlineExpression;
}

interface NamedArgument extends Argument {
    name: FeatureReference;
}

interface OperatorExpression extends InvocationExpression {
    operator?: string;
}

interface CollectExpression extends OperatorExpression {}
interface SelectExpression extends OperatorExpression {}

// interface FeatureChainMember {
//     value: ElementReference;
// }

interface FeatureChainExpression extends OperatorExpression {
}

interface FeatureValue {
    expression: InlineExpression;
    isDefault: boolean;
    isInitial: boolean;
}

interface InvocationExpression {
    args: Argument[] | InlineExpression[] | TypeReference[];
    type?: TypeReference;
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

interface FeatureReferenceExpression {
    expression: InlineExpression;
}