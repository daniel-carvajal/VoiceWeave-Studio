package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"

	"crypto/rand"
    "encoding/hex"
    "io"
    // "sort"
    // "strconv"
    "strings"
    "time"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// OnStartup is called when the app starts up
func (a *App) OnStartup(ctx context.Context) {
	a.ctx = ctx
	
	// Extract Python scripts to temp directory
	if tempDir, err := extractPythonScripts(); err == nil {
		os.Setenv("KOKORO_PYTHON_DIR", tempDir)
		fmt.Printf("Python scripts extracted to: %s\n", tempDir)
	} else {
		fmt.Printf("Failed to extract Python scripts: %v\n", err)
	}
}

// PipelineConfig represents the dubbing pipeline configuration
type PipelineConfig struct {
	VideoURL     string            `json:"videoUrl"`
	TargetLang   string            `json:"targetLang"`
	OutputDir    string            `json:"outputDir"`
	AudioSettings map[string]interface{} `json:"audioSettings"`
	TextRules    []interface{}     `json:"textRules"`
	SegmentRules []interface{}     `json:"segmentRules"`
}

// VoiceRequest represents a voice synthesis request
type VoiceRequest struct {
	Model          string  `json:"model"`
	Voice          string  `json:"voice"`
	Input          string  `json:"input"`
	ResponseFormat string  `json:"response_format"`
	Speed          float64 `json:"speed"`
	LangCode       string  `json:"lang_code"`
}

// getPythonCommand returns the appropriate Python command
func getPythonCommand() string {
	// For development: prefer venv if it exists
	if runtime.GOOS == "windows" {
		venvPython := filepath.Join("python", ".venv", "Scripts", "python.exe")
		if _, err := os.Stat(venvPython); err == nil {
			return venvPython
		}
		return "python"
	} else {
		// Try multiple possible venv paths
		venvPaths := []string{
			filepath.Join("python", ".venv", "bin", "python3"),
			filepath.Join("python", ".venv", "bin", "python"),
		}
		
		for _, path := range venvPaths {
			if _, err := os.Stat(path); err == nil {
				return path
			}
		}
		
		// Fallback to system python
		return "python3"
	}
}

// RunDubbingPipeline executes the Python dubbing pipeline
func (a *App) RunDubbingPipeline(config PipelineConfig) (string, error) {
	// Get the Python scripts directory (either embedded temp or local dev)
	pythonDir := os.Getenv("KOKORO_PYTHON_DIR")
	if pythonDir == "" {
		// Fallback for development - get absolute path
		workDir, _ := os.Getwd()
		pythonDir = filepath.Join(workDir, "python")
	}
	
	scriptPath := filepath.Join(pythonDir, "dubbing_pipeline.py")
	
	// Debug: Print paths
	fmt.Printf("Working directory: %s\n", pythonDir)
	fmt.Printf("Script path: %s\n", scriptPath)
	
	// Check if Python script exists
	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		return "", fmt.Errorf("Python script not found: %s", scriptPath)
	}
	
	// Get Python command with absolute path
	pythonCmd := getPythonCommand()
	if !filepath.IsAbs(pythonCmd) {
		workDir, _ := os.Getwd()
		pythonCmd = filepath.Join(workDir, pythonCmd)
	}
	
	fmt.Printf("Python command: %s\n", pythonCmd)
	
	// Prepare command - dubbing_pipeline.py expects URL and target language
	var sourceUrl string
	if config.VideoURL != "" {
		sourceUrl = config.VideoURL
	} else {
		// Handle file inputs - for now, skip file support in full pipeline
		return "", fmt.Errorf("full pipeline currently only supports YouTube URLs")
	}
	
	cmd := exec.Command(pythonCmd, scriptPath, sourceUrl, config.TargetLang)
	
	// Set working directory to Python scripts directory
	cmd.Dir = pythonDir
	
	// IMPORTANT: Set output directories to project location, not temp directory
	// Get the project's output directory (should be passed from frontend)
	outputDir := config.OutputDir
	if outputDir == "" || outputDir == "./output" {
		// If no specific output dir, use current working directory
		workDir, _ := os.Getwd()
		outputDir = filepath.Join(workDir, "output")
	}
	
	// Ensure output directory exists
	os.MkdirAll(outputDir, 0755)
	
	// Set environment variables for configuration
	env := append(os.Environ(),
        // Override config directories with environment variables if provided
		// Override Python script's default directories
		fmt.Sprintf("KOKORO_VIDEO_OUTPUT_DIR=%s", filepath.Join(outputDir, "videos")),
		fmt.Sprintf("KOKORO_AUDIO_OUTPUT_DIR=%s", filepath.Join(outputDir, "audio")),
		fmt.Sprintf("KOKORO_TRANSCRIPT_OUTPUT_DIR=%s", filepath.Join(outputDir, "transcripts")),
		fmt.Sprintf("OUTPUT_DIR=%s", outputDir),
		fmt.Sprintf("AUDIO_SETTINGS=%s", marshalToJSON(config.AudioSettings)),

        // Add API keys
        fmt.Sprintf("ANTHROPIC_API_KEY=%s", ""),
        fmt.Sprintf("HF_TOKEN=%s", ""),
	)
	
	// Add text and segment rules as environment variables if they exist
	if len(config.TextRules) > 0 {
		env = append(env, fmt.Sprintf("TEXT_RULES=%s", marshalToJSON(config.TextRules)))
	}
	if len(config.SegmentRules) > 0 {
		env = append(env, fmt.Sprintf("SEGMENT_RULES=%s", marshalToJSON(config.SegmentRules)))
	}
	
	cmd.Env = env
	
	// Execute command with timeout (dubbing can take a while)
	fmt.Printf("🚀 Starting dubbing pipeline for: %s\n", sourceUrl)
	fmt.Printf("📁 Output directory: %s\n", outputDir)
	output, err := cmd.CombinedOutput()
	
	if err != nil {
		return "", fmt.Errorf("pipeline execution failed: %v\nOutput: %s", err, string(output))
	}
	
	fmt.Printf("✅ Pipeline completed successfully\n")
	fmt.Printf("📁 Check output in: %s\n", outputDir)
	return string(output), nil
}

