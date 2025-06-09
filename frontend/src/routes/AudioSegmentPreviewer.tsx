import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Square, Search, Upload, FileAudio, Volume2, Clock } from 'lucide-react';

interface AudioSegment {
    start: number;
    end: number;
    original_text: string;
    translated_text: string;
    target_duration: number;
    words?: Array<{ word: string; start: number; end: number }>;
    audio_file: string;
}

interface AudioStatus {
    status: 'testing' | 'success' | 'error' | 'none';
    message: string;
    workingPath?: string;
}

const AudioSegmentPreviewer: React.FC = () => {
    const [loadedSegments, setLoadedSegments] = useState<AudioSegment[]>([]);
    const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
    const [currentPreviewAudio, setCurrentPreviewAudio] = useState<HTMLAudioElement | null>(null);
    const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
    const [audioStatuses, setAudioStatuses] = useState<Record<number, AudioStatus>>({});
    const [globalStatus, setGlobalStatus] = useState<{ message: string; type: 'success' | 'warning' | 'error' | 'info' }>({ message: '', type: 'info' });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const previewTimeouts = useRef<NodeJS.Timeout[]>([]);

    // Helper function to normalize audio file paths
    const normalizeAudioPath = (audioFile: string): string[] => {
        if (!audioFile) return [];

        const filename = audioFile.split('/').pop() || '';

        return [
            `output/kokoro_audio/${filename}`,
            audioFile,
            audioFile.replace(/^\.\//, ''),
            filename
        ];
    };

    // Enhanced audio testing function
    const testAudioPath = (paths: string[]): Promise<{ success: boolean; workingPath?: string; error?: string }> => {
        return new Promise((resolve) => {
            let currentIndex = 0;

            const tryNextPath = () => {
                if (currentIndex >= paths.length) {
                    resolve({ success: false, error: `All paths failed: ${paths.slice(0, 3).join(', ')}...` });
                    return;
                }

                const currentPath = paths[currentIndex];
                const audio = new Audio();

                const timeout = setTimeout(() => {
                    audio.src = '';
                    currentIndex++;
                    tryNextPath();
                }, 2000);

                audio.oncanplaythrough = () => {
                    clearTimeout(timeout);
                    resolve({ success: true, workingPath: currentPath });
                };

                audio.onerror = () => {
                    clearTimeout(timeout);
                    currentIndex++;
                    tryNextPath();
                };

                audio.onabort = () => {
                    clearTimeout(timeout);
                    currentIndex++;
                    tryNextPath();
                };

                audio.src = currentPath;
                audio.load();
            };

            tryNextPath();
        });
    };

    const handleFileLoad = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result as string) as AudioSegment[];
                setLoadedSegments(data);
                setGlobalStatus({ message: `Loaded ${data.length} segments`, type: 'success' });

                // Test all audio files
                setTimeout(() => {
                    data.forEach((_, index) => testSegmentAudio(index));
                }, 100);
            } catch (error) {
                setGlobalStatus({ message: 'Error: Invalid JSON file', type: 'error' });
            }
        };
        reader.readAsText(file);
    };

    const loadExampleSegments = () => {
        const exampleSegments: AudioSegment[] = [
            {
                start: 0.5,
                end: 3.2,
                original_text: "You've probably heard of artificial intelligence identifying objects and images.",
                translated_text: "Probablemente has oído hablar de inteligencia artificial identificando objetos e imágenes.",
                target_duration: 2.7,
                audio_file: "output/kokoro_audio/chunk_000.mp3"
            },
            {
                start: 3.2,
                end: 6.8,
                original_text: "Like distinguishing a cat from a dog.",
                translated_text: "Como distinguir un gato de un perro.",
                target_duration: 3.6,
                audio_file: "output/kokoro_audio/chunk_001.mp3"
            },
            {
                start: 6.8,
                end: 10.5,
                original_text: "But what about deep learning and machine learning?",
                translated_text: "Pero ¿qué pasa con el deep-learning y el machine-learning?",
                target_duration: 3.7,
                audio_file: "output/kokoro_audio/chunk_002.mp3"
            },
            {
                start: 10.5,
                end: 14.2,
                original_text: "These are powerful forms of artificial intelligence.",
                translated_text: "Estas son formas poderosas de inteligencia artificial.",
                target_duration: 3.7,
                audio_file: "output/kokoro_audio/chunk_003.mp3"
            }
        ];

        setLoadedSegments(exampleSegments);
        setGlobalStatus({ message: 'Loaded example segments', type: 'info' });

        setTimeout(() => {
            exampleSegments.forEach((_, index) => testSegmentAudio(index));
        }, 100);
    };

    const testSegmentAudio = async (index: number) => {
        const segment = loadedSegments[index];
        if (!segment?.audio_file) {
            setAudioStatuses(prev => ({ ...prev, [index]: { status: 'error', message: 'No audio file' } }));
            return;
        }

        setAudioStatuses(prev => ({ ...prev, [index]: { status: 'testing', message: 'Testing...' } }));

        const paths = normalizeAudioPath(segment.audio_file);
        const result = await testAudioPath(paths);

        if (result.success && result.workingPath) {
            setAudioStatuses(prev => ({
                ...prev,
                [index]: { status: 'success', message: 'Audio Ready', workingPath: result.workingPath }
            }));
            // Update segment with working path
            setLoadedSegments(prev => prev.map((seg, i) =>
                i === index ? { ...seg, audio_file: result.workingPath! } : seg
            ));
        } else {
            setAudioStatuses(prev => ({
                ...prev,
                [index]: { status: 'error', message: result.error || 'Failed to load' }
            }));
        }
    };

    const playSegment = async (index: number) => {
        const segment = loadedSegments[index];
        const audioStatus = audioStatuses[index];

        if (!segment?.audio_file || audioStatus?.status !== 'success') {
            setGlobalStatus({ message: 'No audio file available for this segment', type: 'warning' });
            return;
        }

        stopAllAudio();

        const audio = new Audio(segment.audio_file);
        setCurrentPreviewAudio(audio);

        try {
            await audio.play();
            setGlobalStatus({
                message: `Playing: "${segment.original_text.substring(0, 40)}..."`,
                type: 'success'
            });

            audio.onended = () => {
                setCurrentPreviewAudio(null);
            };
        } catch (error) {
            setGlobalStatus({
                message: `Cannot play audio: ${error}`,
                type: 'error'
            });
            setCurrentPreviewAudio(null);
            testSegmentAudio(index);
        }
    };

    const pauseSegment = () => {
        if (currentPreviewAudio) {
            currentPreviewAudio.pause();
        }
    };

    const stopAllAudio = () => {
        if (currentPreviewAudio) {
            currentPreviewAudio.pause();
            currentPreviewAudio.currentTime = 0;
            setCurrentPreviewAudio(null);
        }
    };

    const previewAllSegments = () => {
        if (isPreviewPlaying) {
            stopPreview();
        } else {
            startPreviewFromSegment(0);
        }
    };

    const startPreviewFromSegment = (startIndex: number) => {
        stopPreview();

        if (loadedSegments.length === 0) {
            setGlobalStatus({ message: 'No segments to preview', type: 'warning' });
            return;
        }

        setIsPreviewPlaying(true);
        setCurrentSegmentIndex(startIndex);
        setGlobalStatus({ message: `Starting preview from segment ${startIndex + 1}`, type: 'info' });

        playNextSegment(startIndex);
    };

    const playNextSegment = async (index: number) => {
        if (!isPreviewPlaying || index >= loadedSegments.length) {
            if (isPreviewPlaying) {
                setGlobalStatus({ message: 'Preview complete!', type: 'success' });
                stopPreview();
            }
            return;
        }

        const segment = loadedSegments[index];
        const audioStatus = audioStatuses[index];

        setCurrentSegmentIndex(index);

        if (segment.audio_file && audioStatus?.status === 'success' && isPreviewPlaying) {
            const audio = new Audio(segment.audio_file);
            setCurrentPreviewAudio(audio);

            try {
                await audio.play();
                setGlobalStatus({
                    message: `Playing segment ${index + 1}: "${segment.original_text.substring(0, 40)}..."`,
                    type: 'info'
                });

                audio.onended = () => {
                    if (isPreviewPlaying) {
                        const timeout = setTimeout(() => playNextSegment(index + 1), 300);
                        previewTimeouts.current.push(timeout);
                    }
                };
            } catch {
                if (isPreviewPlaying) {
                    const timeout = setTimeout(() => playNextSegment(index + 1), 100);
                    previewTimeouts.current.push(timeout);
                }
            }
        } else {
            if (isPreviewPlaying) {
                const timeout = setTimeout(() => playNextSegment(index + 1), 100);
                previewTimeouts.current.push(timeout);
            }
        }
    };

    const stopPreview = () => {
        setIsPreviewPlaying(false);
        setCurrentSegmentIndex(0);
        stopAllAudio();

        previewTimeouts.current.forEach(timeout => clearTimeout(timeout));
        previewTimeouts.current = [];

        setGlobalStatus({ message: 'Preview stopped', type: 'info' });
    };

    const calculateTotalDuration = (segments: AudioSegment[]) => {
        if (segments.length === 0) return 0;
        return Math.max(...segments.map(s => s.end));
    };

    const getStatusBadge = (status: AudioStatus | undefined) => {
        if (!status) return { className: 'bg-gray-500/20 text-gray-400', text: '❌ No Audio' };

        switch (status.status) {
            case 'testing':
                return { className: 'bg-blue-500/20 text-blue-400', text: '🔄 Testing...' };
            case 'success':
                return { className: 'bg-green-500/20 text-green-400', text: '✅ Audio Ready' };
            case 'error':
                return { className: 'bg-red-500/20 text-red-400', text: '❌ Audio Failed' };
            default:
                return { className: 'bg-gray-500/20 text-gray-400', text: '❌ No Audio' };
        }
    };

    const getGlobalStatusStyle = () => {
        switch (globalStatus.type) {
            case 'success':
                return 'bg-green-500/20 text-green-400';
            case 'warning':
                return 'bg-yellow-500/20 text-yellow-400';
            case 'error':
                return 'bg-red-500/20 text-red-400';
            default:
                return 'bg-blue-500/20 text-blue-400';
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-white mb-2">🎵 Audio Segment Previewer</h1>
                <p className="text-purple-200">Load and preview your dubbed audio segments with enhanced debugging</p>
            </div>

            {/* Load Segments Section */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30 mb-6">
                <h3 className="text-xl font-semibold text-white mb-6">
                    Load Audio Segments
                </h3>

                <div className="flex flex-wrap gap-3 items-center mb-4">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileLoad}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all flex items-center gap-2"
                    >
                        <Upload size={18} />
                        Load {"{video_id}_segments.json"}
                    </button>

                    <button
                        onClick={loadExampleSegments}
                        className="bg-gray-700 text-gray-300 px-4 py-3 rounded-lg font-semibold hover:bg-gray-600 transition-all"
                    >
                        🎭 Examples
                    </button>

                    {globalStatus.message && (
                        <span className={`ml-auto px-4 py-2 rounded-full text-sm font-semibold ${getGlobalStatusStyle()}`}>
                            {globalStatus.message}
                        </span>
                    )}
                </div>

                {loadedSegments.length > 0 && (
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                        <div className="text-green-400 font-semibold mb-2">
                            ✅ Loaded {loadedSegments.length} audio segments
                        </div>
                        <p className="text-sm text-gray-300">
                            <strong>Video Duration:</strong> {calculateTotalDuration(loadedSegments).toFixed(1)}s |
                            <strong> Audio Files:</strong> {Object.values(audioStatuses).filter(s => s.status === 'success').length}/{loadedSegments.length} available
                        </p>
                    </div>
                )}
            </div>

            {/* Segments Timeline */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
                <div className="flex justify-between items-center flex-wrap gap-4 mb-6">
                    <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                        <Volume2 className="text-purple-400" size={20} />
                        Audio Segments Timeline
                    </h3>
                    <div className="flex gap-3 items-center">
                        <button
                            onClick={previewAllSegments}
                            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all flex items-center gap-2"
                        >
                            {isPreviewPlaying ? <Pause size={16} /> : <Play size={16} />}
                            Preview All
                        </button>
                        <button
                            onClick={stopPreview}
                            className="bg-gray-700 text-gray-300 px-4 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-all flex items-center gap-2"
                        >
                            <Square size={16} />
                            Stop
                        </button>
                        <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm font-semibold">
                            Duration: {calculateTotalDuration(loadedSegments).toFixed(1)}s
                        </span>
                        {isPreviewPlaying && (
                            <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-semibold">
                                Segment {currentSegmentIndex + 1}/{loadedSegments.length}
                            </span>
                        )}
                    </div>
                </div>

                {loadedSegments.length === 0 ? (
                    <div className="text-center py-16">
                        <Volume2 className="mx-auto text-gray-500 mb-4" size={48} />
                        <h3 className="text-xl font-semibold text-gray-400 mb-2">No Audio Segments Loaded</h3>
                        <p className="text-gray-500">Load a {"{video_id}_segments.json"} file to preview your dubbed audio segments</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {loadedSegments.map((segment, index) => {
                            const duration = segment.target_duration || (segment.end - segment.start);
                            const status = audioStatuses[index];
                            const statusBadge = getStatusBadge(status);
                            const isCurrentSegment = isPreviewPlaying && currentSegmentIndex === index;

                            return (
                                <div
                                    key={index}
                                    className={`bg-gray-700/50 rounded-lg p-6 border-l-4 transition-all hover:bg-gray-700/70 ${isCurrentSegment ? 'border-l-green-500 bg-green-900/20' : 'border-l-purple-500'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-gray-600 text-white text-sm font-bold px-3 py-1 rounded-full">
                                                {index + 1}
                                            </div>
                                            <div className="bg-purple-600 text-white text-xs font-semibold px-2 py-1 rounded">
                                                {segment.start.toFixed(1)}s - {segment.end.toFixed(1)}s
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusBadge.className}`}>
                                                {statusBadge.text}
                                            </span>
                                        </div>
                                        {isCurrentSegment && (
                                            <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-semibold">
                                                Playing...
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                                        <div className="bg-gray-600/30 p-4 rounded-lg border-l-3 border-l-gray-500">
                                            <div className="text-xs font-semibold text-purple-300 uppercase tracking-wide mb-2">
                                                Original English
                                            </div>
                                            <div className="text-gray-200 leading-relaxed">{segment.original_text}</div>
                                        </div>
                                        <div className="bg-green-900/20 p-4 rounded-lg border-l-3 border-l-green-500">
                                            <div className="text-xs font-semibold text-purple-300 uppercase tracking-wide mb-2">
                                                Translated Spanish
                                            </div>
                                            <div className="text-gray-200 leading-relaxed">
                                                {segment.translated_text || 'Not translated yet'}
                                            </div>
                                        </div>
                                    </div>

                                    {status && status.status !== 'none' && (
                                        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 mb-4 font-mono text-xs text-yellow-300">
                                            <strong>Audio Path:</strong> {segment.audio_file}<br />
                                            <strong>Status:</strong> {status.message}
                                        </div>
                                    )}

                                    <div className="flex gap-3 items-center pt-4 border-t border-gray-600">
                                        <button
                                            onClick={() => playSegment(index)}
                                            disabled={status?.status !== 'success'}
                                            className="bg-gray-700 text-gray-300 px-4 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Play size={16} />
                                            Play
                                        </button>
                                        <button
                                            onClick={pauseSegment}
                                            className="bg-gray-700 text-gray-300 px-4 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-all flex items-center gap-2"
                                        >
                                            <Pause size={16} />
                                            Pause
                                        </button>
                                        <button
                                            onClick={() => testSegmentAudio(index)}
                                            className="bg-gray-700 text-gray-300 px-4 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-all flex items-center gap-2"
                                        >
                                            <Search size={16} />
                                            Test Audio
                                        </button>
                                        <button
                                            onClick={() => startPreviewFromSegment(index)}
                                            className="bg-gray-700 text-gray-300 px-4 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-all"
                                            title="Start preview from this segment"
                                        >
                                            Start Here
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AudioSegmentPreviewer;