import { describe, it, expect, beforeEach } from 'vitest';
import { generateToken, verifyToken } from './jwt.js';
import type { UserResponse } from '../types/user.js';

describe('JWT utilities', () => {
  const mockUser: UserResponse = {
    id: 'test-id',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date(),
  };

  beforeEach(() => {
    // Set test environment
    process.env['JWT_SECRET'] = 'test-secret-key';
    process.env['JWT_EXPIRES_IN'] = '24h';
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken(mockUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });

    it('should include user data in token payload', () => {
      const token = generateToken(mockUser);
      const decoded = verifyToken(token);

      expect(decoded).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
      });
    });

    it('should set correct expiration time', () => {
      const token = generateToken(mockUser);
      const decoded = verifyToken(token) as unknown as UserResponse & { exp: number; iat: number };

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp - decoded.iat).toBe(24 * 60 * 60); // 24 hours in seconds
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const token = generateToken(mockUser);
      const decoded = verifyToken(token);

      expect(decoded).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
      });
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => verifyToken(invalidToken)).toThrow();
    });

    it('should throw error for malformed token', () => {
      const malformedToken = 'not-a-jwt-token';

      expect(() => verifyToken(malformedToken)).toThrow();
    });
  });
});
