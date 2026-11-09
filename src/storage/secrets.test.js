import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createBackup, parseBackup, stripSecrets } from '../core/backup.js'
import { exportAll, getSetting, openDb, replaceAll, setSetting } from './db.js'
import { readSecrets, restoreSecrets } from './secrets.js'

let db
let counter = 0
beforeEach(async () => {
  counter += 1
  db = await openDb(`secrets-test-db-${counter}`)
})

describe('la clave de Intervals no entra en las copias de seguridad', () => {
  it('stripSecrets quita la clave y deja el resto, sin tocar el original', () => {
    const data = { settings: [{ key: 'theme', value: 'dark' }, { key: 'intervalsApiKey', value: 'SECRETA' }], sessions: [{ id: 1 }] }
    const clean = stripSecrets(data)
    expect(clean.settings).toEqual([{ key: 'theme', value: 'dark' }])
    expect(clean.sessions).toEqual([{ id: 1 }])
    expect(data.settings).toHaveLength(2)
  })

  it('sin ajustes no falla', () => {
    expect(stripSecrets({ sessions: [] })).toEqual({ sessions: [] })
    expect(stripSecrets(null)).toBeNull()
  })

  it('una copia creada con la clave guardada no contiene la clave en ningún sitio del archivo', async () => {
    await setSetting(db, 'intervalsApiKey', 'CLAVE-SUPER-SECRETA')
    await setSetting(db, 'theme', 'light')
    const text = JSON.stringify(createBackup(await exportAll(db)))
    expect(text).not.toContain('CLAVE-SUPER-SECRETA')
    expect(text).not.toContain('intervalsApiKey')
    expect(text).toContain('light')
    expect(parseBackup(text).data.settings.map((s) => s.key)).toEqual(['theme'])
  })
})

describe('al restaurar una copia se conserva la clave del dispositivo', () => {
  it('replaceAll borra los ajustes, pero readSecrets / restoreSecrets la devuelven', async () => {
    await setSetting(db, 'intervalsApiKey', 'MI-CLAVE')
    const saved = await readSecrets(db)
    expect(saved).toEqual({ intervalsApiKey: 'MI-CLAVE' })
    await replaceAll(db, { settings: [{ key: 'theme', value: 'dark' }] }) // la copia no lleva la clave
    expect(await getSetting(db, 'intervalsApiKey')).toBeNull()
    await restoreSecrets(db, saved)
    expect(await getSetting(db, 'intervalsApiKey')).toBe('MI-CLAVE')
    expect(await getSetting(db, 'theme')).toBe('dark')
  })

  it('sin clave guardada no hay nada que conservar', async () => {
    expect(await readSecrets(db)).toEqual({})
    await restoreSecrets(db, {})
    expect(await getSetting(db, 'intervalsApiKey')).toBeNull()
  })
})
