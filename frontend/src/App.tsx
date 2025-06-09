import React, { useState } from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Play, Volume2, Settings, Video, MicVocal, Folder, AudioWaveform, Scissors, Pencil } from 'lucide-react';
import KokoroVoiceManager from './routes/KokoroVoiceManager';
import DubbingPipeline from './routes/DubbingPipeline';
import AudioSegmentPreviewer from './routes/AudioSegmentPreviewer';
import ProjectManager from './routes/ProjectManager';


// Import Wails runtime functions
import {
    RunDubbingPipeline,
    SynthesizeVoice,
    SaveProject,
    LoadProject,
    GetProjectFiles
} from '../wailsjs/go/main/App';

// interface PipelineConfig {
//     videoUrl: string;
//     targetLang: string;
//     outputDir: string;
//     audioSettings: {
//         preventOverlaps: boolean;
//         minGap: number;
//         globalCrossfade: boolean;
//         crossfadeDuration: number;
//     };
//     textRules: any[];
//     segmentRules: any[];
// }

interface VoiceRequest {
    model: string;
    voice: string;
    input: string;
    response_format: string;
    speed: number;
    lang_code: string;
}

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
                                to="/rules"
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isActive('/rules')
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

// Voice Manager Component
// const KokoroVoiceManager: React.FC<{ onSynthesizeVoice: (request: VoiceRequest) => Promise<any> }> = ({ onSynthesizeVoice }) => {
//     const [inputText, setInputText] = useState('Hello, this is a test of the Kokoro voice synthesis system.');
//     const [selectedVoice, setSelectedVoice] = useState('af_heart');
//     const [speed, setSpeed] = useState(1.0);
//     const [langCode, setLangCode] = useState('e');
//     const [isLoading, setIsLoading] = useState(false);

//     const voices = [
//         'af_heart', 'af_alloy', 'af_aoede', 'af_bella', 'af_jessica', 'af_kore',
//         'af_nicole', 'af_nova', 'af_river', 'af_sarah', 'af_sky',
//         'am_adam', 'am_echo', 'am_eric', 'am_fenrir', 'am_liam', 'am_michael',
//         'am_onyx', 'am_puck', 'am_santa',
//         'bf_alice', 'bf_emma', 'bf_isabella', 'bf_lily',
//         'bm_daniel', 'bm_fable', 'bm_george', 'bm_lewis'
//     ];

//     const generateSpeech = async () => {
//         if (!inputText.trim()) return;

//         setIsLoading(true);

//         const request: VoiceRequest = {
//             model: "kokoro",
//             voice: selectedVoice,
//             input: inputText,
//             response_format: "mp3",
//             speed: speed,
//             lang_code: langCode
//         };

//         try {
//             const result = await onSynthesizeVoice(request);
//             console.log('Voice synthesis result:', result);
//         } catch (error) {
//             console.error('Voice synthesis failed:', error);
//             alert('Voice synthesis failed. Make sure your Kokoro API is running.');
//         } finally {
//             setIsLoading(false);
//         }
//     };

//     return (
//         <div className="max-w-4xl mx-auto">
//             {/* TEST: This should be a bright red box if Tailwind works */}
//             {/* <div className="bg-red-500 text-white p-8 mb-4 rounded-lg">
//         🚨 TAILWIND TEST - This should be bright red if working!
//       </div> */}

//             <div className="text-center mb-8">
//                 <h1 className="text-4xl font-bold text-white mb-2">Voice Laboratory</h1>
//                 <p className="text-purple-200">Advanced voice synthesis testing</p>
//             </div>

//             <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
//                 <div className="space-y-4">
//                     <div>
//                         <label className="block text-sm font-medium text-purple-300 mb-2">Text to Synthesize</label>
//                         <textarea
//                             value={inputText}
//                             onChange={(e) => setInputText(e.target.value)}
//                             rows={4}
//                             className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none resize-none"
//                             placeholder="Enter text to convert to speech..."
//                         />
//                     </div>

//                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//                         <div>
//                             <label className="block text-sm font-medium text-purple-300 mb-2">Voice</label>
//                             <select
//                                 value={selectedVoice}
//                                 onChange={(e) => setSelectedVoice(e.target.value)}
//                                 className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
//                             >
//                                 {voices.map(voice => (
//                                     <option key={voice} value={voice}>{voice}</option>
//                                 ))}
//                             </select>
//                         </div>

//                         <div>
//                             <label className="block text-sm font-medium text-purple-300 mb-2">Speed</label>
//                             <input
//                                 type="range"
//                                 min="0.5"
//                                 max="2.0"
//                                 step="0.1"
//                                 value={speed}
//                                 onChange={(e) => setSpeed(parseFloat(e.target.value))}
//                                 className="w-full"
//                             />
//                             <div className="text-center text-sm text-gray-400">{speed}x</div>
//                         </div>

//                         <div>
//                             <label className="block text-sm font-medium text-purple-300 mb-2">Language</label>
//                             <select
//                                 value={langCode}
//                                 onChange={(e) => setLangCode(e.target.value)}
//                                 className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
//                             >
//                                 <option value="e">English</option>
//                                 <option value="j">Japanese</option>
//                                 <option value="z">Chinese</option>
//                                 <option value="s">Spanish</option>
//                                 <option value="f">French</option>
//                                 <option value="h">Hindi</option>
//                                 <option value="i">Italian</option>
//                                 <option value="p">Portuguese</option>
//                             </select>
//                         </div>
//                     </div>

