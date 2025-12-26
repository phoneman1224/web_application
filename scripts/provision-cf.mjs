
import { execSync } from 'child_process';

const env = process.argv.includes('--env') ? process.argv[process.argv.indexOf('--env') + 1] : 'test';
const dbName = env === 'test' ? 'reseller_app_test' : 'reseller_app';

function run() {
    console.log(` Provisioning Cloudflare resources for env: ${env}`);
    try {
        console.log(`️ Checking/Creating D1 database: ${dbName}...`);
        execSync(`npx wrangler d1 create ${dbName}`, { stdio: 'inherit' });
    } catch (error) {
        // If stderr contains "already exists", we treat it as a success
        if (error.message.includes("already exists")) {
            console.log(`✅ Database "${dbName}" already exists. Proceeding...`);
        } else {
            console.error("❌ Unexpected error during provisioning:");
            throw error;
        }
    }
    console.log("✨ Provisioning step handled successfully.");
}

run();
