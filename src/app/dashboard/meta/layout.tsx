import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Meta Ads',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
