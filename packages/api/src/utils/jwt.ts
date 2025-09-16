import jwt from 'jsonwebtoken';

// JWT configuration
const JWT_SECRET = process.env['JWT_SECRET'] || 'development-secret';
const JWT_EXPIRES_IN = process.env['JWT_EXPIRES_IN'] || '24h';

export interface UserResponse {
  id: string
  email: string
  name: string
  createdAt: Date
}

export interface JwtPayload {
  userId: string
  email: string
}

export function generateToken(user: UserResponse): string {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    throw new Error('Invalid or expired token');
  }
}
