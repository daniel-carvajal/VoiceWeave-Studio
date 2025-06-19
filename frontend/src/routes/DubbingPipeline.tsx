import {
    Play, Volume2, Settings, Video, Mic, Folder, Upload, Link, FileAudio, FileVideo,
    Download, FileText, Languages, Zap, Brain, Cloud, ChevronDown, ChevronRight,
    Settings2, Layers, Target, CheckCircle, Circle, ArrowRight, Split
} from 'lucide-react';
import { useState, useRef } from 'react';

// Define and export the extended PipelineConfig that includes all your custom fields
export interface ExtendedPipelineConfig {
    inputType: 'url' | 'video' | 'audio';
    videoUrl?: string;
    videoFile?: File;
    audioFile?: File;
    targetLang: string;
    outputDir: string;
    audioSettings: {
        preventOverlaps: boolean;
        minGap: number;
        globalCrossfade: boolean;
        crossfadeDuration: number;
    };
    textRules: any[];
    segmentRules: any[];
    transcriptionSettings: {
        source: 'whisperx' | 'youtube' | 'upload';
        enableDiarization: boolean;
        language: string;
    };
    translationSettings: {
        mode: 'simple' | 'advanced';
        simpleModel: string;
        cloudProvider?: string;
        advancedSettings?: {
            contextWindow: number;
            enableJudge: boolean;
            models: string[];
        };
    };
}

