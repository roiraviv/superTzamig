import { createContext, useContext } from 'react'

export const QuoteCartContext = createContext(null)

/** Items the visitor has staged for a quote, shared by the catalog and wizard. */
export function useQuoteCart() {
  const context = useContext(QuoteCartContext)
  if (!context) {
    throw new Error('useQuoteCart must be used inside <QuoteCartProvider>')
  }
  return context
}
