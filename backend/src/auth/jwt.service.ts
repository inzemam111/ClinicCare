import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type { AccessTokenClaims } from './auth.types';
const encode = (value: string) => Buffer.from(value).toString('base64url');
const decode = (value: string) => Buffer.from(value, 'base64url').toString('utf8');
@Injectable()
export class JwtService {
  private readonly secret: string;
  constructor() {
    const secret =
      process.env.JWT_ACCESS_SECRET ??
      (process.env.NODE_ENV === 'production'
        ? ''
        : 'unsafe-development-secret-replace-before-deployment');
    if (secret.length < 32)
      throw new Error('JWT_ACCESS_SECRET must contain at least 32 characters');
    this.secret = secret;
  }
  sign(claims: Omit<AccessTokenClaims, 'iat' | 'exp'>, lifetimeSeconds = 900) {
    const now = Math.floor(Date.now() / 1000);
    const header = encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = encode(JSON.stringify({ ...claims, iat: now, exp: now + lifetimeSeconds }));
    const input = `${header}.${payload}`;
    return `${input}.${this.signature(input)}`;
  }
  verify(token: string): AccessTokenClaims {
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some((part) => !part))
      throw new UnauthorizedException('Invalid access token');
    const [header, payload, signature] = parts;
    let decodedHeader: { alg?: string; typ?: string };
    let claims: AccessTokenClaims;
    try {
      decodedHeader = JSON.parse(decode(header)) as { alg?: string; typ?: string };
      claims = JSON.parse(decode(payload)) as AccessTokenClaims;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
    if (decodedHeader.alg !== 'HS256' || decodedHeader.typ !== 'JWT')
      throw new UnauthorizedException('Invalid access token');
    const expected = this.signature(`${header}.${payload}`);
    if (
      expected.length !== signature.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
    )
      throw new UnauthorizedException('Invalid access token');
    if (
      typeof claims.sub !== 'string' ||
      !claims.sub ||
      typeof claims.sid !== 'string' ||
      !claims.sid ||
      typeof claims.exp !== 'number' ||
      claims.exp <= Math.floor(Date.now() / 1000) ||
      !Array.isArray(claims.roles) ||
      !Array.isArray(claims.permissions) ||
      typeof claims.mfa !== 'boolean'
    )
      throw new UnauthorizedException('Invalid or expired access token');
    return claims;
  }
  private signature(input: string) {
    return createHmac('sha256', this.secret).update(input).digest('base64url');
  }
}
