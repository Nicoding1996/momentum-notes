# Export/Import Feature - Architectural Plan

## 📋 Overview

This document outlines the design and implementation plan for the Export/Import feature in Synapse Notes. While not the most "wow" feature for a hackathon demo, it's essential for data portability and user trust.

## 🎯 Goals

1. **Data Portability**: Users can export all their data (notes, connections, tags)
2. **Backup & Recovery**: Enable users to backup and restore their data
3. **Migration**: Allow users to move data between devices
4. **Trust**: Demonstrate commitment to data ownership (no lock-in)

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
- **Version field**: For future format compatibility
- **Metadata**: Quick overview without parsing full data
- **Flat structure**: Easy to validate and process
- **Standard JSON**: Universal format, readable, debuggable

## 🏗️ Architecture

### File Structure

```
src/
├── lib/
│   ├── db.ts (existing)
│   └── export-import.ts (NEW)
├── components/
│   ├── SettingsModal.tsx (NEW)
│   ├── ExportPanel.tsx (NEW - optional separate component)
│   └── ImportPanel.tsx (NEW - optional separate component)
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
 * @returns Promise<ExportData>
 */
async function exportAllData(): Promise<ExportData>

/**
 * Create and download JSON file
 * @param data - Export data object
 * @param filename - Optional custom filename
 */
function downloadAsJSON(data: ExportData, filename?: string): void

/**
 * Validate export data structure
 * @param data - Data to validate
 * @returns boolean indicating validity
 */
function validateExportData(data: unknown): data is ExportData
```

### 2. Import Utility

```typescript
/**
 * Parse and validate imported JSON file
 * @param file - File object from input
 * @returns Promise<ExportData>
 */
async function parseImportFile(file: File): Promise<ExportData>

/**
 * Import data with merge strategy
 * @param data - Validated export data
 * @param mode - 'merge' or 'replace'
 */
async function importData(
  data: ExportData, 
  mode: 'merge' | 'replace'
): Promise<ImportResult>

/**
 * Preview import without committing
 * @param data - Export data to preview
 * @returns Statistics about what would be imported
 */
function previewImport(data: ExportData): ImportPreview
```

### 3. Settings Modal Component

**Features:**
- Tabbed interface (General, Data Management, About)
- Export section with statistics
- Import section with drag-and-drop file picker
- Clear all data option (with confirmation)
- App information and version

**UI Structure:**
```tsx
<SettingsModal>
  <Tabs>
    <Tab label="General">
      {/* Theme, language preferences */}
    </Tab>
    
    <Tab label="Data">
      <ExportSection>
        <Statistics />
        <ExportButton />
      </ExportSection>
      
      <ImportSection>
        <FilePicker />
        {importData && (
          <>
            <ImportPreview data={importData} />
            <ModeSelector mode={mode} onChange={setMode} />
            <ConfirmButton />
          </>
        )}
      </ImportSection>
      
      <DangerZone>
        <ClearDataButton />
      </DangerZone>
    </Tab>
    
    <Tab label="About">
      {/* Version, credits, links */}
    </Tab>
  </Tabs>
</SettingsModal>
```

## 🎨 User Experience Flow

### Export Flow
1. User clicks Settings button in header
2. Settings modal opens to "Data" tab
3. User sees current data statistics (X notes, Y connections, Z tags)
4. User clicks "Export All Data"
5. JSON file downloads with filename: `synapse-notes-backup-YYYY-MM-DD.json`
6. Success message shows: "✓ Data exported successfully"

### Import Flow
1. User clicks Settings button
2. Navigates to "Data" tab
3. Clicks "Import Data" or drags file into drop zone
4. File is validated:
   - ✓ Valid: Show preview with statistics
   - ✗ Invalid: Show error message with details
5. User chooses import mode:
   - **Merge**: Add imported data to existing (skip duplicates by ID)
   - **Replace**: Clear existing data, then import (requires confirmation)
6. User clicks "Confirm Import"
7. Progress indicator shows during import
8. Success/failure message displays
9. Modal closes, UI updates with new data

## ⚠️ Error Handling

### Validation Errors
- **Invalid JSON**: "File is not valid JSON"
- **Missing required fields**: "Import file is missing required data: {fields}"
- **Wrong format version**: "Unsupported format version. Please export from a newer version."
- **Corrupted data**: "Data validation failed: {specific error}"

