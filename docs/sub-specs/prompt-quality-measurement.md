# Prompt Quality Measurement Framework

This document defines the **statistical validation and quality measurement infrastructure** for @orchestr8 agent prompts, implementing enterprise-grade adherence scoring, A/B testing, and continuous improvement patterns.

> Created: 2025-01-17  
> Version: 1.0.0  
> Status: Quality Measurement Foundation

## Overview

The @orchestr8 prompt quality measurement framework provides comprehensive statistical validation and continuous improvement capabilities for agent prompts, ensuring 95%+ instruction adherence and consistent output quality through measurable, data-driven optimization.

### Core Capabilities

1. **Adherence Scoring** - Statistical measurement of instruction following
2. **Consistency Measurement** - Semantic and structural consistency validation
3. **A/B Testing Framework** - Scientific prompt optimization methodology
4. **Performance Baselines** - Quality targets and threshold management
5. **Continuous Monitoring** - Real-time quality tracking and alerts

## Adherence Scoring System

### Score Calculation Architecture

```typescript
interface PromptAdherenceScore {
  overall_score: number // 0-100 weighted composite
  timestamp: string
  prompt_version: string
  categories: {
    role_compliance: AdherenceCategory
    instruction_following: AdherenceCategory
    format_compliance: AdherenceCategory
    quality_standards: AdherenceCategory
    reasoning_clarity: AdherenceCategory
  }
  violations: ViolationRecord[]
  recommendations: string[]
  confidence_interval: {
    lower: number
    upper: number
    confidence_level: number // e.g., 0.95 for 95%
  }
}

interface AdherenceCategory {
  score: number // 0-100
  weight: number // Contribution to overall score
  violations: number
  sample_size: number
  criteria: CategoryCriteria[]
}

interface CategoryCriteria {
  criterion: string
  required: boolean
  score: number // 0-100
  evidence: string[]
  failure_reason?: string
}
```

### Scoring Methodology

```typescript
export class PromptAdherenceScorer {
  private readonly CATEGORY_WEIGHTS = {
    role_compliance: 0.25, // Did agent stay in defined role?
    instruction_following: 0.3, // Were instructions followed exactly?
    format_compliance: 0.2, // Was output format correct?
    quality_standards: 0.15, // Did output meet quality requirements?
    reasoning_clarity: 0.1, // Was thinking process clear and logical?
  }

  async scoreResponse(
    prompt: AgentPrompt,
    response: AgentResponse,
    context: ScoringContext,
  ): Promise<PromptAdherenceScore> {
    // 1. Extract scoring criteria from prompt
    const criteria = this.extractScoringCriteria(prompt)

    // 2. Evaluate each category
    const categories = await this.evaluateCategories(response, criteria)

    // 3. Calculate weighted overall score
    const overallScore = this.calculateWeightedScore(categories)

    // 4. Generate confidence interval
    const confidenceInterval = this.calculateConfidenceInterval(
      overallScore,
      categories,
    )

    // 5. Identify violations and recommendations
    const violations = this.identifyViolations(categories)
    const recommendations = this.generateRecommendations(violations)

    return {
      overall_score: overallScore,
      timestamp: new Date().toISOString(),
      prompt_version: prompt.version,
      categories,
      violations,
      recommendations,
      confidence_interval: confidenceInterval,
    }
  }

  private async evaluateCategories(
    response: AgentResponse,
    criteria: ScoringCriteria,
  ): Promise<Record<string, AdherenceCategory>> {
    const results: Record<string, AdherenceCategory> = {}

    for (const [categoryName, categoryCriteria] of Object.entries(criteria)) {
      const categoryScore = await this.evaluateCategory(
        response,
        categoryCriteria,
      )

      results[categoryName] = {
        score: categoryScore.score,
        weight: this.CATEGORY_WEIGHTS[categoryName] || 0,
        violations: categoryScore.violations,
        sample_size: 1,
        criteria: categoryScore.details,
      }
    }

    return results
  }

  private calculateWeightedScore(
    categories: Record<string, AdherenceCategory>,
  ): number {
    let weightedSum = 0
    let totalWeight = 0

    for (const [categoryName, category] of Object.entries(categories)) {
      const weight = this.CATEGORY_WEIGHTS[categoryName] || 0
      weightedSum += category.score * weight
      totalWeight += weight
    }

    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0
  }

  private calculateConfidenceInterval(
    score: number,
    categories: Record<string, AdherenceCategory>,
  ): { lower: number; upper: number; confidence_level: number } {
    // Simplified confidence interval calculation
    // In production, use more sophisticated statistical methods
    const sampleSize = Object.values(categories).reduce(
      (sum, cat) => sum + cat.sample_size,
      0,
    )

    const standardError = Math.sqrt((score * (100 - score)) / sampleSize)
    const margin = 1.96 * standardError // 95% confidence interval

    return {
      lower: Math.max(0, Math.round(score - margin)),
      upper: Math.min(100, Math.round(score + margin)),
      confidence_level: 0.95,
    }
  }
}
```

