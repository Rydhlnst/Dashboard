export type UserRole = "super_admin" | "admin" | "viewer";
export type UserStatus = "active" | "inactive";

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}
