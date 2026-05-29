// Smart categorization engine for expenses
// Improved OCR parser: better merchant + amount detection.

export const CATEGORIES = {
  Food: {
    color: '#f97316',
    keywords: [
      'dominos', "domino's", 'pizza', 'zomato', 'swiggy', 'restaurant', 'cafe',
      'starbucks', 'mcdonald', 'kfc', 'burger', 'subway', 'biryani', 'food',
      'dhaba', 'bakery', 'sweets', 'haldiram', 'barbeque', 'eatery', 'kitchen',
      'chai', 'tea', 'coffee', 'juice', 'bistro', 'diner', 'meal', 'lunch',
      'dinner', 'breakfast', 'snack', 'foods', 'restro',
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
  Other: { color: '#64748b', keywords: [] },
}

export const CATEGORY_LIST = Object.keys(CATEGORIES)

export function categorize(text) {
  if (!text) return { category: 'Other', confidence: 30 }
  const lower = text.toLowerCase()

  let bestMatch = { category: 'Other', confidence: 30, hits: 0 }

  for (const [cat, def] of Object.entries(CATEGORIES)) {
    if (cat === 'Other') continue
    let hits = 0
    let strongHit = false
    for (const kw of def.keywords) {
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (regex.test(lower)) {
        hits++
        if (kw.length >= 5) strongHit = true
      } else if (lower.includes(kw)) {
        hits += 0.6
      }
    }
    if (hits > bestMatch.hits) {
      const base = strongHit ? 78 : 60
      const confidence = Math.min(98, Math.round(base + hits * 6))
      bestMatch = { category: cat, confidence, hits }
    }
  }
  return { category: bestMatch.category, confidence: bestMatch.confidence }
}

// ---------------- Receipt parser ----------------
// Tunable noise / non-merchant phrases that should be skipped when picking merchant
const NON_MERCHANT_PATTERNS = [
  /^(invoice|receipt|bill|tax\s*invoice|cash\s*memo|gstin|gst|cin|tin|hsn|tel|phone|mob|mobile|email|web|fax)/i,
  /^(address|location|branch|outlet|store\s*no|counter|table|server|cashier|operator|order|date|time)/i,
  /^(qty|item|description|amount|rate|price|sub\s*total|sub-total|subtotal|total|grand\s*total|net\s*total|net\s*amount|due|paid|change|round|cgst|sgst|igst|vat|service\s*charge|service\s*tax|discount|saved|savings|tip|refund|cash|card|upi|paytm|gpay|phonepe|tendered)/i,
  /^(thank|thanks|visit|welcome|powered\s*by|please|terms|conditions|warranty|return|policy|signature)/i,
  /^(www\.|http|@)/i,
  /^[0-9\s\/\-:.,()#*+]+$/, // numeric-only
]

const STRONG_TOTAL_LABELS = [
  'grand total', 'grand tota1', 'net amount', 'net total', 'amount due', 'amount payable',
  'total amount', 'total payable', 'balance due', 'total due', 'total to pay', 'total paid',
  'amount paid', 'sub total', 'subtotal', 'sub-total', 'total',
]
const NEGATIVE_LABELS = [
  'cgst', 'sgst', 'igst', 'gst', 'tax', 'vat', 'discount', 'saved', 'savings',
  'service charge', 'service tax', 'tip', 'change', 'cash', 'round', 'tender',
  'item total', 'qty', 'mrp', 'rate', 'unit',
]

function cleanLine(s) {
  return (s || '').replace(/[^\x20-\x7E₹]/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseAmountFromLine(line) {
  // pull all number-like tokens with optional currency, prefer last (right-aligned on receipts)
  const re = /(?:₹|rs\.?|inr|\$|usd)?\s*([0-9]{1,3}(?:[,][0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi
  const found = []
  let m
  while ((m = re.exec(line)) !== null) {
    const raw = m[1].replace(/,/g, '')
    const v = parseFloat(raw)
    if (!isNaN(v)) found.push(v)
  }
  if (!found.length) return null
  // amounts typically appear at end of line on receipts
  return found[found.length - 1]
}

export function parseReceipt(text) {
  if (!text) return { merchant: '', amount: 0, date: '' }

  const lines = text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((l) => l.length > 0)

  // ---------- Merchant ----------
  // Strategy: scan top ~10 lines, score each by length, capital ratio, and word-likeness;
  // prefer lines that aren't standard receipt boilerplate / numeric.
  let merchant = ''
  const candidates = []
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const raw = lines[i]
    const line = raw.replace(/[*=_~`|]+/g, ' ').trim()
    if (line.length < 3 || line.length > 60) continue
    if (NON_MERCHANT_PATTERNS.some((re) => re.test(line))) continue

    const letters = line.replace(/[^a-zA-Z]/g, '')
    if (letters.length < 3) continue
    // Skip lines that are >50% digits
    const digitRatio = (line.replace(/[^0-9]/g, '').length) / line.length
    if (digitRatio > 0.4) continue

    const upper = line.replace(/[^A-Z]/g, '').length
    const lower = line.replace(/[^a-z]/g, '').length
    const capRatio = upper / Math.max(1, upper + lower)
    // score: prefer all-caps / title case lines near top, with letters
    let score = letters.length + capRatio * 8 - i * 1.5
    // bonus if contains common business suffix words
    if (/\b(restaurant|cafe|store|mart|hotel|pizza|kitchen|bakery|shop|enterprises|pvt|ltd|inc|co|llp)\b/i.test(line)) {
      score += 10
    }
    candidates.push({ line, score, i })
  }
  candidates.sort((a, b) => b.score - a.score)
  if (candidates.length) {
    merchant = candidates[0].line
      .split(' ')
      .filter((w) => w.replace(/[^a-zA-Z0-9]/g, '').length > 0)
      .slice(0, 6)
      .join(' ')
  }
  if (!merchant && lines.length) {
    merchant = lines[0].slice(0, 40)
  }

  // ---------- Amount ----------
  let amount = 0
  // Pass 1: lines with strong "total"-style labels, picking the maximum (grand total > subtotal usually)
  const labeledHits = []
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]
    const lower = line.toLowerCase()
    if (NEGATIVE_LABELS.some((l) => lower.includes(l) && !STRONG_TOTAL_LABELS.some((s) => lower.includes(s)))) {
      // negative-only line, skip
      continue
    }
    let weight = 0
    if (/(grand\s*total|net\s*amount|net\s*total|amount\s*due|amount\s*payable|total\s*payable|balance\s*due|total\s*paid|amount\s*paid)/i.test(line)) weight = 100
    else if (/\btotal\b/i.test(line)) weight = 80
    else if (/(sub\s*total|sub-total|subtotal)/i.test(line)) weight = 50
    if (weight === 0) continue
    const v = parseAmountFromLine(line)
    if (v && v > 0 && v < 10_00_000) {
      labeledHits.push({ value: v, weight, idx })
    }
  }
  if (labeledHits.length) {
    // Pick highest-weight; among ties, the LAST occurrence (bottom of receipt) wins
    labeledHits.sort((a, b) => (b.weight - a.weight) || (b.idx - a.idx))
    amount = labeledHits[0].value
  }

  // Pass 2: currency-tagged amounts
  if (!amount) {
    const re = /(?:₹|rs\.?|inr)\s*([0-9]{1,3}(?:[,][0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi
    const all = []
    let m
    while ((m = re.exec(text)) !== null) {
      const v = parseFloat(m[1].replace(/,/g, ''))
      if (!isNaN(v) && v >= 1 && v < 10_00_000) all.push(v)
    }
    if (all.length) amount = Math.max(...all)
  }

  // Pass 3: fallback to largest sensible number in bottom half of receipt
  if (!amount) {
    const bottom = lines.slice(Math.floor(lines.length / 2)).join('\n')
    const re = /([0-9]{1,3}(?:[,][0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/g
    const all = []
    let m
    while ((m = re.exec(bottom)) !== null) {
      const v = parseFloat(m[1].replace(/,/g, ''))
      if (!isNaN(v) && v >= 10 && v < 10_00_000) all.push(v)
    }
    if (all.length) amount = Math.max(...all)
  }

  // ---------- Date ----------
  let date = ''
  const datePatterns = [
    /(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/,
    /(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/,
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{2,4})/i,
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{2,4})/i,
  ]
  for (const line of lines) {
    for (let i = 0; i < datePatterns.length; i++) {
      const m = line.match(datePatterns[i])
      if (m) {
        try {
          if (i === 0) {
            date = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
          } else if (i === 1) {
            let yyyy = m[3]; if (yyyy.length === 2) yyyy = '20' + yyyy
            date = `${yyyy}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
          } else {
            const months = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' }
            if (i === 2) {
              let yyyy = m[3]; if (yyyy.length === 2) yyyy = '20' + yyyy
              date = `${yyyy}-${months[m[2].slice(0,3).toLowerCase()]}-${m[1].padStart(2, '0')}`
            } else {
              let yyyy = m[3]; if (yyyy.length === 2) yyyy = '20' + yyyy
              date = `${yyyy}-${months[m[1].slice(0,3).toLowerCase()]}-${m[2].padStart(2, '0')}`
            }
          }
          break
        } catch (e) {}
      }
    }
    if (date) break
  }
  if (!date) date = new Date().toISOString().slice(0, 10)

  return { merchant, amount, date }
}

// ---------- Image preprocessing for OCR ----------
// Resize, grayscale and threshold the image in a canvas before sending to Tesseract.
// Returns a data URL ready to be consumed by Tesseract.recognize.
export async function preprocessImage(file, targetW = 1400) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      try {
        const scale = Math.min(2, Math.max(1, targetW / img.width))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        const imageData = ctx.getImageData(0, 0, w, h)
        const d = imageData.data

        // 1) Grayscale + contrast
        const contrast = 1.35
        const intercept = 128 * (1 - contrast)
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2]
          // Luminance
          let y = 0.299 * r + 0.587 * g + 0.114 * b
          y = y * contrast + intercept
          if (y < 0) y = 0; else if (y > 255) y = 255
          d[i] = d[i + 1] = d[i + 2] = y
        }

        // 2) Adaptive threshold (simple) – binarize for clean OCR
        // Compute global mean for threshold
        let sum = 0
        for (let i = 0; i < d.length; i += 4) sum += d[i]
        const mean = sum / (d.length / 4)
        const thr = Math.max(110, Math.min(180, mean - 5))
        for (let i = 0; i < d.length; i += 4) {
          const v = d[i] < thr ? 0 : 255
          d[i] = d[i + 1] = d[i + 2] = v
        }
        ctx.putImageData(imageData, 0, 0)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/png'))
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}

// ---------- Insights ----------
export function generateInsights(expenses) {
  const insights = []
  if (!expenses || expenses.length === 0) return insights

  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)

  const byCat = {}
  for (const e of expenses) {
    byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0)
  }
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]
  if (topCat) {
    const pct = total > 0 ? Math.round((topCat[1] / total) * 100) : 0
    insights.push({
      icon: 'pie',
      title: `${pct}% of your money went to ${topCat[0]}`,
      detail: `Total ${topCat[0]} spend: \u20B9${topCat[1].toFixed(0)}`,
    })
  }

  const now = new Date()
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7)
  const weekExpenses = expenses.filter((e) => new Date(e.date) >= weekStart)
  if (weekExpenses.length) {
    const weekByCat = {}
    for (const e of weekExpenses) {
      weekByCat[e.category] = (weekByCat[e.category] || 0) + Number(e.amount || 0)
    }
    const topWeek = Object.entries(weekByCat).sort((a, b) => b[1] - a[1])[0]
    if (topWeek) {
      insights.push({
        icon: 'trend',
        title: `Biggest spend this week: ${topWeek[0]}`,
        detail: `\u20B9${topWeek[1].toFixed(0)} across ${weekExpenses.filter(e => e.category === topWeek[0]).length} receipt(s)`,
      })
    }
  }

  const mCount = {}
  for (const e of expenses) {
    const m = (e.merchant || 'Unknown').trim()
    mCount[m] = (mCount[m] || 0) + 1
  }
  const topMerchant = Object.entries(mCount).sort((a, b) => b[1] - a[1])[0]
  if (topMerchant) {
    insights.push({
      icon: 'store',
      title: `Most frequent merchant: ${topMerchant[0]}`,
      detail: `Visited ${topMerchant[1]} time(s)`,
    })
  }

  if (topCat) {
    const cat = topCat[0]
    const monthMap = {}
    for (const e of expenses) {
      if (e.category !== cat) continue
      const ym = (e.date || '').slice(0, 7)
      if (!ym) continue
      monthMap[ym] = (monthMap[ym] || 0) + Number(e.amount || 0)
    }
    const months = Object.keys(monthMap).sort()
    if (months.length >= 2) {
      const last = monthMap[months[months.length - 1]]
      const prev = monthMap[months[months.length - 2]]
      if (prev > 0) {
        const change = Math.round(((last - prev) / prev) * 100)
        const dir = change >= 0 ? 'increased' : 'decreased'
        insights.push({
          icon: 'spark',
          title: `${cat} spending ${dir} by ${Math.abs(change)}%`,
          detail: `From \u20B9${prev.toFixed(0)} to \u20B9${last.toFixed(0)} month-over-month`,
        })
      }
    }
  }

  const highest = [...expenses].sort((a, b) => Number(b.amount) - Number(a.amount))[0]
  if (highest) {
    insights.push({
      icon: 'fire',
      title: `Highest single expense: \u20B9${Number(highest.amount).toFixed(0)}`,
      detail: `${highest.merchant} \u2014 ${highest.category}`,
    })
  }

  return insights
}
