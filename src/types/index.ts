export type Role = 'admin' | 'viewer' | 'member'
export type Platform = 'meta' | 'google' | 'tiktok'
export type OrderStatus = 'paid' | 'pending' | 'refunded' | 'cancelled'
export type OrderSource = 'shopify' | 'amazon' | 'csv'

export interface Organization {
  id: string
  name: string
  slug: string
  shopify_domain: string | null
  shopify_token: string | null
  meta_ad_account_id: string | null
  meta_access_token: string | null
  created_at: string
}

export interface Profile {
  id: string
  org_id: string
  role: Role
  full_name: string | null
  created_at: string
}

export interface Order {
  id: string
  org_id: string
  external_id: string | null
  source: OrderSource
  customer_email: string | null
  customer_name: string | null
  total_price: number
  status: OrderStatus
  created_at: string
  synced_at: string
}

export interface AdSpend {
  id: string
  org_id: string
  platform: Platform
  campaign_name: string | null
  spend: number
  impressions: number
  clicks: number
  conversions: number
  date: string
  synced_at: string
}

export interface KPI {
  label: string
  value: string
  change: number
  changeLabel: string
}

export interface Database {
  public: {
    Tables: {
      organizations: { Row: Organization; Insert: Partial<Organization>; Update: Partial<Organization> }
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> }
      orders: { Row: Order; Insert: Partial<Order>; Update: Partial<Order> }
      ad_spend: { Row: AdSpend; Insert: Partial<AdSpend>; Update: Partial<AdSpend> }
    }
  }
}
