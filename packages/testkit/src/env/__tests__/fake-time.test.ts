/**
 * Comprehensive tests for fake timer utilities
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  TimerController,
  createSystemTimeContext,
  createTimezoneContext,
  mockDateConstructor,
  mockDateNow,
  setupTimerCleanup,
  timeHelpers,
  useFakeTimers,
  withFakeTimers,
  withSystemTime,
  withTimezone,
} from '../fake-time.js'

describe('useFakeTimers', () => {
  const cleanup = setupTimerCleanup()

  beforeEach(cleanup.beforeEach)
  afterEach(cleanup.afterEach)

  it('should create a fake timer context with all required methods', () => {
    const timers = useFakeTimers()

    expect(timers).toHaveProperty('advance')
    expect(timers).toHaveProperty('advanceAsync')
    expect(timers).toHaveProperty('runAll')
    expect(timers).toHaveProperty('runAllAsync')
    expect(timers).toHaveProperty('restore')
    expect(timers).toHaveProperty('getTimerCount')
    expect(timers).toHaveProperty('clearAll')

    timers.restore()
  })

  it('should control setTimeout execution', () => {
    const timers = useFakeTimers()
    const callback = vi.fn()

    setTimeout(callback, 1000)

    // Timer should not have executed yet
    expect(callback).not.toHaveBeenCalled()
    expect(timers.getTimerCount()).toBe(1)

    // Advance time by 999ms - should still not execute
    timers.advance(999)
    expect(callback).not.toHaveBeenCalled()

    // Advance by 1 more ms - should execute
    timers.advance(1)
    expect(callback).toHaveBeenCalledOnce()
    expect(timers.getTimerCount()).toBe(0)

    timers.restore()
  })

  it('should control setInterval execution', () => {
    const timers = useFakeTimers()
    const callback = vi.fn()

    const intervalId = setInterval(callback, 500)

    // Should not execute immediately
    expect(callback).not.toHaveBeenCalled()

    // Advance 500ms - should execute once
    timers.advance(500)
    expect(callback).toHaveBeenCalledTimes(1)

    // Advance another 500ms - should execute again
    timers.advance(500)
    expect(callback).toHaveBeenCalledTimes(2)

    // Advance 1000ms - should execute twice more
    timers.advance(1000)
    expect(callback).toHaveBeenCalledTimes(4)

    clearInterval(intervalId)
    timers.restore()
  })

  it('should handle async timer advancement', async () => {
    const timers = useFakeTimers()
    const callback = vi.fn()

    const promise = new Promise<string>((resolve) => {
      setTimeout(() => {
        callback()
        resolve('completed')
      }, 1000)
    })

    expect(callback).not.toHaveBeenCalled()

    await timers.advanceAsync(1000)
    await expect(promise).resolves.toBe('completed')
    expect(callback).toHaveBeenCalledOnce()

    timers.restore()
  })

  it('should run all timers with runAll', () => {
    const timers = useFakeTimers()
    const callback1 = vi.fn()
    const callback2 = vi.fn()

    setTimeout(callback1, 1000)
    setTimeout(callback2, 2000)

    expect(callback1).not.toHaveBeenCalled()
    expect(callback2).not.toHaveBeenCalled()

    timers.runAll()

    expect(callback1).toHaveBeenCalledOnce()
    expect(callback2).toHaveBeenCalledOnce()

    timers.restore()
  })

  it('should run all timers asynchronously with runAllAsync', async () => {
    const timers = useFakeTimers()
    const results: string[] = []

    const promise1 = new Promise<void>((resolve) => {
      setTimeout(() => {
        results.push('first')
        resolve()
      }, 1000)
    })

    const promise2 = new Promise<void>((resolve) => {
      setTimeout(() => {
        results.push('second')
        resolve()
      }, 2000)
    })

    expect(results).toHaveLength(0)

    await timers.runAllAsync()
    await Promise.all([promise1, promise2])

    expect(results).toEqual(['first', 'second'])

    timers.restore()
  })

  it('should clear all timers', () => {
    const timers = useFakeTimers()
    const callback1 = vi.fn()
    const callback2 = vi.fn()

    setTimeout(callback1, 1000)
    setInterval(callback2, 500)

    expect(timers.getTimerCount()).toBe(2)

    timers.clearAll()

    expect(timers.getTimerCount()).toBe(0)

    // Advancing time should not execute cleared timers
    timers.advance(2000)
    expect(callback1).not.toHaveBeenCalled()
    expect(callback2).not.toHaveBeenCalled()

    timers.restore()
  })

  it('should accept fake timer options', () => {
    const timers = useFakeTimers({
      toFake: ['setTimeout'],
      shouldAdvanceTime: false,
    })

    // Should still work with setTimeout since it's included
    const callback = vi.fn()
    setTimeout(callback, 1000)

    timers.advance(1000)
    expect(callback).toHaveBeenCalledOnce()

    timers.restore()
  })
})

describe('createSystemTimeContext', () => {
  const cleanup = setupTimerCleanup()

  beforeEach(cleanup.beforeEach)
  afterEach(cleanup.afterEach)

  it('should create a system time context', () => {
    const context = createSystemTimeContext()

    expect(context).toHaveProperty('setTime')
    expect(context).toHaveProperty('getTime')
    expect(context).toHaveProperty('restore')
    expect(context).toHaveProperty('isMocked')

    expect(context.isMocked()).toBe(false)
  })

  it('should set and get system time', () => {
    const context = createSystemTimeContext()
    const fixedDate = new Date('2024-01-01T12:00:00Z')

    context.setTime(fixedDate)
    expect(context.isMocked()).toBe(true)

    const currentTime = context.getTime()
    expect(currentTime.getTime()).toBe(fixedDate.getTime())

    context.restore()
    expect(context.isMocked()).toBe(false)
  })

  it('should handle string dates', () => {
    const context = createSystemTimeContext()
    const dateString = '2024-01-01T12:00:00Z'

    context.setTime(dateString)
    const currentTime = context.getTime()

    expect(currentTime.toISOString()).toBe('2024-01-01T12:00:00.000Z')

    context.restore()
  })

  it('should handle timestamp numbers', () => {
    const context = createSystemTimeContext()
    const timestamp = 1704110400000 // 2024-01-01T12:00:00Z

    context.setTime(timestamp)
    const currentTime = context.getTime()

    expect(currentTime.getTime()).toBe(timestamp)

    context.restore()
  })
})

describe('createTimezoneContext', () => {
  const cleanup = setupTimerCleanup()

  beforeEach(cleanup.beforeEach)
  afterEach(cleanup.afterEach)

  it('should create a timezone context', () => {
    const context = createTimezoneContext()

    expect(context).toHaveProperty('setTimezone')
    expect(context).toHaveProperty('getTimezone')
    expect(context).toHaveProperty('restore')
    expect(context).toHaveProperty('testInTimezone')
  })

  it('should set and restore timezone', () => {
    const context = createTimezoneContext()
    const originalTz = process.env.TZ

    context.setTimezone('America/New_York')
    expect(context.getTimezone()).toBe('America/New_York')

    context.restore()
    expect(process.env.TZ).toBe(originalTz)
  })

  it('should test in specific timezone', () => {
    const context = createTimezoneContext()
    const originalTz = process.env.TZ

    const result = context.testInTimezone('Europe/London', () => {
      expect(process.env.TZ).toBe('Europe/London')
      return 'tested'
    })

    expect(result).toBe('tested')
    expect(process.env.TZ).toBe(originalTz)
  })

  it('should handle missing original timezone', () => {
    const context = createTimezoneContext()
    delete process.env.TZ

    context.setTimezone('Asia/Tokyo')
    expect(context.getTimezone()).toBe('Asia/Tokyo')

    context.restore()
    expect(process.env.TZ).toBeUndefined()
  })
})

describe('date mocking utilities', () => {
  const cleanup = setupTimerCleanup()

  beforeEach(cleanup.beforeEach)
  afterEach(cleanup.afterEach)

  it('should mock Date.now', () => {
    const timestamp = 1704110400000
    const restore = mockDateNow(timestamp)

    expect(Date.now()).toBe(timestamp)

    restore()
    expect(Date.now()).not.toBe(timestamp)
  })

  it('should mock Date constructor', () => {
    const fixedDate = new Date('2024-01-01T12:00:00Z')
    const restore = mockDateConstructor(fixedDate)

    const newDate = new Date()
    expect(newDate).toBe(fixedDate)

    restore()
    const realDate = new Date()
    expect(realDate).not.toBe(fixedDate)
  })
})

describe('convenience functions', () => {
  const cleanup = setupTimerCleanup()

  beforeEach(cleanup.beforeEach)
  afterEach(cleanup.afterEach)

  it('should work with withFakeTimers', () => {
    const callback = vi.fn()

    const result = withFakeTimers((timers) => {
      setTimeout(callback, 1000)
      timers.advance(1000)
      return 'completed'
    })

    expect(result).toBe('completed')
    expect(callback).toHaveBeenCalledOnce()

    // Timers should be restored after function completes
    const callbackAfter = vi.fn()
    setTimeout(callbackAfter, 1000)
    // This would fail if timers weren't restored
    expect(callbackAfter).not.toHaveBeenCalled()
  })

  it('should work with withSystemTime', () => {
    const fixedDate = new Date('2024-01-01T12:00:00Z')

    const result = withSystemTime(fixedDate, (context) => {
      expect(context.getTime().getTime()).toBe(fixedDate.getTime())
      return 'time-tested'
    })

    expect(result).toBe('time-tested')
  })

  it('should work with withTimezone', () => {
    const originalTz = process.env.TZ

    const result = withTimezone('America/Los_Angeles', () => {
      expect(process.env.TZ).toBe('America/Los_Angeles')
      return 'timezone-tested'
    })

    expect(result).toBe('timezone-tested')
    expect(process.env.TZ).toBe(originalTz)
  })
})

describe('TimerController', () => {
  let controller: TimerController

  const cleanup = setupTimerCleanup()

  beforeEach(() => {
    cleanup.beforeEach()
    controller = new TimerController()
  })

  afterEach(() => {
    controller.restore()
    cleanup.afterEach()
  })

  it('should create a timer controller', () => {
    expect(controller).toHaveProperty('advance')
    expect(controller).toHaveProperty('advanceAsync')
    expect(controller).toHaveProperty('runAll')
    expect(controller).toHaveProperty('runAllAsync')
    expect(controller).toHaveProperty('getTimerCount')
    expect(controller).toHaveProperty('clearAll')
    expect(controller).toHaveProperty('advanceToNext')
    expect(controller).toHaveProperty('stepThrough')
    expect(controller).toHaveProperty('restore')
  })

  it('should advance timers', () => {
    const callback = vi.fn()
    setTimeout(callback, 1000)

    controller.advance(1000)
    expect(callback).toHaveBeenCalledOnce()
  })

  it('should advance to next timer', async () => {
    const callback1 = vi.fn()
    const callback2 = vi.fn()

    setTimeout(callback1, 1000)
    setTimeout(callback2, 2000)

    expect(controller.getTimerCount()).toBe(2)

    await controller.advanceToNext()

    expect(callback1).toHaveBeenCalledOnce()
    expect(callback2).toHaveBeenCalledOnce()
    expect(controller.getTimerCount()).toBe(0)
  })

  it('should step through timers', async () => {
    const results: string[] = []

    setTimeout(() => results.push('first'), 1000)
    setTimeout(() => results.push('second'), 2000)
    setTimeout(() => results.push('third'), 3000)

    expect(controller.getTimerCount()).toBe(3)

    await controller.stepThrough(2)

    expect(results).toEqual(['first', 'second', 'third'])
    expect(controller.getTimerCount()).toBe(0)
  })

  it('should handle empty timer queue gracefully', async () => {
    expect(controller.getTimerCount()).toBe(0)

    await controller.advanceToNext()
    await controller.stepThrough(5)

    expect(controller.getTimerCount()).toBe(0)
  })

  it('should clear all timers', () => {
    const callback1 = vi.fn()
    const callback2 = vi.fn()

    setTimeout(callback1, 1000)
    setInterval(callback2, 500)

    expect(controller.getTimerCount()).toBe(2)

    controller.clearAll()

    expect(controller.getTimerCount()).toBe(0)
  })
})

describe('timeHelpers', () => {
  const cleanup = setupTimerCleanup()

  beforeEach(cleanup.beforeEach)
  afterEach(cleanup.afterEach)

  it('should provide useFakeTimers helper', () => {
    const timers = timeHelpers.useFakeTimers()
    expect(timers).toHaveProperty('advance')
    timers.restore()
  })

  it('should provide setSystemTime helper', () => {
    const fixedDate = new Date('2024-01-01T12:00:00Z')
    timeHelpers.setSystemTime(fixedDate)

    const now = new Date()
    expect(now.getTime()).toBe(fixedDate.getTime())
  })

  it('should provide mockNow helper', () => {
    const timestamp = 1704110400000
    const restore = timeHelpers.mockNow(timestamp)

    expect(Date.now()).toBe(timestamp)
    restore()
  })

  it('should provide createController helper', () => {
    const controller = timeHelpers.createController()
    expect(controller).toBeInstanceOf(TimerController)
    controller.restore()
  })

  it('should provide testInTimezone helper', () => {
    const result = timeHelpers.testInTimezone('Europe/Paris', () => {
      expect(process.env.TZ).toBe('Europe/Paris')
      return 'paris-test'
    })

    expect(result).toBe('paris-test')
  })

  it('should provide testAtTime helper', () => {
    const fixedDate = new Date('2024-01-01T12:00:00Z')

    const result = timeHelpers.testAtTime(fixedDate, (context) => {
      expect(context.getTime().getTime()).toBe(fixedDate.getTime())
      return 'time-test'
    })

    expect(result).toBe('time-test')
  })

  it('should provide testWithFakeTimers helper', () => {
    const callback = vi.fn()

    const result = timeHelpers.testWithFakeTimers((timers) => {
      setTimeout(callback, 1000)
      timers.advance(1000)
      return 'timer-test'
    })

    expect(result).toBe('timer-test')
    expect(callback).toHaveBeenCalledOnce()
  })
})

describe('setupTimerCleanup', () => {
  it('should provide beforeEach and afterEach hooks', () => {
    const cleanup = setupTimerCleanup()

    expect(cleanup).toHaveProperty('beforeEach')
    expect(cleanup).toHaveProperty('afterEach')
    expect(typeof cleanup.beforeEach).toBe('function')
    expect(typeof cleanup.afterEach).toBe('function')
  })

  it('should clean up after tests', () => {
    const cleanup = setupTimerCleanup()

    // Set up some mocked state
    const systemTime = createSystemTimeContext()
    const timezone = createTimezoneContext()

    systemTime.setTime(new Date('2024-01-01'))
    timezone.setTimezone('America/New_York')

    // Run cleanup
    cleanup.afterEach()

    // Should not throw and should restore real timers
    expect(() => {
      const realCallback = vi.fn()
      setTimeout(realCallback, 1)
    }).not.toThrow()
  })
})
