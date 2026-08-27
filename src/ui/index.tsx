// Shared controls. Small, typed, and all at least 40px tall.
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { ICON_BY } from '@/model/library'
import { useDoc } from '@/state/store'
import s from './ui.module.css'

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement>

export function Pill({
  on,
  small,
  tone,
  hex,
  ...rest
}: BtnProps & { on?: boolean; small?: boolean; tone?: 'dashed' | 'quiet' | 'soft' | 'primary' | 'accent2'; hex?: string | null }) {
  const style: CSSProperties | undefined = hex
    ? on
      ? { background: hex, borderColor: hex, color: '#fff', ...rest.style }
      : rest.style
    : rest.style
  return (
    <button
      type="button"
      {...rest}
      style={style}
      className={s.pill + (rest.className ? ' ' + rest.className : '')}
      data-on={on ? 'true' : undefined}
      data-small={small ? 'true' : undefined}
      data-tone={tone}
      data-hex={hex !== undefined ? 'true' : undefined}
    />
  )
}

export function Micro({ accent, children, style }: { accent?: boolean; children: ReactNode; style?: CSSProperties }) {
  return (
    <span className={s.micro} data-accent={accent ? 'true' : undefined} style={style}>
      {children}
    </span>
  )
}

export function Chip({ color, bg, children, style, title }: { color: string; bg: string; children: ReactNode; style?: CSSProperties; title?: string }) {
  return (
    <span className={s.chip} style={{ color, background: bg, ...style }} title={title}>
      {children}
    </span>
  )
}

export function Step({ size, ...rest }: BtnProps & { size?: 'sm' | 'xs' | 'w30' }) {
  return <button type="button" {...rest} className={s.step} data-size={size} />
}

/** − value + with a label; the workhorse of the cascade. */
export function Stepper({
  label,
  value,
  onMinus,
  onPlus,
  size = 'xs',
  numStyle,
  title,
}: {
  label?: ReactNode
  value: string
  onMinus: () => void
  onPlus: () => void
  size?: 'sm' | 'xs' | 'w30'
  numStyle?: CSSProperties
  title?: string
}) {
  return (
    <span className={s.stepperRow} title={title}>
      {label != null && <Micro>{label}</Micro>}
      <Step size={size} onClick={onMinus} aria-label="Less">
        −
      </Step>
      <span className={s.num} style={numStyle}>
        {value}
      </span>
      <Step size={size} onClick={onPlus} aria-label="More">
        +
      </Step>
    </span>
  )
}

export function IconBtn({ on, ...rest }: BtnProps & { on?: boolean }) {
  return <button type="button" {...rest} className={s.iconBtn} data-on={on ? 'true' : undefined} />
}

export function VSep() {
  return <span className={s.vsep} />
}

export const inputClass = s.input
export const textareaClass = s.textarea
export const swatchClass = s.swatch
export const swatchRowClass = s.swatchRow
export const iconPickClass = s.iconPick
export const iconRowClass = s.iconRow
export const uploadIconClass = s.uploadIcon
export const tileClass = s.tile

/** A drawn icon from the app's own set, an uploaded icon, or a character. */
export function Glyph({ icon, g, size = 15 }: { icon?: string | null; g?: string; size?: number }) {
  const up = useDoc((d) => (icon ? d.xIcons.find((u) => u.id === icon) : undefined))
  if (up)
    return (
      <img
        src={up.src}
        alt=""
        style={{ width: size, height: size, objectFit: 'contain', display: 'block', borderRadius: 3 }}
      />
    )
  const ic = icon ? ICON_BY[icon] : undefined
  if (!ic) return <>{g || ''}</>
  return <IconSvg d={ic.d} size={size} />
}

export function IconSvg({ d, size = 15, weight = 2.2, style }: { d: string; size?: number; weight?: number; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: size, height: size, display: 'block', ...style }}
      aria-hidden
    >
      <path d={d} />
    </svg>
  )
}

/** A drawn chevron rather than a typographic triangle — it scales and centres properly. */
export function Chevron({ open, size = 13, weight = 2.6 }: { open: boolean; size?: number; weight?: number }) {
  return <IconSvg d={open ? 'M5 9l7 7 7-7' : 'M9 5l7 7-7 7'} size={size} weight={weight} />
}

/** Reads a chosen file as a data URL. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const rd = new FileReader()
    rd.onload = () => res(String(rd.result))
    rd.onerror = () => rej(rd.error)
    rd.readAsDataURL(file)
  })
}
