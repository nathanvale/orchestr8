# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-08-20-json-execution-model/spec.md

> Created: 2025-08-20
> Version: 1.0.0

## Endpoints

### POST /workflows/validate

**Purpose:** Validate a workflow JSON definition against the schema without executing it
**Parameters:** 
- Body: Workflow JSON object
**Response:** 
```json
{
  "valid": boolean,
  "errors": [
    {
      "path": "steps[0].agent.id",
      "message": "Invalid agent ID format",
      "expected": "@scope/name",
      "received": "invalid-id"
    }
  ]
}
```
**Errors:** 
- 400: Invalid JSON structure
- 422: Validation errors in workflow definition

### GET /schemas/workflow

**Purpose:** Retrieve the JSON Schema for workflow definitions
**Parameters:** 
- Query: version (optional) - Schema version to retrieve
**Response:** JSON Schema document
**Errors:** 
- 404: Schema version not found

### GET /schemas/agent

**Purpose:** Retrieve the JSON Schema for agent definitions
**Parameters:** 
- Query: version (optional) - Schema version to retrieve
**Response:** JSON Schema document
**Errors:** 
- 404: Schema version not found

### POST /agents/validate

**Purpose:** Validate an agent JSON definition against the schema
**Parameters:** 
- Body: Agent JSON object
**Response:** 
```json
{
  "valid": boolean,
  "errors": []
}
```
**Errors:** 
- 400: Invalid JSON structure
- 422: Validation errors in agent definition

## Validation Integration

All existing endpoints that accept workflow or agent definitions will be enhanced with schema validation:

### POST /workflows/execute
- Will validate workflow before execution
- Returns 422 with validation errors if invalid

### POST /agents/register
- Will validate agent definition before registration
- Returns 422 with validation errors if invalid

## Error Response Format

All validation errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Workflow validation failed",
    "details": [
      {
        "path": "steps[0].input.mapping",
        "message": "Invalid expression format",
        "expected": "${steps.<id>.output.<path>}",
        "received": "invalid-expression",
        "example": "${steps.fetch.output.data}"
      }
    ]
  }
}
```

## Schema Versioning

- Schemas are versioned using semantic versioning
- Default version is always the latest stable version
- Backward compatibility maintained for at least 2 major versions
- Version can be specified via:
  - Query parameter: `?version=1.0.0`
  - Header: `X-Schema-Version: 1.0.0`

## Content Types

- Request: `application/json`
- Response: `application/json` for validation results
- Response: `application/schema+json` for schema documents