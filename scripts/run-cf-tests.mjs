import { execSync } from 'child_process';

async function run() {
    console.log(" Starting Cloudflare Integration Tests...");
    
    // Provision
    execSync('node scripts/provision-cf.mjs', { stdio: 'inherit' });
    
    // Generate Config
    execSync('npm run generate-config', { stdio: 'inherit' });

    // Test R2 (The fix is the forward slash between bucket and key)
    console.log(" Testing R2 put/get/delete...");
    try {
        execSync('echo "test-content" | npx wrangler r2 object put reseller-app/integration-test.txt --pipe --remote', { stdio: 'inherit' });
        console.log("✅ R2 Put Successful");

        execSync('npx wrangler r2 object get reseller-app/integration-test.txt --file=integration-test-download.txt --remote', { stdio: 'inherit' });
        console.log("✅ R2 Get Successful");

        execSync('npx wrangler r2 object delete reseller-app/integration-test.txt --remote', { stdio: 'inherit' });
        console.log("✅ R2 Delete Successful");
    } catch (error) {
        console.error("❌ R2 Test Failed:", error.message);
        process.exit(1);
    }

    console.log(" All Cloudflare Integration Tests Passed!");
}
run();
