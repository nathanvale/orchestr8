/**
 * Tests for schema error formatter
 */

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { SchemaErrorFormatter } from './formatter.js'

describe('SchemaErrorFormatter', () => {
  const formatter = new SchemaErrorFormatter()

  describe('format', () => {
    it('should format required field errors', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      })

      const result = schema.safeParse({})
      expect(result.success).toBe(false)

      if (!result.success) {
        const errors = formatter.format(result.error)
        expect(errors).toHaveLength(2)
        expect(errors[0]).toMatchObject({
          path: 'name',
          message: 'This field is required',
          expected: 'string',
          received: 'undefined',
        })
        expect(errors[1]).toMatchObject({
          path: 'age',
          message: 'This field is required',
          expected: 'number',
          received: 'undefined',
        })
      }
    })

    it('should format type mismatch errors', () => {
      const schema = z.object({
        count: z.number(),
      })

      const result = schema.safeParse({ count: 'not a number' })
      expect(result.success).toBe(false)

      if (!result.success) {
        const errors = formatter.format(result.error)
        expect(errors[0]).toMatchObject({
          path: 'count',
          message: 'Expected number, but received string',
          expected: 'number',
          received: 'string',
        })
      }
    })

    it('should format UUID validation errors', () => {
      const schema = z.object({
        id: z.string().uuid(),
      })

      const result = schema.safeParse({ id: 'not-a-uuid' })
      expect(result.success).toBe(false)

      if (!result.success) {
        const errors = formatter.format(result.error)
        expect(errors[0]).toMatchObject({
          path: 'id',
          message:
            'Must be a valid UUID (e.g., 123e4567-e89b-12d3-a456-426614174000)',
          expected: 'UUID',
        })
      }
    })

    it('should format regex validation errors with custom message', () => {
      const schema = z.object({
        agentId: z
          .string()
          .regex(
            /^@[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+$/,
            'Agent ID must follow format: @scope/name',
          ),
      })

      const result = schema.safeParse({ agentId: 'invalid' })
      expect(result.success).toBe(false)

      if (!result.success) {
        const errors = formatter.format(result.error)
        expect(errors[0]).toMatchObject({
          path: 'agentId',
          message: 'Agent ID must follow format: @scope/name',
          expected: 'matching pattern',
        })
      }
    })

    it('should format minimum length errors', () => {
      const schema = z.object({
        name: z.string().min(3),
      })

      const result = schema.safeParse({ name: 'ab' })
      expect(result.success).toBe(false)

      if (!result.success) {
        const errors = formatter.format(result.error)
        expect(errors[0]).toMatchObject({
          path: 'name',
          message: 'Must be at least 3 characters long',
        })
      }
    })

    it('should format maximum length errors', () => {
      const schema = z.object({
        description: z.string().max(10),
      })

      const result = schema.safeParse({ description: 'This is too long' })
      expect(result.success).toBe(false)

      if (!result.success) {
        const errors = formatter.format(result.error)
        expect(errors[0]).toMatchObject({
          path: 'description',
          message: 'Must be at most 10 characters long',
        })
      }
    })

    it('should format array minimum errors', () => {
      const schema = z.object({
        items: z.array(z.string()).min(2),
      })

      const result = schema.safeParse({ items: ['one'] })
      expect(result.success).toBe(false)

      if (!result.success) {
        const errors = formatter.format(result.error)
        expect(errors[0]).toMatchObject({
          path: 'items',
          message: 'Must have at least 2 items',
        })
      }
    })

    it('should format enum errors', () => {
      const schema = z.object({
        status: z.enum(['pending', 'active', 'completed']),
      })

      const result = schema.safeParse({ status: 'invalid' })
      expect(result.success).toBe(false)

      if (!result.success) {
        const errors = formatter.format(result.error)
        expect(errors[0]).toMatchObject({
          path: 'status',
          message: 'Must be one of: "pending", "active", "completed"',
          expected: 'pending | active | completed',
        })
      }
    })

    it('should format nested object errors', () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            name: z.string(),
          }),
        }),
      })

      const result = schema.safeParse({ user: { profile: {} } })
      expect(result.success).toBe(false)

      if (!result.success) {
        const errors = formatter.format(result.error)
        expect(errors[0]).toMatchObject({
          path: 'user.profile.name',
          message: 'This field is required',
        })
      }
    })

    it('should format array element errors', () => {
      const schema = z.object({
        steps: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
          }),
        ),
      })

      const result = schema.safeParse({
        steps: [
          { id: 'step1', name: 'First' },
          { id: 'step2' }, // Missing name
        ],
      })
      expect(result.success).toBe(false)

      if (!result.success) {
        const errors = formatter.format(result.error)
        expect(errors[0]).toMatchObject({
          path: 'steps[1].name',
          message: 'This field is required',
        })
      }
    })

    it('should provide examples for known paths', () => {
      const formatter = new SchemaErrorFormatter()

      const schema = z.object({
        metadata: z.object({
          id: z.string().uuid(),
        }),
      })

      const result = schema.safeParse({ metadata: { id: 'invalid' } })
      expect(result.success).toBe(false)

      if (!result.success) {
        const errors = formatter.format(result.error)
        expect(errors[0].example).toBe('123e4567-e89b-12d3-a456-426614174000')
      }
    })
  })

  describe('formatAsString', () => {
    it('should format errors as a readable string', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().min(18),
      })

      const result = schema.safeParse({ age: 16 })
      expect(result.success).toBe(false)

      if (!result.success) {
        const formatted = formatter.formatAsString(result.error)
        expect(formatted).toContain('• name: This field is required')
        expect(formatted).toContain('• age: Must be at least 18')
      }
    })
  })

  describe('formatAsJSON', () => {
    it('should format errors as JSON for API responses', () => {
      const schema = z.object({
        email: z.string().email(),
      })

      const result = schema.safeParse({ email: 'invalid' })
      expect(result.success).toBe(false)

      if (!result.success) {
        const formatted = formatter.formatAsJSON(result.error)
        expect(formatted).toEqual({
          valid: false,
          errors: expect.arrayContaining([
            expect.objectContaining({
              path: 'email',
              message: expect.any(String),
            }),
          ]),
        })
      }
    })
  })
})
