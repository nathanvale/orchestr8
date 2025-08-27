import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Simple React component to test
function TestComponent() {
  return React.createElement(
    'div',
    null,
    React.createElement('h1', null, 'Hello Vitest!'),
    React.createElement('button', { onClick: () => console.log('clicked') }, 'Click me'),
  );
}

// MSW server for API testing
const server = setupServer(
  http.get('/api/test', () => {
    return HttpResponse.json({ message: 'Hello from MSW!' });
  }),
);

describe('Vitest Integration Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up the DOM after each test
    document.body.innerHTML = '';
  });

  test('should render React components using @testing-library/react', () => {
    render(React.createElement(TestComponent));

    expect(screen.getByText('Hello Vitest!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  test('should support user interactions with @testing-library/user-event', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    render(React.createElement(TestComponent));

    const button = screen.getByRole('button', { name: 'Click me' });
    await user.click(button);

    expect(consoleSpy).toHaveBeenCalledWith('clicked');

    consoleSpy.mockRestore();
  });

  test('should work with MSW for API mocking', () => {
    // Test that we can create handlers and setup server
    expect(server).toBeDefined();

    // Test that the handler was created successfully
    const handlers = server.listHandlers();
    expect(handlers).toHaveLength(1);

    // MSW v2 doesn't expose handler.info directly
    // Just verify we have handlers registered
    expect(handlers[0]).toBeDefined();
  });

  test('should support vi.* mocking utilities', () => {
    const mockFn = vi.fn();
    const mockObj = {
      method: vi.fn().mockReturnValue('mocked value'),
    };

    mockFn('test argument');
    const result = mockObj.method();

    expect(mockFn).toHaveBeenCalledWith('test argument');
    expect(result).toBe('mocked value');
    expect(mockObj.method).toHaveBeenCalledTimes(1);
  });

  test('should support fake timers', () => {
    vi.useFakeTimers();

    const callback = vi.fn();
    setTimeout(() => callback(), 1000);

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);

    expect(callback).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  test('should have DOM environment from happy-dom', () => {
    // Test that we have DOM globals
    expect(window).toBeDefined();
    expect(document).toBeDefined();

    // Test DOM manipulation
    const div = document.createElement('div');
    div.innerHTML = '<p>Test content</p>';

    expect(div.querySelector('p')).toBeDefined();
    expect(div.querySelector('p')?.textContent).toBe('Test content');
  });
});
