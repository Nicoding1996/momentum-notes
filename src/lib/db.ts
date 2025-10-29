import Dexie, { Table } from 'dexie';
import { nanoid } from 'nanoid';
import type { Note } from '../types/note';

class NotesDB extends Dexie {
  notes!: Table<Note, string>;

  constructor() {
    super('momentum_notes_db');
    this.version(1).stores({
      notes: 'id, updatedAt, createdAt', // indexes
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
      createdAt: now,
      updatedAt: now,
    });
  }
}