// SynthesizeVoice calls the Kokoro API for voice synthesis
func (a *App) SynthesizeVoice(request VoiceRequest) ([]byte, error) {
	pythonDir := os.Getenv("KOKORO_PYTHON_DIR")
	if pythonDir == "" {
		pythonDir = filepath.Join(".", "python")
	}
	
	scriptPath := filepath.Join(pythonDir, "synthesize_voice.py")
	
	// Marshal request to JSON
	requestJSON, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}
	
	pythonCmd := getPythonCommand()
	cmd := exec.Command(pythonCmd, scriptPath, string(requestJSON))
	cmd.Dir = pythonDir
	
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("voice synthesis failed: %v", err)
	}
	
	return output, nil
}

// GetProjectFiles returns available project files and configurations
func (a *App) GetProjectFiles() (map[string]interface{}, error) {
	projectDir := filepath.Join(".", "projects")
	
	// Ensure projects directory exists
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		return nil, err
	}
	
	files := make(map[string]interface{})
	
	// List project files
	err := filepath.Walk(projectDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		
		if !info.IsDir() && filepath.Ext(path) == ".json" {
			relPath, _ := filepath.Rel(projectDir, path)
			files[relPath] = map[string]interface{}{
				"name":     info.Name(),
				"size":     info.Size(),
				"modified": info.ModTime(),
			}
		}
		
		return nil
	})
	
	if err != nil {
		return nil, err
	}
	
	return files, nil
}

// SaveProject saves a project configuration
func (a *App) SaveProject(name string, config map[string]interface{}) error {
	projectDir := filepath.Join(".", "projects")
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		return err
	}
	
	filePath := filepath.Join(projectDir, name+".json")
	
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	
	return os.WriteFile(filePath, data, 0644)
}

// // LoadProject loads a project configuration
// func (a *App) LoadProject(name string) (map[string]interface{}, error) {
// 	projectDir := filepath.Join(".", "projects")
// 	filePath := filepath.Join(projectDir, name+".json")
	
// 	data, err := os.ReadFile(filePath)
// 	if err != nil {
// 		return nil, err
// 	}
	
// 	var config map[string]interface{}
// 	err = json.Unmarshal(data, &config)
// 	if err != nil {
// 		return nil, err
// 	}
	
