/**
 * Test data factories for creating deterministic test objects
 * Provides factory patterns and builders for complex test data
 */

import { DeterministicGenerator } from './generators.js'

/**
 * Factory interface for creating test data
 */
export interface Factory<T> {
  /** Build a single instance */
  build(overrides?: Partial<T>): T
  /** Build multiple instances */
  buildMany(count: number, overrides?: Partial<T>): T[]
  /** Build multiple instances with individual overrides */
  buildList(overrides: Array<Partial<T>>): T[]
  /** Reset the factory to initial state */
  reset(newSeed?: number | string): void
  /** Get the underlying generator */
  getGenerator(): DeterministicGenerator
}

/**
 * Factory options
 */
export interface FactoryOptions {
  /** Seed for deterministic generation */
  seed?: number | string
  /** Whether to auto-increment IDs */
  autoIncrementId?: boolean
}

/**
 * Create a factory for generating test data
 */
export function createFactory<T>(
  generator: (gen: DeterministicGenerator, index: number) => T,
  options: FactoryOptions = {},
): Factory<T> {
  const { seed = 12345, autoIncrementId = true } = options
  const gen = new DeterministicGenerator(seed)
  let index = 0

  return {
    build(overrides?: Partial<T>): T {
      const base = generator(gen, autoIncrementId ? index++ : index)
      return overrides ? { ...base, ...overrides } : base
    },

    buildMany(count: number, overrides?: Partial<T>): T[] {
      return Array.from({ length: count }, () => this.build(overrides))
    },

    buildList(overrides: Array<Partial<T>>): T[] {
      return overrides.map((override) => this.build(override))
    },

    reset(newSeed?: number | string): void {
      gen.reset(newSeed)
      index = 0
    },

    getGenerator(): DeterministicGenerator {
      return gen
    },
  }
}

/**
 * Builder pattern for complex object construction
 */
export class Builder<T> {
  private data: Partial<T> = {}
  private generator: DeterministicGenerator

  constructor(seed: number | string = 12345) {
    this.generator = new DeterministicGenerator(seed)
  }

  /**
   * Set a property value
   */
  with<K extends keyof T>(key: K, value: T[K]): this {
    this.data[key] = value
    return this
  }

  /**
   * Set multiple properties at once
   */
  withMany(props: Partial<T>): this {
    Object.assign(this.data, props)
    return this
  }

  /**
   * Generate a property value using the generator
   */
  withGenerated<K extends keyof T>(key: K, generator: (gen: DeterministicGenerator) => T[K]): this {
    this.data[key] = generator(this.generator)
    return this
  }

  /**
   * Build the final object
   */
  build(defaults: T): T {
    return { ...defaults, ...this.data }
  }

  /**
   * Reset the builder
   */
  reset(): this {
    this.data = {}
    return this
  }

  /**
   * Get the underlying generator
   */
  getGenerator(): DeterministicGenerator {
    return this.generator
  }
}

/**
 * Sequence generator for incremental values
 */
export class Sequence {
  private counters: Map<string, number> = new Map()

  /**
   * Get the next value in a sequence
   */
  next(key = 'default', start = 1): number {
    const current = this.counters.get(key) ?? start - 1
    const next = current + 1
    this.counters.set(key, next)
    return next
  }

  /**
   * Reset a sequence
   */
  reset(key = 'default'): void {
    this.counters.delete(key)
  }

  /**
   * Reset all sequences
   */
  resetAll(): void {
    this.counters.clear()
  }

  /**
   * Get current value without incrementing
   */
  current(key = 'default', defaultValue = 0): number {
    return this.counters.get(key) ?? defaultValue
  }
}

/**
 * State manager for stateful factories
 */
export class FactoryState<T = Record<string, unknown>> {
  private state: T

  constructor(initialState: T) {
    this.state = { ...initialState }
  }

  /**
   * Get the current state
   */
  get(): T {
    return { ...this.state }
  }

  /**
   * Update the state
   */
  set(newState: Partial<T>): void {
    this.state = { ...this.state, ...newState }
  }

