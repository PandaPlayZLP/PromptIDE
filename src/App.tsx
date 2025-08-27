import React, { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'react-hot-toast'
import { MainLayout } from './components/Layout/MainLayout'
import { AuthProvider } from './contexts/AuthContext'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    },
  },
})

function App() {
  const [loading, setLoading] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(true)

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const electronAPI = (window as any).electronAPI
        if (electronAPI) {
          const darkMode = electronAPI.isDarkMode()
          setIsDarkMode(darkMode)
          electronAPI.onThemeChange((isDark: boolean) => {
            setIsDarkMode(isDark)
          })
        }
      } catch (error) {
        console.error('Error initializing app:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeApp()
  }, [])

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Prompt IDE
          </h2>
          <p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Wird geladen...
          </p>
        </div>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className={`min-h-screen ${isDarkMode ? 'bg-slate-900 dark' : 'bg-white'}`}>
          <MainLayout />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              className: isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900',
              style: {
                background: isDarkMode ? '#1e293b' : '#ffffff',
                color: isDarkMode ? '#ffffff' : '#0f172a',
                border: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0',
              },
              success: {
                iconTheme: { primary: '#10b981', secondary: '#ffffff' },
              },
              error: {
                iconTheme: { primary: '#ef4444', secondary: '#ffffff' },
              },
            }}
          />
          <ReactQueryDevtools initialIsOpen={false} />
        </div>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App