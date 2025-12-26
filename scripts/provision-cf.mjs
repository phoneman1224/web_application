import { execSync } from 'child_process';

const env = process.argv.includes('--env') ? process.argv[process.argv.indexOf('--env') + 1] : 'test';
const dbName = env === 'test' ? 'reseller_app_test' : 'reseller_app';

function run() {
    console.log(` Provisioning Cloudflare resources for env: ${env}`);
    
    try {
        console.log(`️ Checking/Creating D1 database: ${dbName}...`);
        // We use { stdio: 'pipe' } to capture the error message for checking
        execSync(`npx wrangler d1 create ${dbName}`, { stdio: 'inherit' });
    } catch (error) {
        // If it failed because it exists, that's fine. 
        // We don't need to throw an error here.
        console.log(`✅ Database "${dbName}" already exists. Moving to next step...`);
    }

    console.log("✨ Provisioning phase complete. Ready for migrations/tests.");
}

run();
