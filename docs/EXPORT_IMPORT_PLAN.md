# Export/Import Feature - Architectural Summary

## 📋 Overview

This document summarizes the design and implementation of the Export/Import feature in Synapse Notes. This feature is essential for data portability and user trust.

## 🎯 Goals

1. **Data Portability**: Users can export all their data (notes, connections, tags).
2. **Backup & Recovery**: Enable users to backup and restore their data.
3. **Migration**: Allow users to move data between devices.
4. **Trust**: Demonstrate commitment to data ownership (no lock-in).

## 📊 Data Format Specification

### Export Format (JSON)

```json
{
  "version": "1.0.0",
  "exported_at": "2024-10-29T20:30:00.000Z",
  "app": "synapse-notes",
  "data": {
    "notes": [
      {
        "id": "abc123",
        "title": "My Note",
        "content": "Note content",
        "createdAt": "2024-10-29T10:00:00.000Z",
        "updatedAt": "2024-10-29T12:00:00.000Z",
        "x": 100,
        "y": 200,
        "tags": ["tag1", "tag2"]
      }
    ],
    "edges": [
      {
        "id": "edge1",
        "source": "abc123",
        "target": "def456",
        "createdAt": "2024-10-29T11:00:00.000Z",
        "label": "related to"
      }
    ],
    "tags": [
      {
        "id": "tag1",
        "name": "important",
        "color": "#ff0000",
        "createdAt": "2024-10-29T09:00:00.000Z",
        "usageCount": 5
      }
    ]
  },
  "metadata": {
    "note_count": 1,
    "edge_count": 1,
    "tag_count": 1
  }
}
```

### Design Rationale
- **Version field**: For future format compatibility.
- **Metadata**: Quick overview without parsing full data.
- **Flat structure**: Easy to validate and process.
- **Standard JSON**: Universal format, readable, debuggable.

## 🏗️ Architecture

### File Structure

```
src/
├── lib/
│   ├── db.ts (existing)
│   └── export-import.ts (NEW)
├── components/
│   ├── SettingsModal.tsx (NEW)
└── types/
    └── export.ts (NEW - type definitions)
```

### Component Architecture

```
App.tsx
  └── SettingsModal
       ├── ExportPanel
       │   ├── Export statistics display
       │   ├── Export button
       │   └── Download trigger
       └── ImportPanel
           ├── File picker
           ├── Data preview
           ├── Import mode selector (merge/replace)
           └── Import confirmation
```

## 🔧 Implementation Details

### 1. Export Utility (`src/lib/export-import.ts`)

```typescript
/**
 * Export all data from IndexedDB
 */
async function exportAllData(): Promise<ExportData>

/**
 * Create and download JSON file
 */
function downloadAsJSON(data: ExportData, filename?: string): void

/**
 * Validate export data structure
 */
function validateExportData(data: unknown): data is ExportData
```

### 2. Import Utility

```typescript
/**
 * Parse and validate imported JSON file
 */
async function parseImportFile(file: File): Promise<ExportData>

/**
 * Import data with merge strategy
 */
async function importData(
  data: ExportData,
  mode: 'merge' | 'replace'
): Promise<ImportResult>

/**
 * Preview import without committing
 */
function previewImport(data: ExportData): ImportPreview
```

### 3. Settings Modal Component

**Features:**
- Tabbed interface (Data Management, About)
- Export section with statistics
- Import section with file picker
- Clear all data option (with confirmation)
- App information and version

## 🎨 User Experience Flow

### Export Flow
1. User clicks Settings button in header.
2. Settings modal opens to "Data Management" tab.
3. User sees current data statistics.
4. User clicks "Export All Data".
5. JSON file downloads with filename: `synapse-notes-backup-YYYY-MM-DD.json`.
6. Success message is shown.

### Import Flow
1. User clicks Settings button.
2. Navigates to "Data Management" tab.
3. Clicks "Select File" or drags file into drop zone.
4. File is validated and a preview is shown.
5. User chooses import mode (Merge or Replace).
6. User clicks "Confirm Import".
7. Progress indicator is shown during import.
8. Success/failure message is displayed.
9. Modal closes, UI updates with new data.

## ⚠️ Error Handling

- Invalid JSON
- Missing required fields
- Wrong format version
- Corrupted data
- Database errors
- Permission errors
- Browser limitations

## 🔒 Data Integrity

### Import Strategies

**Merge Mode:**
- Skips items that already exist (by ID).
- Adds new items.
- Recalculates `usageCount` for tags.

**Replace Mode:**
- Clears all tables.
- Imports all data fresh.
- Validates foreign key relationships.

### Validation Rules
- All IDs must be non-empty strings.
- All dates must be valid ISO strings.
- Edge source/target must reference existing notes.
- Tag IDs in notes must reference existing tags.

## 🚀 Implementation Summary

All core features for export and import were implemented, including:
- [x] Core Export functionality.
- [x] Core Import functionality with Merge and Replace modes.
- [x] Enhanced UX with data statistics, import preview, and progress indicators.
- [x] "Clear All Data" feature.

## 📱 Responsive Design Considerations

- Modal is full-screen on mobile.
- File picker works with mobile file system.
- Progress indicators are visible on small screens.
- Error messages are readable without scrolling.

## 🧪 Testing Strategy

Manual tests were conducted for various scenarios, including:
- Exporting and importing empty and populated databases.
- Merge and Replace import modes.
- Importing invalid or corrupted files.
- Edge cases like large exports and special characters.

## 🎯 Success Metrics

### Functional Requirements
- ✓ User can export all data as JSON.
- ✓ User can import previously exported data.
- ✓ Import preserves all data relationships.
- ✓ Export file is readable and valid JSON.
- ✓ Errors are caught and reported clearly.

### Non-Functional Requirements
- Export completes in <2 seconds for 100 notes.
- Import completes in <5 seconds for 100 notes.
- File size is reasonable (<1MB for 100 notes).
- UI remains responsive during operations.
- No data loss during export/import cycle.

## 📝 Documentation

- A section was added to the `README.md` about data export/import.
- A user guide with screenshots was created.
- The export format is documented for developers.

## 🔮 Future Enhancements

- Export to other formats (Markdown, CSV, PDF).
- Scheduled automatic backups.
- Cloud backup integration (optional).
- Import from other note apps (Notion, Evernote, etc.).
- Incremental export/import (only changes).
- Encryption for export files.
- Selective export (by tag, date range, etc.).