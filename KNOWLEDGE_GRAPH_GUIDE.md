# Knowledge Graph Feature Guide

## 🎯 Overview

The Knowledge Graph feature transforms your note-taking app into a powerful visual knowledge management system with **explicit relationship types** and enhanced visualizations. This allows you to create meaningful, structured connections between notes that go beyond simple links.

## 🌟 Key Features

### 1. **Relationship Types**

Six predefined relationship types help you categorize how your notes relate to each other:

| Type | Color | Description | Use Case |
|------|-------|-------------|----------|
| **Related to** | Blue | General semantic relationship | Linking similar topics or concepts |
| **Depends on** | Red | Source depends on target | Project tasks, prerequisites |
| **Part of** | Green | Source is part of target | Subtopics, components |
| **Supports** | Orange | Source supports target's argument | Evidence, references |
| **Contradicts** | Purple | Source contradicts target | Opposing views, debates |
| **References** | Cyan | Source references target | Citations, links |

### 2. **Visual Differentiation**

Each relationship type is visualized with:
- **Unique colors**: Easy identification at a glance
- **Labels**: Clear text showing the relationship
- **Smooth connections**: Professional graph appearance

### 3. **Intelligent Filtering**

Filter connections by relationship type to:
- Focus on specific types of relationships
- Reduce visual clutter
- Analyze patterns in your knowledge graph

### 4. **AI-Powered Auto-Linking with Tag Intelligence**

Enhanced AI capabilities now:
- Automatically suggest appropriate relationship types
- Analyze semantic meaning to determine relationships
- **Consider note tags as strong signals for relationships**
- Provide reasoning for each suggested connection
- Prioritize content analysis while using tags to confirm connections

## 🎮 How to Use

### Creating Manual Connections

1. **Switch to Canvas View**
2. **Hover over a note** to reveal connection points (blue dots)
3. **Drag from any dot** to another note's dot
4. **Select a relationship type** from the modal that appears:
   - Read the description for each type
   - Choose the most appropriate relationship
   - Click to create the connection

### Using AI Auto-Link

1. **Create multiple notes** with meaningful content and tags
2. **Click "AI Auto-Link Notes"** button
3. **AI analyzes** semantic relationships, relationship types, AND tags
4. **Review connections** - each has an appropriate type assigned
5. **Delete unwanted** connections if needed

**Pro Tip:** Add tags to your notes before using AI Auto-Link for even better results! Notes with shared tags are more likely to be connected with accurate relationship types.

### Filtering Connections

1. **Click the Filter button** (funnel icon) in the toolbar
2. **Select a relationship type** or "All Types"
3. **View filtered graph** showing only selected relationships
4. **Switch filters** anytime to explore different relationship patterns

### Managing Connections

- **Select**: Click on a connection line (turns red)
- **Delete**: Press DELETE key while selected
- **View details**: Hover to see the relationship type label

## 💡 Best Practices

### Do:
✅ **Be intentional** with relationship types - choose accurately
✅ **Use "Related to"** when unsure of the specific relationship
✅ **Filter by type** when working on specific aspects of your knowledge
✅ **Let AI suggest** types for existing connections
✅ **Review AI suggestions** before accepting
✅ **Add tags** to notes before AI auto-linking for better accuracy
✅ **Use consistent tagging** to help the AI understand your categories

### Don't:
❌ **Over-complicate** - not every connection needs a specific type
❌ **Mix types randomly** - maintain semantic consistency
❌ **Forget to filter** - use filters to reduce cognitive load
❌ **Ignore labels** - they provide important context

## 🎨 Visual Examples

### Research Project
```
"Literature Review" --[related-to]--> "Key Paper #1"
"Hypothesis" --[supports]--> "Results"
"Theory A" --[contradicts]--> "Theory B"
"Conclusion" --[depends-on]--> "Data Analysis"
```

### Software Development
```
"API Docs" --[references]--> "Implementation"
"Bug Fix" --[depends-on]--> "Test Case"
"Feature Request" --[part-of]--> "Epic Story"
"Code Review" --[supports]--> "Best Practices"
```

### Personal Learning
```
"Topic Overview" --[part-of]--> "Chapter 1"
"Example A" --[supports]--> "Concept X"
"Method 1" --[contradicts]--> "Method 2"
"Prerequisites" --[depends-on]--> "Advanced Topics"
```

## 🔧 Technical Details

### Database Schema
The [`NoteEdge`](src/types/edge.ts:1) interface now includes:
```typescript
relationshipType?: string // e.g., "related-to", "depends-on"
```

### Relationship Type Constants
Defined in [`RELATIONSHIP_TYPES`](src/types/edge.ts:9) with:
- Unique IDs
- Display labels
- Color codes
- Descriptions

### AI Integration
The AI auto-link feature now:
- Receives relationship type options in the prompt
- Analyzes semantic meaning to suggest appropriate types
- **Incorporates note tags as high-confidence signals**
- Prioritizes content but uses tags to confirm relationships
- Returns structured JSON with `relationshipType` field

**How Tags Improve AI Accuracy:**
- Notes sharing tags are prioritized for connection
- Tags help disambiguate similar content (e.g., "Jaguar" with #animal vs #car)
- Tag overlap increases confidence in suggested relationships
- Tags guide the AI to think more like the user's mental model

## 🚀 Advanced Usage

### Pattern Recognition
Use filters to identify patterns:
1. Filter by "depends-on" to see dependency chains
2. Filter by "contradicts" to spot conflicting information
3. Filter by "part-of" to understand hierarchies

### Knowledge Validation
Review your graph structure:
- Too many "related-to"? Consider more specific types
- Circular "depends-on"? Might indicate logical issues
- Isolated "contradicts"? Explore those conflicts

### Collaborative Knowledge
When sharing notes:
- Relationship types provide context without explanation
- Colors make presentations more impactful
- Filters let others explore specific aspects

## 🔮 Future Enhancements

Potential improvements for later versions:
- **Custom relationship types**: Define your own types with custom colors
- **Bi-directional relationships**: A → B and B → A with different types
- **Relationship strength**: Visual weight based on importance
- **Graph analytics**: Statistics on relationship type usage
- **Export as diagram**: Generate images of your knowledge graph
- **Collaborative types**: Share custom types with team

## 📊 Performance

- **Database indexed** on `relationshipType` for fast filtering
- **Color-coded rendering** is instant
- **Filter updates** are real-time with no lag
- **AI type suggestions** add minimal overhead (~1-2s extra)

## 🐛 Troubleshooting

### Issue: Relationship type not showing
- **Solution**: Refresh the page, database might need sync

### Issue: Can't select relationship type
- **Solution**: Ensure connection modal appears; try creating connection again

### Issue: AI suggesting wrong types
- **Solution**: Review AI suggestions; delete and manually recreate with correct type

### Issue: Filter not working
- **Solution**: Check if edges exist with that type; try "All Types" first

---

## 📚 Related Documentation

- [`NOTE_CONNECTIONS_GUIDE.md`](NOTE_CONNECTIONS_GUIDE.md) - Original connections feature
- [`KNOWLEDGE_GRAPH_PLAN.md`](KNOWLEDGE_GRAPH_PLAN.md) - Implementation plan
- [`src/types/edge.ts`](src/types/edge.ts) - Type definitions
- [`src/components/CanvasView.tsx`](src/components/CanvasView.tsx) - Implementation

---

Built with ❤️ to enhance your knowledge management workflow