'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart2, Users, Upload, Settings, LogOut, Building2, ChevronDown, FolderOpen, TrendingUp, Menu, X, LayoutGrid, Eye, Package, UserPlus } from 'lucide-react'

const navItems = [
  { label: 'Overview',   href: '/dashboard/overview',  icon: LayoutGrid,  minRole: 'viewer' },
  { label: 'Analytics',  href: '/dashboard/analytics', icon: BarChart2,   minRole: 'viewer' },
  { label: 'Products',   href: '/dashboard/products-breakdown', icon: Package, minRole: 'viewer' },
  { label: 'Meta Ads',   href: '/dashboard/meta',      icon: TrendingUp,  minRole: 'viewer' },
  { label: 'Import CSV', href: '/dashboard/import',    icon: Upload,      minRole: 'member' },
  { label: 'Settings',   href: '/dashboard/settings',  icon: Settings,    minRole: 'admin'  },
]
const ROLE_RANK: Record<string, number> = { viewer: 0, member: 1, admin: 2 }
function canAccess(userRole: string, minRole: string) {
  return (ROLE_RANK[userRole] ?? 0) >= (ROLE_RANK[minRole] ?? 0)
}

interface Org { id: string; name: string; slug: string }
interface Profile { full_name: string | null; role: string; is_superadmin: boolean; org_id: string | null; memberRole?: string }

const ORGS_CACHE_KEY = 'attomik:orgs-cache'
const ACTIVE_ORG_CACHE_KEY = 'attomik:active-org-cache'
const PROFILE_CACHE_KEY = 'attomik:profile-cache'

function readCachedOrgs(): { orgs: Org[]; active: Org | null } {
  if (typeof window === 'undefined') return { orgs: [], active: null }
  try {
    const orgsRaw = window.localStorage.getItem(ORGS_CACHE_KEY)
    const activeRaw = window.localStorage.getItem(ACTIVE_ORG_CACHE_KEY)
    return {
      orgs: orgsRaw ? JSON.parse(orgsRaw) as Org[] : [],
      active: activeRaw ? JSON.parse(activeRaw) as Org : null,
    }
  } catch {
    return { orgs: [], active: null }
  }
}