// 	return config, nil
// }

// Helper function to marshal data to JSON string
func marshalToJSON(data interface{}) string {
	bytes, err := json.Marshal(data)
	if err != nil {
		return "{}"
	}
	return string(bytes)
}

// ## PROJECT RELATED TYPES

type ProjectConfig struct {
    ID              string                 `json:"id"`
    Name            string                 `json:"name"`
    Created         string                 `json:"created"`
    LastModified    string                 `json:"lastModified"`
    Version         int                    `json:"version"`
    SourceType      string                 `json:"sourceType"`
    SourceUrl       *string                `json:"sourceUrl,omitempty"`
    VideoId         *string                `json:"videoId,omitempty"`
    OriginalFilename *string               `json:"originalFilename,omitempty"`
    TargetLanguage  string                 `json:"targetLanguage"`
    CompletedSteps  CompletedSteps         `json:"completedSteps"`
    FileReferences  FileReferences         `json:"fileReferences"`
    Settings        ProjectSettings        `json:"settings"`
    TextRules       []TextRule             `json:"textRules"`
    SegmentRules    []SegmentRule          `json:"segmentRules"`
}

type CompletedSteps struct {
    Download   bool `json:"download"`
    Transcribe bool `json:"transcribe"`
    Translate  bool `json:"translate"`
    Synthesize bool `json:"synthesize"`
    Combine    bool `json:"combine"`
}

type FileReferences struct {
    VideoFile    *FileReference `json:"videoFile,omitempty"`
    AudioFile    *FileReference `json:"audioFile,omitempty"`
    SegmentsFile *string        `json:"segmentsFile,omitempty"`
    FinalAudio   *string        `json:"finalAudio,omitempty"`
    FinalVideo   *string        `json:"finalVideo,omitempty"`
}

type FileReference struct {
    Path         string  `json:"path"`
    IsLinked     bool    `json:"isLinked"`
    OriginalPath *string `json:"originalPath,omitempty"`
    Size         *int64  `json:"size,omitempty"`
    LastModified *string `json:"lastModified,omitempty"`
}

type ProjectSettings struct {
    Transcription TranscriptionSettings `json:"transcription"`
    Translation   TranslationSettings   `json:"translation"`
    Audio         AudioSettings         `json:"audio"`
    Cleanup       CleanupSettings       `json:"cleanup"`
}

type TranscriptionSettings struct {
    Source             string  `json:"source"`
    EnableDiarization  bool    `json:"enableDiarization"`
    Language           string  `json:"language"`
    Model              *string `json:"model,omitempty"`
}

type TranslationSettings struct {
    Mode             string                    `json:"mode"`
    SimpleModel      string                    `json:"simpleModel"`
    CloudProvider    *string                   `json:"cloudProvider,omitempty"`
    AdvancedSettings *AdvancedTranslationSettings `json:"advancedSettings,omitempty"`
}

type AdvancedTranslationSettings struct {
    ContextWindow int      `json:"contextWindow"`
    EnableJudge   bool     `json:"enableJudge"`
    Models        []string `json:"models"`
}

type AudioSettings struct {
    PreventOverlaps    bool   `json:"preventOverlaps"`
    MinGap             int    `json:"minGap"`
    GlobalCrossfade    bool   `json:"globalCrossfade"`
    CrossfadeDuration  int    `json:"crossfadeDuration"`
    EffectsPreset      string `json:"effectsPreset"`
}

type CleanupSettings struct {
    Mode                  string `json:"mode"`
    KeepIntermediateFiles bool   `json:"keepIntermediateFiles"`
}

type TextRule struct {
    ID              string `json:"id"`
    OriginalText    string `json:"originalText"`
    ReplacementText string `json:"replacementText"`
    Language        string `json:"language"`
    Priority        string `json:"priority"`
    CaseSensitive   bool   `json:"caseSensitive"`
    CreatedAt       string `json:"createdAt"`
}

type SegmentRule struct {
    ID         string                 `json:"id"`
    Type       string                 `json:"type"`
    Conditions map[string]interface{} `json:"conditions"`
    Actions    map[string]interface{} `json:"actions"`
    Enabled    bool                   `json:"enabled"`
    CreatedAt  string                 `json:"createdAt"`
}