### Role Compliance Evaluation

```typescript
export class RoleComplianceEvaluator {
  async evaluateRoleCompliance(
    response: AgentResponse,
    roleDefinition: RoleDefinition,
  ): Promise<CategoryScore> {
    const criteria = [
      {
        criterion: 'stayed_in_character',
        required: true,
        evaluator: this.evaluateCharacterConsistency,
      },
      {
        criterion: 'used_defined_capabilities',
        required: true,
        evaluator: this.evaluateCapabilityUsage,
      },
      {
        criterion: 'respected_constraints',
        required: true,
        evaluator: this.evaluateConstraintCompliance,
      },
      {
        criterion: 'maintained_expertise_level',
        required: false,
        evaluator: this.evaluateExpertiseLevel,
      },
    ]

    const results = await Promise.all(
      criteria.map(async (criterion) => {
        const score = await criterion.evaluator(response, roleDefinition)
        return {
          criterion: criterion.criterion,
          required: criterion.required,
          score,
          evidence: this.extractEvidence(response, criterion.criterion),
          failure_reason:
            score < 70 ? this.generateFailureReason(criterion) : undefined,
        }
      }),
    )

    const overallScore = this.aggregateScores(results)
    const violations = results.filter((r) => r.required && r.score < 70).length

    return {
      score: overallScore,
      violations,
      details: results,
    }
  }

  private async evaluateCharacterConsistency(
    response: AgentResponse,
    roleDefinition: RoleDefinition,
  ): Promise<number> {
    // Check if response maintains agent identity and persona
    const identity = roleDefinition.identity
    const responseText = response.content

    // Look for identity markers and consistency
    const identityMarkers = this.extractIdentityMarkers(identity)
    const consistencyScore = this.calculateConsistencyScore(
      responseText,
      identityMarkers,
    )

    return consistencyScore
  }

  private async evaluateCapabilityUsage(
    response: AgentResponse,
    roleDefinition: RoleDefinition,
  ): Promise<number> {
    // Verify only defined capabilities were used
    const definedCapabilities = roleDefinition.capabilities.primary
    const usedCapabilities = this.extractUsedCapabilities(response)

    const authorizedUsage = usedCapabilities.filter((capability) =>
      definedCapabilities.some((defined) =>
        this.isCapabilityMatch(capability, defined),
      ),
    )

    return usedCapabilities.length > 0
      ? (authorizedUsage.length / usedCapabilities.length) * 100
      : 100 // No capabilities used = perfect compliance
  }

  private async evaluateConstraintCompliance(
    response: AgentResponse,
    roleDefinition: RoleDefinition,
  ): Promise<number> {
    // Check for constraint violations
    const constraints = roleDefinition.capabilities.constraints
    const violations = []

    for (const constraint of constraints) {
      const violated = await this.checkConstraintViolation(response, constraint)
      if (violated) {
        violations.push(constraint)
      }
    }

    return constraints.length > 0
      ? ((constraints.length - violations.length) / constraints.length) * 100
      : 100
  }
}
```

## Consistency Measurement

### Semantic Consistency

