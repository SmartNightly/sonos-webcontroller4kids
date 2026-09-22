import './AlbumTileTitle.css'

export function AlbumTileTitle({ title }: { title: string }) {
  // Only the visual presentation is clipped; the accessible name stays complete.
  return (
    <span className="album-tile-title" title={title}>
      {title}
    </span>
  )
}
