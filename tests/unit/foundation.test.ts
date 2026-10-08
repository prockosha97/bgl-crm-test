import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword, tokenDigest, randomToken } from '../../server/src/modules/auth/security.js';
import { readConfig } from '../../server/src/shared/config.js';
describe('foundation security', () => {
  it('uses Argon2id and rejects an incorrect password', async () => {
    const hash = await hashPassword('a-long-test-password');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, 'a-long-test-password')).toBe(true);
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
  });
  it('hashes session identifiers with the configured secret', () => {
    const token = randomToken();
    expect(token).toHaveLength(64);
    expect(tokenDigest(token, 'one')).not.toEqual(tokenDigest(token, 'two'));
    expect(tokenDigest(token, 'one')).not.toEqual(token);
  });
  it('rejects missing configuration without exposing values', () => {
    const old = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    expect(readConfig).toThrow(/SESSION_SECRET/);
    if (old) process.env.SESSION_SECRET = old;
  });
});
