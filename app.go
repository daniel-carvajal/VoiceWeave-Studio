package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
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
		venvPython3 := filepath.Join("python", ".venv", "bin", "python3")
		venvPython := filepath.Join("python", ".venv", "bin", "python")
		
		if _, err := os.Stat(venvPython3); err == nil {
			return venvPython3
		}
		if _, err := os.Stat(venvPython); err == nil {
			return venvPython
		}
		return "python3"
	}
}

// RunDubbingPipeline executes the Python dubbing pipeline
func (a *App) RunDubbingPipeline(config PipelineConfig) (string, error) {
	// Get the Python scripts directory (either embedded temp or local dev)
	pythonDir := os.Getenv("KOKORO_PYTHON_DIR")
	if pythonDir == "" {
		// Fallback for development
		pythonDir = filepath.Join(".", "python")
	}
	
	scriptPath := filepath.Join(pythonDir, "dub_youtube_video.py")
	
	// Check if Python script exists
	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		return "", fmt.Errorf("Python script not found: %s", scriptPath)
	}
	
	// Prepare command
	pythonCmd := getPythonCommand()
	cmd := exec.Command(pythonCmd, scriptPath, config.VideoURL, config.TargetLang)
	
	// Set working directory to Python scripts directory
	cmd.Dir = pythonDir
	
	// Set environment variables for configuration
	cmd.Env = append(os.Environ(),
		fmt.Sprintf("OUTPUT_DIR=%s", config.OutputDir),
		fmt.Sprintf("AUDIO_SETTINGS=%s", marshalToJSON(config.AudioSettings)),
	)
	
	// Execute command
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("pipeline execution failed: %v\nOutput: %s", err, string(output))
	}
	
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

// LoadProject loads a project configuration
func (a *App) LoadProject(name string) (map[string]interface{}, error) {
	projectDir := filepath.Join(".", "projects")
	filePath := filepath.Join(projectDir, name+".json")
	
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}
	
	var config map[string]interface{}
	err = json.Unmarshal(data, &config)
	if err != nil {
		return nil, err
	}
	
	return config, nil
}

// Helper function to marshal data to JSON string
func marshalToJSON(data interface{}) string {
	bytes, err := json.Marshal(data)
	if err != nil {
		return "{}"
	}
	return string(bytes)
}