import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
import { Phone, MessageSquare, History, Settings as SettingsIcon, Users, CheckCircle2, Plus, Pencil, Trash2 } from 'lucide-react'

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function Layout({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-slate-900/60 bg-slate-900/80 border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="font-semibold tracking-tight text-lg">Reconnect</Link>
          <div className="ml-auto flex items-center gap-5 text-slate-300">
            <Link className="hover:text-white flex items-center gap-2" to="/"><CheckCircle2 size={18}/> Dashboard</Link>
            <Link className="hover:text-white flex items-center gap-2" to="/contacts"><Users size={18}/> Contacts</Link>
            <Link className="hover:text-white flex items-center gap-2" to="/history"><History size={18}/> History</Link>
            <Link className="hover:text-white flex items-center gap-2" to="/settings"><SettingsIcon size={18}/> Settings</Link>
          </div>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}

function useFetch(url, deps=[]) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(url).then(r=>r.json()).then(d=>{ if(active){ setData(d); setLoading(false)} }).catch(e=>{ if(active){ setError(e); setLoading(false)} })
    return ()=>{active=false}
  }, deps)
  return { data, loading, error, setData }
}

function toDaysAgo(dateStr){
  if(!dateStr) return 'never'
  const d = new Date(dateStr)
  const diff = Math.floor((Date.now() - d.getTime())/ (1000*60*60*24))
  return diff<=0? 'today' : `${diff} day${diff>1?'s':''} ago`
}

