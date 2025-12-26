# AI Features Guide

Reseller Ops includes 7 AI-powered features built on Cloudflare Workers AI, all designed to save time and improve your eBay reselling business.

## Overview

All AI features are:
- **Optional** - The app works great without AI
- **Suggestions only** - You have final say on all decisions
- **Free tier** - Uses Cloudflare Workers AI free tier (10,000 neurons/day)
- **Fast** - Responses typically in 1-2 seconds
- **Privacy-friendly** - Data stays within Cloudflare infrastructure

## AI Models Used

- **Text Generation:** `@cf/meta/llama-3-8b-instruct`
- **Image Classification:** `@cf/microsoft/resnet-50`

---

## 1. SEO Generation

**What it does:** Generates eBay-optimized listing titles, descriptions, and keywords

**Where to find it:** Pricing & SEO screen → "✨ AI Generate SEO" button

**How it works:**
1. Click "✨ AI Generate SEO" on any pricing draft
2. AI analyzes item name, description, and category
3. Returns:
   - **Title:** 80-character eBay-compliant title with searchable terms
   - **Description:** 3-5 sentence SEO-rich description emphasizing benefits
   - **Keywords:** 5-7 relevant search keywords
   - **Confidence:** How confident the AI is (0-100%)

**Example:**

Input:
```
Name: Sony Walkman WM-10
Description: Vintage cassette player
Category: Electronics
```

Output:
```
Title: "Vintage Sony Walkman WM-10 Personal Cassette Player - Tested & Working"
Description: "Rare vintage Sony Walkman WM-10 in excellent condition. Fully tested
and working perfectly. Includes original headphones and case. Great for collectors!"
Keywords: vintage, sony, walkman, cassette, player, retro, 80s
Confidence: 85%
```

**Tips:**
- More detailed input = better output
- Include condition, accessories, unique features
- Review and edit before applying
- Use keywords in your actual listing for SEO boost

**Cost:** ~2,500 neurons per generation (~4 per day on free tier)

---

## 2. Price Suggestion

**What it does:** Recommends pricing based on item details and market trends

**Where to find it:** Pricing & SEO screen → "✨ AI Suggest Price" button

**How it works:**
1. Click "✨ AI Suggest Price" on any pricing draft
2. AI analyzes name, description, category, condition
3. Returns:
   - **Min:** Minimum realistic price
   - **Max:** Maximum realistic price
   - **Suggested:** Recommended sweet spot
   - **Reasoning:** Why this price makes sense
   - **Confidence:** How confident the AI is

**Example:**

Input:
```
Name: Vintage Sony Walkman
Description: Cassette player in working condition
Category: Electronics
Condition: Used - Excellent
```

Output:
```
Min: $45.00
Max: $75.00
Suggested: $59.99
Reasoning: "Based on recent eBay sales of similar vintage Sony Walkmans in
working condition, prices typically range from $45-$75. Suggested price of
$59.99 is competitive while accounting for tested/working condition."
Confidence: 75%
```

**Tips:**
- Cross-reference with actual eBay sold listings
- Adjust for your specific item's condition
- Consider your cost basis and desired profit margin
- Test different price points to find your market

**Cost:** ~1,000 neurons per suggestion (~10 per day on free tier)

---

## 3. Category Suggestion

**What it does:** Auto-categorizes items and expenses based on text description

**Where to find it:**
- Item form → "✨ AI Suggest Category" button
- Expense form → "✨ AI Suggest Category" button

**How it works:**
1. Start typing item name or expense description
2. Click "✨ AI Suggest Category"
3. AI analyzes text and suggests most appropriate category
4. Returns category and confidence score

**Available Categories:**

**Items:**
- Electronics
- Clothing
- Books
- Toys
- Home & Garden
- Collectibles
- Jewelry
- Other

**Expenses:**
- Inventory
- Operations
- Shipping
- Marketing
- Fees
- Vehicle
- Office
- Other

**Example:**

Input: `"iPhone 13 Pro Max smartphone"`

Output:
```
Category: Electronics
Confidence: 92%
```

**Tips:**
- Works best with descriptive text
- Review suggestion before accepting
- Teaches the AI over time (indirectly via prompts)
- Fallback categories are smart (e.g., "Other" for unclear items)

**Cost:** ~500 neurons per suggestion (~20 per day on free tier)

---

## 4. Photo Analysis

**What it does:** Analyzes uploaded photos to detect item type, condition, and category

**Where to find it:** Item form → Upload photo → "✨ AI Analyze Photo" button

