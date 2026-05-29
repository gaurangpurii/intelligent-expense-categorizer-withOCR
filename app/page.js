'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line,
} from 'recharts'
import {
  Upload, ScanLine, Sparkles, Receipt, Wallet, TrendingUp, Flame,
  Search, Download, Trash2, Pencil, Calendar, Store, PieChart as PieIcon,
  Loader2, X, Check, BarChart3, Layers, Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast, Toaster } from 'sonner'
import {
  CATEGORIES, CATEGORY_LIST, categorize, parseReceipt, generateInsights,
} from '@/lib/utils/categorize'

const STORAGE_KEY = 'sec_expenses_v1'

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(n || 0))

function loadExpenses() {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}

function saveExpenses(list) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

// ---------- Upload + OCR component ----------
function ReceiptUploader({ onSave }) {
  const [file, setFile] = useState(null)
  const [imgUrl, setImgUrl] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const [scanning, setScanning] = useState(false)
  const [rawText, setRawText] = useState('')
  const [ocrConf, setOcrConf] = useState(0)
  const [result, setResult] = useState(null)
  const inputRef = useRef(null)

  const onPick = (f) => {
    if (!f) return
    if (!/image\/(jpe?g|png)/i.test(f.type)) {
      toast.error('Only JPG, JPEG or PNG receipts are supported')
      return
    }
    setFile(f)
    setResult(null)
    setRawText('')
    setOcrConf(0)
    const url = URL.createObjectURL(f)
    setImgUrl(url)
  }

  const reset = () => {
    setFile(null)
    setImgUrl('')
    setResult(null)
    setRawText('')
    setOcrConf(0)
    setProgress(0)
    setStage('')
  }

  const runOcr = async () => {
    if (!file) {
      toast.error('Upload a receipt first')
      return
    }
    setScanning(true)
    setProgress(0)
    setStage('initializing')
    try {
      const Tesseract = (await import('tesseract.js')).default
      const { data } = await Tesseract.recognize(file, 'eng', {
        logger: (m) => {
          if (m.status) setStage(m.status)
          if (typeof m.progress === 'number') setProgress(Math.round(m.progress * 100))
        },
      })
      const text = data?.text || ''
      const conf = Math.round(data?.confidence || 0)
      setRawText(text)
      setOcrConf(conf)
      const parsed = parseReceipt(text)
      const cat = categorize(`${parsed.merchant}\n${text}`)
      setResult({
        merchant: parsed.merchant || 'Unknown',
        amount: parsed.amount || 0,
        date: parsed.date,
        category: cat.category,
        confidence: cat.confidence,
      })
      toast.success('Receipt analyzed successfully')
    } catch (err) {
      console.error(err)
      toast.error('OCR failed. Try a clearer image.')
    } finally {
      setScanning(false)
    }
  }

  const handleSave = () => {
    if (!result) return
    const exp = {
      id: uuid(),
      merchant: result.merchant,
      amount: Number(result.amount) || 0,
      date: result.date,
      category: result.category,
      confidence: result.confidence,
      ocrConfidence: ocrConf,
      imageUrl: imgUrl,
      createdAt: new Date().toISOString(),
    }
    onSave(exp)
    toast.success('Expense saved')
    reset()
  }

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanLine className="w-4 h-4 text-primary" />
          Scan a receipt
        </CardTitle>
        <CardDescription>Drag &amp; drop or upload a JPG/PNG. We&apos;ll do the rest.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!imgUrl ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragOver(false)
              const f = e.dataTransfer.files?.[0]; if (f) onPick(f)
            }}
            onClick={() => inputRef.current?.click()}
            className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all p-10 text-center
              ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/60 hover:bg-muted/40'}`}
          >
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Upload className="w-7 h-7 text-primary" />
            </div>
            <p className="font-medium">Drop your receipt here</p>
            <p className="text-sm text-muted-foreground mt-1">or click to browse &mdash; JPG, JPEG, PNG</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              hidden
              onChange={(e) => onPick(e.target.files?.[0])}
            />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="relative group rounded-xl overflow-hidden border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgUrl} alt="receipt" className="w-full h-72 object-contain bg-black/30" />
              <button
                onClick={reset}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 hover:bg-background border border-border"
                title="Remove"
              >
                <X className="w-4 h-4" />
              </button>
              {scanning && (
                <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex flex-col items-center justify-center">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <p className="mt-3 text-sm capitalize">{stage || 'processing'}...</p>
                  <div className="w-48 mt-2">
                    <Progress value={progress} />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {!result ? (
                <div className="rounded-xl border border-dashed border-border p-4 h-72 flex flex-col items-center justify-center text-center">
                  <Sparkles className="w-7 h-7 text-primary mb-2" />
                  <p className="font-medium">Ready to analyze</p>
                  <p className="text-sm text-muted-foreground mb-3">
                    Extract merchant, amount, date and auto-categorize.
                  </p>
                  <Button onClick={runOcr} disabled={scanning} className="gap-2">
                    {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                    Analyze Receipt
                  </Button>
                </div>
              ) : (
                <ResultEditor
                  result={result}
                  setResult={setResult}
                  ocrConf={ocrConf}
                  onSave={handleSave}
                  onCancel={reset}
                />
              )}
            </div>
          </div>
        )}

        {rawText && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">View extracted text</summary>
            <pre className="mt-2 p-3 rounded-lg bg-muted/60 whitespace-pre-wrap max-h-40 overflow-auto">{rawText}</pre>
          </details>
        )}
      </CardContent>
    </Card>
  )
}

