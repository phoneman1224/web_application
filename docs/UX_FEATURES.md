# UX Features Guide

Reseller Ops is packed with power user features designed to make your eBay reselling workflow fast, efficient, and enjoyable.

## Table of Contents

- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Sortable Tables](#sortable-tables)
- [Batch Actions](#batch-actions)
- [CSV Import/Export](#csv-importexport)
- [Smart Defaults](#smart-defaults)
- [Backup & Restore](#backup--restore)
- [Real-Time Validation](#real-time-validation)
- [Mobile & PWA](#mobile--pwa)

---

## Keyboard Shortcuts

Work faster with keyboard shortcuts for common actions.

### Global Shortcuts (Work Anywhere)

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl/⌘ + N` | New Entry | Opens "New Entry" modal for current screen |
| `Ctrl/⌘ + S` | Quick Save | Saves current form (when form is open) |
| `Ctrl/⌘ + B` | Backup | Downloads full database backup |
| `/` | Focus Search | Jump to global search box |
| `Esc` | Close/Clear | Closes modal or clears search |
| `?` | Show Help | Displays keyboard shortcuts reference |

### Screen Navigation

| Shortcut | Screen | Description |
|----------|--------|-------------|
| `1` | Dashboard | Jump to Dashboard |
| `2` | Inventory | Jump to Inventory |
| `3` | Sales | Jump to Sales |
| `4` | Expenses | Jump to Expenses |
| `5` | Lots | Jump to Lots |
| `6` | Pricing & SEO | Jump to Pricing & SEO |
| `7` | Reports | Jump to Reports |
| `8` | Settings | Jump to Settings |

### Tips for Keyboard Users

- **Modal Focus:** When a modal opens, focus automatically moves to the first input field
- **Tab Navigation:** Use `Tab` to move between form fields, `Shift+Tab` to go back
- **Esc Anywhere:** `Esc` always closes the topmost modal or clears search
- **Context-Aware:** `Ctrl+N` knows which screen you're on (creates item on Inventory, sale on Sales, etc.)

### Viewing Shortcuts

Press `?` anywhere in the app to see the keyboard shortcuts reference card.

---

## Sortable Tables

All data tables support client-side sorting with a single click.

### How to Sort

1. **Click any column header** with the sortable icon
2. **First click:** Sort ascending (▲)
3. **Second click:** Sort descending (▼)
4. **Third click:** Return to default order

### Sortable Columns

**Inventory Table:**
- Name (alphabetical)
- SKU (alphabetical)
- Cost (numerical)
- Category (alphabetical)
- Status (alphabetical)
- Created Date (chronological)

**Sales Table:**
- Order Number (alphabetical)
- Platform (alphabetical)
- Gross Amount (numerical)
- Profit (numerical)
- Sale Date (chronological)

**Expenses Table:**
- Name (alphabetical)
- Category (alphabetical)
- Amount (numerical)
- Expense Date (chronological)

**Lots Table:**
- Name (alphabetical)
- Total Cost (numerical, calculated)
- Created Date (chronological)

**Pricing Drafts Table:**
- Item/Lot (alphabetical)
- Suggested Price (numerical)
- Confidence (numerical)
- Created Date (chronological)

### Visual Indicators

- **▲ Up arrow:** Sorted ascending
- **▼ Down arrow:** Sorted descending
- **Hover effect:** Column header highlights on hover
- **Current sort:** Arrow visible next to sorted column

### Performance

- Sorting is **instant** (client-side, no server requests)
- Works on datasets up to **1,000+ items** without lag
- State persists while viewing the screen (resets on refresh)

---

## Batch Actions

Perform bulk operations on multiple items at once.

### How to Use Batch Actions

1. **Select Items:**
   - Click checkbox in row header to select individual items
   - Click checkbox in table header to select all visible items

2. **Batch Actions Bar Appears:**
   - Slides up from bottom of screen
   - Shows count of selected items
   - Displays available batch operations

3. **Choose an Action:**
   - **Export Selected:** Download CSV of selected items
   - **Update Category:** Change category for all selected
   - **Update Status:** Change status for all selected
   - **Delete Selected:** Delete all selected (with confirmation)

4. **Confirm or Cancel:**
   - Destructive actions (delete) show confirmation dialog
   - Updates show success toast notification
   - Clear selection to hide batch actions bar

### Available Batch Operations

**Inventory Screen:**
- Export selected items to CSV
- Update category (bulk categorize)
- Update status (bulk status change)
- Delete selected items

**Sales Screen:**
- Export selected sales to CSV
- Delete selected sales

**Expenses Screen:**
- Export selected expenses to CSV
- Update category (bulk re-categorize)
- Delete selected expenses

**Lots Screen:**
- Export selected lots to CSV
- Delete selected lots

**Pricing Drafts Screen:**
- Export selected drafts to CSV
- Delete selected drafts

### Tips for Batch Actions

- **Select All:** Checkbox in table header selects all visible items (filtered results only)
- **Clear Selection:** Click "Clear" in batch bar or `Esc` key
- **Cross-Screen:** Selections are isolated per screen (switching screens clears selection)
- **Performance:** Batch operations process items sequentially for reliability

---

## CSV Import/Export

Bulk import and export data via CSV files.

### Export Data

**Individual Exports:**
- **Export Items:** Settings → Export Items CSV
- **Export Sales:** Settings → Export Sales CSV
- **Export Expenses:** Settings → Export Expenses CSV

**Batch Export:**
- Select specific items in any table
- Click "Export Selected" in batch actions bar
- Downloads CSV with only selected items

**CSV Format:**
```csv
"name","sku","cost","description","category","status","bin_location"
"Vintage Walkman","SONY-001","45.00","Rare item","Electronics","In Stock","A2"
```

### Import Data

**Import Items:**
1. Go to Inventory screen
2. Click "Import CSV" button
3. Select CSV file
4. Review import preview
5. Click "Import" to confirm

**CSV Requirements:**
- First row must be headers
- `name` column is required
- `sku` must be unique if provided
- `cost` defaults to 0 if blank
- Unknown columns are ignored

**Import Expenses:**
1. Go to Expenses screen
2. Click "Import CSV" button
3. Select CSV file
4. Review import preview
5. Click "Import" to confirm

**CSV Requirements:**
- `name`, `category`, `amount`, `expense_date` are required
- Splits are auto-calculated if not provided
- Validates splits sum to amount

### Import Error Handling

```json
{
  "success": true,
  "imported": 25,
  "failed": 2,
  "errors": [
    {
      "row": 5,
      "error": "Duplicate SKU: SONY-001"
    },
    {
      "row": 12,
      "error": "Invalid amount: not a number"
    }
  ]
}
```

Successfully imported items are added, failed rows are reported with specific error messages.

### Best Practices

- **Backup before import:** Always backup before bulk importing
- **Test with small sample:** Import 5-10 rows first to verify format
- **Clean your data:** Remove special characters, verify numbers
- **Use templates:** Export existing data to see correct CSV format

---

## Smart Defaults

The app remembers your last-used values for faster data entry.

### Remembered Fields

**Item Form:**
- Last used category
- Last used bin location
- Last used status

**Sale Form:**
- Last used platform
- Last used fee rate

**Expense Form:**
- Last used category
- Last used split percentages

### How It Works

1. **Create first entry:** Fill out form completely
2. **Submit form:** App saves your choices to browser localStorage
3. **Create next entry:** Form pre-fills with last-used values
4. **Override as needed:** Edit any field before submitting

### Privacy

- Smart defaults are stored **locally in your browser**
- Not synced across devices
- Clear browser data = clear defaults
- No personal data sent to server

---

## Backup & Restore

Protect your data with full database backups.

### Create Backup

**Manual Backup:**
1. Go to Settings screen
2. Click "Download Backup"
3. JSON file downloads: `reseller-ops-backup-2025-12-26.json`

**Keyboard Shortcut:**
- Press `Ctrl/⌘ + B` anywhere to trigger backup

**Automated Backups (Recommended):**
- Set a reminder to backup weekly
- Store backups in cloud storage (Google Drive, Dropbox, etc.)
- Keep last 3-4 backups for versioning

### Restore from Backup

**⚠️ WARNING:** Restore is **destructive** - it replaces ALL current data!

1. Go to Settings screen
2. Click "Restore from Backup"
3. Select backup JSON file
4. **Confirm** - this cannot be undone!
5. App reloads with restored data

### What's Included in Backup

```json
{
  "version": "0002",
  "timestamp": "2025-12-26T15:00:00Z",
  "items": [...],          // All inventory items
  "sales": [...],          // All sales records
  "expenses": [...],       // All expense records
  "lots": [...],           // All lots
  "pricing_drafts": [...], // All pricing drafts
  "settings": [...],       // App settings
  "fee_profiles": [...]    // Platform fee profiles
}
```

### Backup Best Practices

1. **Weekly backups:** Download backup every Sunday
2. **Before bulk operations:** Backup before CSV imports, bulk deletes
3. **Version control:** Keep last 3-4 backups with dates in filename
4. **Cloud storage:** Store backups in Google Drive/Dropbox for safety
5. **Test restores:** Occasionally test restore process on TEST environment

---

## Real-Time Validation

Get instant feedback as you type to prevent errors.

### SKU Validation

**Where:** Item form → SKU field

**Behavior:**
- Type SKU → debounced check (500ms delay)
- **Available:** Green checkmark ✅
- **Already exists:** Red X ❌ with error message
- **Editing existing item:** Excludes current item from check

**Implementation:**
```
User types: "SONY-001"
→ Wait 500ms
→ API call: /api/validate/sku?sku=SONY-001
→ Response: { available: false }
→ Show error: "SKU already exists"
```

### Amount Validation

**Where:** Expense form → Split fields

**Behavior:**
- Type split amounts
- Live validation: Splits must sum to total amount
- **Valid:** Green indicator, submit enabled
- **Invalid:** Red error, submit disabled
- **Tolerance:** ±$0.01 allowed for rounding

### Date Validation

**Where:** All date fields

**Behavior:**
- Invalid date format → Red border
- Future dates (where invalid) → Warning message
- Date range validation (start must be before end)

### Form Submission

All forms validate on submit:
- **Required fields:** Highlighted in red if missing
- **Invalid values:** Specific error messages
- **Submit disabled:** Until all errors resolved

---

## Mobile & PWA

Reseller Ops is fully mobile-optimized and can be installed as a Progressive Web App (PWA).

### Mobile Responsiveness

**Adaptive Layouts:**
- **Desktop (>768px):** Full table views, side-by-side forms
- **Mobile (<768px):** Card layouts, stacked forms, full-screen modals

**Touch-Friendly:**
- **44px minimum** tap targets (iOS/Android guidelines)
- Large buttons and form fields
- Swipe gestures for modals (close by swiping down)

**Mobile-Specific Features:**
- Full-screen modals for better focus
- Single-column forms for easier typing
- Larger tap areas for checkboxes and buttons
- Photo upload from camera or gallery

### Install as PWA

**iOS (iPhone/iPad):**
1. Open app in Safari
2. Tap Share button
3. Tap "Add to Home Screen"
4. Name it "Reseller Ops"
5. Tap "Add"

**Android:**
1. Open app in Chrome
2. Tap menu (three dots)
3. Tap "Add to Home Screen"
4. Tap "Add"

**Desktop (Chrome/Edge):**
1. Click install icon in address bar
2. Click "Install"

### PWA Features

**After Installation:**
- App icon on home screen
- Full-screen experience (no browser UI)
- Faster loading (cached assets)
- Works like a native app

**Offline Support (Coming Soon):**
- View cached data offline
- Queue operations for sync when online
- Service worker for background sync

---

## Accessibility

Reseller Ops follows web accessibility best practices.

### Keyboard Navigation

- **All interactive elements** are keyboard accessible
- **Logical tab order** through forms
- **Focus indicators** visible on all elements
- **Skip links** to bypass navigation

### Screen Reader Support

- **ARIA labels** on all buttons and form fields
- **Semantic HTML** (proper heading hierarchy)
- **Alt text** on all images and icons
- **Form error announcements** via ARIA live regions

### Visual Accessibility

- **High contrast** text and backgrounds (WCAG AA compliant)
- **Resizable text** (supports browser zoom up to 200%)
- **Color not sole indicator** (icons + text labels)
- **Focus indicators** visible and clear

---

## Performance Tips

### Faster Data Entry

1. **Use keyboard shortcuts:** `Ctrl+N` faster than clicking "New Entry"
2. **Smart defaults:** Let app pre-fill last-used values
3. **Batch operations:** Update multiple items at once
4. **CSV imports:** Bulk import for new inventory hauls

### Optimize Search

1. **Use filters:** Narrow results before searching
2. **Sort first:** Organize data, then search
3. **Global search:** Searches across current screen only

### Reduce Load Times

1. **Limit photo uploads:** 5-6 photos per item max
2. **Archive old data:** Export and delete sold items annually
3. **Clear browser cache:** If app feels slow
4. **Use modern browser:** Chrome, Firefox, Edge, Safari

---

## Tips & Tricks

### Workflow Optimizations

**Inventory Processing:**
1. Photo items → Batch upload photos (5 at a time)
2. Create items → Use smart defaults, quick entry
3. Categorize → Use AI category suggestions
4. Price → Use AI price suggestions
5. List → Generate SEO with AI

**End of Month:**
1. Record all sales → CSV import if from external system
2. Record expenses → CSV import for receipts
3. Run reports → Profit & Loss, Tax Summary
4. Download backup → Store in cloud

**Tax Time:**
1. Export tax year data → JSON backup
2. Run Florida sales tax report → Calculate liability
3. Run federal tax report → Estimate self-employment tax
4. Export CSV → Share with accountant

### Common Patterns

**Quick Item Entry:**
```
Ctrl+N → Fill name → Tab → Fill cost → Enter
(Takes ~10 seconds with smart defaults)
```

**Bulk Delete:**
```
Select all → Delete → Confirm
(Faster than deleting one by one)
```

**Weekly Review:**
```
Dashboard (1) → Check insights → Reports (7) → Review P&L
(Quick business health check)
```

---

## Support & Feedback

Found a bug or have a feature request?

1. **Check docs:** Review [API docs](./API.md) and [AI guide](./AI_FEATURES.md)
2. **GitHub Issues:** Report bugs at [github.com/yourrepo/issues](https://github.com)
3. **Feature requests:** Open discussion in GitHub Discussions

---

## Summary

Reseller Ops UX features are designed to:
- **Save time** with keyboard shortcuts and batch operations
- **Prevent errors** with real-time validation
- **Improve efficiency** with smart defaults and CSV import
- **Protect data** with backups and restore
- **Work anywhere** with mobile PWA support

Master these features to run your eBay reselling business like a pro!
