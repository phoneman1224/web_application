# eBay Integration - Test Plan

**Version:** 1.0
**Date:** 2025-12-30
**Scope:** Complete end-to-end testing of eBay integration features
**Environment:** Production deployment

---

## 🎯 Test Objectives

1. Verify all eBay integration features work correctly
2. Ensure existing functionality remains unaffected
3. Validate mobile-specific features (PWA, camera, clipboard)
4. Confirm error handling and edge cases
5. Test quota limits and rate limiting

---

## 🔧 Pre-Test Setup

### Environment Checklist
- [ ] Database migration `0004_ebay_fields.sql` applied
- [ ] Worker deployed to production
- [ ] eBay secrets configured (`EBAY_APP_ID`, `EBAY_CERT_ID`, `EBAY_RU_NAME`)
- [ ] eBay Developer Account created
- [ ] eBay Business Policies configured (Payment, Shipping, Return)
- [ ] OAuth redirect URI matches production URL

### Test Data Requirements
- [ ] 5+ test items in inventory (mix of statuses)
- [ ] 2+ items with photos uploaded
- [ ] 1+ existing eBay listing (for import testing)
- [ ] ChatGPT CSV sample ready (see Appendix A)
- [ ] Test eBay account with sandbox credentials (optional)

---

## 📋 Test Suites

### Suite 1: eBay OAuth Connection (Critical)

**Priority:** P0 (Must Pass)
**Estimated Time:** 5 minutes

| Test Case | Steps | Expected Result | Status | Notes |
|-----------|-------|-----------------|--------|-------|
| TC-001 | Navigate to Settings screen | Settings screen loads | ⬜ |  |
| TC-002 | Click "Connect eBay" button | Redirects to eBay login/consent page | ⬜ |  |
| TC-003 | Authorize app on eBay | Redirects back to app with success toast | ⬜ | Toast: "eBay connected successfully!" |
| TC-004 | Check eBay status indicator | Shows "Connected" or green status | ⬜ |  |
| TC-005 | Refresh page | eBay status persists (stored in DB) | ⬜ |  |
| TC-006 | Click "Disconnect" button | Confirm dialog appears | ⬜ |  |
| TC-007 | Confirm disconnect | Shows success toast, status changes to "Disconnected" | ⬜ |  |
| TC-008 | Reconnect eBay | OAuth flow works again | ⬜ |  |

**Edge Cases:**
- [ ] TC-009: User cancels OAuth consent → Returns to app with error message
- [ ] TC-010: Invalid credentials → Shows clear error message
- [ ] TC-011: Token expiration → Auto-refresh on next API call

---

### Suite 2: eBay Market Valuation (High Priority)

**Priority:** P0 (Must Pass)
**Estimated Time:** 15 minutes

#### Text-Based Valuation

| Test Case | Steps | Expected Result | Status | Notes |
|-----------|-------|-----------------|--------|-------|
| TC-020 | Navigate to "eBay Valuation" screen | Screen loads, default to text input | ⬜ |  |
| TC-021 | Enter item name: "iPhone 13" | Input accepts text | ⬜ |  |
| TC-022 | Click "Get Valuation" | Shows loading state | ⬜ |  |
| TC-023 | Wait for results | Displays: suggested price, price range, sold count, confidence | ⬜ | Takes 2-5 seconds |
| TC-024 | Check sample listings | Shows 5-10 recent sold items with prices | ⬜ |  |
| TC-025 | Test with obscure item: "1920s typewriter ribbon" | Returns low confidence or no results | ⬜ |  |
| TC-026 | Test with generic term: "shirt" | Returns results but low confidence | ⬜ |  |
| TC-027 | Clear results | "Clear Results" button removes displayed data | ⬜ |  |

**Edge Cases:**
- [ ] TC-028: Empty input → Shows validation error
- [ ] TC-029: Very long input (200 chars) → Truncates or shows warning
- [ ] TC-030: Special characters in query → Handles gracefully
- [ ] TC-031: eBay API timeout → Shows error message, doesn't crash

