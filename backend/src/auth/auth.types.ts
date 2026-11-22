export interface AuthenticatedUser {
  id: string;
  sessionId: string;
  clinicId?: string;
  roles: string[];
  permissions: string[];
  mfaVerified: boolean;
}

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  cid?: string;
  roles: string[];
  permissions: string[];
  mfa: boolean;
  exp: number;
  iat: number;
}
