'use client'

import { Toaster } from 'sonner'
import { AuthProvider } from '@/components/auth/auth-provider'

// =============================================================================
// Root Providers
// =============================================================================
// Wraps the entire application with necessary context providers.
// Order matters: outermost providers are initialized first.
// =============================================================================

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      {children}
      <Toaster
        position="bottom-center"
        gap={8}
        toastOptions={{
          unstyled: true,
          duration: 3600,
          classNames: {
            toast:
              'flex items-center gap-2.5 rounded-[10px] border border-line bg-surface2 px-3.5 py-2.5 text-[12.5px] leading-snug text-ink shadow-plate',
            title: 'font-normal',
            description: 'text-[11.5px] text-muted',
            icon: 'shrink-0 [&_svg]:h-4 [&_svg]:w-4',
            success: '[&_[data-icon]]:text-ok',
            error: '[&_[data-icon]]:text-danger',
            warning: '[&_[data-icon]]:text-warn',
            info: '[&_[data-icon]]:text-faint',
          },
        }}
      />
    </AuthProvider>
  )
}
