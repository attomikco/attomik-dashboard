'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Topbar from '@/components/Topbar'
import { Plus, Building2, BarChart2, Users, Settings } from 'lucide-react'

interface Org {
  id: string
  name: string
  slug: string
  created_at: string
  shopify_domain: string | null
  meta_ad_account_id: string | null
}

export default function ProjectsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [error, setError] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => { fetchOrgs() }, [])

  const fetchOrgs = async () => {
    setLoading(true)
    const { data } = await supabase.from('organizations').select('*').order('created_at', { ascending: false })
    setOrgs(data ?? [])
    setLoading(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError('')
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const { error } = await supabase.from('organizations').insert({ name, slug: cleanSlug })
    if (error) { setError(error.message); setCreating(false); return }
    setName(''); setSlug(''); setShowForm(false); setCreating(false)
    fetchOrgs()
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', border: '1px solid #e0e0e0', borderRadius: 6,
    fontFamily: 'Barlow, sans-serif', fontSize: '0.875rem', outline: 'none',
    transition: 'border-color 0.15s', background: '#fff', color: '#000',
  }

  const switchToOrg = (org: Org) => {
    localStorage.setItem('activeOrgId', org.id)
    router.push('/dashboard/analytics')
  }

  return (
    <div>
      <Topbar
        title="Client Projects"
        subtitle={`${orgs.length} project${orgs.length !== 1 ? 's' : ''}`}
        action={{ label: '+ New Project', onClick: () => setShowForm(true) }}
      />

      <div style={{ padding: '32px 40px 48px' }}>
        {showForm && (
          <div style={{ background: '#fff', border: '2px solid #00ff97', borderRadius: 10, padding: 24, marginBottom: 24 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 16, fontFamily: 'Barlow, sans-serif' }}>New client project</div>
            {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', marginBottom: 12, fontSize: '0.8rem', color: '#b91c1c', fontFamily: 'Barlow, sans-serif' }}>{error}</div>}
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4, fontFamily: 'Barlow, sans-serif' }}>Client name</label>
                  <input style={inputStyle} placeholder="e.g. Brand X" value={name}
                    onChange={e => { setName(e.target.value); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')) }}
                    onFocus={e => (e.target.style.borderColor = '#00ff97')}
                    onBlur={e => (e.target.style.borderColor = '#e0e0e0')} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4, fontFamily: 'Barlow, sans-serif' }}>Slug</label>
                  <input style={{ ...inputStyle, fontFamily: 'DM Mono, monospace', background: '#f2f2f2' }} value={slug}
                    onChange={e => setSlug(e.target.value)}
                    onFocus={e => (e.target.style.borderColor = '#00ff97')}
                    onBlur={e => (e.target.style.borderColor = '#e0e0e0')} required />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={creating} style={{ background: creating ? '#ccc' : '#00ff97', color: '#000', fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.875rem', padding: '10px 20px', border: 'none', borderRadius: 6, cursor: creating ? 'not-allowed' : 'pointer' }}>
                  {creating ? 'Creating…' : 'Create project'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setError('') }} style={{ background: '#f2f2f2', color: '#000', fontFamily: 'Barlow, sans-serif', fontWeight: 600, fontSize: '0.875rem', padding: '10px 20px', border: '1px solid #e0e0e0', borderRadius: 6, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div style={{ color: '#666', textAlign: 'center', padding: '80px 0', fontFamily: 'Barlow, sans-serif' }}>Loading…</div>
        ) : orgs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 24px', border: '2px dashed #e0e0e0', borderRadius: 10 }}>
            <Building2 size={32} style={{ color: '#ccc', margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontWeight: 700, marginBottom: 6, fontFamily: 'Barlow, sans-serif' }}>No projects yet</p>
            <p style={{ fontSize: '0.875rem', color: '#999', marginBottom: 20, fontFamily: 'Barlow, sans-serif' }}>Create your first client project to get started</p>
            <button onClick={() => setShowForm(true)} style={{ background: '#00ff97', color: '#000', fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.875rem', padding: '10px 20px', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              + New Project
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {orgs.map(org => (
              <div key={org.id} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, padding: 24, transition: '0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#ccc')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#e0e0e0')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: '#000', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Building2 size={18} color="#00ff97" />
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.975rem', fontFamily: 'Barlow, sans-serif' }}>{org.name}</div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.72rem', color: '#999' }}>{org.slug}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: org.shopify_domain ? '#e6fff5' : '#f2f2f2', color: org.shopify_domain ? '#007a48' : '#999', fontFamily: 'Barlow, sans-serif' }}>
                    {org.shopify_domain ? '✓ Shopify' : 'No Shopify'}
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: org.meta_ad_account_id ? '#e6fff5' : '#f2f2f2', color: org.meta_ad_account_id ? '#007a48' : '#999', fontFamily: 'Barlow, sans-serif' }}>
                    {org.meta_ad_account_id ? '✓ Meta' : 'No Meta'}
                  </span>
                </div>

                <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: 16, fontFamily: 'Barlow, sans-serif' }}>
                  Created {new Date(org.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  <button onClick={() => switchToOrg(org)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '7px 10px', background: '#000', color: '#00ff97', fontFamily: 'Barlow, sans-serif', fontWeight: 700, fontSize: '0.72rem', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                    <BarChart2 size={12} /> Analytics
                  </button>
                  <button onClick={() => router.push(`/dashboard/projects/${org.id}`)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '7px 10px', background: '#f2f2f2', color: '#000', fontFamily: 'Barlow, sans-serif', fontWeight: 600, fontSize: '0.72rem', border: '1px solid #e0e0e0', borderRadius: 6, cursor: 'pointer' }}>
                    <Users size={12} /> Access
                  </button>
                  <button onClick={() => router.push(`/dashboard/projects/${org.id}`)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '7px 10px', background: '#f2f2f2', color: '#000', fontFamily: 'Barlow, sans-serif', fontWeight: 600, fontSize: '0.72rem', border: '1px solid #e0e0e0', borderRadius: 6, cursor: 'pointer' }}>
                    <Settings size={12} /> Settings
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
