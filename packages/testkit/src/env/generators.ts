/**
 * Deterministic data generators for testing
 * Provides predictable generation of common test data types
 */

import { SeededRandom } from './seed.js'

/**
 * Address type
 */
export interface Address {
  street: string
  city: string
  state: string
  zipCode: string
  country: string
}

/**
 * User data type
 */
export interface UserData {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  username: string
  address: Address
}

/**
 * Product data type
 */
export interface ProductData {
  id: string
  name: string
  price: number
  inStock: boolean
  description: string
  createdAt: Date
}

/**
 * Company data type
 */
export interface CompanyData {
  id: string
  name: string
  website: string
  phone: string
  address: Address
}

/**
 * Schema type for object generation
 */
export type ObjectSchema = Record<string, 'string' | 'number' | 'boolean' | 'date'>

/**
 * Generated object type
 */
export type GeneratedObject<T extends ObjectSchema = ObjectSchema> = {
  [K in keyof T]: T[K] extends 'string'
    ? string
    : T[K] extends 'number'
      ? number
      : T[K] extends 'boolean'
        ? boolean
        : T[K] extends 'date'
          ? Date
          : never
}

/**
 * Common first names for test data
 */
const FIRST_NAMES = [
  'Alice',
  'Bob',
  'Charlie',
  'David',
  'Emma',
  'Frank',
  'Grace',
  'Henry',
  'Isabella',
  'Jack',
  'Kate',
  'Liam',
  'Maria',
  'Noah',
  'Olivia',
  'Peter',
  'Quinn',
  'Rachel',
  'Samuel',
  'Tara',
  'Uma',
  'Victor',
  'Wendy',
  'Xavier',
  'Yvonne',
  'Zachary',
  'Amy',
  'Brian',
  'Clara',
  'Daniel',
  'Elena',
  'Felix',
]

/**
 * Common last names for test data
 */
const LAST_NAMES = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Gonzalez',
  'Wilson',
  'Anderson',
  'Thomas',
  'Taylor',
  'Moore',
  'Jackson',
  'Martin',
  'Lee',
  'Perez',
  'Thompson',
  'White',
  'Harris',
  'Sanchez',
  'Clark',
  'Ramirez',
  'Lewis',
  'Robinson',
  'Walker',
  'Young',
  'Allen',
]

/**
 * Email domains for test data
 */
const EMAIL_DOMAINS = [
  'example.com',
  'test.com',
  'demo.org',
  'sample.net',
  'testing.io',
  'mock.dev',
  'fake.email',
  'testmail.com',
  'devtest.org',
  'qa.net',
]

/**
 * Street types for addresses
 */
const STREET_TYPES = [
  'Street',
  'Avenue',
  'Boulevard',
  'Drive',
  'Court',
  'Place',
  'Road',
  'Lane',
  'Trail',
  'Way',
  'Circle',
  'Square',
  'Plaza',
  'Parkway',
]

/**
 * City names for addresses
 */
const CITIES = [
  'New York',
  'Los Angeles',
  'Chicago',
  'Houston',
  'Phoenix',
  'Philadelphia',
  'San Antonio',
  'San Diego',
  'Dallas',
  'San Jose',
  'Austin',
  'Jacksonville',
  'Fort Worth',
  'Columbus',
  'Charlotte',
  'San Francisco',
  'Indianapolis',
  'Seattle',
  'Denver',
  'Washington',
  'Boston',
  'Nashville',
  'Baltimore',
]

/**
 * US state codes
 */
const STATE_CODES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
]

/**
 * Lorem ipsum words for text generation
 */
const LOREM_WORDS = [
  'lorem',
  'ipsum',
  'dolor',
  'sit',
  'amet',
  'consectetur',
  'adipiscing',
  'elit',
  'sed',
  'do',
  'eiusmod',
  'tempor',
  'incididunt',
  'ut',
  'labore',
  'et',
  'dolore',
  'magna',
  'aliqua',
  'enim',
  'ad',
  'minim',
  'veniam',
  'quis',
  'nostrud',
  'exercitation',
  'ullamco',
  'laboris',
  'nisi',
  'aliquip',
  'ex',
  'ea',
  'commodo',
  'consequat',
  'duis',
  'aute',
  'irure',
  'in',
  'reprehenderit',
  'voluptate',
  'velit',
  'esse',
  'cillum',
  'fugiat',
  'nulla',
  'pariatur',
  'excepteur',
  'sint',
  'occaecat',
  'cupidatat',
  'non',
  'proident',
  'sunt',
  'culpa',
  'qui',
  'officia',
  'deserunt',
  'mollit',
  'anim',
  'id',
  'est',
  'laborum',
]

/**
 * Deterministic data generator class
 */
export class DeterministicGenerator {
  private rng: SeededRandom
  private counter = 0

  constructor(seed: number | string) {
    this.rng = new SeededRandom(seed)
  }

  /**
   * Reset the generator to initial state
   */
  reset(newSeed?: number | string): void {
    this.rng.reset(newSeed)
    this.counter = 0
  }

  /**
   * Generate a first name
   */
  firstName(): string {
    return this.rng.choice(FIRST_NAMES)
  }

