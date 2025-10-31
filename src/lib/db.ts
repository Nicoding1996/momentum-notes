import Dexie, { Table } from 'dexie';
import { nanoid } from 'nanoid';
import type { Note } from '../types/note';
import type { NoteEdge } from '../types/edge';
import type { Tag } from '../types/tag';
import type { WikiLink } from '../types/wikilink';

class NotesDB extends Dexie {
  notes!: Table<Note, string>;
  edges!: Table<NoteEdge, string>;
  tags!: Table<Tag, string>;
  wikilinks!: Table<WikiLink, string>;

  constructor() {
    super('momentum_notes_db');
    this.version(1).stores({
      notes: 'id, updatedAt, createdAt', // indexes
    });
    this.version(2).stores({
      notes: 'id, updatedAt, createdAt',
      edges: 'id, source, target, createdAt', // indexes
    });
    this.version(3).stores({
      notes: 'id, updatedAt, createdAt, *tags', // *tags creates multi-entry index for array
      edges: 'id, source, target, createdAt',
      tags: 'id, name, usageCount', // indexes for tag lookups
    });
    this.version(4).stores({
      notes: 'id, updatedAt, createdAt, *tags',
      edges: 'id, source, target, createdAt, relationshipType', // added relationshipType index
      tags: 'id, name, usageCount',
    });
    this.version(5).stores({
      notes: 'id, updatedAt, createdAt, *tags',
      edges: 'id, source, target, createdAt, relationshipType',
      tags: 'id, name, usageCount',
      wikilinks: 'id, sourceNoteId, targetNoteId, targetTitle, [sourceNoteId+targetTitle]', // compound index for fast lookups
    });
    // Version 6: Add color field to notes (no schema change needed, just migration)
    this.version(6).stores({
      notes: 'id, updatedAt, createdAt, *tags',
      edges: 'id, source, target, createdAt, relationshipType',
      tags: 'id, name, usageCount',
      wikilinks: 'id, sourceNoteId, targetNoteId, targetTitle, [sourceNoteId+targetTitle]',
    }).upgrade(async (trans) => {
      // Add default color to existing notes that don't have one
      const notes = await trans.table('notes').toArray();
      await Promise.all(
        notes.map(note => {
          if (!note.color) {
            return trans.table('notes').update(note.id, { color: 'default' });
          }
          return Promise.resolve();
        })
      );
    });
  }
}

export const db = new NotesDB();

// Seed helper for development (optional)
export async function seedIfEmpty() {
  const count = await db.notes.count();
  if (count === 0) {
    const id = nanoid();
    const now = new Date().toISOString();
    await db.notes.add({
      id,
      title: 'Welcome to Synapse Notes',
      content: 'This is your first note. Edit me!',
      createdAt: now,
      updatedAt: now,
    });
  }
}