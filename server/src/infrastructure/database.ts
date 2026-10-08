import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
export function createDatabase(url: string) { return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }); }
