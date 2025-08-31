// Vitest custom matcher type declarations
// Placed under tests/types to be included by tsconfig root include patterns

import '@testing-library/jest-dom'
import 'vitest'
export {} // ensure this file is a module for global + module augmentation

declare global {
  // Sentinel used in vitest.setup.tsx to guard idempotent polyfill initialization
  // boolean | undefined reflects first-write wins (true once set)
  var __TEST_POLYFILLS_SETUP__: boolean | undefined
}

declare module 'vitest' {
  interface Assertion<T = any> {
    // Custom matchers from vitest.setup.tsx
    toBeWithinRange(floor: number, ceiling: number): void

    // Jest-DOM matchers for DOM testing environments
    // These extend the Vitest expect interface with jest-dom matchers
    toBeInTheDocument(): T
    toHaveAttribute(attr: string, value?: string): T
    toHaveClass(...classNames: string[]): T
    toHaveFocus(): T
    toHaveFormValues(expectedValues: Record<string, any>): T
    toHaveStyle(css: string | Record<string, any>): T
    toHaveTextContent(text: string | RegExp): T
    toHaveValue(value: string | string[] | number): T
    toBeChecked(): T
    toBeDisabled(): T
    toBeEnabled(): T
    toBeEmpty(): T
    toBeEmptyDOMElement(): T
    toBeInvalid(): T
    toBeRequired(): T
    toBeValid(): T
    toBeVisible(): T
    toContainElement(element: HTMLElement | null): T
    toContainHTML(htmlText: string): T
    toHaveAccessibleDescription(expectedAccessibleDescription?: string | RegExp): T
    toHaveAccessibleName(expectedAccessibleName?: string | RegExp): T
    toHaveDisplayValue(value: string | RegExp | (string | RegExp)[]): T
    toHaveErrorMessage(expectedErrorMessage?: string | RegExp): T
    toHaveRole(expectedRole: string): T
    toBePartiallyChecked(): T
  }

  interface AsymmetricMatchersContaining {
    // Custom matchers from vitest.setup.tsx
    toBeWithinRange(floor: number, ceiling: number): void

    // Jest-DOM matchers for asymmetric matching
    toBeInTheDocument(): any
    toHaveAttribute(attr: string, value?: string): any
    toHaveClass(...classNames: string[]): any
    toHaveFocus(): any
    toHaveFormValues(expectedValues: Record<string, any>): any
    toHaveStyle(css: string | Record<string, any>): any
    toHaveTextContent(text: string | RegExp): any
    toHaveValue(value: string | string[] | number): any
    toBeChecked(): any
    toBeDisabled(): any
    toBeEnabled(): any
    toBeEmpty(): any
    toBeEmptyDOMElement(): any
    toBeInvalid(): any
    toBeRequired(): any
    toBeValid(): any
    toBeVisible(): any
    toContainElement(element: HTMLElement | null): any
    toContainHTML(htmlText: string): any
    toHaveAccessibleDescription(expectedAccessibleDescription?: string | RegExp): any
    toHaveAccessibleName(expectedAccessibleName?: string | RegExp): any
    toHaveDisplayValue(value: string | RegExp | (string | RegExp)[]): any
    toHaveErrorMessage(expectedErrorMessage?: string | RegExp): any
    toHaveRole(expectedRole: string): any
    toBePartiallyChecked(): any
  }
}
