import type { MediaItem } from '../types'

// Public artwork, fictional room state. Demo mode never calls the backend.
export const demoMedia: MediaItem[] = [
  {
    id: 'demo-globi',
    artist: 'Globi',
    title: 'Globi bei der Feuerwehr',
    kind: 'audiobook',
    service: 'appleMusic',
    coverUrl:
      'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/3d/51/0c/3d510c0d-cea1-1361-feda-92f250c1ecdc/cover.jpg/600x600bb.jpg',
    artistImageUrl:
      'https://is1-ssl.mzstatic.com/image/thumb/AMCArtistImages122/v4/c8/eb/ac/c8ebac71-c0d0-29cd-1150-6ffe63a5b572/604e9361-5bfb-4d9d-bdb1-1e98751cb22e_ami-identity-334f0ea1162e2b1a9358d95ad057d6d2-2024-02-22T16-46-53.556Z_cropped.png/600x600cc.png',
  },
  {
    id: 'demo-kasperli',
    artist: 'Kasperli',
    title: 'De Ris im Zaubergarte',
    kind: 'audiobook',
    service: 'appleMusic',
    coverUrl:
      'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/1c/e1/2a/1ce12a07-6836-8746-d32a-a42af2e33e63/7649995049309_3000.jpg/600x600bb.jpg',
    artistImageUrl:
      'https://is1-ssl.mzstatic.com/image/thumb/AMCArtistImages211/v4/74/52/25/74522505-13b3-4376-71bf-003b702377a6/3d8c4043-59f1-4509-8dea-cae5ef5f5f97_ami-identity-46bf919c3ad9c9e5edbe338e9ec30014-2024-06-21T12-23-17.820Z_cropped.png/600x600cc.png',
  },
  {
    id: 'demo-liedli',
    artist: 'Liedli.ch',
    title: 'Wiehnachtsliedli',
    kind: 'album',
    service: 'appleMusic',
    coverUrl:
      'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e4/90/c8/e490c89b-063f-d2cc-f580-547be1ac56cd/cover.jpg/600x600bb.jpg',
    artistImageUrl:
      'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/74/6d/92/746d92e9-d8d8-4873-d7b8-20656b4740a6/pr_source.png/600x600cc.png',
  },
  {
    id: 'demo-swissmom',
    artist: 'Swissmom',
    title: 'Chinder Musig Wält, Vol. 1',
    kind: 'album',
    service: 'appleMusic',
    coverUrl:
      'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/0e/76/95/0e769572-c2f9-f77b-fdd6-ad346c3d57f8/artwork.jpg/600x600bb.jpg',
  },
]
