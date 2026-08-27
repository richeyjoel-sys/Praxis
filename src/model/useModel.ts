import { useMemo } from 'react'
import { useStore } from '@/state/store'
import { createModel, type Model } from './select'
import { MATRIX } from '@/data/matrix.generated'

/** The model for the current doc + ui. One instance per state change. */
export function useModel(): Model {
  const doc = useStore((s) => s.doc)
  const ui = useStore((s) => s.ui)
  return useMemo(() => createModel(doc, ui, MATRIX), [doc, ui])
}

/** For imperative code that needs the latest model without subscribing. */
export function modelNow(): Model {
  const { doc, ui } = useStore.getState()
  return createModel(doc, ui, MATRIX)
}
