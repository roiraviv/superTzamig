import { useCallback, useEffect, useMemo, useState } from 'react'
import { QuoteCartContext } from './quoteCartContext'

const STORAGE_KEY = 'st.quote-cart.v1'
const MAX_LINES = 8
const MAX_QUANTITY = 16

/**
 * Persisted cart data is untrusted input: it survives across sessions and can be
 * edited by hand in devtools. Re-validate the whole shape on read and drop
 * anything that doesn't match rather than letting it into React state.
 */
function readStoredItems() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter(
        (item) =>
          typeof item?.tireId === 'string' &&
          item.tireId.length <= 64 &&
          Number.isInteger(item.quantity),
      )
      .slice(0, MAX_LINES)
      .map((item) => ({
        tireId: item.tireId,
        quantity: Math.max(1, Math.min(MAX_QUANTITY, item.quantity)),
        snapshot: {
          brand: String(item.snapshot?.brand ?? '').slice(0, 40),
          model: String(item.snapshot?.model ?? '').slice(0, 60),
          size: String(item.snapshot?.size ?? '').slice(0, 30),
          price: Number(item.snapshot?.price) || 0,
          imageUrl: String(item.snapshot?.imageUrl ?? '').slice(0, 500),
        },
      }))
  } catch {
    return []
  }
}

export function QuoteCartProvider({ children }) {
  const [items, setItems] = useState(readStoredItems)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // Private mode or a full quota shouldn't break the cart in memory.
    }
  }, [items])

  const addItem = useCallback((tire, quantity = 4) => {
    setItems((previous) => {
      const existing = previous.find((item) => item.tireId === tire.id)
      if (existing) {
        return previous.map((item) =>
          item.tireId === tire.id
            ? { ...item, quantity: Math.min(MAX_QUANTITY, item.quantity + quantity) }
            : item,
        )
      }
      if (previous.length >= MAX_LINES) return previous
      return [
        ...previous,
        {
          tireId: tire.id,
          quantity: Math.max(1, Math.min(MAX_QUANTITY, quantity)),
          snapshot: {
            brand: tire.brand,
            model: tire.model,
            size: tire.size,
            price: tire.price,
            imageUrl: tire.imageUrl,
          },
        },
      ]
    })
  }, [])

  const removeItem = useCallback((tireId) => {
    setItems((previous) => previous.filter((item) => item.tireId !== tireId))
  }, [])

  const setQuantity = useCallback((tireId, quantity) => {
    const safe = Math.max(1, Math.min(MAX_QUANTITY, Math.floor(Number(quantity) || 1)))
    setItems((previous) =>
      previous.map((item) => (item.tireId === tireId ? { ...item, quantity: safe } : item)),
    )
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const value = useMemo(() => {
    const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0)
    return {
      items,
      totalUnits,
      // Display-only. The authoritative price always comes from the server.
      estimatedSubtotal: items.reduce(
        (sum, item) => sum + item.snapshot.price * item.quantity,
        0,
      ),
      isEmpty: items.length === 0,
      isFull: items.length >= MAX_LINES,
      has: (tireId) => items.some((item) => item.tireId === tireId),
      addItem,
      removeItem,
      setQuantity,
      clear,
    }
  }, [items, addItem, removeItem, setQuantity, clear])

  return <QuoteCartContext.Provider value={value}>{children}</QuoteCartContext.Provider>
}
