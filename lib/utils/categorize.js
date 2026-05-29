// Smart categorization engine for expenses

export const CATEGORIES = {
  Food: {
    color: '#f97316',
    keywords: [
      'dominos', "domino's", 'pizza', 'zomato', 'swiggy', 'restaurant', 'cafe',
      'starbucks', 'mcdonald', 'kfc', 'burger', 'subway', 'biryani', 'food',
      'dhaba', 'bakery', 'sweets', 'haldiram', 'barbeque', 'eatery', 'kitchen',
      'chai', 'tea', 'coffee', 'juice', 'bistro', 'diner', 'meal', 'lunch',
      'dinner', 'breakfast', 'snack',
    ],
  },
  Travel: {
    color: '#3b82f6',
    keywords: [
      'uber', 'ola', 'taxi', 'metro', 'rapido', 'cab', 'auto', 'rickshaw',
      'irctc', 'railway', 'train', 'flight', 'indigo', 'spicejet', 'airindia',
      'vistara', 'goair', 'airport', 'fuel', 'petrol', 'diesel', 'iocl', 'hp',
      'bharatpetroleum', 'shell', 'travel', 'bus', 'transport', 'parking',
      'toll', 'fastag',
    ],
  },
  Shopping: {
    color: '#a855f7',
    keywords: [
      'amazon', 'flipkart', 'myntra', 'mall', 'ajio', 'meesho', 'nykaa',
      'shoppers', 'lifestyle', 'westside', 'zudio', 'pantaloons', 'reliance',
      'dmart', 'bigbasket', 'grofers', 'blinkit', 'zepto', 'store', 'shop',
      'mart', 'retail', 'fashion', 'clothing', 'apparel', 'electronics',
      'croma', 'vijaysales',
    ],
  },
  Entertainment: {
    color: '#ec4899',
    keywords: [
      'movie', 'netflix', 'spotify', 'bookmyshow', 'cinema', 'pvr', 'inox',
      'theatre', 'concert', 'gaming', 'youtube', 'prime', 'hotstar', 'disney',
      'sonyliv', 'zee5', 'voot', 'jiocinema', 'wynk', 'gaana', 'playstation',
      'xbox', 'steam', 'entertainment',
    ],
  },
  Health: {
    color: '#22c55e',
    keywords: [
      'hospital', 'medical', 'pharmacy', 'apollo', 'clinic', 'doctor',
      'medicine', 'pharmeasy', 'netmeds', 'tata1mg', '1mg', 'medplus',
      'wellness', 'diagnostic', 'lab', 'pathology', 'fortis', 'max', 'aiims',
      'manipal', 'dental', 'health', 'fitness', 'gym', 'yoga',
    ],
  },
  Utilities: {
    color: '#eab308',
    keywords: [
      'electricity', 'water', 'internet', 'airtel', 'jio', 'vodafone', 'vi',
      'bsnl', 'broadband', 'wifi', 'gas', 'lpg', 'indane', 'bharatgas',
      'bill', 'recharge', 'postpaid', 'prepaid', 'tata power', 'adani',
      'bescom', 'mseb', 'utility', 'dth', 'tatasky', 'dishtv',
    ],
  },
  Other: {
    color: '#64748b',
    keywords: [],
  },
};

export const CATEGORY_LIST = Object.keys(CATEGORIES);

export function categorize(text) {
  if (!text) return { category: 'Other', confidence: 30 };
  const lower = text.toLowerCase();

  let bestMatch = { category: 'Other', confidence: 30, hits: 0 };

  for (const [cat, def] of Object.entries(CATEGORIES)) {
    if (cat === 'Other') continue;
    let hits = 0;
    let strongHit = false;
    for (const kw of def.keywords) {
      // exact word boundary preferred
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lower)) {
        hits++;
        // a long brand/word counts as strong
        if (kw.length >= 5) strongHit = true;
      } else if (lower.includes(kw)) {
        hits += 0.6;
      }
    }
    if (hits > bestMatch.hits) {
      const base = strongHit ? 78 : 60;
      const confidence = Math.min(98, Math.round(base + hits * 6));
      bestMatch = { category: cat, confidence, hits };
    }
  }

  return { category: bestMatch.category, confidence: bestMatch.confidence };
}

