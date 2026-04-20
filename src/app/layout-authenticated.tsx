'use client'

import React from 'react'
import MessagingPanel from '@/components/MessagingPanel'

export function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <MessagingPanel />
    </>
  )
}
