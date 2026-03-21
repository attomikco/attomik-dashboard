'use client'

import type { Order } from '@/types'

interface OrdersTableProps {
  orders: Order[]
}

const statusBadge: Record<string, string> = {
  paid: 'badge-paid',
  pending: 'badge-pending',
  refunded: 'badge-refunded',
  cancelled: 'badge-cancelled',
}

export default function OrdersTable({ orders }: OrdersTableProps) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Order', 'Date', 'Customer', 'Source', 'Amount', 'Status'].map(h => (
              <th key={h} style={{
                padding: '10px 24px', background: 'var(--cream)',
                fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.06em', color: 'var(--muted)', textAlign: 'left',
                whiteSpace: 'nowrap',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
                No orders yet. Upload a CSV to get started.
              </td>
            </tr>
          ) : orders.map(o => (
            <tr key={o.id} style={{ borderBottom: '1px solid var(--border)', transition: '0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <td style={{ padding: '13px 24px', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--muted)' }}>
                {o.external_id ?? o.id.slice(0, 8)}
              </td>
              <td style={{ padding: '13px 24px', color: 'var(--muted)', fontSize: '0.875rem' }}>
                {new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </td>
              <td style={{ padding: '13px 24px', fontWeight: 500 }}>
                {o.customer_name || o.customer_email || '—'}
              </td>
              <td style={{ padding: '13px 24px' }}>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.04em', color: 'var(--muted)',
                }}>
                  {o.source}
                </span>
              </td>
              <td style={{ padding: '13px 24px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                ${Number(o.total_price).toFixed(2)}
              </td>
              <td style={{ padding: '13px 24px' }}>
                <span className={`badge ${statusBadge[o.status] ?? 'badge-pending'}`}>
                  {o.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
