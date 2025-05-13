import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, pool } from '../server/db';

// Run migrations
async function main() {
  console.log('Running migrations...');
  
  // Create all tables in schema.ts
  await migrate(db, {
    migrationsFolder: './migrations',
    migrationsTable: 'drizzle_migrations',
    // Create migrations folder if it doesn't exist
    createMigrationsTable: true
  });
  
  console.log('Migrations complete!');
  await pool.end();
}

main().catch(e => {
  console.error('Migration failed:');
  console.error(e);
  process.exit(1);
});