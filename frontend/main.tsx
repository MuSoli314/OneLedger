import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { CategoryProvider } from './contexts/CategoryContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { HomeFilterProvider } from './contexts/HomeFilterContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CategoryProvider>
        <SettingsProvider>
          <HomeFilterProvider>
            <App />
          </HomeFilterProvider>
        </SettingsProvider>
      </CategoryProvider>
    </BrowserRouter>
  </StrictMode>,
)