  /**
   * Generate a last name
   */
  lastName(): string {
    return this.rng.choice(LAST_NAMES)
  }

  /**
   * Generate a full name
   */
  fullName(): string {
    return `${this.firstName()} ${this.lastName()}`
  }

  /**
   * Generate an email address
   */
  email(options?: { name?: string; domain?: string }): string {
    const name =
      options?.name ?? `${this.firstName().toLowerCase()}.${this.lastName().toLowerCase()}`
    const domain = options?.domain ?? this.rng.choice(EMAIL_DOMAINS)
    const suffix = this.rng.nextInt(1, 999)
    return `${name}${suffix}@${domain}`
  }

  /**
   * Generate a phone number
   */
  phone(format = '(XXX) XXX-XXXX'): string {
    return format.replace(/X/g, () => this.rng.nextInt(0, 9).toString())
  }

  /**
   * Generate a sequential ID
   */
  id(prefix = 'id'): string {
    this.counter++
    return `${prefix}_${this.counter.toString().padStart(6, '0')}`
  }

  /**
   * Generate a UUID-like ID
   */
  uuid(): string {
    const hex = () => this.rng.nextInt(0, 15).toString(16)
    const s4 = () => Array.from({ length: 4 }, hex).join('')
    return `${s4()}${s4()}-${s4()}-4${s4().slice(1)}-${
      ['8', '9', 'a', 'b'][this.rng.nextInt(0, 3)]
    }${s4().slice(1)}-${s4()}${s4()}${s4()}`
  }

  /**
   * Generate a street address
   */
  streetAddress(): string {
    const number = this.rng.nextInt(1, 9999)
    const streetName = this.rng.choice(LAST_NAMES)
    const streetType = this.rng.choice(STREET_TYPES)
    return `${number} ${streetName} ${streetType}`
  }

  /**
   * Generate a full address
   */
  address(): Address {
    return {
      street: this.streetAddress(),
      city: this.rng.choice(CITIES),
      state: this.rng.choice(STATE_CODES),
      zipCode: this.zipCode(),
      country: 'USA',
    }
  }

  /**
   * Generate a zip code
   */
  zipCode(): string {
    return this.rng.nextInt(10000, 99999).toString()
  }

  /**
   * Generate a date within a range
   */
  date(options?: { min?: Date; max?: Date }): Date {
    const min = options?.min ?? new Date('2020-01-01')
    const max = options?.max ?? new Date('2025-12-31')
    const timestamp = this.rng.nextInt(min.getTime(), max.getTime())
    return new Date(timestamp)
  }

  /**
   * Generate a past date
   */
  pastDate(daysAgo = 365): Date {
    const now = Date.now()
    const past = now - daysAgo * 24 * 60 * 60 * 1000
    const timestamp = this.rng.nextInt(past, now)
    return new Date(timestamp)
  }

  /**
   * Generate a future date
   */
  futureDate(daysAhead = 365): Date {
    const now = Date.now()
    const future = now + daysAhead * 24 * 60 * 60 * 1000
    const timestamp = this.rng.nextInt(now, future)
    return new Date(timestamp)
  }

  /**
   * Generate a boolean with optional probability
   */
  boolean(probability = 0.5): boolean {
    return this.rng.nextBoolean(probability)
  }

  /**
   * Generate an integer within range
   */
  integer(min = 0, max = 100): number {
    return this.rng.nextInt(min, max)
  }

  /**
   * Generate a float within range
   */
  float(min = 0, max = 1, decimals = 2): number {
    const value = this.rng.nextFloat(min, max)
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
  }

  /**
   * Pick a random element from array
   */
  arrayElement<T>(array: T[]): T {
    return this.rng.choice(array)
  }

  /**
   * Pick multiple random elements from array
   */
  arrayElements<T>(array: T[], count: number): T[] {
    const shuffled = [...array]
    this.rng.shuffle(shuffled)
    return shuffled.slice(0, Math.min(count, array.length))
  }

  /**
   * Generate lorem ipsum text
   */
  lorem(wordCount = 10): string {
    return Array.from({ length: wordCount }, () => this.rng.choice(LOREM_WORDS)).join(' ')
  }

  /**
   * Generate a sentence
   */
  sentence(wordCount = 10): string {
    const text = this.lorem(wordCount)
    return text.charAt(0).toUpperCase() + text.slice(1) + '.'
  }

  /**
   * Generate a paragraph
   */
  paragraph(sentenceCount = 3): string {
    return Array.from({ length: sentenceCount }, () => this.sentence(this.rng.nextInt(5, 15))).join(
      ' ',
    )
  }

  /**
   * Generate a URL
   */
  url(options?: { protocol?: string; domain?: string }): string {
    const protocol = options?.protocol ?? 'https'
    const domain = options?.domain ?? this.rng.choice(EMAIL_DOMAINS)
    const path = this.rng.choice(['', 'page', 'users', 'posts', 'api'])
    const id = this.rng.nextInt(1, 999)
    return path ? `${protocol}://${domain}/${path}/${id}` : `${protocol}://${domain}`
  }

