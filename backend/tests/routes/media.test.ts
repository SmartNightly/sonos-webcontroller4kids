import { vi, describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

vi.mock('../../src/services/media', () => ({
  loadMedia: vi.fn(),
  saveMedia: vi.fn(),
}))

vi.mock('../../src/services/apple-music', () => ({
  fetchAlbumTracks: vi.fn(),
  searchArtist: vi.fn().mockResolvedValue([]),
}))

import { loadMedia, saveMedia } from '../../src/services/media'
import { fetchAlbumTracks, searchArtist } from '../../src/services/apple-music'
import mediaRouter from '../../src/routes/media'

const app = express()
app.use(express.json())
app.use('/media', mediaRouter)

describe('GET /media', () => {
  it('returns list of media items', async () => {
    vi.mocked(loadMedia).mockReturnValue([])
    const res = await request(app).get('/media')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

describe('POST /media', () => {
  beforeEach(() => {
    vi.mocked(loadMedia).mockReturnValue([])
    vi.mocked(saveMedia).mockReturnValue(undefined)
  })

  it('creates a new media item with sonosUri', async () => {
    const payload = {
      id: 'item1',
      title: 'My Item',
      service: 'spotify',
      sonosUri: 'spotify/now/album:xyz',
    }
    const res = await request(app).post('/media').send(payload)
    expect(res.status).toBe(201)
    expect(res.body.id).toBe('item1')
    expect(saveMedia).toHaveBeenCalledOnce()
  })

  it('creates Apple Music item with appleId (no sonosUri needed)', async () => {
    const payload = {
      id: 'apple1',
      title: 'Apple Album',
      service: 'appleMusic',
      appleId: '12345',
    }
    const res = await request(app).post('/media').send(payload)
    expect(res.status).toBe(201)
    expect(res.body.appleId).toBe('12345')
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/media').send({ title: 'Only Title' })
    expect(res.status).toBe(400)
  })

  it('returns 409 when id already exists', async () => {
    vi.mocked(loadMedia).mockReturnValue([
      {
        id: 'existing',
        title: 'Existing',
        kind: 'album',
        service: 'spotify',
        coverUrl: '',
        sonosUri: 'x',
      },
    ])
    const res = await request(app)
      .post('/media')
      .send({ id: 'existing', title: 'X', service: 'spotify', sonosUri: 'x' })
    expect(res.status).toBe(409)
  })
})

describe('DELETE /media/:id', () => {
  it('deletes an existing item', async () => {
    vi.mocked(loadMedia).mockReturnValue([
      {
        id: 'del1',
        title: 'Delete Me',
        kind: 'album',
        service: 'spotify',
        coverUrl: '',
        sonosUri: 'x',
      },
    ])
    vi.mocked(saveMedia).mockReturnValue(undefined)
    const res = await request(app).delete('/media/del1')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'deleted', id: 'del1' })
  })

  it('returns 404 for unknown id', async () => {
    vi.mocked(loadMedia).mockReturnValue([])
    const res = await request(app).delete('/media/unknown')
    expect(res.status).toBe(404)
  })
})

describe('PUT /media/:id', () => {
  it('updates an existing item', async () => {
    vi.mocked(loadMedia).mockReturnValue([
      {
        id: 'upd1',
        title: 'Old Title',
        kind: 'album',
        service: 'spotify',
        coverUrl: '',
        sonosUri: 'x',
      },
    ])
    vi.mocked(saveMedia).mockReturnValue(undefined)
    const res = await request(app).put('/media/upd1').send({ title: 'New Title' })
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('New Title')
  })

  it('persists artistImageUrl when set', async () => {
    vi.mocked(loadMedia).mockReturnValue([
      { id: 'upd2', title: 'Album', kind: 'album', service: 'appleMusic', coverUrl: '' },
    ])
    vi.mocked(saveMedia).mockReturnValue(undefined)
    const res = await request(app)
      .put('/media/upd2')
      .send({ artistImageUrl: 'https://example.com/artist.jpg' })
    expect(res.status).toBe(200)
    expect(res.body.artistImageUrl).toBe('https://example.com/artist.jpg')
  })

  it('clears artistImageUrl when set to empty string', async () => {
    vi.mocked(loadMedia).mockReturnValue([
      {
        id: 'upd3',
        title: 'Album',
        kind: 'album',
        service: 'appleMusic',
        coverUrl: '',
        artistImageUrl: 'https://example.com/old.jpg',
      },
    ])
    vi.mocked(saveMedia).mockReturnValue(undefined)
    const res = await request(app).put('/media/upd3').send({ artistImageUrl: '' })
    expect(res.status).toBe(200)
    expect(res.body.artistImageUrl).toBeUndefined()
  })

  it('returns 404 for unknown id', async () => {
    vi.mocked(loadMedia).mockReturnValue([])
    const res = await request(app).put('/media/unknown').send({ title: 'X' })
    expect(res.status).toBe(404)
  })
})

describe('POST /media/apple/album', () => {
  beforeEach(() => {
    vi.mocked(searchArtist).mockResolvedValue([])
  })

  it('returns 400 when required fields missing', async () => {
    const res = await request(app).post('/media/apple/album').send({ id: 'x' })
    expect(res.status).toBe(400)
  })

  it('creates new album with tracks', async () => {
    vi.mocked(loadMedia).mockReturnValue([])
    vi.mocked(saveMedia).mockReturnValue(undefined)
    vi.mocked(fetchAlbumTracks).mockResolvedValue([
      { id: 't1', title: 'Track 1', appleSongId: '789' },
    ])
    const res = await request(app).post('/media/apple/album').send({
      id: 'new-album',
      appleAlbumId: '555',
      title: 'New Album',
    })
    expect(res.status).toBe(201)
    expect(res.body.trackCount).toBe(1)
  })

  it('reuses artistImageUrl from existing item with same artist', async () => {
    vi.mocked(loadMedia).mockReturnValue([
      {
        id: 'existing',
        title: 'Other Album',
        kind: 'album',
        service: 'appleMusic',
        coverUrl: '',
        artist: 'Globi',
        artistImageUrl: 'https://example.com/globi.jpg',
      },
    ])
    vi.mocked(saveMedia).mockReturnValue(undefined)
    vi.mocked(fetchAlbumTracks).mockResolvedValue([])
    const res = await request(app).post('/media/apple/album').send({
      id: 'new-album',
      appleAlbumId: '999',
      title: 'New Globi Album',
      artist: 'Globi',
    })
    expect(res.status).toBe(201)
    expect(res.body.artistImageUrl).toBe('https://example.com/globi.jpg')
    expect(searchArtist).not.toHaveBeenCalled()
  })

  it('fetches artistImageUrl via searchArtist when no existing image', async () => {
    vi.mocked(loadMedia).mockReturnValue([])
    vi.mocked(saveMedia).mockReturnValue(undefined)
    vi.mocked(fetchAlbumTracks).mockResolvedValue([])
    vi.mocked(searchArtist).mockResolvedValueOnce([
      { artistId: '1', artistName: 'Pingu', artistImageUrl: 'https://example.com/pingu.jpg' },
    ])
    const res = await request(app).post('/media/apple/album').send({
      id: 'pingu-album',
      appleAlbumId: '111',
      title: 'Pingu Album',
      artist: 'Pingu',
    })
    expect(res.status).toBe(201)
    expect(res.body.artistImageUrl).toBe('https://example.com/pingu.jpg')
  })

  it('creates album without artistImageUrl when searchArtist returns empty', async () => {
    vi.mocked(loadMedia).mockReturnValue([])
    vi.mocked(saveMedia).mockReturnValue(undefined)
    vi.mocked(fetchAlbumTracks).mockResolvedValue([])
    // searchArtist defaults to mockResolvedValue([]) from mock setup
    const res = await request(app).post('/media/apple/album').send({
      id: 'unknown-album',
      appleAlbumId: '222',
      title: 'Unknown Artist Album',
      artist: 'Unknown Artist',
    })
    expect(res.status).toBe(201)
    expect(res.body.artistImageUrl).toBeUndefined()
  })
})
