import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TEAMS } from '@/data/teams'
import { Flag } from './Flag'

describe('Flag', () => {
  it('renders an image for a valid team', () => {
    const html = renderToStaticMarkup(<Flag team={TEAMS.BRA} size={32} />)

    expect(html).toContain('<img')
    expect(html).toContain('flagcdn.com')
    expect(html).toContain('alt="Brasil"')
  })

  it('renders an intentional placeholder for TBD teams', () => {
    const html = renderToStaticMarkup(<Flag team={TEAMS.TBD} size={32} />)

    expect(html).not.toContain('<img')
    expect(html).toContain('aria-label="A definir"')
    expect(html).toContain('AD')
  })

  it('renders an intentional placeholder for null teams', () => {
    const html = renderToStaticMarkup(<Flag team={null} size={32} placeholderLabel="Classificado a definir" />)

    expect(html).not.toContain('<img')
    expect(html).toContain('aria-label="Classificado a definir"')
  })
})
