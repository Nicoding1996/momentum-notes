export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  x?: number; // Canvas x position
  y?: number; // Canvas y position
  tags?: string[]; // Array of tag IDs
}