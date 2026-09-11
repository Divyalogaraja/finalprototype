import React from 'react'
import { createRoot } from 'react-dom/client'
import 'reactflow/dist/style.css'
import './index.css'
import App from './App'
import { SimProvider } from './store/SimContext'

createRoot(document.getElementById('root')).render(
  <SimProvider><App /></SimProvider>
)
