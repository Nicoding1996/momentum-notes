import { useState } from 'react';
import { Palette, Check } from 'lucide-react';
import { NOTE_COLORS, type NoteColorId } from '@/types/note';

interface NoteColorPickerProps {
  currentColor: NoteColorId;
  onChange: (color: NoteColorId) => void;
}

export function NoteColorPicker({ currentColor, onChange }: NoteColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleColorSelect = (colorId: NoteColorId) => {
    onChange(colorId);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-150"
        aria-label="Change note color"
        title="Change color"
      >
        <Palette className="w-4 h-4 text-gray-600 dark:text-gray-400" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Color Picker Dropdown */}
          <div
            className="absolute top-full right-0 mt-2 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200/60 dark:border-gray-700/60 p-3 animate-scale-in"
            style={{
              minWidth: '280px',
              boxShadow: '0 -1px 2px 0 rgba(255, 255, 255, 0.2) inset, 0 12px 32px -8px rgba(0, 0, 0, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-1">
              Note Color
            </div>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(NOTE_COLORS).map(([colorId, colorConfig]) => {
                const isSelected = currentColor === colorId;
                const isDefault = colorId === 'default';
                
                return (
                  <button
                    key={colorId}
                    onClick={() => handleColorSelect(colorId as NoteColorId)}
                    className={`
                      relative w-12 h-12 rounded-lg transition-all duration-200
                      ${colorConfig.background}
                      ${isDefault ? 'border-2 border-gray-300 dark:border-gray-600' : `${colorConfig.border} border-2`}
                      hover:scale-110 hover:shadow-lg
                      focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2
                      ${isSelected ? 'ring-2 ring-accent-500 ring-offset-2' : ''}
                    `}
                    title={colorConfig.name}
                    aria-label={`${colorConfig.name} color`}
                  >
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Check className="w-5 h-5 text-gray-900 dark:text-gray-100 drop-shadow-md" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}