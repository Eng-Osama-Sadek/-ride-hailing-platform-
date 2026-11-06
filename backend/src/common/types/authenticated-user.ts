import { Role } from '@prisma/client';

/** What JwtStrategy attaches to `request.user`. */
export interface AuthenticatedUser {
  id: string;
  role: Role;
}

/** Claims inside the access token. */
export interface JwtPayload {
  sub: string;
  role: Role;
}