**How it works:**
1. Upload a photo of your item
2. Click "✨ AI Analyze Photo"
3. AI uses image classification to detect:
   - **Item Type:** What the item is
   - **Condition:** Estimated condition
   - **Suggested Category:** Best category match
   - **Confidence:** How confident the AI is

**Example:**

Input: Photo of a vintage cassette player

Output:
```
Item Type: Portable cassette player
Condition: Used
Suggested Category: Electronics
Confidence: 88%
```

**Tips:**
- Use clear, well-lit photos
- Show the item from multiple angles
- Works best with common items
- Review and adjust as needed

**Limitations:**
- Cannot detect specific brand/model (use manual description)
- Condition estimate is rough (inspect item yourself)
- Works better with distinct items (electronics, toys) than generic items

**Cost:** ~1,500 neurons per analysis (~6-7 per day on free tier)

---

## 5. Dashboard Insights

**What it does:** Generates personalized business insights, warnings, and opportunities

**Where to find it:** Dashboard screen → Automatically loaded

**How it works:**
1. AI analyzes your recent data:
   - Recent sales (profit, platforms, categories)
   - Current inventory (count, status, aging)
   - Expenses (totals, categories)
2. Returns three types of feedback:
   - **Insights:** Positive observations about your business
   - **Warnings:** Potential issues to address
   - **Opportunities:** Suggestions to improve

**Example:**

Output:
```
Insights:
- Your average profit margin is 47%, which is above the industry average
- Electronics category has highest sell-through rate at 85%

Warnings:
- 5 items have been in inventory for over 90 days
- Florida sales tax liability is $127 - consider remitting soon

Opportunities:
- Consider sourcing more electronics - they're selling fastest
- 15 items are ready to list - could generate ~$450 in potential sales
```

**Tips:**
- Check dashboard weekly for fresh insights
- Act on opportunities to grow your business
- Address warnings before they become problems
- Insights adapt to your business patterns

**Cost:** ~500 neurons per refresh (~20 per day on free tier)

---

## 6. Expense Splitting

**What it does:** Suggests how to allocate expenses across inventory, operations, and other

**Where to find it:** Expense form → "✨ AI Suggest Split" button

**How it works:**
1. Enter expense name, category, and amount
2. Click "✨ AI Suggest Split"
3. AI suggests dollar amounts for:
   - **Inventory:** Cost of goods for resale
   - **Operations:** Business operating costs
   - **Other:** Non-deductible or personal
4. Returns allocation and confidence score

**Example:**

Input:
```
Name: Storage unit rental
Category: Storage
Amount: $100.00
```

Output:
```
Inventory: $70.00 (70%)
Operations: $20.00 (20%)
Other: $10.00 (10%)
Confidence: 82%
```

**Reasoning:** Storage units primarily hold inventory, so most cost is inventory-related.

**Tips:**
- Review IRS guidelines for your specific situation
- Adjust based on your actual usage
- Keep records justifying your splits
- Consistent splitting = easier tax time

**Cost:** ~800 neurons per suggestion (~12 per day on free tier)

---

## 7. Description Enhancement

**What it does:** Improves basic item descriptions to be more compelling and SEO-friendly

**Where to find it:** Item form → "✨ AI Enhance Description" button

**How it works:**
1. Enter a basic description
2. Click "✨ AI Enhance Description"
3. AI enhances it to be:
   - More descriptive and detailed
   - Include potential benefits
   - Add relevant keywords naturally
   - Professional and trustworthy
4. Returns enhanced description and list of improvements

**Example:**

Input: `"Sony Walkman, works good"`

Output:
```
Enhanced: "Beautiful vintage Sony Walkman in excellent working condition.
This classic portable cassette player has been thoroughly tested and plays
tapes perfectly. Includes original headphones and protective case. A must-have
for vintage electronics collectors and 80s enthusiasts!"

Improvements:
- Added descriptive adjectives for appeal
- Emphasized working condition and testing
- Included collector appeal
- Made description more engaging
```

**Tips:**
- Start with basics, let AI fill in the details
- Review for accuracy (don't claim features you don't have)
- Use enhanced descriptions in your listings
- Edit to match your voice/style

**Cost:** ~1,200 neurons per enhancement (~8 per day on free tier)

---

## Free Tier Limits & Monitoring

### Daily Limits

Cloudflare Workers AI free tier provides:
- **10,000 neurons/day**
- Resets at midnight UTC

### Typical Daily Usage