#### Photo-Based Valuation

| Test Case | Steps | Expected Result | Status | Notes |
|-----------|-------|-----------------|--------|-------|
| TC-035 | Toggle to "Photo" valuation method | Photo upload input appears | ⬜ |  |
| TC-036 | Check AI quota display | Shows "Remaining today: X/12" | ⬜ |  |
| TC-037 | Upload item photo (e.g., sneaker) | File selected successfully | ⬜ |  |
| TC-038 | Click "Analyze & Value" | Shows loading state | ⬜ |  |
| TC-039 | Wait for AI analysis | Displays: detected item name + valuation results | ⬜ | Takes 5-10 seconds |
| TC-040 | Verify quota decremented | Remaining count reduced by 1 | ⬜ |  |
| TC-041 | Upload 12 photos (if quota available) | 12th valuation succeeds | ⬜ |  |
| TC-042 | Attempt 13th valuation | Shows quota exceeded error | ⬜ |  |

**Edge Cases:**
- [ ] TC-043: Upload non-image file → Shows validation error
- [ ] TC-044: Upload very large image (10MB+) → Handles or shows size limit
- [ ] TC-045: Photo with no recognizable item → Returns generic category

---

### Suite 3: eBay Draft Listing Creation (High Priority)

**Priority:** P0 (Must Pass)
**Estimated Time:** 10 minutes

| Test Case | Steps | Expected Result | Status | Notes |
|-----------|-------|-----------------|--------|-------|
| TC-050 | Go to Inventory, select item with status='Unlisted' | Item detail modal opens | ⬜ |  |
| TC-051 | Click "List on eBay" button | Draft listing form modal opens | ⬜ |  |
| TC-052 | Form pre-fills with item data | Title, price, description populated | ⬜ |  |
| TC-053 | Edit title to 80 characters | Character counter updates (80/80) | ⬜ |  |
| TC-054 | Try to exceed 80 characters | Input truncates or prevents entry | ⬜ |  |
| TC-055 | Select condition: "Like New" | Dropdown allows selection | ⬜ |  |
| TC-056 | Set quantity: 1 | Accepts number | ⬜ |  |
| TC-057 | Set price: 49.99 | Accepts decimal | ⬜ |  |
| TC-058 | Click "Create Draft" | Shows loading state | ⬜ |  |
| TC-059 | Wait for response | Success toast + eBay drafts page opens in new tab | ⬜ | Toast: "✓ Draft created" |
| TC-060 | Check item in DB | `ebay_listing_id` and `ebay_status='draft'` set | ⬜ | Use browser console or DB query |
| TC-061 | Verify on eBay.com/sh/lst/drafts | Draft listing appears | ⬜ |  |

**Edge Cases:**
- [ ] TC-062: Submit with empty title → Shows validation error
- [ ] TC-063: Submit with price = 0 → Shows validation error
- [ ] TC-064: Submit with negative quantity → Shows validation error
- [ ] TC-065: eBay API error (e.g., missing business policy) → Shows clear error message
- [ ] TC-066: Item without SKU → Auto-generates SKU

---

### Suite 4: Import eBay Listings (Medium Priority)

**Priority:** P1 (Should Pass)
**Estimated Time:** 8 minutes

**Prerequisites:** Have 3+ active listings on eBay account

| Test Case | Steps | Expected Result | Status | Notes |
|-----------|-------|-----------------|--------|-------|
| TC-070 | Go to Inventory screen | Screen loads | ⬜ |  |
| TC-071 | Click "📥 Import from eBay" | Shows confirmation dialog | ⬜ |  |
| TC-072 | Confirm import | Shows loading toast | ⬜ | Toast: "Importing listings..." |
| TC-073 | Wait for completion | Success toast with count | ⬜ | Toast: "✓ Imported X listings" |
| TC-074 | Check inventory table | New items appear with status='Listed' | ⬜ |  |
| TC-075 | Verify item details | Title, price, SKU match eBay | ⬜ |  |
| TC-076 | Check `ebay_listing_id` field | Populated correctly | ⬜ |  |
| TC-077 | Re-run import | Shows "X already imported" (duplicates detected) | ⬜ |  |

