import { Play, Volume2, Settings, Video, Mic, Folder, Upload, Link, FileAudio, FileVideo } from 'lucide-react';
import { useState, useRef } from 'react';

interface PipelineConfig {
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
}

const TranslationDubber: React.FC<{
    onRunPipeline: (config: PipelineConfig) => Promise<string>;
    currentProject: any;
    onSaveProject: (name: string, config: any) => Promise<void>;
}> = ({ onRunPipeline, currentProject, onSaveProject }) => {
    const [inputType, setInputType] = useState<'url' | 'video' | 'audio'>('url');
    const [videoUrl, setVideoUrl] = useState('');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [targetLang, setTargetLang] = useState('es');
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState('');
    const [dragActive, setDragActive] = useState(false);
    
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

    const runPipeline = async () => {
        if (!canRunPipeline()) return;

        setIsProcessing(true);
        setProgress('Starting dubbing pipeline...');

        try {
            const config: PipelineConfig = {
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
                segmentRules: []
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

    const InputTypeButton = ({ type, icon: Icon, label, isActive }: {
        type: 'url' | 'video' | 'audio';
        icon: any;
        label: string;
        isActive: boolean;
    }) => (
        <button
            onClick={() => setInputType(type)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                isActive 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
        >
            <Icon size={18} />
            {label}
        </button>
    );

    return (
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-white mb-2">AI Video Dubbing Pipeline</h1>
                <p className="text-purple-200">Transform videos and audio with AI-powered voice dubbing</p>
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
                                    className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                                        dragActive 
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
                                    className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                                        dragActive 
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

                    {/* Process Button */}
                    <button
                        onClick={runPipeline}
                        disabled={isProcessing || !canRunPipeline()}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2"
                    >
                        <Play size={20} />
                        {isProcessing ? 'Processing...' : 'Start Dubbing Pipeline'}
                    </button>

                    {/* Progress Display */}
                    {progress && (
                        <div className="bg-gray-700/50 rounded-lg p-4 mt-4">
                            <p className="text-white font-mono text-sm">{progress}</p>
                            {isProcessing && (
                                <div className="mt-2 w-full bg-gray-600 rounded-full h-2">
                                    <div className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full animate-pulse" style={{width: '45%'}}></div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Info Section */}
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                        <h3 className="text-blue-300 font-medium mb-2">Pipeline Process:</h3>
                        <ul className="text-blue-200 text-sm space-y-1">
                            <li>• Extract audio from video/URL (if applicable)</li>
                            <li>• Transcribe original speech</li>
                            <li>• Translate to target language</li>
                            <li>• Generate AI voice synthesis</li>
                            <li>• Sync audio with video timing</li>
                            <li>• Export final dubbed content</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TranslationDubber;