type AppSettings struct {
    DefaultProjectsPath string   `json:"defaultProjectsPath"`
    AutoCleanup         string   `json:"autoCleanup"`
    ShowOnboarding      bool     `json:"showOnboarding"`
    RecentProjects      []string `json:"recentProjects"`
    ExportLocation      string   `json:"exportLocation"`
    CustomExportPath    *string  `json:"customExportPath,omitempty"`
}

// ## PROJECT RELATED FUNCTIONS

// GetDefaultProjectsPath returns the default projects directory
func (a *App) GetDefaultProjectsPath() (string, error) {
    var baseDir string
    
    switch runtime.GOOS {
    case "windows":
        baseDir = os.Getenv("USERPROFILE")
        if baseDir == "" {
            return "", fmt.Errorf("USERPROFILE not set")
        }
        baseDir = filepath.Join(baseDir, "Documents")
    case "darwin", "linux":
        baseDir = os.Getenv("HOME")
        if baseDir == "" {
            return "", fmt.Errorf("HOME not set")
        }
        baseDir = filepath.Join(baseDir, "Documents")
    default:
        return "", fmt.Errorf("unsupported operating system: %s", runtime.GOOS)
    }
    
    return filepath.Join(baseDir, "KokoroStudio"), nil
}

// CreateProject creates a new project with the given configuration
func (a *App) CreateProject(sourceType string, source string, targetLang string, customName string) (*ProjectConfig, error) {
    // Generate unique project ID
    projectID, err := generateProjectID()
    if err != nil {
        return nil, fmt.Errorf("failed to generate project ID: %w", err)
    }
    
    // Get or create default projects directory
    settings, err := a.GetAppSettings()
    if err != nil {
        return nil, fmt.Errorf("failed to get app settings: %w", err)
    }
    
    projectsDir := settings.DefaultProjectsPath
    if err := os.MkdirAll(projectsDir, 0755); err != nil {
        return nil, fmt.Errorf("failed to create projects directory: %w", err)
    }
    
    // Determine project name and video ID
    var displayName, videoID string
    var fileRef *FileReference
    
    switch sourceType {
    case "youtube":
        videoID = extractVideoID(source)
        if videoID == "" {
            return nil, fmt.Errorf("invalid YouTube URL: %s", source)
        }
        // Use custom name if provided, otherwise default
        if customName != "" {
            displayName = customName
        } else {
            displayName = fmt.Sprintf("YouTube Video %s", videoID)
        }
    case "video", "audio":
        // Generate local ID
        videoID = fmt.Sprintf("local_%d", time.Now().Unix())
        filename := filepath.Base(source)
        baseName := strings.TrimSuffix(filename, filepath.Ext(filename))
        
        // Use custom name if provided, otherwise use filename
        if customName != "" {
            displayName = customName
        } else {
            displayName = baseName
        }
        
        // Create file reference (linked initially)
        fileInfo, err := os.Stat(source)
        if err != nil {
            return nil, fmt.Errorf("source file not found: %w", err)
        }
        
        fileSize := fileInfo.Size()
        modTime := fileInfo.ModTime().Format(time.RFC3339)
        
        fileRef = &FileReference{
            Path:         source,
            IsLinked:     true,
            OriginalPath: &source,
            Size:         &fileSize,
            LastModified: &modTime,
        }
    default:
        return nil, fmt.Errorf("invalid source type: %s", sourceType)
    }
    
    // Create folder name (filesystem safe, auto-generated)
    folderName := fmt.Sprintf("%s [%s] [%s]", 
        sanitizeForFilename(displayName), 
        videoID, 
        strings.ToUpper(targetLang))
    
    // Handle name clashes
    folderName, version := resolveProjectNameClash(projectsDir, folderName)
    
    // Create project directory
    projectDir := filepath.Join(projectsDir, folderName)
    if err := os.MkdirAll(projectDir, 0755); err != nil {
        return nil, fmt.Errorf("failed to create project directory: %w", err)
    }
    
    // Create subdirectories
    subdirs := []string{"input", "transcripts", "audio", "output"}
    for _, subdir := range subdirs {
        if err := os.MkdirAll(filepath.Join(projectDir, subdir), 0755); err != nil {
            return nil, fmt.Errorf("failed to create subdirectory %s: %w", subdir, err)
        }
    }
    
    // Create project configuration
    now := time.Now().Format(time.RFC3339)
    project := &ProjectConfig{
        ID:           projectID,
        Name:         displayName,  // ✨ Simple: just store what user wants to see
        Created:      now,
        LastModified: now,
        Version:      version,
        SourceType:   sourceType,
        TargetLanguage: targetLang,
        CompletedSteps: CompletedSteps{},
        FileReferences: FileReferences{},
        Settings: ProjectSettings{
            Transcription: TranscriptionSettings{
                Source:            "whisperx",
                EnableDiarization: true,
                Language:          "en",
            },
            Translation: TranslationSettings{
                Mode:        "simple",
                SimpleModel: "m2m100_418m",
            },
            Audio: AudioSettings{
                PreventOverlaps:   true,
                MinGap:           100,
                GlobalCrossfade:  false,
                CrossfadeDuration: 150,
                EffectsPreset:    "voice",
            },
            Cleanup: CleanupSettings{
                Mode:                  "auto",
                KeepIntermediateFiles: false,
            },
        },
        TextRules:    []TextRule{},
        SegmentRules: []SegmentRule{},
    }
    
    // Set source-specific fields
    if sourceType == "youtube" {
        project.SourceUrl = &source
        project.VideoId = &videoID
    } else {
        filename := filepath.Base(source)
        project.OriginalFilename = &filename
        project.VideoId = &videoID
        
        if sourceType == "video" {
            project.FileReferences.VideoFile = fileRef
        } else {
            project.FileReferences.AudioFile = fileRef
        }
    }
    
    // Save project configuration
    if err := a.saveProjectConfig(projectDir, project); err != nil {
        return nil, fmt.Errorf("failed to save project config: %w", err)
    }
    
    // Update recent projects
    if err := a.addToRecentProjects(projectID); err != nil {
        fmt.Printf("Warning: failed to update recent projects: %v\n", err)
    }
    
    return project, nil
}

