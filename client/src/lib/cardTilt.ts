import type { PointerEvent } from 'react'

export const cardTilt = {
  onPointerMove(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === 'touch' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const card = event.currentTarget
    const bounds = card.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    const x = Math.max(-1, Math.min(1, 2 * (event.clientX - bounds.left) / bounds.width - 1))
    const y = Math.max(-1, Math.min(1, 2 * (event.clientY - bounds.top) / bounds.height - 1))
    card.style.setProperty('--tilt-x', `${-y * 9}deg`)
    card.style.setProperty('--tilt-y', `${x * 11}deg`)
    card.style.setProperty('--shine-x', `${50 + x * 46}%`)
    card.style.setProperty('--shine-y', `${50 + y * 46}%`)
    card.setAttribute('data-tilting', '')
  },
  onPointerLeave: resetTilt,
  onPointerCancel: resetTilt,
}

function resetTilt(event: PointerEvent<HTMLElement>) {
  event.currentTarget.removeAttribute('data-tilting')
}