**Edge Cases:**
- [ ] TC-078: No active listings on eBay → "No new listings found"
- [ ] TC-079: Import with 100+ listings → Handles pagination correctly
- [ ] TC-080: Network interruption during import → Shows error, partial import OK

---

### Suite 5: Import eBay Sales (Medium Priority)

**Priority:** P1 (Should Pass)
**Estimated Time:** 8 minutes

**Prerequisites:** Have 1+ completed sale on eBay

| Test Case | Steps | Expected Result | Status | Notes |
|-----------|-------|-----------------|--------|-------|
| TC-085 | Go to Sales screen | Screen loads | ⬜ |  |
| TC-086 | Click "📥 Import eBay Sales" | Date range modal opens | ⬜ |  |
| TC-087 | Check default date range | Start: 30 days ago, End: today | ⬜ |  |
| TC-088 | Click "Import" | Shows loading toast | ⬜ | Toast: "Importing sales..." |
| TC-089 | Wait for completion | Success toast with match stats | ⬜ | Toast: "✓ Imported X sales (Y matched)" |
| TC-090 | Check sales table | New sales appear with platform='eBay' | ⬜ |  |
| TC-091 | Verify matched sale | Item status updated to 'Sold' | ⬜ |  |
| TC-092 | Check profit calculation | Profit = gross - fees - shipping - cost | ⬜ |  |
| TC-093 | Check orphaned sales | Sales without matching items still imported | ⬜ |  |

**Edge Cases:**
- [ ] TC-094: Import with no sales in date range → "No sales found"
- [ ] TC-095: Custom date range (last 7 days) → Respects date filter
- [ ] TC-096: Sale for item not in DB → Imports as orphaned sale

---

### Suite 6: ChatGPT Import (High Priority)

**Priority:** P0 (Must Pass)
**Estimated Time:** 10 minutes

#### CSV File Upload

| Test Case | Steps | Expected Result | Status | Notes |
|-----------|-------|-----------------|--------|-------|
| TC-100 | Go to Inventory screen | Screen loads | ⬜ |  |
| TC-101 | Click "📋 Import from ChatGPT" | Modal opens with file input | ⬜ |  |
| TC-102 | Upload valid CSV (see Appendix A) | File selected | ⬜ |  |
| TC-103 | Click "Import" | Shows loading state | ⬜ |  |
| TC-104 | Wait for completion | Success toast with count | ⬜ | Toast: "✓ Imported X items" |
| TC-105 | Check inventory | New items appear with status='Unlisted' | ⬜ |  |
| TC-106 | Verify item data | Name, description, category, cost match CSV | ⬜ |  |

**Edge Cases:**
- [ ] TC-107: Upload CSV with missing columns → Shows error with details
- [ ] TC-108: Upload CSV with invalid data (negative cost) → Shows row-level errors
- [ ] TC-109: Upload empty CSV → "No items to import"
- [ ] TC-110: Upload non-CSV file → Shows validation error

#### Clipboard Auto-Detection

| Test Case | Steps | Expected Result | Status | Notes |
|-----------|-------|-----------------|--------|-------|
| TC-115 | Copy valid CSV to clipboard | Clipboard contains CSV text | ⬜ | Use sample from Appendix A |
| TC-116 | Switch to ResellerOS tab/window | Window gains focus | ⬜ |  |
| TC-117 | Wait 1 second | Banner appears: "📋 ChatGPT CSV detected" | ⬜ |  |
| TC-118 | Click "Import" button on banner | Import starts, banner closes | ⬜ |  |
| TC-119 | Wait for completion | Success toast, items imported | ⬜ |  |
| TC-120 | Copy same CSV again, switch to app | No banner (duplicate detection) | ⬜ |  |
| TC-121 | Copy CSV, wait 10 seconds | Banner auto-dismisses | ⬜ |  |
| TC-122 | Click "Dismiss" on banner | Banner closes, no import | ⬜ |  |

