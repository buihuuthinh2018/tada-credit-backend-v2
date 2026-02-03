import { user_status, gender } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  permissions: string[];
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  phone: string;
  fullname: string;
  gender: gender;
  status: user_status;
  permissions: string[];
  roles: string[];
}

export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}
