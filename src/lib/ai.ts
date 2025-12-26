/**
 * AI Service Library
 * Provides AI-powered features using Cloudflare Workers AI
 */

// AI Model Constants
const TEXT_MODEL = '@cf/meta/llama-3-8b-instruct';
const IMAGE_MODEL = '@cf/microsoft/resnet-50';

/**
 * Generate SEO-optimized eBay listing
 */
export async function generateSEO(
  ai: any,
  item: {
    name: string;
    description?: string;
    category?: string;
  }
): Promise<{
  title: string;
  description: string;
  keywords: string[];
  confidence: number;
}> {
  const prompt = `You are an eBay listing optimization expert. Create an SEO-optimized listing for this item:

Item Name: ${item.name}
Description: ${item.description || 'No description provided'}
Category: ${item.category || 'Unknown'}

Generate:
1. A compelling eBay title (MAXIMUM 80 characters, include key searchable terms)
2. A detailed SEO-rich description (3-5 sentences, emphasize benefits and features)
3. 5-7 relevant keywords for search optimization

Respond in this exact JSON format:
{
  "title": "your 80-char max title here",
  "description": "your SEO description here",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}`;

  try {
    const response = await ai.run(TEXT_MODEL, {
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.response || '';

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI response did not contain valid JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and truncate title to 80 chars
    const title = (parsed.title || item.name).substring(0, 80);

    return {
      title,
      description: parsed.description || item.description || '',
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      confidence: 0.75
    };
  } catch (error) {
    console.error('AI SEO generation failed:', error);
    // Fallback to basic formatting
    return {
      title: item.name.substring(0, 80),
      description: item.description || `${item.name} - Great condition, ready to ship!`,
      keywords: [item.category || 'collectible', 'vintage', 'rare'].filter(Boolean),
      confidence: 0.3
    };
  }
}

/**
 * Auto-categorize item or expense
 */
export async function suggestCategory(
  ai: any,
  text: string,
  type: 'item' | 'expense'
): Promise<{
  category: string;
  confidence: number;
}> {
  const categories = type === 'item'
    ? ['Electronics', 'Clothing', 'Books', 'Toys', 'Home & Garden', 'Collectibles', 'Jewelry', 'Other']
    : ['Inventory', 'Operations', 'Shipping', 'Marketing', 'Fees', 'Vehicle', 'Office', 'Other'];

  const prompt = `Categorize this ${type}: "${text}"

Available categories: ${categories.join(', ')}

Respond with ONLY the most appropriate category name from the list above. Do not add any explanation.`;

  try {
    const response = await ai.run(TEXT_MODEL, {
      messages: [{ role: 'user', content: prompt }]
    });

    const content = (response.response || '').trim();

    // Find matching category (case-insensitive)
    const matchedCategory = categories.find(
      cat => content.toLowerCase().includes(cat.toLowerCase())
    );

    return {
      category: matchedCategory || categories[categories.length - 1], // Default to 'Other'
      confidence: matchedCategory ? 0.8 : 0.4
    };
  } catch (error) {
    console.error('AI categorization failed:', error);
    return {
      category: categories[categories.length - 1], // Default to 'Other'
      confidence: 0.2
    };
  }
}

/**
 * Suggest pricing based on description
 */
export async function suggestPrice(
  ai: any,
  item: {
    name: string;
    description?: string;
    category?: string;
    condition?: string;
  }
): Promise<{
  min: number;
  max: number;
  suggested: number;
  confidence: number;
  reasoning: string;
}> {
  const prompt = `As a reselling pricing expert, suggest a price range for this item:

Name: ${item.name}
Description: ${item.description || 'No description'}
Category: ${item.category || 'Unknown'}
Condition: ${item.condition || 'Used'}

Provide a realistic eBay selling price range. Respond in this exact JSON format:
{
  "min": 10,
  "max": 50,
  "suggested": 25,
  "reasoning": "brief explanation of pricing"
}`;

  try {
    const response = await ai.run(TEXT_MODEL, {
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.response || '';

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI response did not contain valid JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      min: parseFloat(parsed.min) || 5,
      max: parseFloat(parsed.max) || 50,
      suggested: parseFloat(parsed.suggested) || 20,
      confidence: 0.65,
      reasoning: parsed.reasoning || 'Based on similar items and market trends'
    };
  } catch (error) {
    console.error('AI pricing failed:', error);
    // Fallback to conservative estimate
    return {
      min: 5,
      max: 50,
      suggested: 20,
      confidence: 0.3,
      reasoning: 'Default pricing estimate - adjust based on your research'
    };
  }
}

/**
 * Analyze photo and detect item details
 */
export async function analyzePhoto(
  ai: any,
  photoData: ArrayBuffer
): Promise<{
  itemType: string;
  condition: string;
  suggestedCategory: string;
  confidence: number;
}> {
  try {
    // Note: Image classification with Workers AI is simplified
    // In production, you'd use vision models more extensively
    const response = await ai.run(IMAGE_MODEL, {
      image: Array.from(new Uint8Array(photoData))
    });

    const labels = response.labels || [];
    const topLabel = labels[0]?.label || 'Unknown Item';

    // Map image labels to categories
    const categoryMapping: Record<string, string> = {
      'electronics': 'Electronics',
      'phone': 'Electronics',
      'computer': 'Electronics',
      'clothing': 'Clothing',
      'apparel': 'Clothing',
      'book': 'Books',
      'toy': 'Toys',
      'furniture': 'Home & Garden',
      'jewelry': 'Jewelry',
      'collectible': 'Collectibles'
    };

    const suggestedCategory = Object.entries(categoryMapping).find(
      ([key]) => topLabel.toLowerCase().includes(key)
    )?.[1] || 'Other';

    return {
      itemType: topLabel,
      condition: 'Used', // Default - would need more sophisticated analysis
      suggestedCategory,
      confidence: labels[0]?.score || 0.5
    };
  } catch (error) {
    console.error('AI photo analysis failed:', error);
    return {
      itemType: 'Unknown',
      condition: 'Used',
      suggestedCategory: 'Other',
      confidence: 0.2
    };
  }
}

/**
 * Generate smart dashboard insights
 */
export async function generateInsights(
  ai: any,
  data: {
    recentSales: any[];
    inventory: any[];
    expenses: any[];
  }
): Promise<{
  insights: string[];
  warnings: string[];
  opportunities: string[];
}> {
  const salesCount = data.recentSales.length;
  const inventoryCount = data.inventory.length;
  const totalExpenses = data.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const prompt = `As a reselling business advisor, analyze this data and provide actionable insights:

Recent Sales: ${salesCount} sales
Inventory Items: ${inventoryCount} items
Total Expenses: $${totalExpenses.toFixed(2)}

Provide 3 insights, 2 warnings, and 2 opportunities. Respond in this exact JSON format:
{
  "insights": ["insight 1", "insight 2", "insight 3"],
  "warnings": ["warning 1", "warning 2"],
  "opportunities": ["opportunity 1", "opportunity 2"]
}`;

  try {
    const response = await ai.run(TEXT_MODEL, {
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.response || '';

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI response did not contain valid JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : []
    };
  } catch (error) {
    console.error('AI insights generation failed:', error);
    // Fallback to rule-based insights
    const insights = [];
    const warnings = [];
    const opportunities = [];

    if (salesCount > 10) {
      insights.push('Strong sales activity this period');
    }
    if (inventoryCount > 50) {
      warnings.push('Large inventory - consider listing more items');
    }
    if (totalExpenses > 1000) {
      warnings.push('High expenses this period - review spending');
    }
    if (salesCount < 5 && inventoryCount > 20) {
      opportunities.push('Increase listing frequency to move inventory');
    }

    return { insights, warnings, opportunities };
  }
}

/**
 * Suggest expense split percentages
 */
export async function suggestExpenseSplit(
  ai: any,
  expense: {
    name: string;
    category: string;
    amount: number;
  }
): Promise<{
  inventory: number;
  operations: number;
  other: number;
  confidence: number;
}> {
  const prompt = `As a tax advisor for reselling businesses, suggest how to split this expense:

Expense: ${expense.name}
Category: ${expense.category}
Amount: $${expense.amount}

Split the expense into:
- Inventory (cost of goods for resale)
- Operations (business operating costs)
- Other (non-deductible or personal)

Respond in this exact JSON format (percentages must sum to 100):
{
  "inventory": 60,
  "operations": 40,
  "other": 0
}`;

  try {
    const response = await ai.run(TEXT_MODEL, {
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.response || '';

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI response did not contain valid JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const inventory = parseFloat(parsed.inventory) || 0;
    const operations = parseFloat(parsed.operations) || 0;
    const other = parseFloat(parsed.other) || 0;

    // Convert percentages to dollar amounts
    const total = inventory + operations + other;
    const normalizedInventory = total > 0 ? (inventory / total) * expense.amount : 0;
    const normalizedOperations = total > 0 ? (operations / total) * expense.amount : 0;
    const normalizedOther = total > 0 ? (other / total) * expense.amount : 0;

    return {
      inventory: Math.round(normalizedInventory * 100) / 100,
      operations: Math.round(normalizedOperations * 100) / 100,
      other: Math.round(normalizedOther * 100) / 100,
      confidence: 0.7
    };
  } catch (error) {
    console.error('AI expense split failed:', error);
    // Fallback to category-based defaults
    const categoryDefaults: Record<string, [number, number, number]> = {
      'Inventory': [100, 0, 0],
      'Operations': [0, 100, 0],
      'Shipping': [0, 100, 0],
      'Marketing': [0, 100, 0],
      'Fees': [0, 100, 0],
      'Vehicle': [0, 100, 0],
      'Office': [0, 100, 0]
    };

    const [invPct, opsPct, otherPct] = categoryDefaults[expense.category] || [50, 50, 0];

    return {
      inventory: Math.round((expense.amount * invPct / 100) * 100) / 100,
      operations: Math.round((expense.amount * opsPct / 100) * 100) / 100,
      other: Math.round((expense.amount * otherPct / 100) * 100) / 100,
      confidence: 0.5
    };
  }
}

/**
 * Enhance item description
 */
export async function enhanceDescription(
  ai: any,
  basicDescription: string
): Promise<{
  enhanced: string;
  improvements: string[];
}> {
  const prompt = `As an eBay copywriting expert, enhance this product description to be more compelling and SEO-friendly:

Original: "${basicDescription}"

Make it:
- More descriptive and detailed
- Include potential benefits and features
- Add relevant keywords naturally
- Keep it professional and trustworthy
- 3-5 sentences maximum

Respond in this exact JSON format:
{
  "enhanced": "your enhanced description here",
  "improvements": ["improvement 1", "improvement 2"]
}`;

  try {
    const response = await ai.run(TEXT_MODEL, {
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.response || '';

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI response did not contain valid JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      enhanced: parsed.enhanced || basicDescription,
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : ['Made more descriptive']
    };
  } catch (error) {
    console.error('AI description enhancement failed:', error);
    return {
      enhanced: basicDescription,
      improvements: ['AI enhancement unavailable']
    };
  }
}
