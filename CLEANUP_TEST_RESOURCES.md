# Cleanup Test Environment Resources

After the code changes are deployed and verified, follow these steps to manually delete the test environment resources from Cloudflare.

## ⚠️ IMPORTANT: Run AFTER Deployment

Only delete these resources **AFTER** the updated code has been successfully deployed to production and verified to be working. This ensures you don't accidentally break the production deployment.

## Steps to Delete Test Resources

### 1. Delete D1 Database: `reseller_app_test`

```bash
npx wrangler d1 delete reseller_app_test
```

This will remove the test D1 database and all its data.

### 2. Delete R2 Bucket: `reseller-app-test`

```bash
npx wrangler r2 bucket delete reseller-app-test
```

Note: The bucket must be empty before it can be deleted. If you get an error, first list and delete all objects in the bucket:

```bash
# List objects in bucket
npx wrangler r2 object list reseller-app-test

# Delete any objects (if found)
npx wrangler r2 object delete reseller-app-test/<object-key>

# Then delete the bucket
npx wrangler r2 bucket delete reseller-app-test
```

### 3. Delete DNS Record: `test.markbrian5178.org`

You have two options:

**Option A: Via Cloudflare Dashboard**
1. Go to https://dash.cloudflare.com
2. Select your domain: `markbrian5178.org`
3. Go to DNS → Records
4. Find the AAAA record for `test.markbrian5178.org`
5. Click the three dots → Delete

**Option B: Via Cloudflare API**
```bash
# Set your credentials
ZONE_ID="798e1037a9889d177c27781988126f59"
TOKEN="L4zJPObwWdLcC2lBbc-coSTOXPDAC3S2xcMYTrl0"

# List DNS records to find the test subdomain record ID
curl -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=test.markbrian5178.org" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Delete the DNS record (replace RECORD_ID with the ID from above)
curl -X DELETE "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/RECORD_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

### 4. Delete Cloudflare Access Policy (if configured)

1. Go to https://dash.cloudflare.com
2. Select your account
3. Go to Zero Trust → Access → Applications
4. Find the application for `test.markbrian5178.org`
5. Delete it

## Verification

After cleanup, verify the resources are deleted:

```bash
# Verify D1 database is gone
npx wrangler d1 list | grep reseller_app_test
# Should return nothing

# Verify R2 bucket is gone
npx wrangler r2 bucket list | grep reseller-app-test
# Should return nothing
```

## Expected Resource Savings

After cleanup, you'll save:
- **D1 Storage**: Whatever data was in test database
- **R2 Storage**: Whatever files were in test bucket
- **Worker Requests**: No more test worker consuming request quota

The production environment will continue to work normally.

## Troubleshooting

**Error: "Database is in use"**
- Wait a few minutes for any pending operations to complete
- Ensure no GitHub Actions workflows are running

**Error: "Bucket is not empty"**
- List all objects and delete them first (see step 2 above)

**Error: "Unauthorized"**
- Check that your CLOUDFLARE_API_TOKEN has correct permissions
- Verify you're authenticated: `npx wrangler whoami`

## Questions?

If you encounter any issues during cleanup, you can also manage these resources through the Cloudflare dashboard at https://dash.cloudflare.com
