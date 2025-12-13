import { execSync } from 'child_process';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

console.log('DATABASE_URL found, running drizzle-kit push...');
execSync('npx drizzle-kit push', { 
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: databaseUrl }
});