### Import Errors
- **Database errors**: "Failed to save data: {error}. Your existing data is safe."
- **Partial failure**: "Imported X of Y items. Failed: {list}"
- **Permission errors**: "Cannot access file. Please check permissions."

### Export Errors
- **Database read error**: "Failed to read data: {error}"
- **Browser limitation**: "Export failed. Your browser may not support downloads."

## 🔒 Data Integrity

### Import Strategies

**Merge Mode:**
- Use ID as unique key
- Skip items that already exist (by ID)
- Add new items
- Update `usageCount` for tags (recalculate)
- Preserve existing canvas positions if not in import

**Replace Mode:**
- Clear all three tables
- Import all data fresh
- Validate foreign key relationships (edge source/target must exist)
- Recalculate tag usage counts

### Validation Rules
1. All IDs must be non-empty strings
2. All dates must be valid ISO strings
3. Edge source/target must reference existing notes
4. Tag IDs in notes must reference existing tags
5. Position values (x, y) must be numbers if present

## 🚀 Implementation Phases

### Phase 1: Core Export (Priority: High)
- [ ] Create `src/types/export.ts` with TypeScript types
- [ ] Implement `exportAllData()` function
- [ ] Implement `downloadAsJSON()` function
- [ ] Add basic SettingsModal with Export button
- [ ] Wire up Settings button in App.tsx
- [ ] Test export with real data

### Phase 2: Core Import (Priority: High)
- [ ] Implement `parseImportFile()` function
- [ ] Implement `validateExportData()` function
- [ ] Add file picker to SettingsModal
- [ ] Implement merge-only import (safer for MVP)
- [ ] Add basic error messages
- [ ] Test import with exported file

### Phase 3: Enhanced UX (Priority: Medium)
- [ ] Add data statistics display
- [ ] Add import preview UI
- [ ] Implement replace mode (with confirmation)
- [ ] Add drag-and-drop for import
- [ ] Add progress indicators
- [ ] Polish error messages

### Phase 4: Polish (Priority: Low)
- [ ] Add "Clear All Data" feature
- [ ] Add multiple export formats (CSV for notes?)
- [ ] Add selective export (export selected notes only)
- [ ] Add import history/undo
- [ ] Add automated backup reminders

## 📱 Responsive Design Considerations

- Modal should be full-screen on mobile
- File picker should work with mobile file system
- Progress indicators must be visible on small screens
- Error messages should be readable without scrolling

## 🧪 Testing Strategy

### Manual Tests
1. Export empty database
2. Export with 1 note, no connections, no tags
3. Export with full dataset (notes + edges + tags)
4. Import into empty database
5. Import into existing database (merge)
6. Import into existing database (replace)
7. Import invalid JSON
8. Import JSON with missing fields
9. Import JSON with invalid IDs
10. Cancel import mid-process

### Edge Cases
- Very large exports (1000+ notes)
- Notes with special characters in content
- Circular edge references
- Orphaned edges (source/target doesn't exist)
- Tags with zero usage count
- Notes with invalid canvas positions

## 🎯 Success Metrics

### Functional Requirements
- ✓ User can export all data as JSON
- ✓ User can import previously exported data
- ✓ Import preserves all data relationships
- ✓ Export file is readable and valid JSON
- ✓ Errors are caught and reported clearly

### Non-Functional Requirements
- Export completes in <2 seconds for 100 notes
- Import completes in <5 seconds for 100 notes
- File size is reasonable (<1MB for 100 notes)
- UI remains responsive during operations
- No data loss during export/import cycle

## 📝 Documentation Needs

1. Add section to README.md about data export/import
2. Create user guide with screenshots
3. Document export format for developers
4. Add migration guide for format version changes

## 🔮 Future Enhancements

- Export to other formats (Markdown, CSV, PDF)
- Scheduled automatic backups
- Cloud backup integration (optional)
- Import from other note apps (Notion, Evernote, etc.)
- Incremental export/import (only changes)
- Encryption for export files
- Selective export (by tag, date range, etc.)

---

## ✅ Implementation Checklist

Use this checklist when implementing:

- [ ] Create type definitions
- [ ] Implement export functions
- [ ] Implement import functions with validation
- [ ] Create SettingsModal component
- [ ] Add export UI with statistics
- [ ] Add import UI with preview
- [ ] Wire up settings button
- [ ] Add error handling
- [ ] Add loading states
- [ ] Test with various data scenarios
- [ ] Update README documentation
- [ ] Create user guide