function readCachedProfile(): Profile | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY)
    return raw ? JSON.parse(raw) as Profile : null
  } catch {
    return null
  }
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  // Hydrate from localStorage so the org switcher paints on the first frame
  // instead of staying hidden until the auth round-trip + DB query finish.
  const cached = useRef(readCachedOrgs()).current
  const [orgs, setOrgs] = useState<Org[]>(cached.orgs)
  const [activeOrg, setActiveOrg] = useState<Org | null>(cached.active)
  const [profile, setProfile] = useState<Profile | null>(readCachedProfile())
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [viewAsName, setViewAsName] = useState<string | null>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadData()
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
    document.body.classList.remove('sidebar-open')
  }, [pathname])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('full_name, role, is_superadmin').eq('id', user.id).single()
    setProfile(prof as any)
    try { if (prof) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(prof)) } catch {}
    const viewAsUserId = localStorage.getItem('viewAsUserId')
    const viewAsUserNameStored = localStorage.getItem('viewAsUserName')
    if (viewAsUserId && viewAsUserNameStored) setViewAsName(viewAsUserNameStored)

    const urlOrgSlug = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('org')
      : null
    const resolveOrg = <T extends { id: string; slug: string }>(list: T[]): T | undefined => {
      if (urlOrgSlug) {
        const byUrl = list.find(o => o.slug === urlOrgSlug)
        if (byUrl) return byUrl
      }
      const savedOrgId = localStorage.getItem('activeOrgId')
      return list.find(o => o.id === savedOrgId)
    }

    if (prof?.is_superadmin && !viewAsUserId) {
      // Superadmin sees all orgs
      const { data: allOrgs } = await supabase.from('organizations').select('id, name, slug').is('archived_at', null).order('name')
      const list = allOrgs ?? []
      setOrgs(list)
      try { localStorage.setItem(ORGS_CACHE_KEY, JSON.stringify(list)) } catch {}
      const found = resolveOrg(list)
      const defaultOrg = found ?? list[0] ?? null
      setActiveOrg(defaultOrg)
      if (defaultOrg) {
        localStorage.setItem('activeOrgId', defaultOrg.id)
        try { localStorage.setItem(ACTIVE_ORG_CACHE_KEY, JSON.stringify(defaultOrg)) } catch {}
      }
    } else if (prof?.is_superadmin && viewAsUserId) {
      // Superadmin in "View as" mode — fetch via API to bypass RLS
      const res = await fetch(`/api/overview?viewAs=${viewAsUserId}`)
      const data = await res.json()
      const memberOrgs = (data.orgs ?? []).sort((a: any, b: any) => a.name.localeCompare(b.name))
      setOrgs(memberOrgs)
      try { localStorage.setItem(ORGS_CACHE_KEY, JSON.stringify(memberOrgs)) } catch {}
      const found = resolveOrg(memberOrgs)
      const defaultOrg = found ?? memberOrgs[0] ?? null
      setActiveOrg(defaultOrg)
      if (defaultOrg) {
        localStorage.setItem('activeOrgId', defaultOrg.id)
        try { localStorage.setItem(ACTIVE_ORG_CACHE_KEY, JSON.stringify(defaultOrg)) } catch {}
      }
      // Use viewer role for nav filtering in view-as mode
      setProfile(prev => {
        const next = prev ? { ...prev, memberRole: 'viewer', is_superadmin: false } : prev
        try { if (next) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(next)) } catch {}
        return next
      })
    } else {
      // Regular user: load their memberships
      const { data: memberships } = await supabase
        .from('org_memberships')
        .select('org_id, role, organizations(id, name, slug, archived_at)')
        .eq('user_id', user.id)
      const memberOrgs = (memberships ?? [])
        .map((m: any) => m.organizations)
        .filter((o: any) => o && o.archived_at == null)
        .map(({ archived_at: _a, ...rest }: any) => rest)
        .sort((a: any, b: any) => a.name.localeCompare(b.name))
      setOrgs(memberOrgs)
      try { localStorage.setItem(ORGS_CACHE_KEY, JSON.stringify(memberOrgs)) } catch {}
      const savedOrgId = localStorage.getItem('activeOrgId')
      const found = resolveOrg(memberOrgs)
      const defaultOrg = found ?? memberOrgs[0] ?? null
      setActiveOrg(defaultOrg)
      if (defaultOrg) {
        localStorage.setItem('activeOrgId', defaultOrg.id)
        try { localStorage.setItem(ACTIVE_ORG_CACHE_KEY, JSON.stringify(defaultOrg)) } catch {}
      } else {
        // No memberships — user was removed from all projects
        localStorage.removeItem('activeOrgId')
        localStorage.removeItem(ACTIVE_ORG_CACHE_KEY)
        localStorage.removeItem(ORGS_CACHE_KEY)
      }
      // If saved org was removed, clear it so dashboard doesn't show stale data
      if (savedOrgId && !found && defaultOrg) {
        localStorage.setItem('activeOrgId', defaultOrg.id)
        window.location.reload()
        return
      }
      // Store highest role across all orgs for nav visibility
      const highestRole = (memberships ?? []).reduce((best: string, m: any) => {
        return (ROLE_RANK[m.role] ?? 0) > (ROLE_RANK[best] ?? 0) ? m.role : best
      }, 'viewer')
      setProfile(prev => {
        const next = prev ? { ...prev, memberRole: highestRole } : prev
        try { if (next) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(next)) } catch {}
        return next
      })
    }
  }

  const switchOrg = (org: Org) => {
    setActiveOrg(org)
    localStorage.setItem('activeOrgId', org.id)
    try { localStorage.setItem(ACTIVE_ORG_CACHE_KEY, JSON.stringify(org)) } catch {}
    setDropdownOpen(false)
    // Switching brands from Overview (multi-brand view) should land on that brand's analytics
    if (pathname === '/dashboard/overview') {
      window.location.href = '/dashboard/analytics'
    } else {
      window.location.reload()
    }
  }

  const handleSignOut = async () => {
    localStorage.removeItem('viewAsUserId')
    localStorage.removeItem('viewAsUserName')
    localStorage.removeItem(PROFILE_CACHE_KEY)
    localStorage.removeItem(ORGS_CACHE_KEY)
    localStorage.removeItem(ACTIVE_ORG_CACHE_KEY)
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const initials = (name: string | null) =>
    name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'AT'

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="sidebar-logo" style={{ position: 'relative' }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3162 909" className="logo-sidebar">
          <g transform="scale(8.11041548093341) translate(10, 10)">
            <g transform="matrix(1.0466,0,0,1.0466,-6.28,-6.28)" fill="#ffffff">
              <g transform="translate(0,-952.36218)">
                <path d="m 13.540789,1013.168 c -4.1612604,0 -7.5408665,3.3922 -7.5408665,7.5693 0,4.1771 3.3796061,7.605 7.5408665,7.605 0.813543,0 1.613976,-0.1361 2.383228,-0.3928 12.281102,18.8997 36.649842,23.2608 54.493227,13.032 0.521221,-0.2991 0.724607,-1.0475 0.426614,-1.571 -0.297992,-0.5234 -1.043503,-0.7275 -1.565078,-0.4284 -16.772953,9.6153 -39.67122,5.6292 -51.327282,-12.1037 1.894251,-1.3812 3.130157,-3.6195 3.130157,-6.1411 0,-4.1771 -3.379252,-7.5693 -7.540866,-7.5693 z"/>
                <path d="m 70.417244,970.57299 c -0.951023,0.12132 -1.237323,1.69026 -0.391181,2.14225 13.429842,8.21899 20.928543,24.30182 17.64248,40.55986 -0.392953,-0.067 -0.80185,-0.107 -1.209331,-0.107 -4.161259,0 -7.540866,3.3922 -7.540866,7.5692 0,4.1771 3.379607,7.605 7.540866,7.605 4.16126,0 7.540866,-3.4279 7.540866,-7.605 0,-2.9516 -1.686968,-5.51 -4.161614,-6.748 3.607441,-17.29107 -4.331338,-34.48188 -18.638503,-43.23773 -0.189921,-0.12122 -0.415984,-0.18423 -0.64063,-0.17852 -0.04784,-0.003 -0.09425,-0.003 -0.142087,0 z"/>
                <path d="m 50.000001,958.36218 c -4.012441,0 -7.27441,3.16987 -7.505079,7.14083 -17.197086,3.19362 -29.727637,16.85266 -32.5821254,33.06201 a 1.1383515,1.1426463 0 1 0 2.2407874,0.39275 c 2.681221,-15.22486 14.388307,-28.07084 30.518858,-31.1697 0.826653,3.28539 3.802677,5.71266 7.327559,5.71266 4.161259,0 7.540866,-3.39219 7.540866,-7.56928 0,-4.17708 -3.379607,-7.56927 -7.540866,-7.56927 z"/>
              </g>
            </g>
            <g transform="matrix(2.7814,0,0,2.7814,111.833,11.314)" fill="#ffffff">
              <path d="M12.76 20 l-1.6 -3.72 l-7.94 0 l-1.6 3.72 l-1.56 0 l6.28 -14.58 l1.74 0 l6.3 14.58 l-1.62 0 z M10.58 14.88 l-3.4 -7.88 l-3.38 7.88 l6.78 0 z M21.24 6.86 l0 13.14 l-1.52 0 l0 -13.14 l-4.88 0 l0 -1.44 l11.28 0 l0 1.44 l-4.88 0 z M33.32 6.86 l0 13.14 l-1.52 0 l0 -13.14 l-4.88 0 l0 -1.44 l11.28 0 l0 1.44 l-4.88 0 z M54.26 12.68 c0 1.38 -0.32 2.64 -0.94 3.78 c-0.64 1.14 -1.52 2.04 -2.64 2.7 c-1.14 0.66 -2.38 1 -3.78 1 c-1.02 0 -1.98 -0.2 -2.9 -0.58 c-0.9 -0.38 -1.68 -0.9 -2.32 -1.58 c-0.64 -0.64 -1.14 -1.42 -1.52 -2.34 c-0.36 -0.92 -0.56 -1.88 -0.56 -2.9 c0 -1.38 0.32 -2.64 0.96 -3.78 c0.62 -1.14 1.5 -2.06 2.64 -2.72 c1.12 -0.66 2.38 -0.98 3.76 -0.98 c1.02 0 1.98 0.18 2.9 0.56 c0.9 0.4 1.68 0.92 2.32 1.56 c0.64 0.68 1.16 1.46 1.52 2.36 c0.38 0.92 0.56 1.88 0.56 2.92 z M52.68 12.76 c0 -1.64 -0.6 -3.16 -1.6 -4.26 s-2.5 -1.8 -4.18 -1.8 c-1.08 0 -2.06 0.28 -2.94 0.8 c-0.88 0.56 -1.56 1.28 -2.04 2.18 c-0.48 0.92 -0.72 1.92 -0.72 3 c0 1.62 0.6 3.16 1.6 4.24 c1 1.1 2.5 1.8 4.16 1.8 c1.08 0 2.06 -0.28 2.94 -0.82 c0.9 -0.52 1.58 -1.26 2.06 -2.16 s0.72 -1.9 0.72 -2.98 z M70.3 5.42 l2.2 0 l0 14.58 l-1.52 0 l0 -12.5 l0 0 l-5.42 12.5 l-1.38 0 l-5.38 -12.4 l0 0 l0 12.4 l-1.52 0 l0 -14.58 l2.18 0 l5.44 12.5 z M76.56 20 l0 -14.58 l1.54 0 l0 14.58 l-1.54 0 z M83.68 20 l-1.54 0 l0 -14.58 l1.54 0 l0 6.44 l0.1 0 l6.54 -6.44 l2.12 0 l-7.14 6.98 l7.48 7.6 l-2.16 0 l-6.84 -7.02 l-0.1 0 l0 7.02 z"/>
            </g>
          </g>
        </svg>
        {/* Close button on mobile */}
        <button onClick={() => { setMobileOpen(false); document.body.classList.remove('sidebar-open') }} style={{ display: 'none', background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', position: 'absolute', right: 16, top: 28 }} className="mobile-close">
          <X size={20} />
        </button>
      </div>

      {/* View as banner */}
      {viewAsName && (
        <div style={{ padding: '8px 12px', background: '#fef3c7', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Eye size={13} color="#92400e" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Barlow, sans-serif' }}>Viewing as</div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#78350f', fontFamily: 'Barlow, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{viewAsName}</div>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('viewAsUserId')
              localStorage.removeItem('viewAsUserName')
              window.location.href = '/dashboard/overview'
            }}
            className="btn btn-dark btn-xs"
            style={{ flexShrink: 0 }}
          >
            Exit
          </button>
        </div>
      )}

      {/* Org switcher */}
      {orgs.length > 0 && (
        <div ref={dropRef} style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, position: 'relative' }}>
          <button onClick={() => orgs.length > 1 && setDropdownOpen(!dropdownOpen)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: 'none', cursor: orgs.length > 1 ? 'pointer' : 'default', transition: '0.15s', textAlign: 'left' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Building2 size={15} color="#000" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeOrg?.name ?? 'Select project'}</div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'DM Mono, monospace' }}>{activeOrg?.slug ?? '—'}</div>
            </div>
            {orgs.length > 1 && <ChevronDown size={14} color="rgba(255,255,255,0.4)" style={{ flexShrink: 0, transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: '0.15s' }} />}
          </button>
          {dropdownOpen && orgs.length > 1 && (
            <div style={{ position: 'absolute', top: 'calc(100% - 4px)', left: 12, right: 12, background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, overflow: 'hidden', zIndex: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
              {orgs.map(org => (
                <button key={org.id} onClick={() => switchOrg(org)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: 'none', textAlign: 'left', background: org.id === activeOrg?.id ? 'rgba(0,255,151,0.1)' : 'transparent', cursor: 'pointer', transition: '0.1s' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: org.id === activeOrg?.id ? 'var(--accent)' : 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: org.id === activeOrg?.id ? 700 : 400, color: org.id === activeOrg?.id ? 'var(--accent)' : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{org.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'DM Mono, monospace' }}>{org.slug}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <div className="sidebar-nav">
        {navItems.filter(({ minRole }) => {
          if (profile?.is_superadmin) return true
          const role = profile?.memberRole ?? profile?.role ?? 'viewer'
          return canAccess(role, minRole)
        }).map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <button key={href} onClick={() => router.push(href)}
              className={`nav-item${active ? ' active' : ''}`}>
              <Icon size={16} style={{ flexShrink: 0, opacity: active ? 1 : 0.6 }} />
              {label}
            </button>
          )
        })}
      </div>

      {/* Superadmin section */}
      {profile?.is_superadmin && (
        <div style={{ padding: '8px 0', borderTop: '1px solid var(--sidebar-border)', flexShrink: 0 }}>
          <div className="label" style={{ padding: '8px 24px 4px', color: 'rgba(255,255,255,0.25)', fontSize: '0.65rem', letterSpacing: '0.1em' }}>Admin</div>
          {[
            { label: 'Projects', href: '/dashboard/projects', icon: FolderOpen },
            { label: 'Onboarding', href: '/admin', icon: UserPlus },
          ].map(({ label, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <button key={href} onClick={() => router.push(href)}
                className={`nav-item${active ? ' active' : ''}`}>
                <Icon size={16} style={{ flexShrink: 0, opacity: active ? 1 : 0.6 }} />
                {label}
              </button>
            )
          })}
        </div>
      )}

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="avatar avatar-sm" style={{ width: 34, height: 34 }}>
          {initials(profile?.full_name ?? null)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff' }} className="truncate">{profile?.full_name ?? 'User'}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize' }}>{profile?.is_superadmin ? 'Super Admin' : profile?.role ?? 'Member'}</div>
        </div>
        <button onClick={handleSignOut} title="Sign out" className="btn-ghost" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 4, transition: '0.15s', flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}>
          <LogOut size={16} />
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button onClick={() => { setMobileOpen(true); document.body.classList.add('sidebar-open') }}
        className="mobile-menu-btn">
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      <div onClick={() => { setMobileOpen(false); document.body.classList.remove('sidebar-open') }}
        className="sidebar-overlay"
      />

      {/* Sidebar */}
      <aside className="sidebar">
        {sidebarContent}
      </aside>
    </>
  )
}