// Helper function to sanitize filename
func sanitizeForFilename(name string) string {
    // Remove/replace characters that are problematic in filenames
    name = strings.ReplaceAll(name, "/", "-")
    name = strings.ReplaceAll(name, "\\", "-")
    name = strings.ReplaceAll(name, ":", "-")
    name = strings.ReplaceAll(name, "*", "-")
    name = strings.ReplaceAll(name, "?", "-")
    name = strings.ReplaceAll(name, "\"", "-")
    name = strings.ReplaceAll(name, "<", "-")
    name = strings.ReplaceAll(name, ">", "-")
    name = strings.ReplaceAll(name, "|", "-")
    
    // Limit length to avoid path issues
    if len(name) > 50 {
        name = name[:50]
    }
    
    return strings.TrimSpace(name)
}

// LoadProject loads a project by ID
func (a *App) LoadProject(projectID string) (*ProjectConfig, error) {
    projectDir, err := a.findProjectDirectory(projectID)
    if err != nil {
        return nil, fmt.Errorf("project not found: %w", err)
    }
    
    configPath := filepath.Join(projectDir, "project.json")
    data, err := os.ReadFile(configPath)
    if err != nil {
        return nil, fmt.Errorf("failed to read project config: %w", err)
    }
    
    var project ProjectConfig
    if err := json.Unmarshal(data, &project); err != nil {
        return nil, fmt.Errorf("failed to parse project config: %w", err)
    }
    
    return &project, nil
}

// UpdateProject updates an existing project configuration
func (a *App) UpdateProject(project *ProjectConfig) error {
    projectDir, err := a.findProjectDirectory(project.ID)
    if err != nil {
        return fmt.Errorf("project not found: %w", err)
    }
    
    project.LastModified = time.Now().Format(time.RFC3339)
    
    return a.saveProjectConfig(projectDir, project)
}

// GetRecentProjects returns the list of recent projects
func (a *App) GetRecentProjects() ([]ProjectConfig, error) {
    settings, err := a.GetAppSettings()
    if err != nil {
        return nil, fmt.Errorf("failed to get app settings: %w", err)
    }
    
    projects := make([]ProjectConfig, 0)  // Initialize as empty slice, not nil
    for _, projectID := range settings.RecentProjects {
        project, err := a.LoadProject(projectID)
        if err != nil {
            // Skip projects that can't be loaded
            continue
        }
        projects = append(projects, *project)
    }
    
    return projects, nil  // This returns empty array []
}