const DubbingPipeline: React.FC<{
    onRunPipeline: (config: ExtendedPipelineConfig) => Promise<string>;
    onRunStep: (step: string, config: any) => Promise<any>;
    currentProject: any;
    // onSaveProject: (name: string, config: any) => Promise<void>;
}> = ({ onRunPipeline, onRunStep, currentProject }) => {
    const [mode, setMode] = useState<'full' | 'stepwise'>('full');
    const [inputType, setInputType] = useState<'url' | 'video' | 'audio'>('url');
    const [videoUrl, setVideoUrl] = useState('');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [targetLang, setTargetLang] = useState('es');
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState('');
    const [dragActive, setDragActive] = useState(false);

    // Stepwise completion tracking
    const [completedSteps, setCompletedSteps] = useState({
        download: false,
        transcribe: false,
        translate: false,
        synthesize: false,
        combine: false
    });

    // Advanced settings
    const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
    const [transcriptionSettings, setTranscriptionSettings] = useState({
        source: 'whisperx' as 'whisperx' | 'youtube' | 'upload',
        enableDiarization: true,
        language: 'en'
    });

    const [translationSettings, setTranslationSettings] = useState({
        mode: 'simple' as 'simple' | 'advanced',
        simpleModel: 'm2m100_418m',
        cloudProvider: '',
        advancedSettings: {
            contextWindow: 2,
            enableJudge: true,
            models: ['qwen_direct', 'm2m100_1.2b', 'marian']
        }
    });

    const videoInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('video/')) {
                setVideoFile(file);
                setInputType('video');
            } else if (file.type.startsWith('audio/')) {
                setAudioFile(file);
                setInputType('audio');
            }
        }
    };

    const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setVideoFile(file);
        }
    };

    const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAudioFile(file);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const canRunPipeline = () => {
        switch (inputType) {
            case 'url':
                return videoUrl.trim() !== '';
            case 'video':
                return videoFile !== null;
            case 'audio':
                return audioFile !== null;
            default:
                return false;
        }
    };

    const runFullPipeline = async () => {
        if (!canRunPipeline()) return;

        setIsProcessing(true);
        setProgress('Starting full dubbing pipeline...');

        try {
            const config: ExtendedPipelineConfig = {
                inputType,
                videoUrl: inputType === 'url' ? videoUrl : undefined,
                videoFile: inputType === 'video' ? videoFile || undefined : undefined,
                audioFile: inputType === 'audio' ? audioFile || undefined : undefined,
                targetLang,
                outputDir: './output',
                audioSettings: {
                    preventOverlaps: true,
                    minGap: 100,
                    globalCrossfade: false,
                    crossfadeDuration: 150
                },
                textRules: [],
                segmentRules: [],
                transcriptionSettings,
                translationSettings
            };

            const result = await onRunPipeline(config);
            setProgress('Pipeline completed successfully!');
            console.log('Pipeline result:', result);
        } catch (error) {
            setProgress(`Pipeline failed: ${error}`);
            console.error('Pipeline error:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const runStep = async (step: string) => {
        setIsProcessing(true);
        setProgress(`Running ${step}...`);

        try {
            const config = {
                inputType,
                videoUrl,
                videoFile,
                audioFile,
                targetLang,
                transcriptionSettings,
                translationSettings
            };

            const result = await onRunStep(step, config);
            setCompletedSteps(prev => ({ ...prev, [step]: true }));
            setProgress(`${step} completed successfully!`);
            console.log(`${step} result:`, result);
        } catch (error) {
            setProgress(`${step} failed: ${error}`);
            console.error(`${step} error:`, error);
        } finally {
            setIsProcessing(false);
        }
    };

    const InputTypeButton = ({ type, icon: Icon, label, isActive }: {
        type: 'url' | 'video' | 'audio';
        icon: any;
        label: string;
        isActive: boolean;
    }) => (
        <button
            onClick={() => setInputType(type)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${isActive
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
        >
            <Icon size={18} />
            {label}
        </button>
    );

    const StepButton = ({ stepKey, icon: Icon, label, description, canRun }: {
        stepKey: string;
        icon: any;
        label: string;
        description: string;
        canRun: boolean;
    }) => {
        const isCompleted = completedSteps[stepKey as keyof typeof completedSteps];
        const isDisabled = !canRun || isProcessing;

        return (
            <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        {isCompleted ? (
                            <CheckCircle className="text-green-400" size={20} />
                        ) : (
                            <Circle className="text-gray-400" size={20} />
                        )}
                        <Icon size={20} className={isCompleted ? 'text-green-400' : 'text-purple-400'} />
                        <span className="font-medium text-white">{label}</span>
                    </div>
                    <button
                        onClick={() => runStep(stepKey)}
                        disabled={isDisabled}
                        className={`px-3 py-1 rounded text-sm transition-all ${isDisabled
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            : isCompleted
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-purple-600 hover:bg-purple-700 text-white'
                            }`}
                    >
                        {isCompleted ? 'Re-run' : 'Run'}
                    </button>
                </div>
                <p className="text-gray-300 text-sm">{description}</p>
            </div>
        );
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-white mb-2">AI Video Dubbing Pipeline</h1>
                <p className="text-purple-200">Transform videos and audio with AI-powered voice dubbing</p>
            </div>

            {/* Mode Selection */}
            <div className="mb-6">
                <div className="flex gap-2 bg-gray-800 p-1 rounded-lg">
                    <button
                        onClick={() => setMode('full')}
                        className={`flex-1 py-2 px-4 rounded transition-all ${mode === 'full'
                            ? 'bg-purple-600 text-white'
                            : 'text-gray-300 hover:text-white'
                            }`}
                    >
                        <Zap className="inline mr-2" size={16} />
                        Full Pipeline
                    </button>
                    <button
                        onClick={() => setMode('stepwise')}
                        className={`flex-1 py-2 px-4 rounded transition-all ${mode === 'stepwise'
                            ? 'bg-purple-600 text-white'
                            : 'text-gray-300 hover:text-white'
                            }`}
                    >
                        <Layers className="inline mr-2" size={16} />
                        Step-by-Step
                    </button>
                </div>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
                <div className="space-y-6">
                    {/* Input Type Selection */}
                    <div>
                        <label className="block text-sm font-medium text-purple-300 mb-3">
                            Choose Input Type
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            <InputTypeButton
                                type="url"
                                icon={Link}
                                label="Video URL"
                                isActive={inputType === 'url'}
                            />
                            <InputTypeButton
                                type="video"
                                icon={FileVideo}
                                label="Video File"
                                isActive={inputType === 'video'}
                            />
                            <InputTypeButton
                                type="audio"
                                icon={FileAudio}
                                label="Audio File"
                                isActive={inputType === 'audio'}
                            />
                        </div>
                    </div>

                    {/* Input Section */}
                    <div>
                        {inputType === 'url' && (
                            <div>
                                <label className="block text-sm font-medium text-purple-300 mb-2">
                                    YouTube URL or Video ID
                                </label>
                                <input
                                    type="text"
                                    value={videoUrl}
                                    onChange={(e) => setVideoUrl(e.target.value)}
                                    placeholder="https://youtube.com/watch?v=... or video ID"
                                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                                />
                            </div>
                        )}

                        {inputType === 'video' && (
                            <div>
                                <label className="block text-sm font-medium text-purple-300 mb-2">
                                    Upload Video File
                                </label>
                                <div
                                    className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive
                                        ? 'border-purple-500 bg-purple-500/10'
                                        : 'border-gray-600 hover:border-purple-500/50'
                                        }`}
                                    onDragEnter={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDragOver={handleDrag}
                                    onDrop={handleDrop}
                                >
                                    <input
                                        ref={videoInputRef}
                                        type="file"
                                        accept="video/*"
                                        onChange={handleVideoFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    {videoFile ? (
                                        <div className="space-y-2">
                                            <FileVideo className="mx-auto text-purple-400" size={32} />
                                            <p className="text-white font-medium">{videoFile.name}</p>
                                            <p className="text-gray-400 text-sm">{formatFileSize(videoFile.size)}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Upload className="mx-auto text-gray-400" size={32} />
                                            <p className="text-gray-300">Drop video file here or click to browse</p>
                                            <p className="text-gray-500 text-sm">Supports MP4, AVI, MOV, and more</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {inputType === 'audio' && (
                            <div>
                                <label className="block text-sm font-medium text-purple-300 mb-2">
                                    Upload Audio File
                                </label>
                                <div
                                    className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive
                                        ? 'border-purple-500 bg-purple-500/10'
                                        : 'border-gray-600 hover:border-purple-500/50'
                                        }`}
                                    onDragEnter={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDragOver={handleDrag}
                                    onDrop={handleDrop}
                                >
                                    <input
                                        ref={audioInputRef}
                                        type="file"
                                        accept="audio/*"
                                        onChange={handleAudioFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    {audioFile ? (
                                        <div className="space-y-2">
                                            <Volume2 className="mx-auto text-purple-400" size={32} />
                                            <p className="text-white font-medium">{audioFile.name}</p>
                                            <p className="text-gray-400 text-sm">{formatFileSize(audioFile.size)}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Upload className="mx-auto text-gray-400" size={32} />
                                            <p className="text-gray-300">Drop audio file here or click to browse</p>
                                            <p className="text-gray-500 text-sm">Supports MP3, WAV, M4A, and more</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Target Language */}
                    <div>
                        <label className="block text-sm font-medium text-purple-300 mb-2">
                            Target Language
                        </label>
                        <select
                            value={targetLang}
                            onChange={(e) => setTargetLang(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                        >
                            <option value="es">Spanish</option>
                            <option value="fr">French</option>
                            <option value="de">German</option>
                            <option value="it">Italian</option>
                            <option value="pt">Portuguese</option>
                            <option value="ja">Japanese</option>
                            <option value="ko">Korean</option>
                            <option value="zh">Chinese</option>
                            <option value="ru">Russian</option>
                            <option value="ar">Arabic</option>
                            <option value="hi">Hindi</option>
                            <option value="nl">Dutch</option>
                        </select>
                    </div>

                    {/* Advanced Settings Toggle */}
                    <div>
                        <button
                            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                            className="flex items-center gap-2 text-purple-300 hover:text-purple-200 transition-colors"
                        >
                            {showAdvancedSettings ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                            <Settings2 size={20} />
                            Advanced Settings
                        </button>
                    </div>

                    {/* Advanced Settings Panel */}
                    {showAdvancedSettings && (
                        <div className="bg-gray-700/30 rounded-lg p-4 space-y-4">
                            {/* Transcription Settings */}
                            <div>
                                <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                                    <Mic size={18} />
                                    Transcription Settings
                                </h3>
                                <div className="grid gap-4">
                                    <div>
                                        <label className="block text-sm text-purple-300 mb-2">Source</label>
                                        <select
                                            value={transcriptionSettings.source}
                                            onChange={(e) => setTranscriptionSettings(prev => ({
                                                ...prev,
                                                source: e.target.value as any
                                            }))}
                                            className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500 focus:border-purple-500 focus:outline-none"
                                        >
                                            <option value="whisperx">WhisperX (Local AI)</option>
                                            <option value="youtube">YouTube Official Captions</option>
                                            <option value="upload">Upload Transcript File</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id="diarization"
                                            checked={transcriptionSettings.enableDiarization}
                                            onChange={(e) => setTranscriptionSettings(prev => ({
                                                ...prev,
                                                enableDiarization: e.target.checked
                                            }))}
                                            className="w-4 h-4 text-purple-600 bg-gray-600 border-gray-500 rounded focus:ring-purple-500"
                                        />
                                        <label htmlFor="diarization" className="text-sm text-gray-300">
                                            Enable Speaker Diarization
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Translation Settings */}
                            <div>
                                <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                                    <Languages size={18} />
                                    Translation Settings
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-purple-300 mb-2">Translation Mode</label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setTranslationSettings(prev => ({
                                                    ...prev,
                                                    mode: 'simple'
                                                }))}
                                                className={`px-3 py-2 rounded text-sm transition-all ${translationSettings.mode === 'simple'
                                                    ? 'bg-purple-600 text-white'
                                                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                                    }`}
                                            >
                                                <Target size={16} className="inline mr-1" />
                                                Simple
                                            </button>
                                            <button
                                                onClick={() => setTranslationSettings(prev => ({
                                                    ...prev,
                                                    mode: 'advanced'
                                                }))}
                                                className={`px-3 py-2 rounded text-sm transition-all ${translationSettings.mode === 'advanced'
                                                    ? 'bg-purple-600 text-white'
                                                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                                    }`}
                                            >
                                                <Brain size={16} className="inline mr-1" />
                                                Advanced
                                            </button>
                                        </div>
                                    </div>

                                    {translationSettings.mode === 'simple' && (
                                        <div className="grid gap-4">
                                            <div>
                                                <label className="block text-sm text-purple-300 mb-2">Model</label>
                                                <select
                                                    value={translationSettings.simpleModel}
                                                    onChange={(e) => setTranslationSettings(prev => ({
                                                        ...prev,
                                                        simpleModel: e.target.value
                                                    }))}
                                                    className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500 focus:border-purple-500 focus:outline-none"
                                                >
                                                    <optgroup label="Local Models">
                                                        <option value="m2m100_418m">M2M100-418M (Fast)</option>
                                                        <option value="m2m100_1.2b">M2M100-1.2B (Better Quality)</option>
                                                        <option value="marian">MarianMT (Efficient)</option>
                                                        <option value="local_llm">Local LLM (Qwen)</option>
                                                    </optgroup>
                                                    <optgroup label="Cloud Models">
                                                        <option value="google_translate">Google Translate API</option>
                                                        <option value="deepl">DeepL API</option>
                                                    </optgroup>
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {translationSettings.mode === 'advanced' && (
                                        <div className="bg-gray-600/30 rounded p-3 space-y-3">
                                            <div className="flex items-center gap-2 text-yellow-400 text-sm">
                                                <Brain size={16} />
                                                Multi-model translation with context awareness and LLM supervision
                                            </div>
                                            <div>
                                                <label className="block text-sm text-purple-300 mb-2">Context Window</label>
                                                <select
                                                    value={translationSettings.advancedSettings?.contextWindow}
                                                    onChange={(e) => setTranslationSettings(prev => ({
                                                        ...prev,
                                                        advancedSettings: {
                                                            ...prev.advancedSettings!,
                                                            contextWindow: parseInt(e.target.value)
                                                        }
                                                    }))}
                                                    className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500 focus:border-purple-500 focus:outline-none"
                                                >
                                                    <option value={1}>1 segment</option>
                                                    <option value={2}>2 segments</option>
                                                    <option value={3}>3 segments</option>
                                                    <option value={4}>4 segments</option>
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    id="enableJudge"
                                                    checked={translationSettings.advancedSettings?.enableJudge}
                                                    onChange={(e) => setTranslationSettings(prev => ({
                                                        ...prev,
                                                        advancedSettings: {
                                                            ...prev.advancedSettings!,
                                                            enableJudge: e.target.checked
                                                        }
                                                    }))}
                                                    className="w-4 h-4 text-purple-600 bg-gray-600 border-gray-500 rounded focus:ring-purple-500"
                                                />
                                                <label htmlFor="enableJudge" className="text-sm text-gray-300">
                                                    Enable LLM Translation Judge (Qwen)
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Pipeline Mode Content */}
                    {mode === 'full' ? (
                        <button
                            onClick={runFullPipeline}
                            disabled={isProcessing || !canRunPipeline()}
                            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2"
                        >
                            <Play size={20} />
                            {isProcessing ? 'Processing...' : 'Run Full Dubbing Pipeline'}
                        </button>
                    ) : (
                        <div className="space-y-4">
                            <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                                <Layers size={18} />
                                Pipeline Steps
                            </h3>

                            <StepButton
                                stepKey="download"
                                icon={Download}
                                label="Download/Import Media"
                                description="Download video from URL or process uploaded file"
                                canRun={canRunPipeline()}
                            />

                            <StepButton
                                stepKey="transcribe"
                                icon={FileText}
                                label="Generate Transcript"
                                description="Extract and transcribe speech from audio track"
                                canRun={completedSteps.download}
                            />

                            <StepButton
                                stepKey="translate"
                                icon={Languages}
                                label="Translate Text"
                                description="Translate transcript to target language"
                                canRun={completedSteps.transcribe}
                            />

                            <StepButton
                                stepKey="synthesize"
                                icon={Volume2}
                                label="Generate Voice"
                                description="Create AI voice synthesis for translated text"
                                canRun={completedSteps.translate}
                            />

                            <StepButton
                                stepKey="extract-background-audio"
                                icon={Split}
                                label="Extract Background Audio"
                                description="Extract background audio from original video"
                                canRun={completedSteps.translate}
                            />

                            <StepButton
                                stepKey="combine"
                                icon={Video}
                                label="Final Assembly"
                                description="Combine new voice audio + original background audio with original video timing"
                                canRun={completedSteps.synthesize}
                            />
                        </div>
                    )}

                    {/* Progress Display */}
                    {progress && (
                        <div className="bg-gray-700/50 rounded-lg p-4 mt-4">
                            <p className="text-white font-mono text-sm">{progress}</p>
                            {isProcessing && (
                                <div className="mt-2 w-full bg-gray-600 rounded-full h-2">
                                    <div className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full animate-pulse" style={{ width: '45%' }}></div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Info Section */}
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                        <h3 className="text-blue-300 font-medium mb-2">Pipeline Process:</h3>
                        <ul className="text-blue-200 text-sm space-y-1">
                            <li>• Extract audio from video/URL (if applicable)</li>
                            <li>• Transcribe original speech using WhisperX or other sources</li>
                            <li>• Translate to target language (simple or advanced mode)</li>
                            <li>• Generate AI voice synthesis with timing synchronization</li>
                            <li>• Combine new audio with original video timing</li>
                            <li>• Export final dubbed content with quality optimization</li>
                        </ul>
                    </div>

                    {/* Step Results Display (for stepwise mode) */}
                    {mode === 'stepwise' && Object.values(completedSteps).some(Boolean) && (
                        <div className="bg-gray-700/30 rounded-lg p-4">
                            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                                <CheckCircle size={18} className="text-green-400" />
                                Completed Steps Results
                            </h3>
                            <div className="space-y-2 text-sm">
                                {completedSteps.download && (
                                    <div className="flex items-center gap-2 text-green-300">
                                        <CheckCircle size={16} />
                                        Media file processed and ready for transcription
                                    </div>
                                )}
                                {completedSteps.transcribe && (
                                    <div className="flex items-center gap-2 text-green-300">
                                        <CheckCircle size={16} />
                                        Transcript generated with {transcriptionSettings.enableDiarization ? 'speaker diarization' : 'single speaker'}
                                    </div>
                                )}
                                {completedSteps.translate && (
                                    <div className="flex items-center gap-2 text-green-300">
                                        <CheckCircle size={16} />
                                        Translation completed using {translationSettings.mode} mode
                                    </div>
                                )}
                                {completedSteps.synthesize && (
                                    <div className="flex items-center gap-2 text-green-300">
                                        <CheckCircle size={16} />
                                        Voice synthesis completed with timing alignment
                                    </div>
                                )}
                                {completedSteps.combine && (
                                    <div className="flex items-center gap-2 text-green-300">
                                        <CheckCircle size={16} />
                                        Final dubbed video exported successfully
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Quick Actions (for stepwise mode) */}
                    {mode === 'stepwise' && (
                        <div className="flex gap-2 flex-wrap">
                            <button
                                onClick={() => setCompletedSteps({
                                    download: false,
                                    transcribe: false,
                                    translate: false,
                                    synthesize: false,
                                    combine: false
                                })}
                                disabled={isProcessing}
                                className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Reset Progress
                            </button>

                            {Object.values(completedSteps).every(Boolean) && (
                                <button
                                    onClick={() => {
                                        setProgress('All steps completed! Check output directory for final dubbed video.');
                                    }}
                                    className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-all flex items-center gap-1"
                                >
                                    <CheckCircle size={16} />
                                    View Results
                                </button>
                            )}
                        </div>
                    )}

                    {/* Translation Mode Info */}
                    {translationSettings.mode === 'advanced' && (
                        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                            <h3 className="text-yellow-300 font-medium mb-2 flex items-center gap-2">
                                <Brain size={18} />
                                Advanced Translation Process:
                            </h3>
                            <ul className="text-yellow-200 text-sm space-y-1">
                                <li>• Multiple translation models run in parallel (M2M100, MarianMT, Qwen)</li>
                                <li>• Context window provides {translationSettings.advancedSettings?.contextWindow} segments of surrounding dialogue</li>
                                <li>• LLM judge {translationSettings.advancedSettings?.enableJudge ? 'evaluates and selects' : 'is disabled for'} best translation</li>
                                <li>• Maintains consistency in terminology, tone, and speaker voice across segments</li>
                                <li>• Higher quality but longer processing time compared to simple mode</li>
                            </ul>
                        </div>
                    )}

                    {/* Cloud Service Warnings */}
                    {(translationSettings.simpleModel.includes('google') || translationSettings.simpleModel.includes('deepl')) && (
                        <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4">
                            <h3 className="text-orange-300 font-medium mb-2 flex items-center gap-2">
                                <Cloud size={18} />
                                Cloud Service Notice:
                            </h3>
                            <p className="text-orange-200 text-sm">
                                Using cloud translation services requires API keys and may incur costs.
                                Ensure your API credentials are configured in the settings before running the pipeline.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DubbingPipeline;