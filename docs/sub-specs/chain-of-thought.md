# Chain of Thought Specification

This document defines the official Anthropic Chain of Thought (CoT) implementation patterns for @orchestr8 agents, based on Claude's production documentation.

> Created: 2025-01-18  
> Version: 1.0.0  
> Status: Official Anthropic Pattern

## Overview

Chain of Thought prompting improves Claude's reasoning by explicitly structuring the thinking process. This specification provides the exact patterns from Anthropic's official documentation, replacing any incorrect XML patterns.

## Official Anthropic Patterns

### Pattern 1: Basic Chain of Thought

The simplest approach - just ask Claude to think:

```text
Draft personalized emails to donors asking for contributions to this year's Care for Kids program.

Program information: <program>{{PROGRAM_DETAILS}}</program>
Donor information: <donor>{{DONOR_DETAILS}}</donor>

Think step-by-step before writing the email.
```

### Pattern 2: Guided Chain of Thought

Provide specific steps for Claude to follow:

```text
Draft personalized emails to donors asking for contributions to this year's Care for Kids program.

Program information: <program>{{PROGRAM_DETAILS}}</program>
Donor information: <donor>{{DONOR_DETAILS}}</donor>

Think before you write the email. First, think through what messaging might appeal to this donor given their donation history and which campaigns they've supported in the past. Then, think through what aspects of the Care for Kids program would appeal to them, given their history. Finally, write the personalized donor email using your analysis.
```

### Pattern 3: Structured XML Tags (RECOMMENDED)

**This is Anthropic's preferred pattern** - using `<thinking>` tags to separate reasoning from output:

```text
Draft personalized emails to donors asking for contributions to this year's Care for Kids program.

Program information: <program>{{PROGRAM_DETAILS}}</program>
Donor information: <donor>{{DONOR_DETAILS}}</donor>

Think before you write the email in <thinking> tags. First, think through what messaging might appeal to this donor given their donation history and which campaigns they've supported in the past. Then, think through what aspects of the Care for Kids program would appeal to them, given their history. Finally, write the personalized donor email in <email> tags, using your analysis.
```

## Implementation for @orchestr8 Agents

### Agent Prompt Template with Chain of Thought

```typescript
interface ChainOfThoughtPrompt {
  instruction: string
  thinking_process: string[]
  output_format: string
}

export function buildCoTPrompt(
  task: string,
  context: any,
  outputTag: string = 'output',
): string {
  return `
${task}

Context: ${JSON.stringify(context)}

Please think through this step-by-step in <thinking> tags:
1. Analyze the input and requirements
2. Consider different approaches
3. Evaluate trade-offs
4. Select the best approach
5. Plan the implementation

Then provide your final ${outputTag} in <${outputTag}> tags.
`
}
```

### Workflow Analysis Example

```text
Analyze this @orchestr8 workflow for potential issues:

<workflow>
{
  "id": "data-processing",
  "steps": [...],
  "resilience": {...}
}
</workflow>

<thinking>
Let me analyze this workflow step by step:

1. **Input Analysis**: The workflow has 5 steps with parallel execution in step 3
2. **Resilience Check**: Retry policy is set but no timeout configured
3. **Potential Issues**:
   - Missing timeout could cause infinite hanging
   - No circuit breaker for external API calls
   - Parallel steps don't have individual error handling
4. **Recommendations**:
   - Add timeout: 30000ms for overall workflow
   - Add circuit breaker for steps 3 and 4
   - Implement fallback for parallel execution
</thinking>

<analysis>
The workflow has 3 critical issues:
1. Missing timeout configuration (HIGH priority)
2. No circuit breaker for external calls (MEDIUM priority)
3. Insufficient error handling in parallel steps (MEDIUM priority)

Recommended fixes:
- Add `timeout: 30000` to resilience config
- Wrap external API calls in circuit breaker pattern
- Add try-catch blocks in parallel step implementations
</analysis>
```

### Multi-Step Reasoning Pattern

```typescript
export class ReasoningAgent {
  async analyzeWithReasoning(input: any): Promise<any> {
    const prompt = `
Analyze this ${input.type} and provide recommendations.

Input:
${JSON.stringify(input.data)}

<thinking>
Step 1: Understanding the requirements
- What is being asked?
- What are the constraints?
- What is the expected output?