**Edge Cases:**
- [ ] TC-123: Copy non-CSV text → No banner appears
- [ ] TC-124: Clipboard API not available (older browser) → Fails silently
- [ ] TC-125: Deny clipboard permission → No banner, no error

---

### Suite 7: Dashboard Widgets (Medium Priority)

**Priority:** P1 (Should Pass)
**Estimated Time:** 5 minutes

| Test Case | Steps | Expected Result | Status | Notes |
|-----------|-------|-----------------|--------|-------|
| TC-130 | Go to Dashboard screen | Dashboard loads | ⬜ |  |
| TC-131 | Check eBay Activity widget | Shows counts: active, drafts, sold this week | ⬜ |  |
| TC-132 | Verify active listings count | Matches count from import | ⬜ |  |
| TC-133 | Check Action Items widget | Shows actionable items or "No action items" | ⬜ |  |
| TC-134 | Click "X items ready to list" link | Navigates to Inventory screen | ⬜ |  |
| TC-135 | Check eBay Performance widget | Shows MTD sales and profit margin | ⬜ |  |
| TC-136 | Verify profit margin calculation | Margin = (profit / gross) * 100 | ⬜ |  |

**Edge Cases:**
- [ ] TC-137: No eBay items → Widgets show zeros gracefully
- [ ] TC-138: No sales this month → Profit margin shows 0%

---

### Suite 8: Floating Action Button (FAB) (Medium Priority)

**Priority:** P1 (Should Pass)
**Estimated Time:** 8 minutes

| Test Case | Steps | Expected Result | Status | Notes |
|-----------|-------|-----------------|--------|-------|
| TC-140 | Load any screen | FAB button visible bottom-right | ⬜ | ⚡ icon |
| TC-141 | Click FAB button | Menu expands upward with 5 options | ⬜ |  |
| TC-142 | Click outside FAB menu | Menu closes | ⬜ |  |
| TC-143 | Click "➕ Quick Add Item" | Prompts for name, then cost | ⬜ |  |
| TC-144 | Enter name: "Test Item" | Accepts input | ⬜ |  |
| TC-145 | Enter cost: 10 | Item created with status='Unlisted' | ⬜ |  |
| TC-146 | Open FAB, click "💰 Quick Sale" | Modal opens with recent items | ⬜ |  |
| TC-147 | Select item, enter price: 25 | Sale created, item marked 'Sold' | ⬜ |  |
| TC-148 | Open FAB, click "🏷️ eBay Check" | Navigates to eBay Valuation screen | ⬜ |  |
| TC-149 | Open FAB, click "📦 Bulk Actions" | Navigates to Inventory screen | ⬜ |  |

**Edge Cases:**
- [ ] TC-150: Cancel Quick Add (empty name) → No item created
- [ ] TC-151: Quick Sale with no items → Shows "No items available"
- [ ] TC-152: FAB menu overlaps other content → Z-index correct

---

### Suite 9: Mobile Features (High Priority)

**Priority:** P0 (Must Pass)
**Estimated Time:** 12 minutes

**Prerequisites:** Test on mobile device or Chrome DevTools mobile emulation

#### PWA Shortcuts

| Test Case | Steps | Expected Result | Status | Notes |
|-----------|-------|-----------------|--------|-------|
| TC-160 | Install PWA to home screen | App installs | ⬜ | Android/iOS |
| TC-161 | Long-press app icon | Context menu shows shortcuts | ⬜ |  |
| TC-162 | Tap "Quick Add Item" shortcut | App opens to quick add flow | ⬜ |  |
| TC-163 | Tap "eBay Valuation" shortcut | App opens to valuation screen | ⬜ |  |
| TC-164 | Tap "Record Sale" shortcut | App opens to quick sale flow | ⬜ |  |
| TC-165 | Tap "Import from eBay" shortcut | App opens to import flow | ⬜ |  |

#### Camera Integration

