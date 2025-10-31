import { Node, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Node as PMNode } from '@tiptap/pm/model'

export interface WikilinkOptions {
  HTMLAttributes: Record<string, any>
  onNavigate: (noteId: string) => void
  onTriggerAutocomplete: (query: string, position: number) => void
  validateTarget: (title: string) => Promise<string | null>
}

export const WikilinkExtension = Node.create<WikilinkOptions>({
  name: 'wikilink',
  
  group: 'inline',
  inline: true,
  atom: true, // Cannot split or edit inline
  
  addOptions() {
    return {
      HTMLAttributes: {},
      onNavigate: () => {},
      onTriggerAutocomplete: () => {},
      validateTarget: async () => null,
    }
  },
  
  addAttributes() {
    return {
      targetNoteId: {
        default: null,
      },
      targetTitle: {
        default: '',
      },
      exists: {
        default: true,
      },
    }
  },
  
  parseHTML() {
    return [
      {
        tag: 'span[data-type="wikilink"]',
      },
    ]
  },
  
  renderHTML({ node, HTMLAttributes }) {
    const exists = node.attrs.exists
    return [
      'span',
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        {
          'data-type': 'wikilink',
          'data-note-id': node.attrs.targetNoteId,
          'data-title': node.attrs.targetTitle,
          'class': `wikilink ${exists ? 'wikilink-exists' : 'wikilink-broken'}`,
        }
      ),
      node.attrs.targetTitle,
    ]
  },
  
  addNodeView() {
    const onNavigate = this.options.onNavigate
    
    return ({ node }: { node: PMNode }) => {
      const dom = document.createElement('span')
      dom.className = `wikilink ${node.attrs.exists ? 'wikilink-exists' : 'wikilink-broken'}`
      dom.setAttribute('data-type', 'wikilink')
      dom.setAttribute('data-note-id', node.attrs.targetNoteId || '')
      dom.setAttribute('data-title', node.attrs.targetTitle || '')
      dom.setAttribute('contenteditable', 'false')
      dom.textContent = node.attrs.targetTitle
      dom.style.cursor = 'pointer'
      dom.style.userSelect = 'none'
      
      // Add click handler with mousedown for better responsiveness
      const handleClick = (event: MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        
        const noteId = node.attrs.targetNoteId
        if (noteId) {
          console.log('Wikilink clicked, navigating to:', noteId)
          onNavigate(noteId)
        } else {
          console.log('Wikilink clicked but no noteId found')
        }
      }
      
      dom.addEventListener('click', handleClick)
      dom.addEventListener('mousedown', (e) => {
        e.preventDefault() // Prevent editor from capturing the event
      })
      
      return {
        dom,
        contentDOM: null,
        update: () => false,
        destroy: () => {
          dom.removeEventListener('click', handleClick)
        }
      }
    }
  },
  
  addProseMirrorPlugins() {
    return [
      
      // Plugin for autocomplete triggering
      new Plugin({
        key: new PluginKey('wikilink-autocomplete'),
        state: {
          init: () => ({ active: false, query: '', pos: 0 }),
          apply: (tr, value) => {
            if (!tr.docChanged) return value
            
            const { selection } = tr
            const { $from } = selection
            
            // Get text before cursor
            const textBefore = $from.parent.textBetween(
              Math.max(0, $from.parentOffset - 50),
              $from.parentOffset
            )
            
            // Check if user is typing after @
            const wikilinkPattern = /@([^\s]*?)$/
            const match = textBefore.match(wikilinkPattern)
            
            if (match) {
              const query = match[1]
              const pos = $from.pos
              
              // Trigger autocomplete
              this.options.onTriggerAutocomplete(query, pos)
              
              return { active: true, query, pos }
            }
            
            return { active: false, query: '', pos: 0 }
          },
        },
      }),
    ]
  },
})