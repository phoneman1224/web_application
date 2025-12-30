# Reseller Ops

**Production-ready eBay reselling business management application built on Cloudflare's free tier**

A complete, feature-rich web application for managing your eBay reselling business with inventory tracking, sales recording, expense management, AI-powered pricing & SEO, and comprehensive tax reporting.

[![Tests](https://img.shields.io/badge/tests-123%20passing-brightgreen)](./tests)
[![License](https://img.shields.io/badge/license-MIT-blue)](#license)
[![Cloudflare](https://img.shields.io/badge/cloudflare-workers-orange)](https://workers.cloudflare.com/)

---

## ✨ Features

### Core Functionality
- **Inventory Management** - Track items through complete lifecycle: Acquired → In Stock → Listed → Sold
- **Sales Recording** - Multi-item sales with platform fees, promotions, taxes, and auto-calculated profit
- **Expense Tracking** - Split expenses across inventory, operations, and other with vehicle deduction support
- **Lots & Bundles** - Group items for bundled pricing and listing
- **Pricing Drafts** - Create and manage pricing suggestions with confidence scores

### eBay Integration
- **Market Valuation** - Real-time eBay pricing from completed listings (text & photo-based)
- **Draft Listings** - Create eBay inventory items and unpublished offers (5-field forms)
- **Import Listings** - Sync active eBay listings to local database (duplicate detection)
- **Import Sales** - Auto-import eBay orders with item matching and profit calculation
- **ChatGPT Import** - Bulk import from ChatGPT CSV responses (clipboard auto-detect)
- **Dashboard Widgets** - eBay activity summary, action items, and performance metrics

### AI-Powered Features (8 AI Tools)
- **SEO Generation** - eBay-optimized titles (80 char limit), descriptions, and keywords
- **Price Suggestions** - AI-recommended pricing with min/max range and reasoning
- **Smart Categorization** - Auto-categorize items and expenses
- **Photo Analysis** - Detect item type, condition, and category from photos
- **eBay Photo Valuation** - AI-powered item detection + eBay market research (800 neurons)
- **Dashboard Insights** - Personalized business insights, warnings, and opportunities
- **Expense Splitting** - Intelligent allocation across categories
- **Description Enhancement** - Improve basic descriptions with SEO keywords

### Business Intelligence
- **Dashboard** - MTD profit, tax liability, ready drafts, next actions
- **Profit & Loss** - Revenue, COGS, expenses, profit margin by period
- **Tax Reports** - Federal tax estimates with drilldown, Florida sales tax liability by platform
- **Export Options** - CSV export for items, sales, expenses, and complete JSON backups

### Power User Features
- **Keyboard Shortcuts** - 15+ shortcuts for faster workflow (Ctrl+N, Ctrl+S, 1-8 screen navigation, etc.)
- **Sortable Tables** - Click any column header to sort (▲/▼ indicators)
- **Batch Actions** - Multi-select with bulk delete, update category, update status, CSV export
- **CSV Import/Export** - Bulk operations with error reporting and row-level validation
- **Backup & Restore** - Complete database backup/restore with version compatibility
- **Real-Time Validation** - SKU uniqueness, split validation, date range checking
- **Smart Defaults** - Remembers last-used values for faster data entry

### Mobile & Progressive Web App
- **Fully Responsive** - Card layouts on mobile, table views on desktop
- **Touch-Friendly** - 44px minimum tap targets, large form fields
- **PWA Support** - Install on home screen, full-screen experience
- **Offline-Ready** - Cached app shell, offline banner, queued updates synced on reconnect

### Security & Authentication
- **Cloudflare Zero Trust** - Enterprise-grade authentication with fail-closed security
- **Role-Based Access** - Email/domain-based access policies
- **Session Management** - Configurable session duration (1-24 hours)
- **Audit Logs** - Complete access logs via Cloudflare Zero Trust dashboard

---

## 🏗️ Tech Stack

### Frontend
- **Vanilla HTML/CSS/JS** - No frameworks, fast loading, minimal dependencies
- **2,100+ lines of JavaScript** - Complete client-side functionality
- **980+ lines of CSS** - Custom styling with responsive design
- **Modal System** - Reusable overlays for all forms

### Backend
- **Cloudflare Workers** - Serverless edge computing
- **TypeScript** - Type-safe backend code
- **2,450+ lines** - 54+ API endpoints across 14 categories
- **REST API** - JSON responses, consistent error handling

### Data Storage
- **Cloudflare D1** - SQLite database at the edge
- **Cloudflare R2** - S3-compatible object storage for photos
- **Comprehensive Schema** - 9 tables with proper indexing and constraints

### AI Integration
- **Cloudflare Workers AI** - Free tier AI (10,000 neurons/day)
- **Llama 3 8B** - Text generation for SEO, pricing, insights
- **ResNet-50** - Image classification for photo analysis

### Testing
- **Vitest** - Unit testing framework
- **123 tests passing** - 100% function coverage
- **3 test suites** - Finance, validation, AI (mocked)

### CI/CD
- **GitHub Actions** - Automated testing and deployment
- **Multi-Environment** - TEST and PROD with separate databases
- **Zero-Touch Deploy** - Push to main → tests → deploy TEST → deploy PROD

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Cloudflare account (free tier works!)
- GitHub account (for CI/CD)

### Local Development

```bash
# Clone repository
git clone https://github.com/yourusername/web_application.git
cd web_application

# Install dependencies
npm install

# Run unit tests (no Cloudflare needed)
npm test

# Run all tests (requires Cloudflare credentials)
npm run test:all

# Local development (requires wrangler login)
npm run dev
```

### Environment Setup

1. **Create Cloudflare API Token:**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → My Profile → API Tokens
   - Create token with permissions: Workers, D1, R2

2. **Set Environment Variables:**
   ```bash
   export CLOUDFLARE_API_TOKEN="your-token-here"
   export CLOUDFLARE_ACCOUNT_ID="your-account-id"
   ```

3. **Generate Wrangler Config:**
   ```bash
   npm run generate-config
   ```

4. **Provision Resources:**
   ```bash
   # TEST environment
   npm run provision:test

   # PRODUCTION environment
   npm run provision:prod
   ```

5. **Apply Migrations:**
   ```bash
   # TEST database
   npm run migrate:test

   # PRODUCTION database
   npm run migrate:prod
   ```

6. **Deploy:**
   ```bash
   # Deploy to TEST
   npm run deploy:test

   # Deploy to PRODUCTION
   npm run deploy:prod

   # Deploy both
   npm run deploy:all
   ```

---

## 🛒 eBay Integration

Complete eBay API integration for market research, listing creation, and sales sync.

### Features

**1. Market Valuation (FREE)**
- **Text-based:** Search eBay completed listings by item name (unlimited)
- **Photo-based:** AI analyzes photo → searches eBay (800 neurons = ~12/day)
- Returns: suggested price, price range, confidence score, sample listings
- Access: Navigation → "🏷️ eBay Valuation" or FAB → "eBay Check"

**2. Draft Listing Creation**
- Create eBay inventory items + unpublished offers
- 5-field form: title (80 char), price, condition, quantity, description
- Smart defaults: shipping, returns, duration (Good 'Til Cancelled)
- Opens eBay drafts page for review and publishing
- Access: Item detail → "List on eBay" button

**3. Import Active Listings**
- Sync eBay inventory items to local database
- Duplicate detection via `ebay_listing_id`
- Preserves: SKU, title, description, price, quantity, status
- Access: Inventory screen → "📥 Import from eBay"

**4. Import Sales Orders**
- Fetch eBay orders with date range picker (default: last 30 days)
- Auto-match to items via `ebay_listing_id`
- Calculates: gross amount, platform fees, shipping, net amount, profit
- Updates item status to "Sold"
- Access: Sales screen → "📥 Import eBay Sales"

**5. ChatGPT Bulk Import**
- Upload CSV from ChatGPT (e.g., "convert this list to CSV format")
- Expected columns: name, description, category, cost, bin_location
- Creates items with status='Unlisted'
- **Clipboard auto-detect:** Copy CSV → switch to app → auto-import banner
- Access: Inventory screen → "📋 Import from ChatGPT"

**6. Dashboard Widgets**
- **eBay Activity:** Active listings, drafts, sold this week
- **Action Items:** Ready to list, stale listings, needs valuation, pending drafts
- **eBay Performance:** MTD sales, profit margin

### Setup Instructions

**1. Create eBay Developer Account**
```
1. Go to https://developer.ebay.com/
2. Sign in with eBay account
3. Click "Get Started" → Create Application
4. Application Title: "ResellerOS"
5. Select: Production (not Sandbox)
```

**2. Configure OAuth Consent**
```
1. Grant Application Access to APIs: ✓
2. Required scopes:
   - https://api.ebay.com/oauth/api_scope
   - https://api.ebay.com/oauth/api_scope/sell.inventory
   - https://api.ebay.com/oauth/api_scope/sell.account
   - https://api.ebay.com/oauth/api_scope/buy.browse (for market research)
3. OAuth Redirect URI: https://your-app.workers.dev/api/ebay/callback
```

**3. Get Credentials**
```
1. Copy App ID (Client ID)
2. Copy Cert ID (Client Secret)
3. Copy Redirect URI (RuName)
```

**4. Add to Cloudflare Worker Secrets**
```bash
# Using wrangler CLI
wrangler secret put EBAY_APP_ID
wrangler secret put EBAY_CERT_ID
wrangler secret put EBAY_RU_NAME

# Or via Cloudflare Dashboard
# Workers → Your Worker → Settings → Variables → Add variable
```

**5. Configure eBay Business Policies** (One-time setup)
```
1. Go to https://www.ebay.com/sh/ovw/
2. Settings → Business Policies
3. Create policies:
   - Payment Policy: Managed Payments (required)
   - Shipping Policy: USPS Ground (or your preference)
   - Return Policy: 30 days (recommended)
4. Set as default policies
```

**6. Connect eBay in App**
```
1. Go to Settings screen
2. Click "Connect eBay"
3. Authorize access on eBay
4. Redirected back to app → "eBay connected successfully!"
```

### Usage Workflow

**Daily Workflow:**
```
1. Source items → ChatGPT import (or manual entry)
2. Take photos → Upload to items
3. Get valuations → eBay Valuation screen
4. Create listings → "List on eBay" button
5. Review drafts → eBay.com/sh/lst/drafts
6. Publish → Items go live on eBay
7. Import sales → Track locally for profit/tax
```

**Weekly Sync:**
```
1. Import eBay listings → Catch any manual listings
2. Import eBay sales → Match to items, update status
3. Review dashboard → Action items, performance metrics
```

### API Endpoints

- `GET /api/ebay/auth` - Initiate OAuth flow
- `GET /api/ebay/callback` - OAuth callback handler
- `GET /api/ebay/status` - Check connection status
- `DELETE /api/ebay/disconnect` - Remove eBay integration
- `POST /api/ebay/valuation/text` - Text-based market research
- `POST /api/ebay/valuation/photo` - Photo-based valuation (AI + eBay)
- `POST /api/ebay/create-draft` - Create draft listing
- `POST /api/ebay/import-listings` - Import active listings
- `POST /api/ebay/import-sales` - Import orders/sales
- `POST /api/import/chatgpt-items` - ChatGPT CSV import

### Database Schema Changes

**Migration:** `migrations/0004_ebay_fields.sql`

```sql
-- Add eBay tracking fields to items table
ALTER TABLE items ADD COLUMN ebay_listing_id TEXT;
ALTER TABLE items ADD COLUMN ebay_status TEXT CHECK (ebay_status IN (NULL, 'draft', 'active', 'ended', 'sold'));

-- Indexes for performance
CREATE INDEX idx_items_ebay_listing ON items(ebay_listing_id) WHERE ebay_listing_id IS NOT NULL;
CREATE INDEX idx_items_ebay_status ON items(ebay_status) WHERE ebay_status IS NOT NULL;
```

**Note:** Only 2 fields added - minimal schema impact

### Mobile Features

**PWA Shortcuts** (long-press app icon):
- Quick Add Item
- eBay Valuation
- Record Sale
- Import from eBay

**Camera Integration:**
- All photo inputs have direct camera access
- Use environment (rear) camera by default

**Clipboard Auto-Detection:**
- Copy ChatGPT CSV response
- Switch to app → Banner: "📋 ChatGPT CSV detected - Import items?"
- One-click import
- Auto-dismisses after 10 seconds

### Quota & Limits

**eBay API:**
- 5,000 calls/day (free tier)
- Typical usage: <100/day

**AI Photo Valuation:**
- 800 neurons per valuation
- Daily limit: ~12 valuations (10,000 neurons ÷ 800)
- Text-based valuation: **UNLIMITED** (no AI cost)

### Troubleshooting

**"eBay not connected"**
- Go to Settings → Click "Connect eBay"
- Ensure OAuth redirect URI matches exactly

**"Token expired"**
- Tokens auto-refresh on 401 errors
- If refresh fails, reconnect eBay

**"Failed to create listing"**
- Ensure Business Policies are configured
- Check title length (max 80 chars)
- Verify all required fields

**Import returns 0 items**
- Check eBay account has active listings
- Verify OAuth scopes include `sell.inventory`

---

## 📚 Documentation

Comprehensive guides are available in the `docs/` directory:

- **[Zero Trust Setup](./docs/ZERO_TRUST_SETUP.md)** - Configure Cloudflare Zero Trust authentication
- **[API Documentation](./docs/API.md)** - Complete REST API reference with examples
- **[AI Features Guide](./docs/AI_FEATURES.md)** - AI capabilities, usage limits, best practices
- **[UX Features Guide](./docs/UX_FEATURES.md)** - Keyboard shortcuts, batch actions, mobile PWA

---

## 🏛️ Architecture

### Database Schema

```
items (150 fields)
├── id, sku, name, description, cost, bin_location
├── photos (array), category, status, lifecycle_stage
└── sold_price, sold_date, timestamps

sales (14 fields)
├── id, order_number, platform, gross_amount
├── platform_fees, promotion_discount, shipping_cost
├── florida_tax_collected, ebay_tax_collected
├── federal_tax_estimate, profit, sale_date
└── timestamps

sale_items (junction)
├── sale_id → sales.id
├── item_id → items.id
└── quantity

expenses (13 fields)
├── id, name, category, amount
├── split_inventory, split_operations, split_other
├── receipt_key, vehicle_mileage, vehicle_actual
└── expense_date, timestamps

lots (4 fields)
├── id, name, notes
└── timestamps

lot_items (junction)
├── lot_id → lots.id
├── item_id → items.id
└── quantity

pricing_drafts (8 fields)
├── id, item_id, lot_id (XOR constraint)
├── suggested_price, seo_title, seo_description
├── confidence_score
└── timestamps

settings (4 fields)
├── id, key, value
└── updated_at

fee_profiles (4 fields)
├── id, platform, fee_rate
└── description

closed_periods (5 fields)
├── id, starts_on, ends_on
├── description
└── timestamps
```

### API Architecture

```
Worker (src/worker.ts)
├── Authentication Layer (Zero Trust enforcement)
├── Router (URL pattern matching)
├── Request Handlers (54+ endpoints)
├── Validation Layer (src/lib/validation.ts)
├── Business Logic (src/lib/finance.ts)
├── AI Services (src/lib/ai.ts)
└── Database Layer (src/lib/db.ts)
```

### Frontend Architecture

```
index.html (792 lines)
├── Navigation (8 screens)
├── Modal System (overlay + templates)
├── Form Templates (5 comprehensive forms)
└── Batch Actions Bar

app.js (2,100+ lines)
├── State Management (appState object)
├── API Client (fetch wrapper)
├── Screen Renderers (8 screens)
├── Modal Handlers (open/close/populate)
├── Form Handlers (validation/submission)
├── AI Functions (7 AI features)
├── Batch Actions (select/update/delete)
├── Keyboard Shortcuts (15+ shortcuts)
└── Utility Functions (formatters, validators)

styles.css (980+ lines)
├── Global Styles (variables, reset)
├── Layout (topbar, sidebar, content)
├── Components (cards, panels, modals)
├── Forms (inputs, labels, validation)
├── Tables (sortable, responsive)
├── AI Styling (buttons, suggestions, confidence)
├── Batch Actions (bar, checkboxes)
└── Responsive (mobile breakpoints)
```

---

## 🧪 Testing

### Test Coverage

- **123 tests passing** across 3 test suites
- **0 failures**
- **100% function coverage** for all libraries

### Test Breakdown

**Finance Library (24 tests):**
- Profit calculations with fees and promotions
- Federal tax estimates
- Florida sales tax liability
- Expense splitting with rounding
- Lot wrapper building
- Edge cases: zero values, negative profit, very large numbers

**Validation Library (73 tests):**
- All 10 validation functions
- ValidationError class
- Edge cases and boundary conditions
- XOR constraints
- Vehicle deduction exclusivity

**AI Service Library (26 tests):**
- All 7 AI functions with mocked Workers AI
- Error handling (quota exceeded, malformed responses)
- Confidence scoring
- Fallback behavior

### Running Tests

```bash
# Unit tests only (no Cloudflare needed)
npm test

# Cloudflare integration tests (requires credentials)
npm run test:cf

# All tests
npm run test:all
```

---

## 🔄 CI/CD Pipeline

### Automated Workflow

```
Push to main
  ↓
Unit Tests (123 tests)
  ↓
Integration Tests (if secrets available)
  ↓
Deploy to TEST
  ├── Provision TEST resources (D1, R2)
  ├── Apply TEST migrations
  └── Deploy TEST worker
  ↓
Deploy to PRODUCTION
  ├── Provision PROD resources (D1, R2)
  ├── Apply PROD migrations
  └── Deploy PROD worker
  ↓
Success! 🎉
```

### GitHub Secrets Required

- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Workers, D1, R2 permissions
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

### Manual Deployment

```bash
# Generate config
npm run generate-config

# Deploy to specific environment
npm run deploy:test
npm run deploy:prod

# Deploy both (TEST first, then PROD)
npm run deploy:all
```

---

## 💰 Free Tier Compliance

All features work within Cloudflare's free tier limits:

### Workers
- ✅ 100,000 requests/day (personal use: <1,000/day)
- ✅ 10ms CPU time per request (our operations: <5ms)

### D1 Database
- ✅ 5 GB storage (thousands of items/sales)
- ✅ 5 million rows read/day (personal use: hundreds/day)
- ✅ 100,000 rows written/day (personal use: 10-50/day)

### R2 Storage
- ✅ 10 GB storage (hundreds of photos)
- ✅ 1 million writes/month (personal use: <1,000/month)
- ✅ 10 million reads/month (plenty for viewing)

### Workers AI
- ✅ 10,000 neurons/day
- ✅ Typical daily usage: ~6,000 neurons (60% of limit)
- ✅ Usage monitoring and warnings at 80%

---

## 📊 Project Stats

- **Backend:** 2,870+ lines of TypeScript (+420 for eBay integration)
- **Frontend:** 3,752+ lines (1,032 HTML + 2,720 JS)
- **Styling:** 1,084+ lines of CSS
- **Tests:** 123 tests across 3 suites
- **API Endpoints:** 60+ across 15 categories (54 core + 10 eBay)
- **Documentation:** 5 comprehensive guides + eBay integration guide
- **AI Features:** 8 AI-powered tools
- **eBay Features:** 6 integration features (valuation, import, listing, widgets)
- **Mobile Features:** PWA shortcuts, camera integration, clipboard auto-detect
- **UX Features:** FAB, 15+ keyboard shortcuts, batch actions, sortable tables

---

## 🗺️ Roadmap

### Completed ✅
- Phase 1-8: Complete application with backend, frontend, AI, testing
- Phase 9: CI/CD, comprehensive documentation
- **Phase 10: eBay Integration** ✅
  - OAuth 2.0 authentication
  - Market valuation (text & photo-based)
  - Draft listing creation
  - Import listings and sales
  - ChatGPT bulk import with clipboard auto-detect
  - Dashboard widgets and action items
  - PWA shortcuts and mobile optimizations

### Future Enhancements
- **Offline Mode:** Service worker with background sync
- **Multi-Language:** i18n support for international sellers
- **Advanced Analytics:** Charts, trends, forecasting
- **Mobile App:** Native iOS/Android apps (Capacitor)
- **Mercari Integration:** Similar to eBay integration
- **Collaboration:** Multi-user support with role-based access

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure:
- All tests pass (`npm test`)
- Code follows existing style
- Documentation is updated

---

## 📄 License

MIT License - See [LICENSE](./LICENSE) for details

---

## 🙏 Acknowledgments

Built with:
- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless platform
- [Cloudflare D1](https://developers.cloudflare.com/d1/) - Edge database
- [Cloudflare R2](https://developers.cloudflare.com/r2/) - Object storage
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) - AI at the edge
- [Vitest](https://vitest.dev/) - Testing framework

---

## 📞 Support

- **Documentation:** See `docs/` directory
- **Issues:** [GitHub Issues](https://github.com/yourusername/web_application/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/web_application/discussions)

---

## 🎯 Definition of Done

- [x] 123 unit tests passing
- [x] Integration tests with Cloudflare
- [x] TEST and PROD environments
- [x] CI/CD pipeline configured
- [x] Zero Trust authentication enforced
- [x] 60+ API endpoints implemented (54 core + 10 eBay)
- [x] 8 AI features integrated
- [x] eBay integration complete (6 features)
- [x] Complete documentation (README + 5 guides)
- [x] Mobile PWA support with shortcuts
- [x] Free tier compliant
- [x] Floating Action Button (FAB)
- [x] Clipboard auto-detection

---

**Made with ❤️ for eBay resellers**
