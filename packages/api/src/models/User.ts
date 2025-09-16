import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';

interface User {
  id: string
  email: string
  passwordHash: string
  name: string
  createdAt: Date
}

interface UserResponse {
  id: string
  email: string
  name: string
  createdAt: Date
}

// In-memory user storage map
const users: Map<string, User> = new Map();

export class UserModel {
  static async create(email: string, password: string, name: string): Promise<User> {
    const existingUser = Array.from(users.values()).find((u) => u.email === email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const saltRounds = parseInt(process.env['BCRYPT_ROUNDS'] || '10', 10);
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user: User = {
      id: uuidv4(),
      email,
      passwordHash,
      name,
      createdAt: new Date(),
    };

    users.set(user.id, user);
    return user;
  }

  static async findById(id: string): Promise<User | null> {
    return users.get(id) || null;
  }

  static async findByEmail(email: string): Promise<User | null> {
    return Array.from(users.values()).find((u) => u.email === email) || null;
  }

  static async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }

  static toResponse(user: User): UserResponse {
    const { passwordHash: _passwordHash, ...userResponse } = user;
    return userResponse;
  }

  static clear(): void {
    users.clear();
  }

  static getAll(): User[] {
    return Array.from(users.values());
  }
}
