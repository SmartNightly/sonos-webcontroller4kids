// Serialize read/modify/write commands per room, without blocking other rooms.
const pending = new Map<string, Promise<unknown>>()

export async function withRoomQueue<T>(room: string, operation: () => Promise<T>): Promise<T> {
  const previous = pending.get(room) ?? Promise.resolve()
  const current = previous.catch(() => undefined).then(operation)
  pending.set(room, current)
  try {
    return await current
  } finally {
    if (pending.get(room) === current) pending.delete(room)
  }
}
