require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const revoked = await prisma.roastdStudio.findMany({
    where: { status: 'REVOKED' },
    select: { id: true }
  });
  console.log('Revoked connectors:', revoked.length);

  // Delete roast imports linked to revoked connectors first
  for (const r of revoked) {
    const importCount = await prisma.artisanRoastImport.deleteMany({
      where: { connectorId: r.id }
    });
    if (importCount.count > 0) {
      console.log(`Deleted ${importCount.count} imports for connector ${r.id}`);
    }
  }

  // Delete revoked connectors
  const result = await prisma.roastdStudio.deleteMany({
    where: { status: 'REVOKED' }
  });
  console.log('Deleted connectors:', result.count);

  // Verify
  const remaining = await prisma.roastdStudio.findMany({
    select: { id: true, computerName: true, status: true }
  });
  console.log('Remaining:', JSON.stringify(remaining, null, 2));

  process.exit(0);
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
