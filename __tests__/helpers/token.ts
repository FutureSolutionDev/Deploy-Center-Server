/**
 * Test JWT signer — F-002.
 * Mints access tokens matching AuthService.GenerateTokens shape so integration
 * tests can authenticate via `Authorization: Bearer <token>` without going
 * through the full login flow.
 */

import jwt from 'jsonwebtoken';
import AppConfig from '@Config/AppConfig';
import type { User } from '@Models/User';

export function signAccessToken(user: User): string {
  const payload = {
    UserId: user.Id,
    Username: user.Username,
    FullName: '',
    Email: user.Email,
    Role: user.Role,
  };
  return jwt.sign(payload, AppConfig.Jwt.Secret, {
    expiresIn: AppConfig.Jwt.Expiry,
  } as jwt.SignOptions);
}

export function authHeader(user: User): { Authorization: string } {
  return { Authorization: `Bearer ${signAccessToken(user)}` };
}