Conservative estimates for daily AI operations:
- 5 SEO generations: ~2,500 neurons
- 10 category suggestions: ~500 neurons
- 5 price suggestions: ~1,000 neurons
- 3 photo analyses: ~1,500 neurons
- 1 dashboard insights refresh: ~500 neurons
- **Total: ~6,000 neurons/day (60% of limit)**

### Monitoring Your Usage

Check AI usage anytime:
1. Go to Settings screen
2. View "AI Usage Monitor" section
3. See:
   - Daily usage (e.g., 6,500 / 10,000)
   - Percentage used (65%)
   - Breakdown by endpoint
   - Time until reset

**Warnings:**
- **80% usage:** Yellow warning appears
- **100% usage:** AI features disabled until reset
- **Quota exceeded:** Features return fallback suggestions

### Fallback Behavior

When AI is unavailable (quota exceeded, network issues), the app provides:
- **SEO:** Basic formatting based on item name
- **Category:** Rule-based categorization
- **Price:** Conservative estimates ($5-$50 range)
- **Splits:** Category-based defaults
- **Descriptions:** Original text returned
- **Confidence:** Low scores (0.2-0.4) indicate fallback

---

## Best Practices

### 1. Use AI Strategically

Don't use AI for every operation. Good times to use AI:
- ✅ High-value items (worth optimizing SEO/pricing)
- ✅ Unfamiliar items (AI can suggest category/price)
- ✅ Bulk operations (AI categorize while importing)
- ❌ Low-value items (<$10) - manual is faster
- ❌ Items you know well - trust your expertise

### 2. Review All Suggestions

AI is a tool, not a replacement for your judgment:
- Always review SEO titles for accuracy
- Verify pricing against actual sold listings
- Confirm categories make sense
- Check enhanced descriptions for factual accuracy

### 3. Optimize AI Inputs

Better input = better output:
- Provide detailed item descriptions
- Include condition, brand, model
- Mention accessories, packaging, etc.
- Upload clear, well-lit photos

### 4. Monitor Your Usage

Check AI usage monitor weekly:
- Identify which features you use most
- Adjust usage if approaching limits
- Plan heavy AI days (e.g., Sunday inventory processing)

### 5. Combine AI with Research

AI suggestions are starting points:
1. Get AI suggestion
2. Research on eBay sold listings
3. Adjust based on your item's specifics
4. Apply final decision

---

## Troubleshooting

### "AI quota exceeded" error

**Cause:** You've used 10,000 neurons today

**Solution:**
1. Wait until midnight UTC for reset (check timer in Settings)
2. Manual operations still work normally
3. AI features will return fallback suggestions
4. Plan to use AI earlier in the day tomorrow

### Low confidence scores

**Cause:** Unclear inputs or uncommon items

**Solutions:**
- Add more details to item description
- Upload clearer photos
- Try different wording
- Accept that some items are genuinely hard to categorize

### "AI unavailable" warning

**Cause:** Cloudflare Workers AI is temporarily down

**Solution:**
- Wait a few minutes and try again
- App will use fallback suggestions
- Check [Cloudflare Status](https://www.cloudflarestatus.com/)

### Inaccurate suggestions

**Cause:** AI doesn't have context about your specific item

**Solutions:**
- Provide more detailed input
- Cross-reference with eBay research
- Use AI as a starting point, not final answer
- Report extreme inaccuracies (helps improve prompts)

---

## Privacy & Security

### Data Handling

- AI requests are processed by Cloudflare Workers AI
- Data is NOT stored by Cloudflare after processing
- No training on your data
- Privacy-friendly architecture

### What AI Sees

AI has access to:
- Item names, descriptions, categories (what you provide)
- Photo data (only during analysis, not stored)
- Aggregate statistics (for dashboard insights)

AI does NOT see:
- Your identity
- Customer information
- Financial account details
- Anything outside the specific request

---

## Future AI Features (Roadmap)

Potential AI enhancements for future versions:
- Listing quality scores
- Seasonal pricing adjustments
- Inventory restocking suggestions
- Competitor analysis
- Automated listing generation
- Multi-language support

---

## Support

For AI-related issues:
1. Check Settings → AI Usage Monitor
2. Review [API documentation](./API.md#ai-api)
3. Verify inputs are detailed and accurate
4. Report persistent issues via GitHub

---

## Summary

AI features in Reseller Ops are designed to:
- **Save time** on repetitive tasks
- **Improve quality** of listings and pricing
- **Provide insights** you might miss
- **Stay within free limits** for personal use
- **Remain optional** - manual operations always work

Use AI to enhance your workflow, not replace your expertise!
