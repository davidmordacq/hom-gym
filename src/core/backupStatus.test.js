import { describe, expect, it } from 'vitest'
import { BACKUP_EVERY_DAYS, backupStatus, backupText, daysSince, snoozeUntil } from './backupStatus.js'

const now = new Date('2026-11-09T12:00:00Z')
const ago = (days, hours = 0) => new Date(now.getTime() - days * 86_400_000 - hours * 3_600_000).toISOString()

describe('daysSince', () => {
  it('cuenta días completos', () => {
    expect(daysSince(ago(0, 5), now)).toBe(0)
    expect(daysSince(ago(1), now)).toBe(1)
    expect(daysSince(ago(6, 23), now)).toBe(6)
    expect(daysSince(ago(7), now)).toBe(7)
  })
  it('sin fecha o con una fecha rota, null', () => {
    expect(daysSince(null, now)).toBeNull()
    expect(daysSince('ayer', now)).toBeNull()
  })
  it('una fecha futura (reloj raro) cuenta 0, no negativo', () => {
    expect(daysSince(ago(-2), now)).toBe(0)
  })
})

describe('backupStatus', () => {
  const status = (extra) => backupStatus({ lastBackupAt: ago(3), sessionCount: 10, now, ...extra })

  it('el aviso es semanal', () => {
    expect(BACKUP_EVERY_DAYS).toBe(7)
    expect(status({ lastBackupAt: ago(6) }).due).toBe(false)
    expect(status({ lastBackupAt: ago(7) }).due).toBe(true)
    expect(status({ lastBackupAt: ago(30) })).toMatchObject({ due: true, days: 30, never: false })
  })

  it('si nunca se hizo copia y hay datos, toca', () => {
    expect(status({ lastBackupAt: null })).toMatchObject({ due: true, never: true, days: null })
  })

  it('sin datos que perder no se avisa', () => {
    expect(status({ lastBackupAt: null, sessionCount: 0 }).due).toBe(false)
    expect(status({ lastBackupAt: ago(40), sessionCount: 0 }).due).toBe(false)
  })

  it('un aviso pospuesto no sale hasta que pasa la hora indicada', () => {
    expect(status({ lastBackupAt: ago(40), snoozedUntil: ago(-1) }).due).toBe(false)
    expect(status({ lastBackupAt: ago(40), snoozedUntil: ago(1) }).due).toBe(true)
    expect(status({ lastBackupAt: ago(40), snoozedUntil: null }).due).toBe(true)
  })

  it('se puede cambiar cada cuántos días', () => {
    expect(status({ lastBackupAt: ago(3), everyDays: 3 }).due).toBe(true)
    expect(status({ lastBackupAt: ago(3), everyDays: 14 }).due).toBe(false)
  })
})

describe('textos y posposición', () => {
  it('backupText', () => {
    expect(backupText({ never: true, days: null })).toMatch(/Todavía no/)
    expect(backupText({ never: false, days: 0 })).toBe('Tu última copia es de hoy.')
    expect(backupText({ never: false, days: 1 })).toBe('Tu última copia es de hace 1 día.')
    expect(backupText({ never: false, days: 9 })).toBe('Tu última copia es de hace 9 días.')
  })
  it('posponer es hasta mañana a la misma hora', () => {
    expect(snoozeUntil(now)).toBe('2026-11-10T12:00:00.000Z')
  })
})
