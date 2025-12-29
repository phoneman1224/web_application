import { execSync } from 'child_process';

const env = process.argv.includes('--env') ? process.argv[process.argv.indexOf('--env') + 1] : 'test';
const dbName = env === 'test' ? 'reseller_app_test' : 'reseller_app';
const bucketName = env === 'test' ? 'reseller-app-test' : 'reseller-app';

async function run() {
    console.log(` Provisioning Cloudflare resources for env: ${env}`);
    try {
        console.log(`️ Checking/Creating D1 database: ${dbName}...`);
        execSync(`npx wrangler d1 create ${dbName}`, { stdio: 'inherit' });
    } catch (error) {
        if (error.message.includes("already exists")) {
            console.log(`✅ Database "${dbName}" already exists. Continuing...`);
        } else {
            console.error("❌ Fatal error during D1 provisioning:", error.message);
            process.exit(1);
        }
    }
    // Provision R2 Bucket
    try {
        console.log(`️ Checking/Creating R2 bucket: ${bucketName}...`);
        execSync(`npx wrangler r2 bucket create ${bucketName}`, { stdio: 'inherit' });
        console.log(`✅ R2 bucket "${bucketName}" created successfully.`);
    } catch (error) {
        if (error.message.includes("already exists") || error.message.includes("A bucket with this name already exists")) {
            console.log(`✅ R2 bucket "${bucketName}" already exists. Continuing...`);
        } else {
            console.error("❌ Fatal error during R2 bucket provisioning:", error.message);
            process.exit(1);
        }
    }

    console.log("✨ Provisioning complete.");
}
run();
