import { createClient } from '@/lib/supabase/server'
import Topbar from '@/components/Topbar'

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles').select('*, organizations(*)').eq('id', user.id).single()

  const org = (profile as any)?.organizations

  return (
    <div>
      <Topbar title="Settings" subtitle="Organization & integrations" />
      <div style={{ padding: '32px 40px 48px', maxWidth: 640 }}>

        {/* Org info */}
        <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
            Organization
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Name</label>
              <div style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', background: 'var(--cream)' }}>
                {org?.name ?? '—'}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Slug</label>
              <div style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem', background: 'var(--cream)', fontFamily: 'var(--font-mono)' }}>
                {org?.slug ?? '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Integrations — coming soon */}
        <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
            Integrations
          </div>
          {[
            { name: 'Shopify', desc: 'Sync orders automatically', status: org?.shopify_domain ? 'connected' : 'not connected' },
            { name: 'Meta Ads', desc: 'Sync ad spend + ROAS', status: org?.meta_ad_account_id ? 'connected' : 'not connected' },
            { name: 'Amazon', desc: 'Sync marketplace sales', status: 'coming soon' },
            { name: 'Google Ads', desc: 'Sync campaign performance', status: 'coming soon' },
          ].map(integration => (
            <div key={integration.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{integration.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 2 }}>{integration.desc}</div>
              </div>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.04em', padding: '3px 9px', borderRadius: 20,
                background: integration.status === 'connected' ? 'var(--accent)' :
                  integration.status === 'coming soon' ? 'var(--cream)' : '#fee2e2',
                color: integration.status === 'connected' ? '#000' :
                  integration.status === 'coming soon' ? 'var(--muted)' : '#b91c1c',
              }}>
                {integration.status}
              </span>
            </div>
          ))}
        </div>

        {/* Account */}
        <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 10, padding: 24 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
            Account
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
            Signed in as <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{user.email}</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 4 }}>
            Role: <span style={{ fontWeight: 600 }}>{profile?.role ?? 'viewer'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