// CopyLinkedFilesToProject copies all linked files into the project directory
func (a *App) CopyLinkedFilesToProject(projectID string) error {
    project, err := a.LoadProject(projectID)
    if err != nil {
        return fmt.Errorf("failed to load project: %w", err)
    }
    
    projectDir, err := a.findProjectDirectory(projectID)
    if err != nil {
        return fmt.Errorf("project directory not found: %w", err)
    }
    
    updated := false
    
    // Copy video file if linked
    if project.FileReferences.VideoFile != nil && project.FileReferences.VideoFile.IsLinked {
        if err := a.copyFileToProject(projectDir, "input", project.FileReferences.VideoFile); err != nil {
            return fmt.Errorf("failed to copy video file: %w", err)
        }
        updated = true
    }
    
    // Copy audio file if linked
    if project.FileReferences.AudioFile != nil && project.FileReferences.AudioFile.IsLinked {
        if err := a.copyFileToProject(projectDir, "input", project.FileReferences.AudioFile); err != nil {
            return fmt.Errorf("failed to copy audio file: %w", err)
        }
        updated = true
    }
    
    if updated {
        return a.UpdateProject(project)
    }
    
    return nil
}

// Helper functions

func generateProjectID() (string, error) {
    bytes := make([]byte, 16)
    if _, err := rand.Read(bytes); err != nil {
        return "", err
    }
    return hex.EncodeToString(bytes), nil
}

func extractVideoID(url string) string {
    // Simple YouTube URL parsing
    if strings.Contains(url, "youtube.com/watch?v=") {
        parts := strings.Split(url, "v=")
        if len(parts) > 1 {
            videoID := strings.Split(parts[1], "&")[0]
            return videoID
        }
    } else if strings.Contains(url, "youtu.be/") {
        parts := strings.Split(url, "youtu.be/")
        if len(parts) > 1 {
            videoID := strings.Split(parts[1], "?")[0]
            return videoID
        }
    }
    // If it's already just an ID, return it
    if len(url) == 11 && !strings.Contains(url, "/") {
        return url
    }
    return ""
}

func resolveProjectNameClash(projectsDir, baseName string) (string, int) {
    version := 1
    projectName := baseName
    
    for {
        projectPath := filepath.Join(projectsDir, projectName)
        if _, err := os.Stat(projectPath); os.IsNotExist(err) {
            break
        }
        
        version++
        projectName = fmt.Sprintf("%s (%d)", baseName, version)
    }
    
    return projectName, version
}

func (a *App) saveProjectConfig(projectDir string, project *ProjectConfig) error {
    configPath := filepath.Join(projectDir, "project.json")
    data, err := json.MarshalIndent(project, "", "  ")
    if err != nil {
        return fmt.Errorf("failed to marshal project config: %w", err)
    }
    
    return os.WriteFile(configPath, data, 0644)
}

func (a *App) findProjectDirectory(projectID string) (string, error) {
    settings, err := a.GetAppSettings()
    if err != nil {
        return "", fmt.Errorf("failed to get app settings: %w", err)
    }
    
    projectsDir := settings.DefaultProjectsPath
    
    // Walk through project directories to find matching ID
    entries, err := os.ReadDir(projectsDir)
    if err != nil {
        return "", fmt.Errorf("failed to read projects directory: %w", err)
    }
    
    for _, entry := range entries {
        if !entry.IsDir() {
            continue
        }
        
        projectDir := filepath.Join(projectsDir, entry.Name())
        configPath := filepath.Join(projectDir, "project.json")
        
        data, err := os.ReadFile(configPath)
        if err != nil {
            continue
        }
        
        var config ProjectConfig
        if err := json.Unmarshal(data, &config); err != nil {
            continue
        }
        
        if config.ID == projectID {
            return projectDir, nil
        }
    }
    
    return "", fmt.Errorf("project not found: %s", projectID)
}