| Test Case | Steps | Expected Result | Status | Notes |
|-----------|-------|-----------------|--------|-------|
| TC-170 | Go to eBay Valuation (photo mode) | Photo input visible | ⬜ |  |
| TC-171 | Tap "Upload Photo" on mobile | Camera opens (not file picker) | ⬜ | `capture="environment"` |
| TC-172 | Take photo with camera | Photo captured and selected | ⬜ |  |
| TC-173 | Go to Add Item form, upload photo | Camera opens | ⬜ |  |
| TC-174 | Go to Add Expense, upload receipt | Camera opens | ⬜ |  |

#### FAB Mobile Positioning

| Test Case | Steps | Expected Result | Status | Notes |
|-----------|-------|-----------------|--------|-------|
| TC-180 | Open app on mobile | FAB visible, not covered by nav bar | ⬜ |  |
| TC-181 | Scroll down page | FAB stays fixed in position | ⬜ |  |
| TC-182 | Open FAB menu | Menu doesn't overlap bottom nav | ⬜ |  |

---

### Suite 10: Regression Testing (Critical)

**Priority:** P0 (Must Pass)
**Estimated Time:** 15 minutes

Verify existing features still work after eBay integration:

| Test Case | Steps | Expected Result | Status | Notes |
|-----------|-------|-----------------|--------|-------|
| TC-200 | Add new item manually | Item created successfully | ⬜ |  |
| TC-201 | Upload photo to item | Photo saved to R2, displays correctly | ⬜ |  |
| TC-202 | Use AI SEO generation | Generates title and description | ⬜ |  |
| TC-203 | Use AI price suggestion | Returns price with confidence | ⬜ |  |
| TC-204 | Record a sale | Sale created, profit calculated | ⬜ |  |
| TC-205 | Link sale to item | Junction table updated | ⬜ |  |
| TC-206 | Add expense | Expense created with split | ⬜ |  |
| TC-207 | Create pricing draft | Draft saved with confidence | ⬜ |  |
| TC-208 | View reports (P&L) | Reports generate correctly | ⬜ |  |
| TC-209 | Export items to CSV | CSV downloads with all columns | ⬜ |  |
| TC-210 | Backup database | JSON backup downloads | ⬜ |  |
| TC-211 | Use keyboard shortcuts (Ctrl+N) | New item modal opens | ⬜ |  |
| TC-212 | Sort table by clicking header | Table sorts correctly | ⬜ |  |
| TC-213 | Batch select items | Checkboxes work, batch bar appears | ⬜ |  |
| TC-214 | Change theme (Settings) | Theme persists after reload | ⬜ |  |

---

### Suite 11: Error Handling & Edge Cases (High Priority)

**Priority:** P0 (Must Pass)
**Estimated Time:** 10 minutes

| Test Case | Steps | Expected Result | Status | Notes |
|-----------|-------|-----------------|--------|-------|
| TC-220 | Disconnect internet, try eBay valuation | Shows network error, doesn't crash | ⬜ |  |
| TC-221 | eBay token expired, make API call | Auto-refreshes token, retries | ⬜ |  |
| TC-222 | Exceed AI quota, try photo valuation | Shows quota error, suggests text valuation | ⬜ |  |
| TC-223 | Submit form with XSS attempt (`<script>`) | Input sanitized, no script execution | ⬜ |  |
| TC-224 | Upload 100MB photo | Shows file size error | ⬜ |  |
| TC-225 | Rapid-click eBay import button | Prevents duplicate imports | ⬜ |  |
| TC-226 | Navigate away during import | Import completes in background | ⬜ |  |

---

### Suite 12: Performance & Quota Compliance (Medium Priority)

**Priority:** P1 (Should Pass)
**Estimated Time:** 8 minutes

