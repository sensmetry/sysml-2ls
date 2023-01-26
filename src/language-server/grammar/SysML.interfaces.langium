import 'KerML.interfaces'

// Langium only generated `is...` function if the type is a union and not an alias
type TransparentElement = 
    LoopActionUsage |
    LoopActionUsage
;

interface Definition extends Classifier {
}

interface Usage extends Feature {
}

interface MetadataDefinition extends Metaclass, ItemDefinition {
}

interface MetadataUsage extends MetadataFeature, ItemUsage {
}

interface ReferenceUsage extends Usage {
}

interface OccurrenceDefinition extends Definition, Class {}

interface OccurrenceUsage extends Usage {}

interface AttributeDefinition extends Definition, DataType {}

interface AttributeUsage extends Usage {}

interface ItemDefinition extends OccurrenceDefinition, Structure {}

interface ItemUsage extends OccurrenceUsage {}

interface PartDefinition extends ItemDefinition {}

interface PartUsage extends ItemUsage {}

interface PortDefinition extends OccurrenceDefinition, Structure {}

interface PortUsage extends OccurrenceUsage {}

interface ConjugatedPortReference extends FeatureReference {}

interface ActionDefinition extends OccurrenceDefinition, Behavior {}

interface ActionUsage extends OccurrenceUsage, Step {}

interface IfActionUsage extends ActionUsage {}

interface StateDefinition extends ActionDefinition {}

interface StateUsage extends ActionUsage {}

interface ExhibitStateUsage extends StateUsage, PerformActionUsage {}

interface ConstraintDefinition extends OccurrenceDefinition, Predicate {}

interface ConstraintUsage extends OccurrenceUsage, BooleanExpression {}

interface AssertConstraintUsage extends ConstraintUsage, Invariant {}

interface TransitionUsage extends ActionUsage {}

interface AcceptActionUsage extends ActionUsage {}

interface RequirementDefinition extends ConstraintDefinition {}

interface RequirementUsage extends ConstraintUsage {}

interface SatisfyRequirementUsage extends RequirementUsage, AssertConstraintUsage {}

interface ConcernDefinition extends RequirementDefinition {}

interface ConcernUsage extends RequirementUsage {}

interface CalculationDefinition extends ActionDefinition, SysMLFunction {}

interface CalculationUsage extends ActionUsage, Expression {}

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

interface ViewDefinition extends PartDefinition {}

interface ViewUsage extends PartUsage {}

interface ViewpointDefinition extends RequirementDefinition {}

interface ViewpointUsage extends RequirementUsage {}

interface RenderingDefinition extends PartDefinition {}

interface RenderingUsage extends PartUsage {}

interface VerificationCaseDefinition extends CaseDefinition {}

interface VerificationCaseUsage extends CaseUsage {}

interface EnumerationDefinition extends AttributeDefinition {}

interface EnumerationUsage extends AttributeUsage {}

interface AllocationDefinition extends ConnectionDefinition {}

interface AllocationUsage extends ConnectionUsage {}

interface UseCaseDefinition extends CaseDefinition {}

interface UseCaseUsage extends CaseUsage {}

interface IncludeUseCaseUsage extends UseCaseUsage, PerformActionUsage {}

interface FlowConnectionDefinition extends ConnectionDefinition, ActionDefinition, Interaction {}

interface FlowConnectionUsage extends ConnectionUsage, ActionUsage, ItemFlow {}

interface SuccessionFlowConnectionUsage extends FlowConnectionUsage, SuccessionItemFlow {}

interface AssignmentActionUsage extends ActionUsage {}

// interface TriggerInvocationExpression extends InvocationExpression {}

interface PerformActionUsage extends ActionUsage, EventOccurrenceUsage {}

interface EventOccurrenceUsage extends OccurrenceUsage {}

interface LoopActionUsage extends ActionUsage {}

interface WhileLoopActionUsage extends LoopActionUsage {}

interface ForLoopActionUsage extends LoopActionUsage {}

interface SendActionUsage extends ActionUsage {}

interface ControlNode extends ActionUsage {}

interface ForkNode extends ControlNode {}

interface MergeNode extends ControlNode {}

interface JoinNode extends ControlNode {}

interface DecisionNode extends ControlNode {}

interface Dependency extends Relationship {}

interface SuccessionAsUsage extends ConnectorAsUsage, Succession {}

interface Expose extends Import {}