func (a *App) copyFileToProject(projectDir, subdir string, fileRef *FileReference) error {
    if !fileRef.IsLinked {
        return nil // Already copied
    }
    
    srcPath := fileRef.Path
    filename := filepath.Base(srcPath)
    destPath := filepath.Join(projectDir, subdir, filename)
    
    // Copy file
    src, err := os.Open(srcPath)
    if err != nil {
        return fmt.Errorf("failed to open source file: %w", err)
    }
    defer src.Close()
    
    dest, err := os.Create(destPath)
    if err != nil {
        return fmt.Errorf("failed to create destination file: %w", err)
    }
    defer dest.Close()
    
    if _, err := io.Copy(dest, src); err != nil {
        return fmt.Errorf("failed to copy file: %w", err)
    }
    
    // Update file reference
    relativePath := filepath.Join(subdir, filename)
    fileRef.OriginalPath = &fileRef.Path
    fileRef.Path = relativePath
    fileRef.IsLinked = false
    
    return nil
}

func (a *App) addToRecentProjects(projectID string) error {
    settings, err := a.GetAppSettings()
    if err != nil {
        return err
    }
    
    // Remove if already exists
    for i, id := range settings.RecentProjects {
        if id == projectID {
            settings.RecentProjects = append(settings.RecentProjects[:i], settings.RecentProjects[i+1:]...)
            break
        }
    }
    
    // Add to front
    settings.RecentProjects = append([]string{projectID}, settings.RecentProjects...)
    
    // Keep only 5 most recent
    if len(settings.RecentProjects) > 5 {
        settings.RecentProjects = settings.RecentProjects[:5]
    }
    
    return a.SaveAppSettings(settings)
}

// DeleteProject removes a project and its files
func (a *App) DeleteProject(projectID string) error {
    projectDir, err := a.findProjectDirectory(projectID)
    if err != nil {
        return fmt.Errorf("project not found: %w", err)
    }
    
    // Remove from recent projects
    settings, err := a.GetAppSettings()
    if err == nil {
        for i, id := range settings.RecentProjects {
            if id == projectID {
                settings.RecentProjects = append(settings.RecentProjects[:i], settings.RecentProjects[i+1:]...)
                break
            }
        }
        a.SaveAppSettings(settings)
    }
    
    // Remove project directory
    return os.RemoveAll(projectDir)
}

// ShowProjectInFolder opens the project directory in the system file explorer
func (a *App) ShowProjectInFolder(projectID string) error {
    projectDir, err := a.findProjectDirectory(projectID)
    if err != nil {
        return fmt.Errorf("project not found: %w", err)
    }
    
    var cmd *exec.Cmd
    switch runtime.GOOS {
    case "windows":
        cmd = exec.Command("explorer", projectDir)
    case "darwin":
        cmd = exec.Command("open", projectDir)
    case "linux":
        cmd = exec.Command("xdg-open", projectDir)
    default:
        return fmt.Errorf("unsupported operating system: %s", runtime.GOOS)
    }
    
    return cmd.Start()
}

// App Settings Functions
func (a *App) GetAppSettings() (*AppSettings, error) {
    settingsPath, err := a.getSettingsPath()
    if err != nil {
        return nil, err
    }
    
    // Return defaults if file doesn't exist
    if _, err := os.Stat(settingsPath); os.IsNotExist(err) {
        defaultPath, _ := a.GetDefaultProjectsPath()
        return &AppSettings{
            DefaultProjectsPath: defaultPath,
            AutoCleanup:         "auto",
            ShowOnboarding:      true,
            RecentProjects:      []string{},
            ExportLocation:      "project-folder",
        }, nil
    }
    
    data, err := os.ReadFile(settingsPath)
    if err != nil {
        return nil, fmt.Errorf("failed to read settings: %w", err)
    }
    
    var settings AppSettings
    if err := json.Unmarshal(data, &settings); err != nil {
        return nil, fmt.Errorf("failed to parse settings: %w", err)
    }
    
    return &settings, nil
}

func (a *App) SaveAppSettings(settings *AppSettings) error {
    settingsPath, err := a.getSettingsPath()
    if err != nil {
        return err
    }
    
    // Ensure settings directory exists
    if err := os.MkdirAll(filepath.Dir(settingsPath), 0755); err != nil {
        return fmt.Errorf("failed to create settings directory: %w", err)
    }
    
    data, err := json.MarshalIndent(settings, "", "  ")
    if err != nil {
        return fmt.Errorf("failed to marshal settings: %w", err)
    }
    
    return os.WriteFile(settingsPath, data, 0644)
}