function ResultEditor({ result, setResult, ocrConf, onSave, onCancel }) {
  const update = (k, v) => setResult((r) => ({ ...r, [k]: v }))
  const catColor = CATEGORIES[result.category]?.color || '#64748b'

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> Extracted details
        </div>
        <Badge variant="secondary" className="text-[10px]">OCR {ocrConf}%</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs">Merchant</Label>
          <Input value={result.merchant} onChange={(e) => update('merchant', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Amount (₹)</Label>
          <Input
            type="number"
            value={result.amount}
            onChange={(e) => update('amount', e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Date</Label>
          <Input
            type="date"
            value={result.date}
            onChange={(e) => update('date', e.target.value)}
          />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Category</Label>
          <div className="flex items-center gap-2">
            <Select value={result.category} onValueChange={(v) => update('category', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_LIST.map((c) => (
                  <SelectItem key={c} value={c}>
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: CATEGORIES[c].color }} />
                      {c}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge
              className="border-0"
              style={{ background: `${catColor}22`, color: catColor }}
            >
              {result.confidence}% match
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onCancel} className="gap-1">
          <X className="w-4 h-4" /> Discard
        </Button>
        <Button onClick={onSave} className="gap-1">
          <Check className="w-4 h-4" /> Save expense
        </Button>
      </div>
    </div>
  )
}

// ---------- KPI ----------
function KpiCard({ icon: Icon, label, value, sub }) {
  return (
    <Card className="relative overflow-hidden border-border/60 bg-card/60 backdrop-blur">
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-30 bg-primary" />
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        </div>
        <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  )
}

// ---------- Dashboard charts ----------
function CategoryPie({ data }) {
  if (!data.length) return <EmptyChart label="Add expenses to see distribution" />
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={3} stroke="none">
          {data.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
        </Pie>
        <Tooltip
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
          formatter={(v, n) => [`₹${formatINR(v)}`, n]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span className="text-muted-foreground">{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function CategoryBar({ data }) {
  if (!data.length) return <EmptyChart label="Add expenses to see category spend" />
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
          formatter={(v) => [`₹${formatINR(v)}`, 'Spent']}
        />
        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
          {data.map((d, i) => (<Cell key={i} fill={d.color} />))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function MonthlyLine({ data }) {
  if (!data.length) return <EmptyChart label="Track spend across months as you add receipts" />
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
          formatter={(v) => [`₹${formatINR(v)}`, 'Total']}
        />
        <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3}
          dot={{ r: 4, fill: 'hsl(var(--primary))' }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function EmptyChart({ label }) {
  return (
    <div className="h-[260px] flex flex-col items-center justify-center text-muted-foreground">
      <BarChart3 className="w-8 h-8 mb-2 opacity-60" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

function ExpenseList({ expenses, onDelete, onEdit }) {
  if (!expenses.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Receipt className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p>No expenses yet. Scan your first receipt to begin.</p>
      </div>
    )
  }
  return (
    <ScrollArea className="h-[460px] pr-3">
      <div className="space-y-2">
        {expenses.map((e) => {
          const color = CATEGORIES[e.category]?.color || '#64748b'
          return (
            <div key={e.id} className="group flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/40 transition-colors">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${color}22`, color }}>
                <Store className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{e.merchant || 'Unknown'}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-3 h-3" /> {e.date}
                  <span className="opacity-50">•</span>
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]" style={{ borderColor: `${color}55`, color }}>
                    {e.category}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">₹{formatINR(e.amount)}</div>
                <div className="text-[10px] text-muted-foreground">{e.confidence}% conf</div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="ghost" onClick={() => onEdit(e)} title="Edit">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => onDelete(e.id)} title="Delete">
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

function EditDialog({ open, onOpenChange, expense, onSave }) {
  const [form, setForm] = useState(expense)
  useEffect(() => { setForm(expense) }, [expense])
  if (!form) return null
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit expense</DialogTitle>
          <DialogDescription>Update merchant, amount, date and category.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Merchant</Label>
            <Input value={form.merchant} onChange={(e) => update('merchant', e.target.value)} />
          </div>
          <div>
            <Label>Amount (₹)</Label>
            <Input type="number" value={form.amount} onChange={(e) => update('amount', e.target.value)} />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => update('category', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORY_LIST.map((c) => (
                  <SelectItem key={c} value={c}>
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: CATEGORIES[c].color }} />
                      {c}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onSave({ ...form, amount: Number(form.amount) || 0 }); onOpenChange(false) }}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function sampleSeed() {
  const today = new Date()
  const d = (back) => {
    const x = new Date(today); x.setDate(x.getDate() - back)
    return x.toISOString().slice(0, 10)
  }
  return [
    { merchant: "Domino's Pizza", amount: 540, date: d(2), category: 'Food', confidence: 96 },
    { merchant: 'Uber', amount: 280, date: d(3), category: 'Travel', confidence: 95 },
    { merchant: 'Amazon', amount: 1499, date: d(5), category: 'Shopping', confidence: 94 },
    { merchant: 'BookMyShow', amount: 600, date: d(7), category: 'Entertainment', confidence: 92 },
    { merchant: 'Apollo Pharmacy', amount: 360, date: d(10), category: 'Health', confidence: 93 },
    { merchant: 'Airtel', amount: 799, date: d(14), category: 'Utilities', confidence: 90 },
    { merchant: 'Swiggy', amount: 420, date: d(18), category: 'Food', confidence: 91 },
    { merchant: 'Ola', amount: 220, date: d(22), category: 'Travel', confidence: 88 },
    { merchant: 'Netflix', amount: 199, date: d(28), category: 'Entertainment', confidence: 96 },
    { merchant: 'Starbucks', amount: 480, date: d(35), category: 'Food', confidence: 90 },
    { merchant: 'Flipkart', amount: 2199, date: d(42), category: 'Shopping', confidence: 92 },
    { merchant: 'Jio', amount: 299, date: d(48), category: 'Utilities', confidence: 89 },
  ].map((e) => ({ id: uuid(), ocrConfidence: 0, imageUrl: '', createdAt: new Date().toISOString(), ...e }))
}

function InsightsPanel({ insights }) {
  const iconMap = { pie: PieIcon, trend: TrendingUp, store: Store, spark: Sparkles, fire: Flame }
  if (!insights.length) {
    return (
      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Smart Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Add receipts to unlock personalized insights.
        </CardContent>
      </Card>
    )
  }
  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> Smart Insights
        </CardTitle>
        <CardDescription>Auto-generated from your spending pattern</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((ins, i) => {
          const Icon = iconMap[ins.icon] || Sparkles
          return (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-br from-primary/5 to-transparent border border-border/60">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">{ins.title}</div>
                <div className="text-xs text-muted-foreground">{ins.detail}</div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function App() {
  const [expenses, setExpenses] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    setExpenses(loadExpenses())
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) saveExpenses(expenses)
  }, [expenses, loaded])

  const addExpense = (e) => setExpenses((prev) => [e, ...prev])
  const deleteExpense = (id) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id))
    toast.success('Expense deleted')
  }
  const updateExpense = (next) => {
    setExpenses((prev) => prev.map((e) => (e.id === next.id ? next : e)))
    toast.success('Expense updated')
  }

  const seed = () => {
    setExpenses((prev) => [...sampleSeed(), ...prev])
    toast.success('Loaded sample expenses')
  }

  const clearAll = () => {
    if (!expenses.length) return
    if (confirm('Delete all expenses? This cannot be undone.')) {
      setExpenses([])
      toast.success('All expenses cleared')
    }
  }

  const filtered = useMemo(() => {
    let list = [...expenses]
    if (filterCat !== 'all') list = list.filter((e) => e.category === filterCat)
    if (dateFrom) list = list.filter((e) => e.date >= dateFrom)
    if (dateTo) list = list.filter((e) => e.date <= dateTo)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter((e) => (e.merchant || '').toLowerCase().includes(q))
    }
    return list.sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [expenses, filterCat, dateFrom, dateTo, query])

  const total = filtered.reduce((s, e) => s + Number(e.amount || 0), 0)
  const highest = filtered.reduce((m, e) => (Number(e.amount) > m ? Number(e.amount) : m), 0)
  const catTotals = useMemo(() => {
    const m = {}
    for (const e of filtered) m[e.category] = (m[e.category] || 0) + Number(e.amount || 0)
    return m
  }, [filtered])
  const topCategory = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'

  const pieData = useMemo(() => {
    return Object.entries(catTotals).map(([name, value]) => ({
      name, value, color: CATEGORIES[name]?.color || '#64748b',
    }))
  }, [catTotals])
  const barData = pieData

  const monthlyData = useMemo(() => {
    const m = {}
    for (const e of filtered) {
      const ym = (e.date || '').slice(0, 7)
      if (!ym) continue
      m[ym] = (m[ym] || 0) + Number(e.amount || 0)
    }
    return Object.keys(m).sort().map((k) => ({ month: k, value: m[k] }))
  }, [filtered])

  const insights = useMemo(() => generateInsights(filtered), [filtered])

  const exportCSV = () => {
    if (!filtered.length) {
      toast.error('Nothing to export')
      return
    }
    const headers = ['id', 'merchant', 'amount', 'date', 'category', 'confidence']
    const rows = filtered.map((e) => headers.map((h) => JSON.stringify(e[h] ?? '')).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Exported CSV')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 text-foreground">
      <Toaster richColors theme="dark" position="top-right" />

      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute top-1/3 -right-32 w-[420px] h-[420px] rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-[420px] h-[420px] rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/60 border-b border-border/60">
        <div className="container flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-fuchsia-500 flex items-center justify-center shadow-lg shadow-primary/20">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-semibold tracking-tight">Smart Expense Categorizer</div>
              <div className="text-xs text-muted-foreground">Snap. Analyze. Save.</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={seed} className="gap-1 hidden sm:inline-flex">
              <Plus className="w-4 h-4" /> Sample data
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1">
              <Download className="w-4 h-4" /> Export
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        <section className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-card p-6">
              <Badge className="mb-3 bg-primary/15 text-primary border-0">AI-powered</Badge>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
                Turn paper receipts into <span className="bg-gradient-to-r from-primary to-fuchsia-400 bg-clip-text text-transparent">clean insights</span>.
              </h1>
              <p className="text-muted-foreground mt-2 max-w-xl">
                Upload a receipt, our on-device OCR reads merchant, amount and date &mdash; then auto-tags it into the right category.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <div className="text-xs px-2.5 py-1 rounded-full bg-muted/60 border border-border">100% on-device OCR</div>
                <div className="text-xs px-2.5 py-1 rounded-full bg-muted/60 border border-border">No login required</div>
                <div className="text-xs px-2.5 py-1 rounded-full bg-muted/60 border border-border">Local-first storage</div>
              </div>
            </div>

            <ReceiptUploader onSave={addExpense} />
          </div>

          <InsightsPanel insights={insights} />
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={Wallet} label="Total spend" value={`₹${formatINR(total)}`} sub={`${filtered.length} receipts`} />
          <KpiCard icon={Receipt} label="Receipts" value={filtered.length} sub="across all months" />
          <KpiCard icon={Flame} label="Highest expense" value={`₹${formatINR(highest)}`} sub="single receipt" />
          <KpiCard icon={Layers} label="Top category" value={topCategory} sub="by amount" />
        </section>

        <section className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1 grid md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Search merchant</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="e.g. Uber" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={filterCat} onValueChange={setFilterCat}>
                <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {CATEGORY_LIST.map((c) => (
                    <SelectItem key={c} value={c}>
                      <span className="inline-flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: CATEGORIES[c].color }} />
                        {c}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setQuery(''); setFilterCat('all'); setDateFrom(''); setDateTo('') }}>
              Reset
            </Button>
            <Button variant="destructive" onClick={clearAll} className="gap-1">
              <Trash2 className="w-4 h-4" /> Clear all
            </Button>
          </div>
        </section>

        <section className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1 border-border/60 bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-primary" /> Distribution
              </CardTitle>
              <CardDescription>How your money splits by category</CardDescription>
            </CardHeader>
            <CardContent><CategoryPie data={pieData} /></CardContent>
          </Card>

          <Card className="lg:col-span-2 border-border/60 bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" /> Category spending
              </CardTitle>
              <CardDescription>Top spend buckets</CardDescription>
            </CardHeader>
            <CardContent><CategoryBar data={barData} /></CardContent>
          </Card>

          <Card className="lg:col-span-3 border-border/60 bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Monthly trend
              </CardTitle>
              <CardDescription>Total spend per month</CardDescription>
            </CardHeader>
            <CardContent><MonthlyLine data={monthlyData} /></CardContent>
          </Card>
        </section>

        <section>
          <Card className="border-border/60 bg-card/60 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-primary" /> Expenses
                </CardTitle>
                <CardDescription>{filtered.length} record(s) shown</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <ExpenseList expenses={filtered} onDelete={deleteExpense} onEdit={(e) => setEditing(e)} />
            </CardContent>
          </Card>
        </section>

        <footer className="text-xs text-muted-foreground text-center py-6">
          Built with Tesseract.js &bull; Recharts &bull; shadcn/ui
        </footer>
      </main>

      <EditDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        expense={editing}
        onSave={updateExpense}
      />
    </div>
  )
}

export default App