// Extract structured fields from raw OCR text
export function parseReceipt(text) {
  if (!text) return { merchant: '', amount: 0, date: '' };

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // ---- Merchant: usually one of the first non-numeric lines ----
  let merchant = '';
  for (const line of lines.slice(0, 8)) {
    const stripped = line.replace(/[^a-zA-Z0-9 &'.\-]/g, '').trim();
    if (stripped.length < 3) continue;
    if (/^\d+/.test(stripped)) continue; // skip lines starting with numbers
    if (/(invoice|receipt|bill|gstin|tel|phone|address|date|time)/i.test(stripped)) continue;
    // Has at least 2 letters
    const letters = stripped.replace(/[^a-zA-Z]/g, '');
    if (letters.length >= 3) {
      merchant = stripped
        .split(' ')
        .filter(Boolean)
        .slice(0, 5)
        .join(' ');
      break;
    }
  }
  if (!merchant && lines.length) merchant = lines[0].slice(0, 40);

  // ---- Amount: find max number with currency context, or labelled total ----
  let amount = 0;
  const totalRegexes = [
    /(?:grand\s*total|total\s*amount|net\s*amount|amount\s*due|total|amount|sub\s*total|paid)\D{0,10}([0-9]{1,6}(?:[,.][0-9]{1,3})*(?:\.[0-9]{1,2})?)/i,
  ];
  for (const line of [...lines].reverse()) {
    for (const r of totalRegexes) {
      const m = line.match(r);
      if (m && m[1]) {
        const v = parseFloat(m[1].replace(/,/g, ''));
        if (!isNaN(v) && v > amount) amount = v;
      }
    }
  }
  if (!amount) {
    // fallback: largest currency-like number anywhere
    const allNums = [];
    const re = /(?:₹|rs\.?|inr|\$|usd)?\s*([0-9]{1,6}(?:[,.][0-9]{1,3})*(?:\.[0-9]{1,2})?)/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
      const v = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(v) && v >= 10 && v < 1000000) allNums.push(v);
    }
    if (allNums.length) amount = Math.max(...allNums);
  }

  // ---- Date ----
  let date = '';
  const datePatterns = [
    /(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/,
    /(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/,
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{2,4})/i,
  ];
  for (const line of lines) {
    for (let i = 0; i < datePatterns.length; i++) {
      const m = line.match(datePatterns[i]);
      if (m) {
        try {
          if (i === 0) {
            const yyyy = m[1], mm = m[2].padStart(2, '0'), dd = m[3].padStart(2, '0');
            date = `${yyyy}-${mm}-${dd}`;
          } else if (i === 1) {
            let yyyy = m[3];
            if (yyyy.length === 2) yyyy = '20' + yyyy;
            const mm = m[2].padStart(2, '0');
            const dd = m[1].padStart(2, '0');
            date = `${yyyy}-${mm}-${dd}`;
          } else if (i === 2) {
            const months = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };
            const dd = m[1].padStart(2, '0');
            const mm = months[m[2].slice(0,3).toLowerCase()];
            let yyyy = m[3];
            if (yyyy.length === 2) yyyy = '20' + yyyy;
            date = `${yyyy}-${mm}-${dd}`;
          }
          break;
        } catch (e) {}
      }
    }
    if (date) break;
  }
  if (!date) date = new Date().toISOString().slice(0, 10);

  return { merchant, amount, date };
}

export function generateInsights(expenses) {
  const insights = [];
  if (!expenses || expenses.length === 0) return insights;

  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  // by category
  const byCat = {};
  for (const e of expenses) {
    byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0);
  }
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  if (topCat) {
    const pct = total > 0 ? Math.round((topCat[1] / total) * 100) : 0;
    insights.push({
      icon: 'pie',
      title: `${pct}% of your money went to ${topCat[0]}`,
      detail: `Total ${topCat[0]} spend: \u20B9${topCat[1].toFixed(0)}`,
    });
  }

  // this week
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const weekExpenses = expenses.filter((e) => new Date(e.date) >= weekStart);
  if (weekExpenses.length) {
    const weekByCat = {};
    for (const e of weekExpenses) {
      weekByCat[e.category] = (weekByCat[e.category] || 0) + Number(e.amount || 0);
    }
    const topWeek = Object.entries(weekByCat).sort((a, b) => b[1] - a[1])[0];
    if (topWeek) {
      insights.push({
        icon: 'trend',
        title: `Biggest spend this week: ${topWeek[0]}`,
        detail: `\u20B9${topWeek[1].toFixed(0)} across ${weekExpenses.filter(e => e.category === topWeek[0]).length} receipt(s)`,
      });
    }
  }

  // most frequent merchant
  const mCount = {};
  for (const e of expenses) {
    const m = (e.merchant || 'Unknown').trim();
    mCount[m] = (mCount[m] || 0) + 1;
  }
  const topMerchant = Object.entries(mCount).sort((a, b) => b[1] - a[1])[0];
  if (topMerchant && topMerchant[1] >= 1) {
    insights.push({
      icon: 'store',
      title: `Most frequent merchant: ${topMerchant[0]}`,
      detail: `Visited ${topMerchant[1]} time(s)`,
    });
  }

  // month-over-month trend for top category
  if (topCat) {
    const cat = topCat[0];
    const monthMap = {};
    for (const e of expenses) {
      if (e.category !== cat) continue;
      const ym = (e.date || '').slice(0, 7);
      if (!ym) continue;
      monthMap[ym] = (monthMap[ym] || 0) + Number(e.amount || 0);
    }
    const months = Object.keys(monthMap).sort();
    if (months.length >= 2) {
      const last = monthMap[months[months.length - 1]];
      const prev = monthMap[months[months.length - 2]];
      if (prev > 0) {
        const change = Math.round(((last - prev) / prev) * 100);
        const dir = change >= 0 ? 'increased' : 'decreased';
        insights.push({
          icon: 'spark',
          title: `${cat} spending ${dir} by ${Math.abs(change)}%`,
          detail: `From \u20B9${prev.toFixed(0)} to \u20B9${last.toFixed(0)} month-over-month`,
        });
      }
    }
  }

  // highest single expense
  const highest = [...expenses].sort((a, b) => Number(b.amount) - Number(a.amount))[0];
  if (highest) {
    insights.push({
      icon: 'fire',
      title: `Highest single expense: \u20B9${Number(highest.amount).toFixed(0)}`,
      detail: `${highest.merchant} \u2014 ${highest.category}`,
    });
  }

  return insights;
}