  /**
   * Reset to initial state
   */
  reset(initialState: T): void {
    this.state = { ...initialState }
  }

  /**
   * Transform state with a function
   */
  transform(fn: (state: T) => T): void {
    this.state = fn(this.state)
  }
}

/**
 * Trait system for composing factories
 */
export interface Trait<T> {
  name: string
  apply(data: T): T
}

/**
 * Create a trait
 */
export function trait<T>(name: string, apply: (data: T) => T): Trait<T> {
  return { name, apply }
}

/**
 * Factory with traits support
 */
export class TraitFactory<T> {
  private factory: Factory<T>
  private traits: Map<string, Trait<T>> = new Map()

  constructor(
    generator: (gen: DeterministicGenerator, index: number) => T,
    options: FactoryOptions = {},
  ) {
    this.factory = createFactory(generator, options)
  }

  /**
   * Register a trait
   */
  trait(traitDef: Trait<T>): this {
    this.traits.set(traitDef.name, traitDef)
    return this
  }

  /**
   * Build with traits
   */
  build(overrides?: Partial<T>, ...traitNames: string[]): T {
    let result = this.factory.build(overrides)

    for (const name of traitNames) {
      const trait = this.traits.get(name)
      if (trait) {
        result = trait.apply(result)
      }
    }

    return result
  }

  /**
   * Build many with traits
   */
  buildMany(count: number, overrides?: Partial<T>, ...traitNames: string[]): T[] {
    return Array.from({ length: count }, () => this.build(overrides, ...traitNames))
  }

  /**
   * Get the base factory
   */
  getFactory(): Factory<T> {
    return this.factory
  }
}

/**
 * Association helper for related data
 */
export class Association<T, R> {
  constructor(
    private parentFactory: Factory<T>,
    private relatedFactory: Factory<R>,
    private linkFn: (parent: T, related: R) => T,
  ) {}

  /**
   * Build with association
   */
  build(parentOverrides?: Partial<T>, relatedOverrides?: Partial<R>): T {
    const related = this.relatedFactory.build(relatedOverrides)
    const parent = this.parentFactory.build(parentOverrides)
    return this.linkFn(parent, related)
  }

  /**
   * Build many with associations
   */
  buildMany(count: number, parentOverrides?: Partial<T>, relatedOverrides?: Partial<R>): T[] {
    return Array.from({ length: count }, () => this.build(parentOverrides, relatedOverrides))
  }
}

/**
 * Lazy attribute evaluation
 */
export function lazy<T, K extends keyof T>(
  fn: (obj: Partial<T>) => T[K],
): (obj: Partial<T>) => T[K] {
  return fn
}

/**
 * Dependent attribute helper
 */
export function dependent<T, K extends keyof T>(
  deps: Array<keyof T>,
  fn: (...values: Array<T[keyof T]>) => T[K],
): (obj: Partial<T>) => T[K] {
  return (obj: Partial<T>) => {
    const values = deps.map((dep) => obj[dep]) as Array<T[keyof T]>
    return fn(...values)
  }
}

/**
 * Pre-built factories for common types
 */
