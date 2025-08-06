package main

import (
	"embed"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed python
var pythonScripts embed.FS

// Extract embedded Python scripts to temp directory on startup
func extractPythonScripts() (string, error) {
	tempDir := filepath.Join(os.TempDir(), "kokoro-studio-python")
	
	// Remove existing temp directory
	os.RemoveAll(tempDir)
	
	// Create temp directory
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		return "", err
	}
	
	// Extract all embedded Python files
	return tempDir, fs.WalkDir(pythonScripts, "python", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		
		// Skip directories
		if d.IsDir() {
			return nil
		}
		
		// Read embedded file
		data, err := pythonScripts.ReadFile(path)
		if err != nil {
			return err
		}
		
		// Create target path
		relPath, _ := filepath.Rel("python", path)
		targetPath := filepath.Join(tempDir, relPath)
		
		// Create parent directory if needed
		if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
			return err
		}
		
		// Write file
		return os.WriteFile(targetPath, data, 0644)
	})
}

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "VoiceWeave Studio",
		Width:  1400,
		Height: 1000,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 81, A: 1},
		OnStartup:        app.OnStartup,  // Changed from app.startup
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}