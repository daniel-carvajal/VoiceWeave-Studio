# Kokoro Studio: Complete Project Management & Python Integration Action Plan

## 🎯 **Current Status**
- ✅ TypeScript errors fixed in frontend
- ✅ Step-by-step UI components built
- ✅ Python dubbing pipeline exists at `python/dubbing_pipeline.py`
- 🔄 **NEXT**: Integrate project management + Python backend

## 🏗️ **Project Management Decisions Made**

### **File Organization Strategy**
- **Approach**: Hybrid (like Ableton/Premiere) - Link by default, copy on demand
- **Default Location**: `~/Documents/KokoroStudio/`
- **Project Structure**:
```
📁 ~/Documents/KokoroStudio/
  📁 [VideoTitle] [VideoID] [TargetLang]/
    📄 project.json (settings, progress, file references)
    📁 input/ (copied files when needed)
    📁 transcripts/ (segments.json, whisperx output)
    📁 audio/ (kokoro chunks, final dubbed audio)
    📁 output/ (final video)
```

### **Project Naming Convention**
- **Format**: `[Title] [VideoID] [TargetLang]`
- **Examples**: 
  - `"How AI Works [dQw4w9WgXcQ] [ES]"`
  - `"Custom Audio [local_001] [DE]"`
- **Clash Handling**: Auto-increment with (2), (3), etc.

### **File Linking vs Copying**
- **Default**: Link to original files (fast, saves space)
- **UI Display**: `Input: 🔗 MyVideo.mp4 (linked to .../Downloads/) [📥 Copy to Project]`
- **Auto-copy triggers**: Export, Share, Manual button click
- **After copy**: `Input: ✅ MyVideo.mp4 (in project) [📤 Reveal in Folder]`

### **Onboarding Flow**
```
🎬 Welcome to Kokoro Studio

Where should we save your projects?
[📁 ~/Documents/KokoroStudio] [Browse...]

Cleanup intermediate files when dubbing completes?
○ Keep everything  ● Auto-cleanup  ○ Ask each time

[✅ Start Dubbing]
```

### **Recent Projects**
- Show 5 most recent on startup
- Include creation date in metadata (not folder name)

## 🔧 **Implementation Tasks**

### **1. Project Management System**
**Create new files:**
- `src/types/ProjectTypes.ts` - Type definitions
- `src/services/ProjectService.ts` - Project CRUD operations
- `src/hooks/useProject.ts` - React hook for project state
- `src/components/ProjectManager.tsx` - Recent projects, onboarding

**Key interfaces:**
```typescript
interface ProjectConfig {
  id: string;
  name: string;
  created: string;
  lastModified: string;
  sourceType: 'youtube' | 'video' | 'audio';
  sourceUrl?: string;
  videoId?: string;
  targetLanguage: string;
  completedSteps: { download: boolean; transcribe: boolean; etc... };
  fileReferences: { videoFile: string; isLinked: boolean; etc... };
  settings: { transcription: {}; translation: {}; audio: {} };
}
```

### **2. Wails Backend Integration**
**Add to `app.go`:**
- `CreateProject(config ProjectConfig) error`
- `LoadProject(projectId string) ProjectConfig`
- `GetRecentProjects() []ProjectConfig`
- `RunPipelineStep(projectId, step string, params any) error`
- `CopyLinkedFilesToProject(projectId string) error`

### **3. Python Pipeline Integration**
**Modify existing `RunDubbingPipeline` to:**
- Accept project ID instead of raw config
- Load project settings from JSON
- Update project progress after each step
- Save intermediate results to project folders

**Create step-by-step functions:**
- `RunDownloadStep(projectId, url, inputType)`
- `RunTranscribeStep(projectId, settings)`
- `RunTranslateStep(projectId, settings)`
- `RunSynthesizeStep(projectId, settings)`
- `RunFinalAssemblyStep(projectId, settings)`

### **4. Frontend Updates**
**Update `App.tsx`:**
- Add project selection/creation flow
- Show current project in navigation
- Handle onboarding on first run

**Update `DubbingPipeline.tsx`:**
- Replace direct pipeline calls with step-by-step project calls
- Show project file status (linked/copied)
- Add "Copy to Project" buttons
- Update progress tracking

**Update `AudioSegmentPreviewer.tsx`:**
- Load segments from current project
- Show project-relative paths

### **5. Settings & Preferences**
**Create `src/services/SettingsService.ts`:**
- Store default project location
- Cleanup preferences
- Recent projects list

## 🚀 **Implementation Order**

1. **Project Types & Backend** (1-2 hours)
   - Define TypeScript interfaces
   - Add Wails backend functions
   - Test project CRUD operations

2. **Python Integration** (2-3 hours)
   - Modify `dubbing_pipeline.py` to work with projects
   - Create step-by-step execution functions
   - Test individual steps

3. **Frontend Project Management** (2-3 hours)
   - Build onboarding component
   - Add recent projects view
   - Update navigation with current project

4. **Step-by-Step UI Integration** (2-3 hours)
   - Connect existing DubbingPipeline to new project system
   - Add file linking/copying UI
   - Update progress tracking

5. **Polish & Testing** (1-2 hours)
   - Error handling
   - File path edge cases
   - Cross-platform testing

## 🎯 **Key Features to Implement**
- ✅ Project auto-save (like Ableton)
- ✅ File linking with smart paths display
- ✅ Step-by-step pipeline with project persistence
- ✅ Onboarding for new users
- ✅ Recent projects dashboard
- ✅ Auto-cleanup options
- ✅ Export/sharing with auto-collection

**Total Estimated Time**: 8-13 hours
**Priority**: Start with Project Types & Backend, then Python integration

Ready to begin implementation? 🚀