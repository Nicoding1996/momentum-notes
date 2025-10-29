export interface NoteEdge {
  id: string;
  source: string; // Source note ID
  target: string; // Target note ID
  createdAt: string; // ISO date
  label?: string; // Optional label for the connection
}