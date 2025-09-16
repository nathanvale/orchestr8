export interface User {
  id: string
  email: string
  passwordHash: string
  name: string
  createdAt: Date
}

export interface UserResponse {
  id: string
  email: string
  name: string
  createdAt: Date
}

export interface RegisterRequest {
  email: string
  password: string
  name: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  token: string
  user: UserResponse
}
