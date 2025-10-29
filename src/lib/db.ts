import Dexie, { Table } from 'dexie';
import { nanoid } from 'nanoid';
import type { Note } from '../types/note';
import type { NoteEdge } from '../types/edge';
import type { Tag } from '../types/tag';

class NotesDB extends Dexie {
  notes!: Table<Note, string>;
  edges!: Table<NoteEdge, string>;
  tags!: Table<Tag, string>;

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
      title: 'Welcome to Momentum Notes',
      content: 'This is your first note. Edit me!',
      tags: [],
      createdAt: now,
      updatedAt: now,
    });
  }
}