export const factories = {
  /**
   * User factory
   */
  user: createFactory((gen) => ({
    id: gen.id('user'),
    firstName: gen.firstName(),
    lastName: gen.lastName(),
    email: gen.email(),
    phone: gen.phone(),
    username: gen.username(),
    createdAt: gen.pastDate(30),
    updatedAt: gen.pastDate(7),
    active: gen.boolean(0.9),
  })),

  /**
   * Post factory
   */
  post: createFactory((gen) => ({
    id: gen.id('post'),
    title: gen.sentence(5),
    content: gen.paragraph(3),
    authorId: gen.id('user'),
    published: gen.boolean(0.7),
    views: gen.integer(0, 10000),
    likes: gen.integer(0, 1000),
    createdAt: gen.pastDate(30),
    updatedAt: gen.pastDate(7),
  })),

  /**
   * Comment factory
   */
  comment: createFactory((gen) => ({
    id: gen.id('comment'),
    postId: gen.id('post'),
    authorId: gen.id('user'),
    content: gen.paragraph(1),
    likes: gen.integer(0, 100),
    createdAt: gen.pastDate(7),
  })),

  /**
   * Product factory
   */
  product: createFactory((gen) => ({
    id: gen.id('product'),
    name: gen.productName(),
    description: gen.paragraph(2),
    price: gen.float(9.99, 999.99, 2),
    stock: gen.integer(0, 1000),
    category: gen.arrayElement(['Electronics', 'Clothing', 'Books', 'Home', 'Sports']),
    sku: `SKU-${gen.integer(10000, 99999)}`,
    inStock: gen.boolean(0.8),
    createdAt: gen.pastDate(90),
  })),

  /**
   * Order factory
   */
  order: createFactory((gen) => ({
    id: gen.id('order'),
    userId: gen.id('user'),
    items: Array.from({ length: gen.integer(1, 5) }, () => ({
      productId: gen.id('product'),
      quantity: gen.integer(1, 10),
      price: gen.float(9.99, 199.99, 2),
    })),
    total: gen.float(19.99, 999.99, 2),
    status: gen.arrayElement(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
    shippingAddress: gen.address(),
    createdAt: gen.pastDate(30),
  })),

  /**
   * Company factory
   */
  company: createFactory((gen) => ({
    id: gen.id('company'),
    name: gen.companyName(),
    website: gen.url(),
    email: gen.email({ domain: 'company.com' }),
    phone: gen.phone(),
    address: gen.address(),
    employees: gen.integer(10, 10000),
    founded: gen.pastDate(365 * 20),
  })),
}

/**
 * Factory registry for managing multiple factories
 */
export class FactoryRegistry {
  private factories: Map<string, Factory<unknown>> = new Map()
  private globalSeed: number | string = 12345

  /**
   * Register a factory
   */
  register<T>(name: string, factory: Factory<T>): this {
    this.factories.set(name, factory)
    return this
  }

  /**
   * Get a factory
   */
  get<T>(name: string): Factory<T> | undefined {
    return this.factories.get(name) as Factory<T> | undefined
  }

  /**
   * Create and register a factory
   */
  define<T>(
    name: string,
    generator: (gen: DeterministicGenerator, index: number) => T,
    options?: FactoryOptions,
  ): Factory<T> {
    const factory = createFactory(generator, {
      seed: this.globalSeed,
      ...options,
    })
    this.register(name, factory)
    return factory
  }

  /**
   * Reset all factories
   */
  resetAll(newSeed?: number | string): void {
    if (newSeed !== undefined) {
      this.globalSeed = newSeed
    }
    for (const factory of this.factories.values()) {
      factory.reset(this.globalSeed)
    }
  }

  /**
   * Clear all factories
   */
  clear(): void {
    this.factories.clear()
  }
}

/**
 * Global factory registry instance
 */
export const registry = new FactoryRegistry()

/**
 * Quick factory helpers
 */
export const factory = {
  /**
   * Create a new factory
   */
  create: createFactory,

  /**
   * Create a builder
   */
  builder: <T>(seed?: number | string) => new Builder<T>(seed),

  /**
   * Create a sequence
   */
  sequence: () => new Sequence(),

  /**
   * Create a state manager
   */
  state: <T>(initialState: T) => new FactoryState(initialState),

  /**
   * Create a trait factory
   */
  withTraits: <T>(
    generator: (gen: DeterministicGenerator, index: number) => T,
    options?: FactoryOptions,
  ) => new TraitFactory(generator, options),

  /**
   * Create an association
   */
  associate: <T, R>(
    parentFactory: Factory<T>,
    relatedFactory: Factory<R>,
    linkFn: (parent: T, related: R) => T,
  ) => new Association(parentFactory, relatedFactory, linkFn),

  /**
   * Pre-built factories
   */
  ...factories,
}