function Dashboard(){
  const { data: settings } = useFetch(`${API_BASE}/api/settings`, [])
  const [mode, setMode] = useState('daily')
  const [count, setCount] = useState(3)
  useEffect(()=>{ if(settings){ setMode(settings.mode); setCount(settings.mode==='daily'?settings.countDaily:settings.countWeekly) } },[settings])
  const { data: suggestions, loading, setData } = useFetch(`${API_BASE}/api/suggestions?mode=${mode}&count=${count}`, [mode, count])

  const [activeContact, setActiveContact] = useState(null)
  const [textDraft, setTextDraft] = useState('')
  const [templates, setTemplates] = useState([])

  function openText(contact){
    setActiveContact(contact)
    fetch(`${API_BASE}/api/templates?name=${encodeURIComponent(contact.fullName.split(' ')[0])}`)
      .then(r=>r.json()).then(setTemplates)
    setTextDraft('')
  }

  function logInteraction(contact, type, body){
    fetch(`${API_BASE}/api/contacts/${contact.id}/interactions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, messagePreview: type==='text'? (body||'').slice(0,140) : undefined })
    }).then(r=>r.json()).then(()=>{
      // refresh suggestions after logging
      fetch(`${API_BASE}/api/suggestions?mode=${mode}&count=${count}`).then(r=>r.json()).then(setData)
      setActiveContact(null); setTextDraft(''); setTemplates([])
    })
  }

  return (
    <Layout>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-semibold">Who to contact {mode==='daily'?'today':'this week'}</h1>
        <div className="ml-auto flex items-center gap-2">
          <button className={`px-3 py-1 rounded border ${mode==='daily'?'bg-blue-600 border-blue-500':'border-slate-700'}`} onClick={()=>setMode('daily')}>Daily</button>
          <button className={`px-3 py-1 rounded border ${mode==='weekly'?'bg-blue-600 border-blue-500':'border-slate-700'}`} onClick={()=>setMode('weekly')}>Weekly</button>
          <input type="number" className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1" value={count} onChange={e=>setCount(parseInt(e.target.value)||1)} />
        </div>
      </div>

      {loading && <div className="text-slate-400">Loading suggestions...</div>}
      {!loading && suggestions && suggestions.length===0 && (
        <div className="text-slate-400">No contacts yet. <Link className="text-blue-400 underline" to="/contacts">Add one</Link> or <SeedButton/></div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suggestions?.map(c=> (
          <div key={c.id} className="bg-slate-900 border border-slate-800 rounded p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="font-medium">{c.fullName}</div>
                <div className="text-sm text-slate-400 capitalize">{c.relationship} • last contacted {toDaysAgo(c.lastContactedAt)}</div>
              </div>
              <div className="flex gap-2">
                <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500" onClick={()=>logInteraction(c,'call')}><Phone size={16}/> Call</button>
                <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500" onClick={()=>openText(c)}><MessageSquare size={16}/> Send Text</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {activeContact && (
        <div className="fixed inset-0 bg-black/60 grid place-items-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Message to {activeContact.fullName}</div>
              <button className="text-slate-400" onClick={()=>{setActiveContact(null); setTemplates([])}}>Close</button>
            </div>
            <div className="flex flex-col gap-2 mb-3">
              {templates.map((t,i)=> (
                <button key={i} className="text-left text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded p-2" onClick={()=>setTextDraft(t)}>{t}</button>
              ))}
            </div>
            <textarea value={textDraft} onChange={e=>setTextDraft(e.target.value)} rows={5} className="w-full bg-slate-950 border border-slate-800 rounded p-2 mb-3" placeholder="Type or choose a template above"/>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1.5 rounded border border-slate-700" onClick={()=>{navigator.clipboard.writeText(textDraft||'')}}>Copy</button>
              <button className="px-3 py-1.5 rounded bg-blue-600" onClick={()=>logInteraction(activeContact,'text', textDraft)}>Log as Sent</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

function SeedButton(){
  const [loading, setLoading] = useState(false)
  return (
    <button onClick={()=>{ setLoading(true); fetch(`${API_BASE}/api/seed`, {method:'POST'}).then(()=>location.reload()) }} className="ml-2 underline text-blue-400 disabled:opacity-50" disabled={loading}>{loading?'Seeding...':'Seed demo contacts'}</button>
  )
}

function Contacts(){
  const { data, loading, setData } = useFetch(`${API_BASE}/api/contacts`, [])
  const [editing, setEditing] = useState(null)

  function save(contact){
    const method = contact.id ? 'PUT' : 'POST'
    const url = contact.id ? `${API_BASE}/api/contacts/${contact.id}` : `${API_BASE}/api/contacts`
    fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(contact) })
      .then(r=>r.json()).then(()=> fetch(`${API_BASE}/api/contacts`).then(r=>r.json()).then(setData).then(()=>setEditing(null)))
  }

  function remove(id){
    if(!confirm('Delete this contact?')) return
    fetch(`${API_BASE}/api/contacts/${id}`, {method: 'DELETE'}).then(()=> setData(data.filter(c=>c.id!==id)))
  }

  return (
    <Layout>
      <div className="flex items-center mb-4">
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <button className="ml-auto inline-flex items-center gap-2 bg-blue-600 px-3 py-1.5 rounded" onClick={()=>setEditing({ fullName:'', relationship:'friend', phoneNumber:'', email:'', frequencyDays:30, priority:1 })}><Plus size={16}/> Add</button>
      </div>
      {loading && <div className="text-slate-400">Loading...</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data?.map(c=> (
          <div key={c.id} className="bg-slate-900 border border-slate-800 rounded p-3">
            <div className="font-medium">{c.fullName}</div>
            <div className="text-xs text-slate-400">{c.relationship} • Every {c.frequencyDays} days • Last: {toDaysAgo(c.lastContactedAt)}</div>
            <div className="mt-2 flex gap-2">
              <button className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-700" onClick={()=>setEditing(c)}><Pencil size={14}/> Edit</button>
              <button className="inline-flex items-center gap-1 px-2 py-1 rounded border border-rose-600 bg-rose-600/10" onClick={()=>remove(c.id)}><Trash2 size={14}/> Delete</button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 grid place-items-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">{editing.id? 'Edit Contact' : 'Add Contact'}</div>
              <button className="text-slate-400" onClick={()=>setEditing(null)}>Close</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-sm">Name<input className="mt-1 w-full bg-slate-950 border border-slate-800 rounded px-2 py-1" value={editing.fullName} onChange={e=>setEditing({...editing, fullName:e.target.value})}/></label>
              <label className="text-sm">Relationship<select className="mt-1 w-full bg-slate-950 border border-slate-800 rounded px-2 py-1" value={editing.relationship} onChange={e=>setEditing({...editing, relationship:e.target.value})}><option>friend</option><option>family</option><option>business</option><option>other</option></select></label>
              <label className="text-sm">Frequency (days)<input type="number" className="mt-1 w-full bg-slate-950 border border-slate-800 rounded px-2 py-1" value={editing.frequencyDays} onChange={e=>setEditing({...editing, frequencyDays: parseInt(e.target.value)||7})}/></label>
              <label className="col-span-2 text-sm">Phone<input className="mt-1 w-full bg-slate-950 border border-slate-800 rounded px-2 py-1" value={editing.phoneNumber} onChange={e=>setEditing({...editing, phoneNumber:e.target.value})}/></label>
              <label className="col-span-2 text-sm">Email<input className="mt-1 w-full bg-slate-950 border border-slate-800 rounded px-2 py-1" value={editing.email||''} onChange={e=>setEditing({...editing, email:e.target.value})}/></label>
              <label className="text-sm">Priority (1-5)<input type="number" min="1" max="5" className="mt-1 w-full bg-slate-950 border border-slate-800 rounded px-2 py-1" value={editing.priority||1} onChange={e=>setEditing({...editing, priority: parseInt(e.target.value)||1})}/></label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1.5 rounded border border-slate-700" onClick={()=>setEditing(null)}>Cancel</button>
              <button className="px-3 py-1.5 rounded bg-blue-600" onClick={()=>save(editing)}>Save</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

function HistoryPage(){
  const { data, loading } = useFetch(`${API_BASE}/api/interactions`, [])
  return (
    <Layout>
      <h1 className="text-2xl font-semibold mb-4">History</h1>
      {loading && <div className="text-slate-400">Loading...</div>}
      <div className="space-y-3">
        {data?.map(i=> (
          <div key={i.id} className="bg-slate-900 border border-slate-800 rounded p-3">
            <div className="text-sm text-slate-400">{new Date(i.createdAt).toLocaleString()} • {i.type}</div>
            {i.messagePreview && <div className="text-slate-200 mt-1">“{i.messagePreview}”</div>}
            {i.notes && <div className="text-slate-200 mt-1">Notes: {i.notes}</div>}
          </div>
        ))}
      </div>
    </Layout>
  )
}

function Settings(){
  const { data: initial, setData } = useFetch(`${API_BASE}/api/settings`, [])
  const [form, setForm] = useState(null)
  useEffect(()=>{ if(initial) setForm(initial) },[initial])
  function save(){
    const payload = { mode: form.mode, countDaily: Number(form.countDaily), countWeekly: Number(form.countWeekly), defaultFrequencies: form.defaultFrequencies }
    fetch(`${API_BASE}/api/settings`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }).then(r=>r.json()).then(setData)
  }
  if(!form) return <Layout><div className="text-slate-400">Loading...</div></Layout>
  return (
    <Layout>
      <h1 className="text-2xl font-semibold mb-4">Settings</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-sm">Default mode
          <select className="mt-1 w-full bg-slate-950 border border-slate-800 rounded px-2 py-1" value={form.mode} onChange={e=>setForm({...form, mode:e.target.value})}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>
        <label className="text-sm">Daily count
          <input type="number" className="mt-1 w-full bg-slate-950 border border-slate-800 rounded px-2 py-1" value={form.countDaily} onChange={e=>setForm({...form, countDaily: Number(e.target.value)})}/>
        </label>
        <label className="text-sm">Weekly count
          <input type="number" className="mt-1 w-full bg-slate-950 border border-slate-800 rounded px-2 py-1" value={form.countWeekly} onChange={e=>setForm({...form, countWeekly: Number(e.target.value)})}/>
        </label>
        <label className="col-span-1 md:col-span-2 text-sm">Default frequencies (days, comma-separated)
          <input className="mt-1 w-full bg-slate-950 border border-slate-800 rounded px-2 py-1" value={form.defaultFrequencies.join(', ')} onChange={e=>setForm({...form, defaultFrequencies: e.target.value.split(',').map(s=>parseInt(s.trim())).filter(Boolean)})}/>
        </label>
      </div>
      <div className="mt-4">
        <button className="px-3 py-1.5 rounded bg-blue-600" onClick={save}>Save Settings</button>
      </div>
    </Layout>
  )
}

function AppRouter(){
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard/>} />
        <Route path="/contacts" element={<Contacts/>} />
        <Route path="/history" element={<HistoryPage/>} />
        <Route path="/settings" element={<Settings/>} />
      </Routes>
    </BrowserRouter>
  )
}

export default AppRouter
