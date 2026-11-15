import { prisma } from './prisma.js';

try {
  await prisma.$connect();
  console.log('Database connection established');
} finally {
  await prisma.$disconnect();
}