//                     <button
//                         onClick={generateSpeech}
//                         disabled={isLoading || !inputText.trim()}
//                         className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-700 hover:to-blue-700 transition-all"
//                     >
//                         {isLoading ? 'Generating...' : 'Generate Speech'}
//                     </button>
//                 </div>
//             </div>
//         </div>
//     );
// };

// // Pipeline Component (Simplified)
// const DubbingPipeline: React.FC<{
//     onRunPipeline: (config: PipelineConfig) => Promise<string>;
//     currentProject: any;
//     onSaveProject: (name: string, config: any) => Promise<void>;
// }> = ({ onRunPipeline, currentProject, onSaveProject }) => {
//     const [videoUrl, setVideoUrl] = useState('');
//     const [targetLang, setTargetLang] = useState('es');
//     const [isProcessing, setIsProcessing] = useState(false);
//     const [progress, setProgress] = useState('');

//     const runPipeline = async () => {
//         if (!videoUrl.trim()) return;

//         setIsProcessing(true);
//         setProgress('Starting dubbing pipeline...');

//         try {
//             const config: PipelineConfig = {
//                 videoUrl,
//                 targetLang,
//                 outputDir: './output',
//                 audioSettings: {
//                     preventOverlaps: true,
//                     minGap: 100,
//                     globalCrossfade: false,
//                     crossfadeDuration: 150
//                 },
//                 textRules: [],
//                 segmentRules: []
//             };

//             const result = await onRunPipeline(config);
//             setProgress('Pipeline completed successfully!');
//             console.log('Pipeline result:', result);
//         } catch (error) {
//             setProgress(`Pipeline failed: ${error}`);
//             console.error('Pipeline error:', error);
//         } finally {
//             setIsProcessing(false);
//         }
//     };

//     return (
//         <div className="max-w-4xl mx-auto">
//             <div className="text-center mb-8">
//                 <h1 className="text-4xl font-bold text-white mb-2">Video Dubbing Pipeline</h1>
//                 <p className="text-purple-200">Transform videos with AI-powered voice dubbing</p>
//             </div>

//             <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
//                 <div className="space-y-4">
//                     <div>
//                         <label className="block text-sm font-medium text-purple-300 mb-2">
//                             YouTube URL or Video ID
//                         </label>
//                         <input
//                             type="text"
//                             value={videoUrl}
//                             onChange={(e) => setVideoUrl(e.target.value)}
//                             placeholder="https://youtube.com/watch?v=... or video ID"
//                             className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
//                         />
//                     </div>

//                     <div>
//                         <label className="block text-sm font-medium text-purple-300 mb-2">
//                             Target Language
//                         </label>
//                         <select
//                             value={targetLang}
//                             onChange={(e) => setTargetLang(e.target.value)}
//                             className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
//                         >
//                             <option value="es">Spanish</option>
//                             <option value="fr">French</option>
//                             <option value="de">German</option>
//                             <option value="it">Italian</option>
//                             <option value="pt">Portuguese</option>
//                             <option value="ja">Japanese</option>
//                             <option value="ko">Korean</option>
//                             <option value="zh">Chinese</option>
//                         </select>
//                     </div>

//                     <button
//                         onClick={runPipeline}
//                         disabled={isProcessing || !videoUrl.trim()}
//                         className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2"
//                     >
//                         <Play size={20} />
//                         {isProcessing ? 'Processing...' : 'Start Dubbing'}
//                     </button>

//                     {progress && (
//                         <div className="bg-gray-700/50 rounded-lg p-4 mt-4">
//                             <p className="text-white font-mono text-sm">{progress}</p>
//                         </div>
//                     )}
//                 </div>
//             </div>
//         </div>
//     );
// };

// // Simple Projects placeholder
// const ProjectManager: React.FC<any> = () => {
//     return (
//         <div className="max-w-4xl mx-auto">
//             <div className="text-center mb-8">
//                 <h1 className="text-4xl font-bold text-white mb-2">Project Manager</h1>
//                 <p className="text-purple-200">Save and load your dubbing configurations</p>
//             </div>

//             <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
//                 <div className="text-center py-8">
//                     <Folder size={48} className="mx-auto mb-4 text-gray-500" />
//                     <p className="text-gray-400">Project management coming soon...</p>
//                 </div>
//             </div>
//         </div>
//     );
// };

// Main App Component (Simplified)
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

    return (
        <Router>
            <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
                <Navigation currentProject={currentProject} />

                <main className="container mx-auto px-6 pt-20 pb-16">
                    <Routes>
                        <Route
                            path="/"
                            element={
                                <KokoroVoiceManager
                                // onSynthesizeVoice={SynthesizeVoice}
                                />
                            }
                        />
                        <Route
                            path="/dubbing"
                            element={
                                <DubbingPipeline
                                    onRunPipeline={RunDubbingPipeline}
                                    currentProject={currentProject}
                                    onSaveProject={saveCurrentProject}
                                />
                            }
                        />
                        <Route
                            path="/segments"
                            element={
                                <AudioSegmentPreviewer
                                    // onRunPipeline={RunDubbingPipeline}
                                    // currentProject={currentProject}
                                    // onSaveProject={saveCurrentProject}
                                />
                            }
                        />
                        <Route
                            path="/Rules"
                            element={<ProjectManager />}
                        />
                    </Routes>
                </main>
            </div>
        </Router>
    );
};

export default App;