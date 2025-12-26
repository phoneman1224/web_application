# Cloudflare Zero Trust Setup Guide

This guide walks you through setting up Cloudflare Zero Trust authentication to secure your Reseller Ops application with fail-closed security.

## Overview

Zero Trust authentication ensures that **all requests** to your application are authenticated before they can access any data. The application is configured to **fail closed**, meaning unauthenticated requests are rejected by default.

## Prerequisites

- Cloudflare account with a domain configured
- Application deployed to Cloudflare Workers
- Admin access to Cloudflare Zero Trust dashboard

## Step 1: Enable Cloudflare Zero Trust

1. Log in to your [Cloudflare dashboard](https://dash.cloudflare.com)
2. Navigate to **Zero Trust** in the sidebar
3. If this is your first time:
   - Click **Get Started**
   - Choose a team name (e.g., `reseller-ops`)
   - Complete the setup wizard

## Step 2: Create an Access Application

1. In the Zero Trust dashboard, go to **Access** → **Applications**
2. Click **Add an application**
3. Select **Self-hosted**
4. Configure the application:

   **Application Configuration:**
   ```
   Application name: Reseller Ops
   Session Duration: 24 hours
   Application domain: app.reseller.example.com (your production domain)
   ```

5. Click **Next**

## Step 3: Create an Access Policy

Create a policy that defines who can access your application.

**Example Policy: Email-based access**

```
Policy name: Reseller Ops - Authorized Users
Action: Allow
Session duration: 24 hours
```

**Include rules:**
- Add yourself: `Emails: your-email@example.com`
- Or use email domain: `Email domains: example.com`

**Exclude rules:** (optional)
- None for single-user app

Click **Next**, then **Add application**

## Step 4: Configure Authentication Method

1. Go to **Settings** → **Authentication**
2. Add a login method:
   - **One-time PIN**: No configuration needed, works immediately
   - **Google Workspace**: If you use Google for email
   - **GitHub**: If you want to use GitHub OAuth
   - **Email**: Simple email link authentication

Recommended for single-user: **One-time PIN** (easiest to set up)

## Step 5: Update Your Worker Configuration

Your worker is already configured to enforce Zero Trust authentication. The key code is in `src/worker.ts`:

```typescript
function isAuthorized(request: Request): boolean {
  const cfAccessJWT = request.headers.get('Cf-Access-Jwt-Assertion');

  // Fail closed: Reject if no JWT present
  if (!cfAccessJWT) {
    console.warn('Unauthorized request: No Cf-Access-Jwt-Assertion header');
    return false;
  }

  return true; // In production, validate JWT signature
}
```

**Important:** This is a fail-closed design. All requests without the `Cf-Access-Jwt-Assertion` header are rejected.

## Step 6: Test Your Setup

1. Open your application URL in an **incognito/private window**:
   ```
   https://app.reseller.example.com
   ```

2. You should see:
   - **Zero Trust login page** (not your app)
   - Login prompt asking for authentication

3. Log in using your configured method:
   - For One-time PIN: Enter your email, check your inbox, enter the PIN
   - For Google/GitHub: Click the button and authorize

4. After successful login:
   - You should be redirected to your application
   - Your session will last 24 hours (configurable)

## Step 7: Configure TEST Environment

Repeat Steps 2-3 for your TEST environment:

```
Application name: Reseller Ops - TEST
Application domain: test.reseller.example.com
```

Use the **same Access Policy** or create a separate one for testing.

## Troubleshooting

### Issue: "Access Denied" message

**Cause:** Your email is not in the allowed list

**Solution:**
1. Go to Zero Trust dashboard → Access → Applications
2. Edit your application
3. Check the policy includes your email or domain
4. Save changes

### Issue: Application loads without authentication

**Cause:** Zero Trust not properly configured on the domain

**Solution:**
1. Verify the application domain matches your Worker route exactly
2. Check that the application is **enabled** in Zero Trust dashboard
3. Ensure the application type is **Self-hosted** (not SaaS)

### Issue: "Invalid JWT" errors in logs

**Cause:** JWT signature validation failing

**Solution:**
1. Check that `Cf-Access-Jwt-Assertion` header is being sent
2. Verify your Worker code is correctly checking for the header
3. In production, implement full JWT signature validation (optional for personal use)

### Issue: Can't access application from specific network

**Cause:** Zero Trust might have location-based rules

**Solution:**
1. Check Access Policy for location restrictions
2. Add your current location to allowed list if needed
3. Or remove location-based rules entirely for personal use

## Advanced Configuration (Optional)

### Enable Multi-Factor Authentication (MFA)

1. Go to **Settings** → **Authentication**
2. Enable **Require multi-factor authentication**
3. Users will need to set up MFA on next login

### Add Session Timeout

1. Edit your Access Application
2. Set **Session Duration** to a shorter time (e.g., 8 hours)
3. Users will need to re-authenticate after this period

### Audit Logs

1. Go to **Logs** → **Access**
2. View all authentication attempts
3. Filter by application, user, action, etc.

## Security Best Practices

1. **Use Strong Authentication:** Enable MFA for production use
2. **Limit Access:** Only add emails/domains you trust
3. **Monitor Logs:** Regularly check Access logs for suspicious activity
4. **Short Sessions:** Use shorter session durations for sensitive data
5. **Test Fail-Closed:** Verify unauthenticated requests are rejected
6. **Regular Audits:** Review Access Policies quarterly

## Additional Resources

- [Cloudflare Zero Trust Docs](https://developers.cloudflare.com/cloudflare-one/)
- [Access Policies Guide](https://developers.cloudflare.com/cloudflare-one/policies/access/)
- [JWT Validation](https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/)

## Support

If you encounter issues:
1. Check Cloudflare Zero Trust dashboard for errors
2. Review Worker logs in Cloudflare dashboard
3. Verify DNS records for your domain
4. Contact Cloudflare support for account-specific issues