func (a *App) getSettingsPath() (string, error) {
    var configDir string
    
    switch runtime.GOOS {
    case "windows":
        configDir = os.Getenv("APPDATA")
        if configDir == "" {
            return "", fmt.Errorf("APPDATA not set")
        }
    case "darwin":
        home := os.Getenv("HOME")
        if home == "" {
            return "", fmt.Errorf("HOME not set")
        }
        configDir = filepath.Join(home, "Library", "Application Support")
    case "linux":
        configDir = os.Getenv("XDG_CONFIG_HOME")
        if configDir == "" {
            home := os.Getenv("HOME")
            if home == "" {
                return "", fmt.Errorf("HOME not set")
            }
            configDir = filepath.Join(home, ".config")
        }
    default:
        return "", fmt.Errorf("unsupported operating system: %s", runtime.GOOS)
    }
    
    return filepath.Join(configDir, "KokoroStudio", "settings.json"), nil
}


// Pipeline execution related functions

// RunPipelineStep executes a single pipeline step for a project
func (a *App) RunPipelineStep(projectID string, step string) (map[string]interface{}, error) {
    // Find project directory
    projectDir, err := a.findProjectDirectory(projectID)
    if err != nil {
        return nil, fmt.Errorf("project not found: %w", err)
    }
    
    // Get Python command
    pythonCmd := a.getPythonCommand()
    
    // Get Python scripts directory
    pythonDir := os.Getenv("KOKORO_PYTHON_DIR")
    if pythonDir == "" {
        workDir, _ := os.Getwd()
        pythonDir = filepath.Join(workDir, "python")
    }
    
    scriptPath := filepath.Join(pythonDir, "project_pipeline.py")
    
    // Prepare command
    cmd := exec.Command(pythonCmd, scriptPath, projectDir, step)
    cmd.Dir = pythonDir
    
    // Set environment variables
    cmd.Env = append(os.Environ(),
        fmt.Sprintf("PYTHONPATH=%s", pythonDir),
    )
    
    // Execute command and capture output
    output, err := cmd.CombinedOutput()
    if err != nil {
        return nil, fmt.Errorf("pipeline step failed: %v\nOutput: %s", err, string(output))
    }
    
    // Parse JSON result
    var result map[string]interface{}
    if err := json.Unmarshal(output, &result); err != nil {
        return nil, fmt.Errorf("failed to parse pipeline output: %w\nOutput: %s", err, string(output))
    }
    
    return result, nil
}

// RunFullPipeline executes the complete pipeline for a project
func (a *App) RunFullPipeline(projectID string) (map[string]interface{}, error) {
    steps := []string{"download", "transcribe", "translate", "synthesize", "combine"}
    
    results := make(map[string]interface{})
    results["steps"] = make(map[string]interface{})
    
    for _, step := range steps {
        stepResult, err := a.RunPipelineStep(projectID, step)
        if err != nil {
            results["success"] = false
            results["error"] = err.Error()
            results["failedStep"] = step
            return results, err
        }
        
        results["steps"].(map[string]interface{})[step] = stepResult
        
        // Stop if step failed
        if success, ok := stepResult["success"].(bool); !ok || !success {
            results["success"] = false
            results["failedStep"] = step
            if stepError, exists := stepResult["error"]; exists {
                results["error"] = stepError
            }
            return results, fmt.Errorf("pipeline step '%s' failed", step)
        }
    }
    
    results["success"] = true
    results["message"] = "✅ Full pipeline completed successfully"
    
    return results, nil
}

// Helper function to get Python command (reuse existing logic)
func (a *App) getPythonCommand() string {
    if runtime.GOOS == "windows" {
        venvPython := filepath.Join("python", ".venv", "Scripts", "python.exe")
        if _, err := os.Stat(venvPython); err == nil {
            return venvPython
        }
        return "python"
    } else {
        venvPaths := []string{
            filepath.Join("python", ".venv", "bin", "python3"),
            filepath.Join("python", ".venv", "bin", "python"),
        }
        
        for _, path := range venvPaths {
            if _, err := os.Stat(path); err == nil {
                return path
            }
        }
        
        return "python3"
    }
}