Step 2: Analyzing the current state
- What exists currently?
- What are the gaps?
- What are the risks?

Step 3: Generating solutions
- What are possible approaches?
- What are the trade-offs?
- Which approach is optimal?

Step 4: Planning implementation
- What are the concrete steps?
- What is the priority order?
- What are the dependencies?
</thinking>

<recommendations>
[Provide structured recommendations based on the analysis]
</recommendations>
`

    return await this.llm.complete(prompt)
  }
}
```

## Parsing Chain of Thought Responses

### Extracting Thinking and Output

```typescript
interface ParsedCoTResponse {
  thinking: string
  output: string
  confidence?: number
}

export function parseCoTResponse(response: string): ParsedCoTResponse {
  // Extract thinking section
  const thinkingMatch = response.match(/<thinking>([\s\S]*?)<\/thinking>/)
  const thinking = thinkingMatch ? thinkingMatch[1].trim() : ''

  // Extract output section (flexible tag name)
  const outputMatch = response.match(/<(\w+)>([\s\S]*?)<\/\1>/)
  const output =
    outputMatch && outputMatch[1] !== 'thinking'
      ? outputMatch[2].trim()
      : response.replace(/<thinking>[\s\S]*?<\/thinking>/, '').trim()

  // Extract confidence if mentioned
  const confidenceMatch = thinking.match(/confidence[:\s]+(\d+)/i)
  const confidence = confidenceMatch
    ? parseInt(confidenceMatch[1]) / 100
    : undefined

  return { thinking, output, confidence }
}
```

### Structured Extraction for Analysis

````typescript
interface AnalysisResult {
  thinking: {
    input_analysis: string
    approach_selection: string
    implementation_plan: string
  }
  output: {
    recommendations: string[]
    priority: 'high' | 'medium' | 'low'
    next_steps: string[]
  }
}

export function parseStructuredAnalysis(response: string): AnalysisResult {
  const parsed = parseCoTResponse(response)

  // Parse thinking into structured sections
  const thinkingSections = parsed.thinking.split(/Step \d+:/)

  // Parse output into structured format
  const outputData = JSON.parse(parsed.output.replace(/```json|```/g, ''))

  return {
    thinking: {
      input_analysis: thinkingSections[1] || '',
      approach_selection: thinkingSections[2] || '',
      implementation_plan: thinkingSections[3] || '',
    },
    output: outputData,
  }
}
````

## Advanced Patterns

### Pattern: Self-Evaluation

```text
Analyze this code for security vulnerabilities.

<code>
{{CODE}}
</code>

<thinking>
First, I'll identify the type of code and its purpose.
Then, I'll check for common vulnerability patterns.
Finally, I'll assess the severity of any issues found.
</thinking>

<analysis>
[Provide vulnerability analysis]
</analysis>

<confidence>
Rate your confidence in this analysis from 0-100 and explain why.
</confidence>
```

### Pattern: Alternative Consideration

```text
Design a retry mechanism for this workflow.

<requirements>
{{REQUIREMENTS}}
</requirements>

<thinking>
Let me consider multiple approaches:

Approach 1: Exponential backoff
- Pros: Prevents thundering herd
- Cons: Can be slow for transient failures

Approach 2: Fixed interval retry
- Pros: Predictable timing
- Cons: May overwhelm recovering services

Approach 3: Adaptive retry with circuit breaker
- Pros: Balances speed and safety
- Cons: More complex to implement

I'll go with Approach 3 because...
</thinking>

<solution>
[Provide the selected solution]
</solution>
```

### Pattern: Iterative Refinement

```text
Optimize this @orchestr8 workflow for performance.

<workflow>
{{WORKFLOW}}
</workflow>

<thinking>
Iteration 1: Identify bottlenecks
- Database calls in sequence (30% of time)
- Unnecessary data transformations (15% of time)

Iteration 2: Propose optimizations
- Parallelize independent DB calls
- Cache transformation results

Iteration 3: Validate improvements
- Estimated 40% performance gain
- No loss of functionality
</thinking>

<optimized_workflow>
[Provide optimized version]
</optimized_workflow>
```

## Chain Prompting (Multi-Step Workflows)

### Three-Prompt Chain Example

Based on Anthropic's documentation, here's a complete chain for document review:

**Prompt 1: Summary**

