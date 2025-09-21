/**
 * Tests for deterministic data generators
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DeterministicGenerator } from '../generators.js'

describe('DeterministicGenerator', () => {
  let generator: DeterministicGenerator

  beforeEach(() => {
    generator = new DeterministicGenerator(12345)
  })

  describe('Name generation', () => {
    it('should generate deterministic first names', () => {
      const firstName1 = generator.firstName()
      const firstName2 = generator.firstName()

      expect(firstName1).toBeTruthy()
      expect(firstName2).toBeTruthy()
      expect(typeof firstName1).toBe('string')

      generator.reset()
      expect(generator.firstName()).toBe(firstName1)
      expect(generator.firstName()).toBe(firstName2)
    })

    it('should generate deterministic last names', () => {
      const lastName1 = generator.lastName()
      const lastName2 = generator.lastName()

      expect(lastName1).toBeTruthy()
      expect(lastName2).toBeTruthy()
      expect(typeof lastName1).toBe('string')

      generator.reset()
      expect(generator.lastName()).toBe(lastName1)
      expect(generator.lastName()).toBe(lastName2)
    })

    it('should generate deterministic full names', () => {
      const fullName = generator.fullName()

      expect(fullName).toContain(' ')
      expect(fullName.split(' ')).toHaveLength(2)

      generator.reset()
      expect(generator.fullName()).toBe(fullName)
    })
  })

  describe('Contact information', () => {
    it('should generate deterministic emails', () => {
      const email1 = generator.email()
      const email2 = generator.email()

      expect(email1).toContain('@')
      expect(email1).toContain('.')
      expect(email2).toContain('@')

      generator.reset()
      expect(generator.email()).toBe(email1)
      expect(generator.email()).toBe(email2)
    })

    it('should generate emails with custom options', () => {
      const email = generator.email({ name: 'test', domain: 'example.com' })

      // Email generator always adds a random suffix even with custom name
      expect(email).toMatch(/^test\d+@example\.com$/)
    })

    it('should generate deterministic phone numbers', () => {
      const phone = generator.phone()

      expect(phone).toMatch(/^\(\d{3}\) \d{3}-\d{4}$/)

      generator.reset()
      expect(generator.phone()).toBe(phone)
    })

    it('should generate phone with custom format', () => {
      const phone = generator.phone('XXX-XXX-XXXX')

      expect(phone).toMatch(/^\d{3}-\d{3}-\d{4}$/)
    })

    it('should generate deterministic usernames', () => {
      const username = generator.username()

      expect(username).toBeTruthy()
      // Username format is firstname + number (no dot)
      expect(username).toMatch(/^[a-z]+\d+$/)

      generator.reset()
      expect(generator.username()).toBe(username)
    })
  })

  describe('Address generation', () => {
    it('should generate complete addresses', () => {
      const address = generator.address()

      expect(address.street).toBeTruthy()
      expect(address.city).toBeTruthy()
      expect(address.state).toBeTruthy()
      expect(address.zipCode).toMatch(/^\d{5}$/)
      expect(address.country).toBe('USA')

      generator.reset()
      const sameAddress = generator.address()
      expect(sameAddress).toEqual(address)
    })

    it('should generate street addresses', () => {
      const street = generator.streetAddress()

      expect(street).toMatch(/^\d+ .+$/)

      generator.reset()
      expect(generator.streetAddress()).toBe(street)
    })

    it('should generate zip codes', () => {
      const zip = generator.zipCode()

      expect(zip).toMatch(/^\d{5}$/)

      generator.reset()
      expect(generator.zipCode()).toBe(zip)
    })
  })

  describe('Date generation', () => {
    it('should generate deterministic dates', () => {
      const date1 = generator.date()
      const date2 = generator.date()

      expect(date1).toBeInstanceOf(Date)
      expect(date2).toBeInstanceOf(Date)
      expect(date1.getTime()).not.toBe(date2.getTime())

      generator.reset()
      expect(generator.date().getTime()).toBe(date1.getTime())
      expect(generator.date().getTime()).toBe(date2.getTime())
    })

    it('should generate dates within range', () => {
      const min = new Date('2020-01-01')
      const max = new Date('2020-12-31')
      const date = generator.date({ min, max })

      expect(date.getTime()).toBeGreaterThanOrEqual(min.getTime())
      expect(date.getTime()).toBeLessThanOrEqual(max.getTime())
    })

    it('should generate past dates', () => {
      const date = generator.pastDate(30)
      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      expect(date.getTime()).toBeLessThan(now.getTime())
      expect(date.getTime()).toBeGreaterThanOrEqual(thirtyDaysAgo.getTime())
    })

    it('should generate future dates', () => {
      const date = generator.futureDate(30)
      const now = new Date()
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

      expect(date.getTime()).toBeGreaterThan(now.getTime())
      expect(date.getTime()).toBeLessThanOrEqual(thirtyDaysFromNow.getTime())
    })
  })

  describe('Number generation', () => {
    it('should generate deterministic booleans', () => {
      const values = Array.from({ length: 20 }, () => generator.boolean())

      expect(values).toContain(true)
      expect(values).toContain(false)

      generator.reset()
      const sameValues = Array.from({ length: 20 }, () => generator.boolean())
      expect(sameValues).toEqual(values)
    })

    it('should generate booleans with probability', () => {
      const alwaysTrue = Array.from({ length: 10 }, () => generator.boolean(1))
      const alwaysFalse = Array.from({ length: 10 }, () => generator.boolean(0))

      expect(alwaysTrue.every((v) => v === true)).toBe(true)
      expect(alwaysFalse.every((v) => v === false)).toBe(true)
    })

    it('should generate deterministic integers', () => {
      const int1 = generator.integer()
      const int2 = generator.integer()

      expect(Number.isInteger(int1)).toBe(true)
      expect(Number.isInteger(int2)).toBe(true)
      expect(int1).not.toBe(int2)

      generator.reset()
      expect(generator.integer()).toBe(int1)
      expect(generator.integer()).toBe(int2)
    })

    it('should generate integers within range', () => {
      const int = generator.integer(10, 20)

      expect(int).toBeGreaterThanOrEqual(10)
      expect(int).toBeLessThanOrEqual(20)
    })

    it('should generate deterministic floats', () => {
      const float1 = generator.float()
      const float2 = generator.float()

      expect(typeof float1).toBe('number')
      expect(typeof float2).toBe('number')
      expect(float1).not.toBe(float2)

      generator.reset()
      expect(generator.float()).toBe(float1)
      expect(generator.float()).toBe(float2)
    })

    it('should generate floats with custom decimals', () => {
      const float = generator.float(0, 10, 3)
      const decimals = float.toString().split('.')[1]

      expect(float).toBeGreaterThanOrEqual(0)
      expect(float).toBeLessThanOrEqual(10)
      if (decimals) {
        expect(decimals.length).toBeLessThanOrEqual(3)
      }
    })
  })

  describe('Text generation', () => {
    it('should generate lorem ipsum text', () => {
      const lorem = generator.lorem(5)
      const words = lorem.split(' ')

      expect(words).toHaveLength(5)

      generator.reset()
      expect(generator.lorem(5)).toBe(lorem)
    })

    it('should generate sentences', () => {
      const sentence = generator.sentence(7)

      expect(sentence).toContain(' ')
      expect(sentence).toMatch(/\.$/) // Check sentence ends with period
      expect(sentence[0]).toMatch(/[A-Z]/)

      generator.reset()
      expect(generator.sentence(7)).toBe(sentence)
    })

    it('should generate paragraphs', () => {
      const paragraph = generator.paragraph(3)

      const sentences = paragraph.split('. ')
      expect(sentences.length).toBeGreaterThanOrEqual(3)

      generator.reset()
      expect(generator.paragraph(3)).toBe(paragraph)
    })
  })

  describe('Web data', () => {
    it('should generate deterministic URLs', () => {
      const url = generator.url()

      expect(url).toMatch(/^https?:\/\/.+/)

      generator.reset()
      expect(generator.url()).toBe(url)
    })

    it('should generate URLs with custom options', () => {
      const url = generator.url({ protocol: 'ftp', domain: 'example.com' })

      expect(url).toMatch(/^ftp:\/\/example\.com/)
    })

    it('should generate IP addresses', () => {
      const ip = generator.ipAddress()

      expect(ip).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)
      const parts = ip.split('.').map(Number)
      parts.forEach((part) => {
        expect(part).toBeGreaterThanOrEqual(0)
        expect(part).toBeLessThanOrEqual(255)
      })

      generator.reset()
      expect(generator.ipAddress()).toBe(ip)
    })

    it('should generate MAC addresses', () => {
      const mac = generator.macAddress()

      // MAC addresses use lowercase hex digits with colons
      expect(mac).toMatch(
        /^[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}$/,
      )

      generator.reset()
      expect(generator.macAddress()).toBe(mac)
    })
  })

  describe('Financial data', () => {
    it('should generate credit card numbers', () => {
      const visa = generator.creditCardNumber('visa')
      const mastercard = generator.creditCardNumber('mastercard')
      const amex = generator.creditCardNumber('amex')

      // Credit card numbers are generated without hyphens
      expect(visa).toMatch(/^4\d{15}$/) // Visa: starts with 4, 16 digits total
      expect(mastercard).toMatch(/^5\d{15}$/) // Mastercard: starts with 5, 16 digits total
      expect(amex).toMatch(/^37\d{13}$/) // Amex: starts with 37, 15 digits total
    })
  })

  describe('Color generation', () => {
    it('should generate hex colors', () => {
      const color = generator.hexColor()

      expect(color).toMatch(/^#[0-9A-F]{6}$/i)

      generator.reset()
      expect(generator.hexColor()).toBe(color)
    })

    it('should generate RGB colors', () => {
      const color = generator.rgbColor()

      expect(color.r).toBeGreaterThanOrEqual(0)
      expect(color.r).toBeLessThanOrEqual(255)
      expect(color.g).toBeGreaterThanOrEqual(0)
      expect(color.g).toBeLessThanOrEqual(255)
      expect(color.b).toBeGreaterThanOrEqual(0)
      expect(color.b).toBeLessThanOrEqual(255)

      generator.reset()
      const sameColor = generator.rgbColor()
      expect(sameColor).toEqual(color)
    })
  })

  describe('Business data', () => {
    it('should generate company names', () => {
      const company = generator.companyName()

      expect(company).toBeTruthy()
      expect(typeof company).toBe('string')

      generator.reset()
      expect(generator.companyName()).toBe(company)
    })

    it('should generate product names', () => {
      const product = generator.productName()

      expect(product).toBeTruthy()
      expect(typeof product).toBe('string')

      generator.reset()
      expect(generator.productName()).toBe(product)
    })
  })

  describe('Complex objects', () => {
    it('should generate user data objects using object method', () => {
      const userSchema = {
        id: 'string' as const,
        firstName: 'string' as const,
        lastName: 'string' as const,
        email: 'string' as const,
        phone: 'string' as const,
        username: 'string' as const,
        address: 'string' as const,
      }
      const user = generator.object(userSchema)

      expect(user.id).toBeTruthy()
      expect(user.firstName).toBeTruthy()
      expect(user.lastName).toBeTruthy()
      expect(user.email).toBeTruthy()
      expect(user.phone).toBeTruthy()
      expect(user.username).toBeTruthy()
      expect(user.address).toBeTruthy()

      generator.reset()
      const sameUser = generator.object(userSchema)
      expect(sameUser.id).toBe(user.id)
      expect(sameUser.firstName).toBe(user.firstName)
    })

    it('should generate product data objects using object method', () => {
      const productSchema = {
        id: 'string' as const,
        name: 'string' as const,
        price: 'number' as const,
        inStock: 'boolean' as const,
        description: 'string' as const,
        createdAt: 'date' as const,
      }
      const product = generator.object(productSchema)

      expect(product.id).toBeTruthy()
      expect(product.name).toBeTruthy()
      expect(product.price).toBeGreaterThan(0)
      expect(typeof product.inStock).toBe('boolean')
      expect(product.description).toBeTruthy()
      expect(product.createdAt).toBeInstanceOf(Date)

      generator.reset()
      const sameProduct = generator.object(productSchema)
      expect(sameProduct.id).toBe(product.id)
    })

    it('should generate company data objects using object method', () => {
      const companySchema = {
        id: 'string' as const,
        name: 'string' as const,
        website: 'string' as const,
        phone: 'string' as const,
        address: 'string' as const,
      }
      const company = generator.object(companySchema)

      expect(company.id).toBeTruthy()
      expect(company.name).toBeTruthy()
      expect(company.website).toBeTruthy()
      expect(company.phone).toBeTruthy()
      expect(company.address).toBeTruthy()

      generator.reset()
      const sameCompany = generator.object(companySchema)
      expect(sameCompany.id).toBe(company.id)
    })
  })

  describe('Utilities', () => {
    it('should generate IDs', () => {
      const id1 = generator.id()
      const id2 = generator.id('user')

      expect(id1).toMatch(/^id_\d+$/)
      expect(id2).toMatch(/^user_\d+$/)

      generator.reset()
      expect(generator.id()).toBe(id1)
    })

    it('should generate UUIDs', () => {
      const uuid = generator.uuid()

      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)

      generator.reset()
      expect(generator.uuid()).toBe(uuid)
    })

    it('should reset properly', () => {
      const initial = generator.firstName()
      generator.firstName() // advance state
      generator.firstName() // advance more

      generator.reset()
      expect(generator.firstName()).toBe(initial)
    })

    it('should reset with new seed', () => {
      const with12345 = generator.firstName()

      generator.reset(54321)
      const with54321 = generator.firstName()

      expect(with12345).not.toBe(with54321)

      // Verify new seed is deterministic
      generator.reset(54321)
      expect(generator.firstName()).toBe(with54321)
    })
  })

  describe('Different seeds produce different results', () => {
    it('should generate different sequences with different seeds', () => {
      const gen1 = new DeterministicGenerator(12345)
      const gen2 = new DeterministicGenerator(54321)

      const name1 = gen1.firstName()
      const name2 = gen2.firstName()

      expect(name1).not.toBe(name2)

      const email1 = gen1.email()
      const email2 = gen2.email()

      expect(email1).not.toBe(email2)
    })

    it('should handle string seeds', () => {
      const gen1 = new DeterministicGenerator('test-seed')
      const gen2 = new DeterministicGenerator('test-seed')
      const gen3 = new DeterministicGenerator('different-seed')

      const value1 = gen1.firstName()
      const value2 = gen2.firstName()
      const value3 = gen3.firstName()

      expect(value1).toBe(value2) // Same seed
      expect(value1).not.toBe(value3) // Different seed
    })
  })
})
