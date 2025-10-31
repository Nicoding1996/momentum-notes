// Simple event bus for cross-component communication
type EventCallback<T = any> = (data: T) => void

interface EventMap {
  'create-wikilink': {
    noteId: string
    searchText: string
    targetNoteId: string
    targetTitle: string
  }
}

class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map()

  on<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.delete(callback)
    }
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => callback(data))
    }
  }
}

export const eventBus = new EventBus()