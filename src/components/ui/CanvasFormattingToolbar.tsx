import { Bold, Italic, Underline, Strikethrough, Heading1, Heading2, Heading3, List, ListOrdered, Check } from 'lucide-react';

interface CanvasFormattingToolbarProps {
  onFormat: (format: FormatType) => void;
  onDone: () => void;
}

export type FormatType = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'h1' | 'h2' | 'h3' | 'bullet' | 'numbered';

export function CanvasFormattingToolbar({ onFormat, onDone }: CanvasFormattingToolbarProps) {
  const formatButtons = [
    { icon: Bold, type: 'bold' as FormatType, label: 'Bold (⌘B)', shortcut: '**text**' },
    { icon: Italic, type: 'italic' as FormatType, label: 'Italic (⌘I)', shortcut: '*text*' },
    { icon: Underline, type: 'underline' as FormatType, label: 'Underline (⌘U)', shortcut: '__text__' },
    { icon: Strikethrough, type: 'strikethrough' as FormatType, label: 'Strikethrough', shortcut: '~~text~~' },
  ];

  const headingButtons = [
    { icon: Heading1, type: 'h1' as FormatType, label: 'Heading 1', shortcut: '# ' },
    { icon: Heading2, type: 'h2' as FormatType, label: 'Heading 2', shortcut: '## ' },
    { icon: Heading3, type: 'h3' as FormatType, label: 'Heading 3', shortcut: '### ' },
  ];

  const listButtons = [
    { icon: List, type: 'bullet' as FormatType, label: 'Bullet List', shortcut: '• ' },
    { icon: ListOrdered, type: 'numbered' as FormatType, label: 'Numbered List', shortcut: '1. ' },
  ];

  return (
    <div
      className="flex items-center gap-1 px-3 py-2 mb-3 bg-white/98 dark:bg-gray-800/98 border border-gray-200/80 dark:border-gray-700/80 rounded-xl shadow-lg backdrop-blur-xl animate-slide-down"
      style={{
        boxShadow: '0 -1px 1px 0 rgba(255, 255, 255, 0.1) inset, 0 2px 12px rgba(0, 0, 0, 0.08)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Text Formatting */}
      <div className="flex items-center gap-0.5">
        {formatButtons.map((btn) => (
          <button
            key={btn.type}
            onClick={() => onFormat(btn.type)}
            className="toolbar-button"
            title={btn.label}
            aria-label={btn.label}
          >
            <btn.icon className="w-4 h-4" />
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

      {/* Headings */}
      <div className="flex items-center gap-0.5">
        {headingButtons.map((btn) => (
          <button
            key={btn.type}
            onClick={() => onFormat(btn.type)}
            className="toolbar-button"
            title={btn.label}
            aria-label={btn.label}
          >
            <btn.icon className="w-4 h-4" />
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

      {/* Lists */}
      <div className="flex items-center gap-0.5">
        {listButtons.map((btn) => (
          <button
            key={btn.type}
            onClick={() => onFormat(btn.type)}
            className="toolbar-button"
            title={btn.label}
            aria-label={btn.label}
          >
            <btn.icon className="w-4 h-4" />
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

      {/* Done Button */}
      <button
        onClick={onDone}
        className="toolbar-button-primary"
        title="Done editing (Esc)"
        aria-label="Done editing"
      >
        <Check className="w-4 h-4" />
      </button>
    </div>
  );
}