import 'KerML.interfaces'

// Langium only generated `is...` function if the type is a union and not an alias
type TransparentElement = 
    LoopActionUsage |
    LoopActionUsage
;

type RequirementKind = "objective" | "verify";
type ParameterKind = "actor" | "stakeholder";
type RequirementConstraintKind = "assume" | "require";
type PortionKind = 'timeslice' | 'snapshot';
type TriggerKind = 'when' | 'at' | 'after';
type StateSubactionKind = 'entry' | 'do' | 'exit';
type TransitionFeatureKind = 'trigger' | 'guard' | 'effect';

interface Definition extends Classifier {
    isVariation: boolean;
    variants: Feature[];
    isIndividual: boolean;
}

interface Usage extends Feature {
    isVariation: boolean;
    variants: Feature[];
    isReference: boolean;
    portionKind?: PortionKind;
    isIndividual: boolean;
}

interface MetadataDefinition extends Metaclass, ItemDefinition {
}

interface MetadataUsage extends MetadataFeature, ItemUsage {
}

interface ReferenceUsage extends Usage {
    isSubject: boolean;
    trigger?: TriggerInvocationExpression;
}

interface OccurrenceDefinition extends Definition, Class {}

interface OccurrenceUsage extends Usage {}

interface AttributeDefinition extends Definition, DataType {}

interface AttributeUsage extends Usage {}

interface ItemDefinition extends OccurrenceDefinition, Structure {}

interface ItemUsage extends OccurrenceUsage {}

interface PartDefinition extends ItemDefinition {}

interface PartUsage extends ItemUsage {
    parameterKind?: ParameterKind;
}

interface PortDefinition extends OccurrenceDefinition, Structure {}

interface PortUsage extends OccurrenceUsage {}

interface ActionDefinition extends OccurrenceDefinition, Behavior {}

interface ActionUsage extends OccurrenceUsage, Step {
    actionKind?: StateSubactionKind;
    isParallel: boolean;
    parameters: ReferenceUsage[];
    via?: InlineExpression;
    send?: InlineExpression;
    to?: InlineExpression;
}

interface IfActionUsage extends ActionUsage {
    condition: InlineExpression;
    body: ActionUsage;
    else?: ActionUsage;
}

interface StateDefinition extends ActionDefinition {
    subactions: ActionUsage[];
    isParallel: boolean;
}

interface StateUsage extends ActionUsage {
    subactions: ActionUsage[];
}

interface ExhibitStateUsage extends StateUsage, PerformActionUsage {}

interface ConstraintDefinition extends OccurrenceDefinition, Predicate {}

interface ConstraintUsage extends OccurrenceUsage, BooleanExpression {
    constraintKind?: RequirementConstraintKind;
}

interface AssertConstraintUsage extends ConstraintUsage, Invariant {
}

interface TransitionUsage extends ActionUsage {
    source?: FeatureReference;
    trigger?: AcceptActionUsage;
    guard?: InlineExpression;
    effect?: ActionUsage;
    then?: SuccessionAsUsage;
    else?: SuccessionAsUsage;
}

interface AcceptActionUsage extends ActionUsage {}

interface RequirementDefinition extends ConstraintDefinition {}

interface RequirementUsage extends ConstraintUsage {
    requirementKind?: RequirementKind;
}

interface SatisfyRequirementUsage extends RequirementUsage, AssertConstraintUsage {
    by?: FeatureReference;
}

interface ConcernDefinition extends RequirementDefinition {}

interface ConcernUsage extends RequirementUsage {
    isFramed: boolean;
}

interface CalculationDefinition extends ActionDefinition, SysMLFunction {
}

interface CalculationUsage extends ActionUsage, Expression {
}

interface CaseDefinition extends CalculationDefinition {}

interface CaseUsage extends CalculationUsage {}

interface AnalysisCaseDefinition extends CaseDefinition {}

interface AnalysisCaseUsage extends CaseUsage {}

interface ConnectorAsUsage extends Usage, Connector {}

interface BindingConnectorAsUsage extends ConnectorAsUsage, BindingConnector {}

interface ConnectionDefinition extends PartDefinition, AssociationStructure {}

interface ConnectionUsage extends PartUsage, ConnectorAsUsage {}

interface InterfaceDefinition extends ConnectionDefinition {}

interface InterfaceUsage extends ConnectionUsage {}

interface ViewDefinition extends PartDefinition {
}

interface ViewUsage extends PartUsage {
}

interface ViewpointDefinition extends RequirementDefinition {}

interface ViewpointUsage extends RequirementUsage {}

interface RenderingDefinition extends PartDefinition {}

interface RenderingUsage extends PartUsage {}

interface VerificationCaseDefinition extends CaseDefinition {}

interface VerificationCaseUsage extends CaseUsage {}

interface EnumerationDefinition extends AttributeDefinition {
    values: EnumerationUsage[];
}

interface EnumerationUsage extends AttributeUsage {}

interface AllocationDefinition extends ConnectionDefinition {}

interface AllocationUsage extends ConnectionUsage {}

interface UseCaseDefinition extends CaseDefinition {}

interface UseCaseUsage extends CaseUsage {}

interface IncludeUseCaseUsage extends UseCaseUsage, PerformActionUsage {}

interface FlowConnectionDefinition extends ConnectionDefinition, ActionDefinition, Interaction {}

interface FlowConnectionUsage extends ConnectionUsage, ActionUsage, ItemFlow {}

interface SuccessionFlowConnectionUsage extends FlowConnectionUsage, SuccessionItemFlow {}

interface AssignmentActionUsage extends ActionUsage {
    left: InlineExpression;
    right: InlineExpression;
}

interface TriggerInvocationExpression extends InvocationExpression {
    kind: TriggerKind;
    expression: InlineExpression;
}

interface PerformActionUsage extends ActionUsage, EventOccurrenceUsage {}

interface EventOccurrenceUsage extends OccurrenceUsage {}

interface LoopActionUsage extends ActionUsage {
    expression: InlineExpression;
    body: ActionUsage;
}

interface WhileLoopActionUsage extends LoopActionUsage {
    until?: InlineExpression;
}

interface ForLoopActionUsage extends LoopActionUsage {
    for: ReferenceUsage;
}

interface SendActionUsage extends ActionUsage {}

interface ControlNode extends ActionUsage {}

interface ForkNode extends ControlNode {}

interface MergeNode extends ControlNode {}

interface JoinNode extends ControlNode {}

interface DecisionNode extends ControlNode {}

interface SuccessionAsUsage extends ConnectorAsUsage, Succession {
    then: SuccessionAsUsage[];
}

interface Expose extends Import {}