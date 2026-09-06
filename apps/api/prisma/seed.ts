/**
 * Demo data. Idempotent: re-running it updates the same accounts instead of
 * creating duplicates, so `make seed` is safe at any time.
 *
 * Stage 1 seeds accounts, companies and one pavilion. Products, 3D assets and
 * their animations are added in stage 2 once the upload pipeline exists.
 */
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/lib/password.js';

const DEMO_PASSWORD = 'sfera-demo-2026';

interface SupplierSeed {
  email: string;
  companyName: string;
  legalName: string;
  taxId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
}

const suppliers: SupplierSeed[] = [
  {
    email: 'antenna@demo.3dsfera.local',
    companyName: 'Орбита Связь',
    legalName: 'ООО «Орбита Связь»',
    taxId: '7701234567',
    status: 'APPROVED',
  },
  {
    email: 'robotics@demo.3dsfera.local',
    companyName: 'Домовой Роботикс',
    legalName: 'ООО «Домовой Роботикс»',
    taxId: '7809876543',
    status: 'APPROVED',
  },
  {
    email: 'furniture@demo.3dsfera.local',
    companyName: 'Мебель Кронос',
    legalName: 'ИП Кронов А. В.',
    taxId: '5405551234',
    status: 'PENDING',
  },
];

async function main(): Promise<void> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.3dsfera.local' },
    update: { role: 'ADMIN', passwordHash },
    create: { email: 'admin@demo.3dsfera.local', passwordHash, role: 'ADMIN', locale: 'ru' },
  });

  const buyer = await prisma.user.upsert({
    where: { email: 'buyer@demo.3dsfera.local' },
    update: { passwordHash },
    create: { email: 'buyer@demo.3dsfera.local', passwordHash, role: 'BUYER', locale: 'ru' },
  });

  let slot = 1;
  for (const entry of suppliers) {
    const user = await prisma.user.upsert({
      where: { email: entry.email },
      update: { passwordHash, role: 'SUPPLIER' },
      create: { email: entry.email, passwordHash, role: 'SUPPLIER', locale: 'ru' },
    });

    const supplier = await prisma.supplier.upsert({
      where: { userId: user.id },
      update: {
        companyName: entry.companyName,
        legalName: entry.legalName,
        taxId: entry.taxId,
        status: entry.status,
        rejectionReason: entry.rejectionReason ?? null,
      },
      create: {
        userId: user.id,
        companyName: entry.companyName,
        legalName: entry.legalName,
        taxId: entry.taxId,
        contactEmail: entry.email,
        status: entry.status,
      },
    });

    // Only approved companies get a plot in the world.
    if (entry.status === 'APPROVED') {
      await prisma.pavilion.upsert({
        where: { slot },
        update: { supplierId: supplier.id, title: entry.companyName },
        create: {
          supplierId: supplier.id,
          slot,
          title: entry.companyName,
          theme: slot % 2 === 0 ? 'DEEP_BLUE' : 'GRAPHITE',
          status: 'PUBLISHED',
          worldPosition: { x: (slot - 1) * 24, y: 0, z: 0, rotationY: 0 },
        },
      });
      slot += 1;
    }
  }

  const pavilions = await prisma.pavilion.count();
  console.log('seed complete');
  console.log(`  admin:     ${admin.email} / ${DEMO_PASSWORD}`);
  console.log(`  buyer:     ${buyer.email} / ${DEMO_PASSWORD}`);
  for (const entry of suppliers) {
    console.log(`  supplier:  ${entry.email} / ${DEMO_PASSWORD}  (${entry.status})`);
  }
  console.log(`  pavilions: ${pavilions}`);
}

main()
  .catch((error: unknown) => {
    console.error('seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
