import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SYNTHETIC_USERS = [
  {
    email: 'admin@redfigure.test',
    password: 'Admin2026!',
    name: 'Admin Staging',
    role: 'ADMIN' as const,
  },
  {
    email: 'client1@redfigure.test',
    password: 'Client2026!',
    name: 'Client 1',
    role: 'CUSTOMER' as const,
  },
  {
    email: 'client2@redfigure.test',
    password: 'Client2026!',
    name: 'Client 2',
    role: 'CUSTOMER' as const,
  },
  {
    email: 'affiliate1@redfigure.test',
    password: 'Affiliate2026!',
    name: 'Affiliate 1',
    role: 'CUSTOMER' as const,
  },
];

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('REFUSING to run staging seed in NODE_ENV=production');
    process.exit(1);
  }

  console.log('Seeding synthetic users...');

  for (const user of SYNTHETIC_USERS) {
    const passwordHash = await bcrypt.hash(user.password, 12);
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role },
      create: {
        email: user.email,
        password: passwordHash,
        name: user.name,
        role: user.role,
      },
    });
    console.log(`  ✓ ${user.email} (${user.role})`);
  }

  console.log(`  ✅ ${SYNTHETIC_USERS.length} users seeded`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