```typescript
export class ConsistencyMeasurement {
  async measureConsistency(
    responses: AgentResponse[],
    prompt: AgentPrompt,
  ): Promise<ConsistencyMetrics> {
    if (responses.length < 2) {
      throw new Error('Need at least 2 responses to measure consistency')
    }

    const semanticSimilarity = await this.measureSemanticSimilarity(responses)
    const formatConsistency = this.measureFormatConsistency(responses)
    const terminologyConsistency = this.measureTerminologyConsistency(responses)
    const qualityVariance = this.measureQualityVariance(responses)
    const reasoningCoherence = await this.measureReasoningCoherence(responses)

    return {
      similarity_score: semanticSimilarity,
      format_consistency: formatConsistency,
      terminology_consistency: terminologyConsistency,
      quality_variance: qualityVariance,
      reasoning_coherence: reasoningCoherence,
      sample_size: responses.length,
      measurement_timestamp: new Date().toISOString(),
    }
  }

  private async measureSemanticSimilarity(
    responses: AgentResponse[],
  ): Promise<number> {
    const similarities: number[] = []

    // Compare all pairs of responses
    for (let i = 0; i < responses.length - 1; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        const similarity = await this.calculateSemanticSimilarity(
          responses[i].content,
          responses[j].content,
        )
        similarities.push(similarity)
      }
    }

    return similarities.length > 0
      ? similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length
      : 1.0
  }

  private async calculateSemanticSimilarity(
    text1: string,
    text2: string,
  ): Promise<number> {
    // Simplified semantic similarity calculation
    // In production, use embeddings or more sophisticated NLP

    // 1. Normalize texts
    const normalized1 = this.normalizeText(text1)
    const normalized2 = this.normalizeText(text2)

    // 2. Extract key concepts
    const concepts1 = this.extractKeyConcepts(normalized1)
    const concepts2 = this.extractKeyConcepts(normalized2)

    // 3. Calculate Jaccard similarity
    const intersection = concepts1.filter((c) => concepts2.includes(c))
    const union = [...new Set([...concepts1, ...concepts2])]

    return union.length > 0 ? intersection.length / union.length : 0
  }

  private measureFormatConsistency(responses: AgentResponse[]): number {
    // Check structural consistency
    const structures = responses.map((r) => this.extractStructure(r.content))
    const referenceStructure = structures[0]

    const consistentStructures = structures.filter((s) =>
      this.isStructureMatch(s, referenceStructure),
    )

    return consistentStructures.length / structures.length
  }

  private measureTerminologyConsistency(responses: AgentResponse[]): number {
    // Extract terminology from each response
    const terminologies = responses.map((r) =>
      this.extractTerminology(r.content),
    )

    // Find common terminology baseline
    const allTerms = terminologies.flat()
    const termFrequency = this.calculateTermFrequency(allTerms)

    // Measure consistency of key terms usage
    const keyTerms = Object.keys(termFrequency)
      .filter((term) => termFrequency[term] >= responses.length * 0.5)
      .slice(0, 20) // Top 20 key terms

    let consistencySum = 0
    for (const term of keyTerms) {
      const usageConsistency = this.measureTermUsageConsistency(
        term,
        terminologies,
      )
      consistencySum += usageConsistency
    }

    return keyTerms.length > 0 ? consistencySum / keyTerms.length : 1.0
  }
}
```

## A/B Testing Framework

### Experiment Design

```typescript
export interface PromptExperiment {
  id: string
  name: string
  description: string
  status: 'draft' | 'running' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string

  // Experimental design
  variants: PromptVariant[]
  traffic_allocation: TrafficAllocation
  success_metrics: SuccessMetric[]

  // Statistical configuration
  statistical_config: StatisticalConfig

  // Results
  results?: ExperimentResults
}

export interface PromptVariant {
  id: string
  name: string
  description: string
  prompt_template: AgentPrompt
  allocation_percentage: number // 0-100
}

export interface StatisticalConfig {
  significance_level: number // e.g., 0.05 for 95% confidence
  minimum_sample_size: number
  maximum_duration_days: number
  early_stopping_enabled: boolean
  power: number // Statistical power, e.g., 0.80
}

export interface SuccessMetric {
  name: string
  type:
    | 'adherence_score'
    | 'consistency_score'
    | 'user_satisfaction'
    | 'response_time'
    | 'custom'
  target_value?: number
  improvement_direction: 'increase' | 'decrease'
  weight: number // For composite scoring
}
```

### Experiment Execution

