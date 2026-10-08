import { createHmac, randomBytes } from 'node:crypto';
import { hash, verify, Algorithm } from '@node-rs/argon2';
export const hashPassword = (password: string) => hash(password, { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
export const verifyPassword = (passwordHash: string, password: string) => verify(passwordHash, password);
export const randomToken = () => randomBytes(32).toString('hex');
export const tokenDigest = (token: string, secret: string) => createHmac('sha256', secret).update(token).digest('hex');
