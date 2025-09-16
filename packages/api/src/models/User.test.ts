import { describe, it, expect, beforeEach } from 'vitest';
import { UserModel } from './User.js';

describe('UserModel', () => {
  beforeEach(() => {
    UserModel.clear();
  });

  describe('create', () => {
    it('should create a new user with hashed password', async() => {
      const user = await UserModel.create('test@example.com', 'Password123!', 'Test User');

      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
      expect(user.passwordHash).toBeDefined();
      expect(user.passwordHash).not.toBe('Password123!');
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('should throw error if email already exists', async() => {
      await UserModel.create('test@example.com', 'Password123!', 'Test User');

      await expect(
        UserModel.create('test@example.com', 'AnotherPass123!', 'Another User'),
      ).rejects.toThrow('User with this email already exists');
    });
  });

  describe('findById', () => {
    it('should find user by id', async() => {
      const createdUser = await UserModel.create('test@example.com', 'Password123!', 'Test User');
      const foundUser = await UserModel.findById(createdUser.id);

      expect(foundUser).toEqual(createdUser);
    });

    it('should return null for non-existent id', async() => {
      const user = await UserModel.findById('non-existent-id');
      expect(user).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async() => {
      const createdUser = await UserModel.create('test@example.com', 'Password123!', 'Test User');
      const foundUser = await UserModel.findByEmail('test@example.com');

      expect(foundUser).toEqual(createdUser);
    });

    it('should return null for non-existent email', async() => {
      const user = await UserModel.findByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async() => {
      const user = await UserModel.create('test@example.com', 'Password123!', 'Test User');
      const isValid = await UserModel.verifyPassword('Password123!', user.passwordHash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async() => {
      const user = await UserModel.create('test@example.com', 'Password123!', 'Test User');
      const isValid = await UserModel.verifyPassword('WrongPassword', user.passwordHash);

      expect(isValid).toBe(false);
    });
  });

  describe('toResponse', () => {
    it('should exclude passwordHash from response', async() => {
      const user = await UserModel.create('test@example.com', 'Password123!', 'Test User');
      const response = UserModel.toResponse(user);

      expect(response.id).toBe(user.id);
      expect(response.email).toBe(user.email);
      expect(response.name).toBe(user.name);
      expect(response.createdAt).toBe(user.createdAt);
      expect('passwordHash' in response).toBe(false);
    });
  });
});
