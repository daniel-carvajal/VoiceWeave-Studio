import React, { useState } from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Play, Volume2, Settings, Video, MicVocal, Folder, AudioWaveform, Scissors, Pencil } from 'lucide-react';
import KokoroVoiceManager from './routes/KokoroVoiceManager';
import DubbingPipeline from './routes/DubbingPipeline';
import AudioSegmentPreviewer from './routes/AudioSegmentPreviewer';
import TextRulesManager from './routes/TextRulesManager';

// Import Wails runtime functions
import {
    RunDubbingPipeline,
    SynthesizeVoice,
    SaveProject,
    LoadProject,
    GetProjectFiles
} from '../wailsjs/go/main/App';

// Import the correct PipelineConfig type from wails models
import { main } from '../wailsjs/go/models';

// Import the interface from DubbingPipeline to avoid duplicate definitions
import type { ExtendedPipelineConfig } from './routes/DubbingPipeline';

// Create a function to handle step-by-step pipeline execution
const runPipelineStep = async (step: string, config: any): Promise<any> => {
    // This is a placeholder - you'll need to implement actual step handling
    console.log(`Running step: ${step}`, config);

    // For now, just return a success message
    return Promise.resolve(`Step ${step} completed successfully`);
};

// Navigation Component
const Navigation: React.FC<{ currentProject: any }> = ({ currentProject }) => {
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    return (
        <nav className="bg-gray-900/80 backdrop-blur-sm border-b border-purple-500/30 fixed top-0 left-0 right-0 z-50">
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center space-x-8">
                        <h1 className="text-xl font-bold text-white">Kokoro Studio</h1>

                        <div className="flex space-x-1">
                            <Link
                                to="/"
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isActive('/')
                                    ? 'bg-purple-600 text-white'
                                    : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                                    }`}
                            >
                                <MicVocal size={16} />
                                Voice Lab
                            </Link>

                            <Link
                                to="/dubbing"
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isActive('/dubbing')
                                    ? 'bg-purple-600 text-white'
                                    : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                                    }`}
                            >
                                <Video size={16} />
                                Dubbing
                            </Link>
                            <Link
                                to="/segments"
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isActive('/segments')
                                    ? 'bg-purple-600 text-white'
                                    : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                                    }`}
                            >
                                <Scissors size={16} />
                                Segment Playground
                            </Link>
                            <Link
                                to="/text-rules"
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isActive('/text-rules')
                                    ? 'bg-purple-600 text-white'
                                    : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                                    }`}
                            >
                                <Pencil size={16} />
                                Rules
                            </Link>
                        </div>
                    </div>

                    {currentProject && (
                        <div className="text-sm text-gray-300">
                            Project: <span className="text-purple-300">{currentProject.name}</span>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
};

// Main App Component
const App: React.FC = () => {
    const [currentProject, setCurrentProject] = useState<any>(null);

    const saveCurrentProject = async (name: string, config: any) => {
        try {
            await SaveProject(name, config);
            setCurrentProject({ name, config });
        } catch (error) {
            console.error('Failed to save project:', error);
        }
    };

    const loadProject = async (name: string) => {
        try {
            const config = await LoadProject(name);
            setCurrentProject({ name, config });
        } catch (error) {
            console.error('Failed to load project:', error);
        }
    };

    // Wrapper function to handle the pipeline config conversion
    const handleRunPipeline = async (config: ExtendedPipelineConfig): Promise<string> => {
        // Convert the extended config to the base PipelineConfig expected by Wails
        const wailsConfig: main.PipelineConfig = {
            videoUrl: config.videoUrl || '', // Ensure videoUrl is always a string
            targetLang: config.targetLang,
            outputDir: config.outputDir,
            audioSettings: config.audioSettings,
            textRules: config.textRules,
            segmentRules: config.segmentRules
        };

        return RunDubbingPipeline(wailsConfig);
    };

    return (
        <Router>
            <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
                <Navigation currentProject={currentProject} />

                <main className="container mx-auto px-6 pt-20 pb-16">
                    <Routes>
                        <Route
                            path="/"
                            element={<KokoroVoiceManager />}
                        />
                        <Route
                            path="/dubbing"
                            element={
                                <DubbingPipeline
                                    onRunPipeline={handleRunPipeline}
                                    onRunStep={runPipelineStep}
                                    currentProject={currentProject}
                                    onSaveProject={saveCurrentProject}
                                />
                            }
                        />
                        <Route
                            path="/segments"
                            element={<AudioSegmentPreviewer />}
                        />
                        <Route
                            path="/text-rules"
                            element={<TextRulesManager />}
                        />
                    </Routes>
                </main>
            </div>
        </Router>
    );
};

export default App;