```text
Summarize this technical specification.

<spec>{{SPEC_DOCUMENT}}</spec>

Focus on architecture, requirements, and deliverables.
```

**Prompt 2: Review**

```text
Review this summary for accuracy, clarity, and completeness.

<summary>{{SUMMARY}}</summary>
<original_spec>{{SPEC_DOCUMENT}}</original_spec>

Grade on A-F scale and explain.
```

**Prompt 3: Improvement**

```text
Improve the summary based on this feedback.

<summary>{{SUMMARY}}</summary>
<feedback>{{FEEDBACK}}</feedback>
<original_spec>{{SPEC_DOCUMENT}}</original_spec>

Update the summary addressing all feedback points.
```

### Implementation of Chain Prompting

```typescript
export class ChainPromptOrchestrator {
  async executeChain(
    document: string,
    steps: ChainStep[],
  ): Promise<ChainResult> {
    const results: any[] = []
    let previousOutput = document

    for (const step of steps) {
      const prompt = step.buildPrompt(previousOutput, results)

      const response = await this.llm.complete({
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        system: step.systemPrompt,
      })

      const parsed = parseCoTResponse(response)
      results.push(parsed)
      previousOutput = parsed.output
    }

    return {
      finalOutput: previousOutput,
      intermediateSteps: results,
    }
  }
}
```

## Best Practices

### 1. Use Explicit Tags for Clarity

```text
✅ GOOD: Clear separation with tags
<thinking>
[reasoning process]
</thinking>

<output>
[final result]
</output>

❌ BAD: Mixed reasoning and output
Here's my analysis: [reasoning mixed with output]
```

### 2. Guide the Thinking Process

```text
✅ GOOD: Structured steps
Think through this in <thinking> tags:
1. Analyze the requirements
2. Consider edge cases
3. Design the solution
4. Validate the approach

❌ BAD: Vague instruction
Think about this problem.
```

### 3. Request Specific Reasoning

```text
✅ GOOD: Targeted reasoning
<thinking>
Specifically consider:
- Performance implications
- Security concerns
- Maintainability
</thinking>

❌ BAD: Generic thinking
<thinking>
Let me think about this...
</thinking>
```

## Common Mistakes to Avoid

### 1. Wrong XML Tag Names

```text
❌ WRONG: Non-standard tags
<ai_thinking>...</ai_thinking>
<process_flow>...</process_flow>
<reasoning_steps>...</reasoning_steps>

✅ CORRECT: Anthropic's tags
<thinking>...</thinking>
<output>...</output>
```

### 2. Over-Engineering the Structure

```text
❌ WRONG: Too complex
<meta_reasoning>
  <step_1>
    <substep_a>...</substep_a>
  </step_1>
</meta_reasoning>

✅ CORRECT: Simple and clear
<thinking>
Step 1: ...
Step 2: ...
</thinking>
```

### 3. Forgetting to Parse Output

```typescript
❌ WRONG: Using raw response
const response = await llm.complete(prompt);
return response; // Contains thinking tags!

✅ CORRECT: Parse and extract
const response = await llm.complete(prompt);
const parsed = parseCoTResponse(response);
return parsed.output; // Clean output only
```

## Performance Considerations

### Token Usage

Chain of Thought increases token usage but improves quality:

```typescript
interface TokenAnalysis {
  without_cot: {
    input: 500
    output: 200
    total: 700
  }
  with_cot: {
    input: 600 // +100 for instructions
    output: 800 // +600 for thinking
    total: 1400 // 2x tokens
  }
  quality_improvement: '40-60% better accuracy'
}
```

### When to Use Chain of Thought

✅ **Use CoT for:**

- Complex reasoning tasks
- Multi-step problems
- Tasks requiring explanation
- Critical decisions
- Debugging and analysis

❌ **Skip CoT for:**

- Simple lookups
- Straightforward transformations
- High-volume, low-complexity tasks
- Time-critical responses

## Conclusion

The official Anthropic Chain of Thought pattern is simple and powerful:

1. **Use `<thinking>` tags** for reasoning
2. **Use semantic tags** for output (`<email>`, `<analysis>`, `<solution>`)
3. **Guide the thinking** with specific steps
4. **Parse the response** to extract clean output

This approach provides clear separation between reasoning and results, making it easy to debug, audit, and improve agent responses.