  /**
   * Generate a username
   */
  username(): string {
    const first = this.firstName().toLowerCase()
    const suffix = this.rng.nextInt(100, 9999)
    return `${first}${suffix}`
  }

  /**
   * Generate a company name
   */
  companyName(): string {
    const suffixes = ['Inc', 'LLC', 'Corp', 'Industries', 'Solutions', 'Services']
    const name = this.rng.choice(LAST_NAMES)
    const suffix = this.rng.choice(suffixes)
    return `${name} ${suffix}`
  }

  /**
   * Generate a product name
   */
  productName(): string {
    const adjectives = ['Premium', 'Ultimate', 'Pro', 'Super', 'Mega', 'Ultra']
    const nouns = ['Widget', 'Gadget', 'Tool', 'Device', 'System', 'Solution']
    const versions = ['', ' 2.0', ' X', ' Plus', ' Max', ' Pro']

    const adjective = this.rng.choice(adjectives)
    const noun = this.rng.choice(nouns)
    const version = this.rng.choice(versions)

    return `${adjective} ${noun}${version}`
  }

  /**
   * Generate a color (hex)
   */
  hexColor(): string {
    const hex = () => this.rng.nextInt(0, 255).toString(16).padStart(2, '0')
    return `#${hex()}${hex()}${hex()}`
  }

  /**
   * Generate an RGB color
   */
  rgbColor(): { r: number; g: number; b: number } {
    return {
      r: this.rng.nextInt(0, 255),
      g: this.rng.nextInt(0, 255),
      b: this.rng.nextInt(0, 255),
    }
  }

  /**
   * Generate an IP address
   */
  ipAddress(): string {
    return Array.from({ length: 4 }, () => this.rng.nextInt(0, 255)).join('.')
  }

  /**
   * Generate a MAC address
   */
  macAddress(): string {
    return Array.from({ length: 6 }, () =>
      this.rng.nextInt(0, 255).toString(16).padStart(2, '0'),
    ).join(':')
  }

  /**
   * Generate a credit card number (fake, passes Luhn check)
   */
  creditCardNumber(type: 'visa' | 'mastercard' | 'amex' = 'visa'): string {
    const prefixes = {
      visa: '4',
      mastercard: '5',
      amex: '37',
    }

    const lengths = {
      visa: 16,
      mastercard: 16,
      amex: 15,
    }

    const prefix = prefixes[type]
    const length = lengths[type]

    // Generate random digits
    const digits = [prefix]
    for (let i = prefix.length; i < length - 1; i++) {
      digits.push(this.rng.nextInt(0, 9).toString())
    }

    // Calculate Luhn check digit
    let sum = 0
    let isEven = false

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10)

      if (isEven) {
        digit *= 2
        if (digit > 9) {
          digit -= 9
        }
      }

      sum += digit
      isEven = !isEven
    }

    const checkDigit = (10 - (sum % 10)) % 10
    digits.push(checkDigit.toString())

    return digits.join('')
  }

  /**
   * Generate a JSON object with random data
   */
  object<T extends ObjectSchema = ObjectSchema>(schema?: T): GeneratedObject<T> {
    const defaultSchema: ObjectSchema = {
      id: 'string',
      name: 'string',
      age: 'number',
      active: 'boolean',
      created: 'date',
    }

    const actualSchema = schema ?? defaultSchema
    const result: Record<string, unknown> = {}

    for (const [key, type] of Object.entries(actualSchema)) {
      switch (type) {
        case 'string':
          result[key] = this.lorem(3)
          break
        case 'number':
          result[key] = this.integer(1, 100)
          break
        case 'boolean':
          result[key] = this.boolean()
          break
        case 'date':
          result[key] = this.date()
          break
      }
    }

    return result as GeneratedObject<T>
  }
}

/**
 * Create a deterministic generator with a seed
 */
export function createGenerator(seed: number | string = 12345): DeterministicGenerator {
  return new DeterministicGenerator(seed)
}

/**
 * Quick generator helpers
 */
export const generate = {
  /**
   * Create a new generator instance
   */
  create: createGenerator,

  /**
   * Generate test user data
   */
  user(seed = 'user'): UserData {
    const gen = createGenerator(seed)
    return {
      id: gen.id('user'),
      firstName: gen.firstName(),
      lastName: gen.lastName(),
      email: gen.email(),
      phone: gen.phone(),
      username: gen.username(),
      address: gen.address(),
    }
  },

  /**
   * Generate test product data
   */
  product(seed = 'product'): {
    id: string
    name: string
    price: number
    inStock: boolean
    description: string
    createdAt: Date
  } {
    const gen = createGenerator(seed)
    return {
      id: gen.id('prod'),
      name: gen.productName(),
      price: gen.float(9.99, 999.99),
      inStock: gen.boolean(0.8),
      description: gen.paragraph(2),
      createdAt: gen.pastDate(90),
    }
  },

  /**
   * Generate test company data
   */
  company(seed = 'company'): CompanyData {
    const gen = createGenerator(seed)
    return {
      id: gen.id('comp'),
      name: gen.companyName(),
      website: gen.url(),
      phone: gen.phone(),
      address: gen.address(),
    }
  },
}
