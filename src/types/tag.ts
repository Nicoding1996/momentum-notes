export interface Tag {
  id: string;
  name: string;
  color?: string; // Optional color for visual differentiation
  createdAt: string; // ISO date
  usageCount: number; // Track how many notes use this tag
}