```typescript
export class PromptExperimentRunner {
  private readonly MIN_SAMPLE_SIZE = 100
  private readonly MAX_EXPERIMENT_DURATION = 30 // days

  async runExperiment(experiment: PromptExperiment): Promise<void> {
    // 1. Validate experiment configuration
    this.validateExperiment(experiment)

    // 2. Initialize data collection
    await this.initializeDataCollection(experiment)

    // 3. Start traffic allocation
    await this.startTrafficAllocation(experiment)

    // 4. Monitor experiment progress
    await this.monitorExperiment(experiment)
  }

  private async allocateTraffic(
    experiment: PromptExperiment,
    executionContext: ExecutionContext,
  ): Promise<PromptVariant> {
    // Consistent allocation based on execution context
    const allocationKey = this.generateAllocationKey(executionContext)
    const hash = this.hashAllocationKey(allocationKey)
    const percentage = hash % 100

    let cumulativePercentage = 0
    for (const variant of experiment.variants) {
      cumulativePercentage += variant.allocation_percentage
      if (percentage < cumulativePercentage) {
        return variant
      }
    }

    // Fallback to control variant
    return experiment.variants[0]
  }

  private generateAllocationKey(context: ExecutionContext): string {
    // Create stable key for consistent allocation
    return `${context.workflow.id}:${context.execution.id}:${context.step.id}`
  }

  private hashAllocationKey(key: string): number {
    // Simple hash function for traffic allocation
    let hash = 0
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  async collectExperimentData(
    experiment: PromptExperiment,
    variant: PromptVariant,
    execution: AgentExecution,
  ): Promise<void> {
    const dataPoint: ExperimentDataPoint = {
      experiment_id: experiment.id,
      variant_id: variant.id,
      execution_id: execution.id,
      timestamp: new Date().toISOString(),

      // Metrics collection
      adherence_score: execution.quality_metrics?.adherence_score,
      consistency_score: execution.quality_metrics?.consistency_score,
      response_time: execution.performance_metrics?.total_duration,

      // Context information
      agent_type: execution.agent.name,
      input_complexity: this.assessInputComplexity(execution.input),

      // Additional metrics
      custom_metrics: await this.collectCustomMetrics(execution),
    }

    await this.storeDataPoint(dataPoint)
  }
}
```

### Statistical Analysis

```typescript
export class ExperimentAnalyzer {
  async analyzeExperiment(
    experiment: PromptExperiment,
  ): Promise<ExperimentResults> {
    const data = await this.loadExperimentData(experiment.id)

    // 1. Calculate descriptive statistics for each variant
    const variantStats = await this.calculateVariantStatistics(data)

    // 2. Perform statistical tests
    const statisticalTests = await this.performStatisticalTests(
      data,
      experiment.success_metrics,
    )

    // 3. Calculate confidence intervals
    const confidenceIntervals = this.calculateConfidenceIntervals(variantStats)

    // 4. Determine statistical significance
    const significance = this.determineSignificance(
      statisticalTests,
      experiment.statistical_config.significance_level,
    )

    // 5. Generate recommendations
    const recommendations = this.generateRecommendations(
      variantStats,
      significance,
      experiment.success_metrics,
    )

    return {
      experiment_id: experiment.id,
      analysis_timestamp: new Date().toISOString(),
      sample_sizes: this.calculateSampleSizes(data),
      variant_statistics: variantStats,
      statistical_tests: statisticalTests,
      confidence_intervals: confidenceIntervals,
      significance_results: significance,
      recommendations,
      is_conclusive: this.isConclusiveResult(significance, variantStats),
    }
  }

  private async performStatisticalTests(
    data: ExperimentDataPoint[],
    metrics: SuccessMetric[],
  ): Promise<StatisticalTestResult[]> {
    const results: StatisticalTestResult[] = []

    for (const metric of metrics) {
      const metricData = this.extractMetricData(data, metric.name)
      const variants = this.groupByVariant(metricData)

      if (variants.length === 2) {
        // Two-sample t-test for A/B comparison
        const result = await this.performTTest(variants[0], variants[1])
        results.push({
          metric_name: metric.name,
          test_type: 't-test',
          p_value: result.p_value,
          test_statistic: result.statistic,
          effect_size: result.effect_size,
          is_significant: result.p_value < 0.05,
        })
      } else if (variants.length > 2) {
        // ANOVA for multiple variant comparison
        const result = await this.performANOVA(variants)
        results.push({
          metric_name: metric.name,
          test_type: 'ANOVA',
          p_value: result.p_value,
          test_statistic: result.f_statistic,
          is_significant: result.p_value < 0.05,
        })
      }
    }

    return results
  }

  private generateRecommendations(
    variantStats: VariantStatistics[],
    significance: SignificanceResult[],
    metrics: SuccessMetric[],
  ): ExperimentRecommendation[] {
    const recommendations: ExperimentRecommendation[] = []

    // Find best performing variant for each metric
    for (const metric of metrics) {
      const metricSignificance = significance.find(
        (s) => s.metric_name === metric.name,
      )

      if (metricSignificance?.is_significant) {
        const bestVariant = this.findBestVariant(variantStats, metric)

        recommendations.push({
          type: 'variant_selection',
          metric_name: metric.name,
          recommended_variant: bestVariant.variant_id,
          confidence_level: metricSignificance.confidence_level,
          expected_improvement: this.calculateExpectedImprovement(
            variantStats,
            bestVariant,
            metric,
          ),
          rationale: this.generateRationale(
            bestVariant,
            metric,
            metricSignificance,
          ),
        })
      } else {
        recommendations.push({
          type: 'continue_experiment',
          metric_name: metric.name,
          rationale:
            'No statistically significant difference detected. Consider extending experiment duration or increasing sample size.',
        })
      }
    }

    return recommendations
  }
}
```

