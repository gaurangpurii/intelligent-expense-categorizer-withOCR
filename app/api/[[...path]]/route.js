import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import { getDb } from '@/lib/mongodb'
import {
  signSession, verifySession, setSessionCookie, clearSessionCookie,
} from '@/lib/auth'

function json(data, init = {}) {
  return NextResponse.json(data, init)
}

async function userFromReq(req) {
  const token = req.cookies.get('sec_session')?.value
  return await verifySession(token)
}

function routeOf(params) {
  const p = params?.path || []
  return p.join('/')
}

// ----- AUTH -----
async function handleAuth(req, route) {
  const db = await getDb()
  const users = db.collection('users')

  if (route === 'auth/signup' && req.method === 'POST') {
    const { email, password, name } = await req.json()
    if (!email || !password) return json({ error: 'Email and password required' }, { status: 400 })
    const e = String(email).trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return json({ error: 'Invalid email' }, { status: 400 })
    if (String(password).length < 6) return json({ error: 'Password must be 6+ chars' }, { status: 400 })

    const exists = await users.findOne({ email: e })
    if (exists) return json({ error: 'Account already exists. Please sign in.' }, { status: 409 })

    const hash = await bcrypt.hash(password, 10)
    const user = {
      id: uuid(),
      email: e,
      name: name || e.split('@')[0],
      passwordHash: hash,
      createdAt: new Date().toISOString(),
    }
    await users.insertOne(user)
    const token = await signSession({ uid: user.id, email: user.email, name: user.name })
    const res = json({ user: { id: user.id, email: user.email, name: user.name } })
    return setSessionCookie(res, token)
  }

  if (route === 'auth/login' && req.method === 'POST') {
    const { email, password } = await req.json()
    if (!email || !password) return json({ error: 'Email and password required' }, { status: 400 })
    const e = String(email).trim().toLowerCase()
    const user = await users.findOne({ email: e })
    if (!user) return json({ error: 'Invalid credentials' }, { status: 401 })
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return json({ error: 'Invalid credentials' }, { status: 401 })
    const token = await signSession({ uid: user.id, email: user.email, name: user.name })
    const res = json({ user: { id: user.id, email: user.email, name: user.name } })
    return setSessionCookie(res, token)
  }

  if (route === 'auth/logout' && req.method === 'POST') {
    const res = json({ ok: true })
    return clearSessionCookie(res)
  }

  if (route === 'auth/me' && req.method === 'GET') {
    const u = await userFromReq(req)
    if (!u) return json({ user: null })
    return json({ user: { id: u.uid, email: u.email, name: u.name } })
  }

  return null
}

// ----- EXPENSES -----
async function handleExpenses(req, route) {
  const u = await userFromReq(req)
  if (!u) return json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb()
  const col = db.collection('expenses')

  // GET /api/expenses
  if (route === 'expenses' && req.method === 'GET') {
    const list = await col
      .find({ userId: u.uid }, { projection: { _id: 0 } })
      .sort({ date: -1 })
      .toArray()
    return json({ expenses: list })
  }

  // POST /api/expenses  -> single insert
  if (route === 'expenses' && req.method === 'POST') {
    const body = await req.json()
    const e = sanitizeExpense(body, u.uid)
    await col.insertOne(e)
    const { _id, ...rest } = e
    return json({ expense: rest })
  }

  // POST /api/expenses/bulk -> import many
  if (route === 'expenses/bulk' && req.method === 'POST') {
    const { expenses } = await req.json()
    if (!Array.isArray(expenses) || expenses.length === 0) {
      return json({ inserted: 0 })
    }
    const docs = expenses.map((x) => sanitizeExpense(x, u.uid))
    await col.insertMany(docs)
    return json({ inserted: docs.length })
  }

  // PUT /api/expenses/:id
  if (route.startsWith('expenses/') && req.method === 'PUT') {
    const id = route.split('/')[1]
    const body = await req.json()
    const update = {
      merchant: String(body.merchant || ''),
      amount: Number(body.amount) || 0,
      date: String(body.date || ''),
      category: String(body.category || 'Other'),
      confidence: Number(body.confidence) || 0,
    }
    await col.updateOne({ id, userId: u.uid }, { $set: update })
    return json({ ok: true })
  }

  // DELETE /api/expenses/:id
  if (route.startsWith('expenses/') && req.method === 'DELETE') {
    const id = route.split('/')[1]
    await col.deleteOne({ id, userId: u.uid })
    return json({ ok: true })
  }

  // DELETE /api/expenses (clear all)
  if (route === 'expenses' && req.method === 'DELETE') {
    const r = await col.deleteMany({ userId: u.uid })
    return json({ deleted: r.deletedCount })
  }

  return null
}

function sanitizeExpense(body, userId) {
  return {
    id: body.id || uuid(),
    userId,
    merchant: String(body.merchant || 'Unknown'),
    amount: Number(body.amount) || 0,
    date: String(body.date || new Date().toISOString().slice(0, 10)),
    category: String(body.category || 'Other'),
    confidence: Number(body.confidence) || 0,
    ocrConfidence: Number(body.ocrConfidence) || 0,
    imageUrl: '',
    createdAt: body.createdAt || new Date().toISOString(),
  }
}

// ----- ROUTER -----
async function dispatch(req, { params }) {
  const route = routeOf(params)
  try {
    if (route.startsWith('auth/')) {
      const r = await handleAuth(req, route)
      if (r) return r
    }
    if (route === 'expenses' || route.startsWith('expenses/')) {
      const r = await handleExpenses(req, route)
      if (r) return r
    }
    if (route === '' || route === '/') {
      return json({ ok: true, name: 'Smart Expense Categorizer API' })
    }
    return json({ error: 'Not found', route }, { status: 404 })
  } catch (e) {
    console.error('API error', e)
    return json({ error: e.message || 'Server error' }, { status: 500 })
  }
}

export async function GET(req, ctx) { return dispatch(req, ctx) }
export async function POST(req, ctx) { return dispatch(req, ctx) }
export async function PUT(req, ctx) { return dispatch(req, ctx) }
export async function DELETE(req, ctx) { return dispatch(req, ctx) }
