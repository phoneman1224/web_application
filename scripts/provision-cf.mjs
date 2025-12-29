import { execSync } from 'child_process';

const dbName = 'reseller_app';
const bucketName = 'reseller-app';

async function run() {
    console.log(' Provisioning Cloudflare production resources...');

    // Provision D1 Database
    try {
        console.log(`️ Checking/Creating D1 database: ${dbName}...`);
        const output = execSync(`npx wrangler d1 create ${dbName}`, { encoding: 'utf-8' });
        console.log(output);
        console.log(`✅ D1 database "${dbName}" created successfully.`);
    } catch (error) {
        const errorOutput = error.stderr || error.stdout || error.message;
        if (errorOutput.includes("already exists") || errorOutput.includes("A database with that name already exists")) {
            console.log(`✅ Database "${dbName}" already exists. Continuing...`);
        } else {
            console.error("❌ Fatal error during D1 provisioning:", errorOutput);
            process.exit(1);
        }
    }

    // Provision R2 Bucket
    try {
        console.log(`️ Checking/Creating R2 bucket: ${bucketName}...`);
        const output = execSync(`npx wrangler r2 bucket create ${bucketName}`, { encoding: 'utf-8' });
        console.log(output);
        console.log(`✅ R2 bucket "${bucketName}" created successfully.`);
    } catch (error) {
        const errorOutput = error.stderr || error.stdout || error.message;
        if (errorOutput.includes("already exists") || errorOutput.includes("A bucket with this name already exists")) {
            console.log(`✅ R2 bucket "${bucketName}" already exists. Continuing...`);
        } else {
            console.error("❌ Fatal error during R2 bucket provisioning:", errorOutput);
            process.exit(1);
        }
    }

    console.log("✨ Provisioning complete.");
}
run();