## Performance Baselines

### Quality Targets

```typescript
export interface PromptPerformanceBaselines {
  version: string
  created_at: string

  // Adherence targets
  adherence_targets: {
    minimum_acceptable: number // 85 - Below this triggers review
    target_performance: number // 95 - Standard goal
    excellence_threshold: number // 98 - Outstanding performance
  }

  // Consistency targets
  consistency_targets: {
    semantic_similarity: number // 0.90 - 90% semantic consistency
    format_consistency: number // 0.98 - 98% format consistency
    terminology_consistency: number // 0.95 - 95% term consistency
  }

  // Quality indicators
  quality_indicators: {
    user_satisfaction: number // 0.85 - 85% positive feedback
    error_rate: number // 0.05 - 5% maximum error rate
    retry_rate: number // 0.10 - 10% maximum retry rate
  }

  // Performance benchmarks
  performance_benchmarks: {
    response_time_p95: number // 2000ms - 95th percentile response time
    reasoning_depth_score: number // 0.80 - Quality of reasoning process
    context_utilization: number // 0.90 - How well context is used
  }
}

export const DEFAULT_BASELINES: PromptPerformanceBaselines = {
  version: '1.0.0',
  created_at: '2025-01-17T00:00:00Z',

  adherence_targets: {
    minimum_acceptable: 85,
    target_performance: 95,
    excellence_threshold: 98,
  },

  consistency_targets: {
    semantic_similarity: 0.9,
    format_consistency: 0.98,
    terminology_consistency: 0.95,
  },

  quality_indicators: {
    user_satisfaction: 0.85,
    error_rate: 0.05,
    retry_rate: 0.1,
  },

  performance_benchmarks: {
    response_time_p95: 2000,
    reasoning_depth_score: 0.8,
    context_utilization: 0.9,
  },
}
```

### Baseline Monitoring