| Test Case | Steps | Expected Result | Status | Notes |
|-----------|-------|-----------------|--------|-------|
| TC-230 | Measure eBay valuation response time | < 5 seconds | ⬜ | Text-based |
| TC-231 | Measure photo valuation response time | < 10 seconds | ⬜ | AI + eBay |
| TC-232 | Check AI usage in dashboard | Shows current usage (X/10,000) | ⬜ |  |
| TC-233 | Import 50 eBay listings | Completes without timeout | ⬜ |  |
| TC-234 | Check browser console for errors | No JavaScript errors | ⬜ |  |
| TC-235 | Monitor network tab | No 429 (rate limit) errors | ⬜ |  |
| TC-236 | Check D1 query count | < 100 queries for typical workflow | ⬜ |  |

---

## 📊 Test Execution Summary

### Pass/Fail Criteria

- **P0 tests:** 100% must pass (blocking issues)
- **P1 tests:** 95% must pass (minor issues acceptable)
- **Overall:** 98% pass rate required for production release

### Test Metrics Template

| Suite | Total Tests | Passed | Failed | Blocked | Pass Rate |
|-------|-------------|--------|--------|---------|-----------|
| 1. OAuth Connection | 11 | - | - | - | -% |
| 2. Market Valuation | 24 | - | - | - | -% |
| 3. Draft Listings | 17 | - | - | - | -% |
| 4. Import Listings | 11 | - | - | - | -% |
| 5. Import Sales | 12 | - | - | - | -% |
| 6. ChatGPT Import | 26 | - | - | - | -% |
| 7. Dashboard Widgets | 8 | - | - | - | -% |
| 8. FAB | 13 | - | - | - | -% |
| 9. Mobile Features | 15 | - | - | - | -% |
| 10. Regression | 15 | - | - | - | -% |
| 11. Error Handling | 7 | - | - | - | -% |
| 12. Performance | 7 | - | - | - | -% |
| **TOTAL** | **166** | **-** | **-** | **-** | **-%** |

---

## 🐛 Bug Reporting Template

**Bug ID:** BUG-XXX
**Severity:** Critical / High / Medium / Low
**Priority:** P0 / P1 / P2
**Test Case:** TC-XXX
**Environment:** Production / Local

**Steps to Reproduce:**
1.
2.
3.

**Expected Result:**


**Actual Result:**


**Screenshots/Logs:**


**Workaround:**


---

## 📎 Appendix A: Test Data Samples

### ChatGPT CSV Sample

```csv
name,description,category,cost,bin_location
Nike Air Max 90,White colorway size 10 good condition,Shoes,45.00,A1
Vintage Typewriter,1960s Royal typewriter working,Collectibles,80.00,C3
iPhone 12 Case,Silicone case blue color,Electronics,5.00,B2
Leather Wallet,Brown genuine leather bifold,Accessories,12.00,A5
Board Game Lot,3 vintage board games complete,Toys,25.00,D1
```

### eBay Valuation Test Queries

**High Volume Items (should return many results):**
- "iPhone 13 128GB"
- "Nike Air Force 1"
- "PlayStation 5"

**Medium Volume Items:**
- "Vintage Polaroid camera"
- "Leather messenger bag"
- "Cast iron skillet"

**Low Volume Items (edge cases):**
- "1920s typewriter ribbon"
- "Rare Pokemon card Charizard"
- "Antique pocket watch"

---

## ✅ Sign-Off

**Tester Name:** _________________
**Date:** _________________
**Overall Status:** PASS / FAIL / BLOCKED
**Notes:**


**Approved for Production:** YES / NO
**Approver:** _________________
**Date:** _________________

---

## 📝 Notes for Testers

1. **Test in order** - Suites build on each other (e.g., must connect eBay before importing)
2. **Document failures** - Screenshot + console logs for every failed test
3. **Check browser console** - Watch for JavaScript errors throughout
4. **Test on multiple devices** - Desktop Chrome, Mobile Safari, Mobile Chrome
5. **Real eBay account** - Use actual eBay developer account, not sandbox
6. **AI quota** - Reset daily at UTC midnight, plan photo valuation tests accordingly
7. **Database state** - Reset test data between major suites if needed

---

**Good luck testing! 🚀**
