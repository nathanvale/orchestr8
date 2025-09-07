interface User {
        id: number
        name: string
        email?: string
      }

      export function getUserEmail(user: User | null): string {
        // This should trigger strict null check issues
        return user.email
      }

      export function processUsers(users: User[]): string[] {
        return users.map(u => u.email)
      }