```typescript
export class BaselineMonitor {
  private readonly CHECK_INTERVAL = 300000 // 5 minutes
  private readonly ALERT_THRESHOLDS = {
    consecutive_failures: 3,
    trend_degradation: 0.1, // 10% degradation triggers alert
    sample_size_minimum: 50,
  }

  async startMonitoring(): Promise<void> {
    setInterval(async () => {
      await this.performBaselineCheck()
    }, this.CHECK_INTERVAL)
  }

  private async performBaselineCheck(): Promise<void> {
    const currentPeriod = this.getCurrentPeriod()
    const metrics = await this.collectPeriodMetrics(currentPeriod)

    // Check against baselines
    const violations = this.checkBaselineViolations(metrics)

    if (violations.length > 0) {
      await this.handleBaselineViolations(violations)
    }

    // Check for trends
    const trends = await this.analyzeTrends(metrics)
    const degradationTrends = trends.filter((t) => t.is_degrading)

    if (degradationTrends.length > 0) {
      await this.handleTrendDegradation(degradationTrends)
    }

    // Store metrics for historical analysis
    await this.storeMetrics(metrics)
  }

  private checkBaselineViolations(metrics: PeriodMetrics): BaselineViolation[] {
    const violations: BaselineViolation[] = []
    const baselines = DEFAULT_BASELINES

    // Check adherence targets
    if (
      metrics.average_adherence_score <
      baselines.adherence_targets.minimum_acceptable
    ) {
      violations.push({
        type: 'adherence_below_minimum',
        metric_name: 'adherence_score',
        current_value: metrics.average_adherence_score,
        threshold: baselines.adherence_targets.minimum_acceptable,
        severity: 'high',
        sample_size: metrics.sample_size,
      })
    }

    // Check consistency targets
    if (
      metrics.semantic_consistency <
      baselines.consistency_targets.semantic_similarity
    ) {
      violations.push({
        type: 'consistency_below_target',
        metric_name: 'semantic_consistency',
        current_value: metrics.semantic_consistency,
        threshold: baselines.consistency_targets.semantic_similarity,
        severity: 'medium',
        sample_size: metrics.sample_size,
      })
    }

    // Check error rates
    if (metrics.error_rate > baselines.quality_indicators.error_rate) {
      violations.push({
        type: 'error_rate_exceeded',
        metric_name: 'error_rate',
        current_value: metrics.error_rate,
        threshold: baselines.quality_indicators.error_rate,
        severity: 'high',
        sample_size: metrics.sample_size,
      })
    }

    return violations
  }

  private async handleBaselineViolations(
    violations: BaselineViolation[],
  ): Promise<void> {
    for (const violation of violations) {
      // Log violation
      console.warn(`Baseline violation detected: ${violation.type}`, violation)

      // Send alert based on severity
      if (violation.severity === 'high') {
        await this.sendHighSeverityAlert(violation)
      }

      // Trigger automatic investigation
      await this.triggerInvestigation(violation)
    }
  }

  private async analyzeTrends(
    metrics: PeriodMetrics,
  ): Promise<TrendAnalysis[]> {
    const historicalData = await this.getHistoricalMetrics(7) // Last 7 periods
    const trends: TrendAnalysis[] = []

    // Analyze adherence score trend
    const adherenceTrend = this.calculateTrend(
      historicalData.map((d) => d.average_adherence_score),
    )

    trends.push({
      metric_name: 'adherence_score',
      trend_direction: adherenceTrend.direction,
      slope: adherenceTrend.slope,
      r_squared: adherenceTrend.r_squared,
      is_degrading:
        adherenceTrend.direction === 'decreasing' &&
        adherenceTrend.slope < -this.ALERT_THRESHOLDS.trend_degradation,
    })

    // Analyze consistency trends
    const consistencyTrend = this.calculateTrend(
      historicalData.map((d) => d.semantic_consistency),
    )

    trends.push({
      metric_name: 'semantic_consistency',
      trend_direction: consistencyTrend.direction,
      slope: consistencyTrend.slope,
      r_squared: consistencyTrend.r_squared,
      is_degrading:
        consistencyTrend.direction === 'decreasing' &&
        consistencyTrend.slope < -this.ALERT_THRESHOLDS.trend_degradation,
    })

    return trends
  }
}
```

## Continuous Monitoring

### Real-Time Quality Tracking

