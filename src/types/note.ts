export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  x?: number; // Canvas x position
  y?: number; // Canvas y position
  width?: number; // Canvas width (for resizing)
  height?: number; // Canvas height (for resizing)
  tags?: string[]; // Array of tag IDs
  color?: NoteColorId; // Note color theme (defaults to 'default')
}

// Note color system - predefined palette
export const NOTE_COLORS = {
  default: {
    id: 'default' as const,
    name: 'Default',
    background: 'bg-white dark:bg-gray-900',
    border: 'border-gray-200/80 dark:border-gray-700/80',
    hover: 'hover:border-gray-300 dark:hover:border-gray-600',
    lightBg: '#ffffff',
    darkBg: '#18181b',
  },
  gray: {
    id: 'gray' as const,
    name: 'Gray',
    background: 'bg-gray-50 dark:bg-gray-800',
    border: 'border-gray-300 dark:border-gray-600',
    hover: 'hover:border-gray-400 dark:hover:border-gray-500',
    lightBg: '#f9fafb',
    darkBg: '#1f2937',
  },
  brown: {
    id: 'brown' as const,
    name: 'Brown',
    background: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    hover: 'hover:border-amber-300 dark:hover:border-amber-700',
    lightBg: '#fffbeb',
    darkBg: '#451a03',
  },
  orange: {
    id: 'orange' as const,
    name: 'Orange',
    background: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-800',
    hover: 'hover:border-orange-300 dark:hover:border-orange-700',
    lightBg: '#fff7ed',
    darkBg: '#431407',
  },
  yellow: {
    id: 'yellow' as const,
    name: 'Yellow',
    background: 'bg-yellow-50 dark:bg-yellow-950/30',
    border: 'border-yellow-200 dark:border-yellow-800',
    hover: 'hover:border-yellow-300 dark:hover:border-yellow-700',
    lightBg: '#fefce8',
    darkBg: '#422006',
  },
  green: {
    id: 'green' as const,
    name: 'Green',
    background: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800',
    hover: 'hover:border-emerald-300 dark:hover:border-emerald-700',
    lightBg: '#ecfdf5',
    darkBg: '#022c22',
  },
  blue: {
    id: 'blue' as const,
    name: 'Blue',
    background: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    hover: 'hover:border-blue-300 dark:hover:border-blue-700',
    lightBg: '#eff6ff',
    darkBg: '#172554',
  },
  purple: {
    id: 'purple' as const,
    name: 'Purple',
    background: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-800',
    hover: 'hover:border-purple-300 dark:hover:border-purple-700',
    lightBg: '#faf5ff',
    darkBg: '#2e1065',
  },
  pink: {
    id: 'pink' as const,
    name: 'Pink',
    background: 'bg-pink-50 dark:bg-pink-950/30',
    border: 'border-pink-200 dark:border-pink-800',
    hover: 'hover:border-pink-300 dark:hover:border-pink-700',
    lightBg: '#fdf2f8',
    darkBg: '#500724',
  },
  red: {
    id: 'red' as const,
    name: 'Red',
    background: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    hover: 'hover:border-red-300 dark:hover:border-red-700',
    lightBg: '#fef2f2',
    darkBg: '#450a0a',
  },
} as const;

export type NoteColorId = keyof typeof NOTE_COLORS;