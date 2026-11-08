import { describe, expect, it } from 'vitest'
import { parseYoutubeId, youtubeEmbedUrl, youtubeWatchUrl } from './youtube.js'

describe('parseYoutubeId', () => {
  const ID = 'XANUniwN1Jg'

  it('entiende los formatos habituales de enlace', () => {
    expect(parseYoutubeId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID)
    expect(parseYoutubeId(`https://youtube.com/watch?v=${ID}&t=30s`)).toBe(ID)
    expect(parseYoutubeId(`https://m.youtube.com/watch?feature=share&v=${ID}`)).toBe(ID)
    expect(parseYoutubeId(`https://youtu.be/${ID}?si=abc`)).toBe(ID)
    expect(parseYoutubeId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID)
    expect(parseYoutubeId(`https://www.youtube.com/embed/${ID}`)).toBe(ID)
    expect(parseYoutubeId(`https://www.youtube-nocookie.com/embed/${ID}?rel=0`)).toBe(ID)
  })

  it('admite el enlace sin https y con espacios alrededor', () => {
    expect(parseYoutubeId(`  youtu.be/${ID}  `)).toBe(ID)
    expect(parseYoutubeId(`www.youtube.com/watch?v=${ID}`)).toBe(ID)
  })

  it('admite el identificador suelto', () => {
    expect(parseYoutubeId(ID)).toBe(ID)
  })

  it('rechaza lo que no es de YouTube o está incompleto', () => {
    expect(parseYoutubeId('')).toBeNull()
    expect(parseYoutubeId('   ')).toBeNull()
    expect(parseYoutubeId(null)).toBeNull()
    expect(parseYoutubeId(undefined)).toBeNull()
    expect(parseYoutubeId('hola')).toBeNull()
    expect(parseYoutubeId('https://vimeo.com/123456789')).toBeNull()
    expect(parseYoutubeId('https://www.youtube.com/watch?v=corto')).toBeNull()
    expect(parseYoutubeId('https://www.youtube.com/')).toBeNull()
    expect(parseYoutubeId('https://example.com/watch?v=XANUniwN1Jg')).toBeNull()
  })
})

describe('direcciones', () => {
  it('construye la dirección para incrustar y la normal', () => {
    expect(youtubeEmbedUrl('XANUniwN1Jg')).toBe('https://www.youtube-nocookie.com/embed/XANUniwN1Jg?rel=0')
    expect(youtubeWatchUrl('XANUniwN1Jg')).toBe('https://www.youtube.com/watch?v=XANUniwN1Jg')
  })
})
