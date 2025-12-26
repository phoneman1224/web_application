import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const DB_NAME_TEST = "reseller_app_test";
const DB_NAME_PROD = "reseller_app";

console.log("️ Starting Phase 9 Repair in ~/web_application...");

// 1. Fix Git Status & .gitignore
console.log(" Sanitizing Git index...");
const gitignorePath = '.gitignore';
let gitignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';

if (!gitignoreContent.includes('node_modules')) {
    fs.appendFileSync(gitignorePath, '\nnode_modules/\n.wrangler/\n.dev.vars\n');
}

try {
    // Remove node_modules from git index if they were accidentally added
    execSync('git rm -r --cached node_modules/ --ignore-unmatch', { stdio: 'ignore' });
    console.log("✅ node_modules untracked from Git.");
} catch (e) {
    console.log("ℹ️ node_modules was not being tracked. Skipping untrack.");
}

// 2. Overwrite provision-cf.mjs with hardened, idempotent logic
const hardenedScript = `
import { execSync } from 'child_process';

const env = process.argv.includes('--env') ? process.argv[process.argv.indexOf('--env') + 1] : 'test';
const dbName = env === 'test' ? '${DB_NAME_TEST}' : '${DB_NAME_PROD}';

function run() {
    console.log(\` Provisioning Cloudflare resources for env: \${env}\`);
    try {
        console.log(\`️ Checking/Creating D1 database: \${dbName}...\`);
        execSync(\`npx wrangler d1 create \${dbName}\`, { stdio: 'inherit' });
    } catch (error) {
        // If stderr contains "already exists", we treat it as a success
        if (error.message.includes("already exists")) {
            console.log(\`✅ Database "\${dbName}" already exists. Proceeding...\`);
        } else {
            console.error("❌ Unexpected error during provisioning:");
            throw error;
        }
    }
    console.log("✨ Provisioning step handled successfully.");
}

run();
`;

fs.writeFileSync('scripts/provision-cf.mjs', hardenedScript);
console.log("✅ scripts/provision-cf.mjs has been hardened.");
console.log("\n REPAIR COMPLETE. Run 'npm run test:cf' to verify.");