```typescript
export class QualityMonitoringService {
  private readonly metricsQueue: QualityMetric[] = []
  private readonly BATCH_SIZE = 50
  private readonly FLUSH_INTERVAL = 30000 // 30 seconds

  constructor(
    private scorer: PromptAdherenceScorer,
    private consistencyMeasurer: ConsistencyMeasurement,
    private baselineMonitor: BaselineMonitor,
  ) {
    this.startBatchProcessor()
  }

  async trackExecution(
    execution: AgentExecution,
    prompt: AgentPrompt,
  ): Promise<void> {
    // Score this execution
    const adherenceScore = await this.scorer.scoreResponse(
      prompt,
      execution.response,
      execution.context,
    )

    // Add to metrics queue
    const metric: QualityMetric = {
      execution_id: execution.id,
      timestamp: new Date().toISOString(),
      prompt_version: prompt.version,
      agent_type: execution.agent.name,
      adherence_score: adherenceScore.overall_score,
      response_time: execution.performance_metrics?.total_duration || 0,
      error_count: execution.errors?.length || 0,
      retry_count: execution.retry_count || 0,
    }

    this.metricsQueue.push(metric)

    // Real-time alerting for critical issues
    if (adherenceScore.overall_score < 70) {
      await this.sendCriticalQualityAlert(execution, adherenceScore)
    }
  }

  private startBatchProcessor(): void {
    setInterval(async () => {
      if (this.metricsQueue.length >= this.BATCH_SIZE) {
        await this.flushMetricsBatch()
      }
    }, this.FLUSH_INTERVAL)
  }

  private async flushMetricsBatch(): Promise<void> {
    if (this.metricsQueue.length === 0) return

    const batch = this.metricsQueue.splice(0, this.BATCH_SIZE)

    try {
      // Store metrics in database
      await this.storeMetricsBatch(batch)

      // Update real-time dashboard
      await this.updateDashboard(batch)

      // Check for immediate threshold violations
      await this.checkImmediateViolations(batch)
    } catch (error) {
      console.error('Failed to process metrics batch:', error)
      // Re-queue failed metrics
      this.metricsQueue.unshift(...batch)
    }
  }

  private async checkImmediateViolations(
    batch: QualityMetric[],
  ): Promise<void> {
    const recentMetrics = batch.filter(
      (m) => Date.now() - new Date(m.timestamp).getTime() < 300000, // Last 5 minutes
    )

    if (recentMetrics.length < 10) return // Need sufficient sample

    const avgAdherence =
      recentMetrics.reduce((sum, m) => sum + m.adherence_score, 0) /
      recentMetrics.length

    const errorRate =
      recentMetrics.filter((m) => m.error_count > 0).length /
      recentMetrics.length

    // Check for immediate violations
    if (avgAdherence < 80) {
      await this.sendQualityDegradationAlert({
        type: 'adherence_degradation',
        current_value: avgAdherence,
        sample_size: recentMetrics.length,
        time_window: '5_minutes',
      })
    }

    if (errorRate > 0.2) {
      await this.sendQualityDegradationAlert({
        type: 'error_rate_spike',
        current_value: errorRate,
        sample_size: recentMetrics.length,
        time_window: '5_minutes',
      })
    }
  }
}
```

## Integration with Agent System

### Quality-Aware Agent Execution

```typescript
export class QualityAwareAgentExecutor {
  constructor(
    private qualityMonitor: QualityMonitoringService,
    private baselineConfig: PromptPerformanceBaselines,
  ) {}

  async executeWithQualityTracking(
    agent: Agent,
    input: unknown,
    context: ExecutionContext,
  ): Promise<QualityTrackedResult> {
    const startTime = Date.now()

    try {
      // Execute agent
      const result = await agent.execute(input, context)

      // Track quality metrics
      await this.qualityMonitor.trackExecution(
        {
          id: context.execution.id,
          agent: agent,
          response: result.output,
          context: context,
          performance_metrics: {
            total_duration: Date.now() - startTime,
          },
          errors: result.errors,
          retry_count: result.retry_count,
        },
        agent.prompt,
      )

      // Determine if quality meets thresholds
      const qualityMeetsThreshold = await this.assessQualityThreshold(result)

      return {
        ...result,
        quality_metadata: {
          adherence_score: result.quality_metrics?.adherence_score,
          meets_threshold: qualityMeetsThreshold,
          baseline_version: this.baselineConfig.version,
          measurement_timestamp: new Date().toISOString(),
        },
      }
    } catch (error) {
      // Track execution error
      await this.qualityMonitor.trackExecution(
        {
          id: context.execution.id,
          agent: agent,
          response: null,
          context: context,
          performance_metrics: {
            total_duration: Date.now() - startTime,
          },
          errors: [error],
          retry_count: 0,
        },
        agent.prompt,
      )

      throw error
    }
  }

  private async assessQualityThreshold(result: AgentResult): Promise<boolean> {
    if (!result.quality_metrics?.adherence_score) {
      return false // No quality metrics = failed threshold
    }

    const adherenceScore = result.quality_metrics.adherence_score
    const minimumThreshold =
      this.baselineConfig.adherence_targets.minimum_acceptable

    return adherenceScore >= minimumThreshold
  }
}
```

## Conclusion

This prompt quality measurement framework provides:

- ✅ **Statistical adherence scoring** with confidence intervals
- ✅ **Consistency measurement** across multiple dimensions
- ✅ **A/B testing infrastructure** for scientific prompt optimization
- ✅ **Performance baselines** with automated monitoring
- ✅ **Real-time quality tracking** with immediate alerting
- ✅ **Continuous improvement** through data-driven insights

The framework transforms prompt engineering from an art into a **measurable, scientific discipline** with statistical validation and continuous optimization capabilities that achieve enterprise-grade reliability and performance.
