import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Download, Save, Trash2, Plus, X, Volume2, Settings } from 'lucide-react';

// Define types and interfaces
interface Voice {
    name: string;
    weight: number;
}

interface Preset {
    id: number;
    name: string;
    voices: Voice[];
    voiceString: string;
    speed: number;
    langCode: string;
    createdAt: string;
}

const KokoroVoiceManager: React.FC = () => {
    const [voices] = useState<string[]>([
        // American English
        'af_heart', 'af_alloy', 'af_aoede', 'af_bella', 'af_jessica', 'af_kore',
        'af_nicole', 'af_nova', 'af_river', 'af_sarah', 'af_sky',
        'am_adam', 'am_echo', 'am_eric', 'am_fenrir', 'am_liam', 'am_michael',
        'am_onyx', 'am_puck', 'am_santa',
        // British English
        'bf_alice', 'bf_emma', 'bf_isabella', 'bf_lily',
        'bm_daniel', 'bm_fable', 'bm_george', 'bm_lewis',
        // Japanese
        'jf_alpha', 'jf_gongitsune', 'jf_nezumi', 'jf_tebukuro', 'jm_kumo',
        // Mandarin Chinese
        'zf_xiaobei', 'zf_xiaoni', 'zf_xiaoxiao', 'zf_xiaoyi',
        'zm_yunjian', 'zm_yunxi', 'zm_yunxia', 'zm_yunyang',
        // Spanish
        'ef_dora', 'em_alex', 'em_santa',
        // French
        'ff_siwis',
        // Hindi
        'hf_alpha', 'hf_beta', 'hm_omega', 'hm_psi',
        // Italian
        'if_sara', 'im_nicola',
        // Brazilian Portuguese
        'pf_dora', 'pm_alex', 'pm_santa'
    ]);

    const [inputText, setInputText] = useState<string>('Hello, this is a test of the Kokoro voice synthesis system.');
    const [selectedVoices, setSelectedVoices] = useState<Voice[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [speed, setSpeed] = useState<number>(1.0);
    const [langCode, setLangCode] = useState<string>('e');
    const [responseFormat, setResponseFormat] = useState<string>('mp3');
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [savedPresets, setSavedPresets] = useState<Preset[]>([]);
    const [presetName, setPresetName] = useState<string>('');
    const [showSaveDialog, setShowSaveDialog] = useState<boolean>(false);
    const [currentAudio, setCurrentAudio] = useState<string | null>(null);
    const [playbackTime, setPlaybackTime] = useState<number>(0);
    const [duration, setDuration] = useState<number>(0);

    const audioRef = useRef<HTMLAudioElement | null>(null);

    const voiceCategories: Record<string, string[]> = {
        '🇺🇸 American English (Female)': voices.filter(v => v.startsWith('af_')),
        '🇺🇸 American English (Male)': voices.filter(v => v.startsWith('am_')),
        '🇬🇧 British English (Female)': voices.filter(v => v.startsWith('bf_')),
        '🇬🇧 British English (Male)': voices.filter(v => v.startsWith('bm_')),
        '🇯🇵 Japanese (Female)': voices.filter(v => v.startsWith('jf_')),
        '🇯🇵 Japanese (Male)': voices.filter(v => v.startsWith('jm_')),
        '🇨🇳 Chinese (Female)': voices.filter(v => v.startsWith('zf_')),
        '🇨🇳 Chinese (Male)': voices.filter(v => v.startsWith('zm_')),
        '🇪🇸 Spanish': voices.filter(v => v.startsWith('ef_') || v.startsWith('em_')),
        '🇫🇷 French': voices.filter(v => v.startsWith('ff_')),
        '🇮🇳 Hindi': voices.filter(v => v.startsWith('hf_') || v.startsWith('hm_')),
        '🇮🇹 Italian': voices.filter(v => v.startsWith('if_') || v.startsWith('im_')),
        '🇧🇷 Portuguese': voices.filter(v => v.startsWith('pf_') || v.startsWith('pm_'))
    };

    const filteredVoices = voices.filter((voice: string) =>
        voice.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const addVoice = (voiceName: string): void => {
        if (!selectedVoices.find(v => v.name === voiceName)) {
            setSelectedVoices([...selectedVoices, { name: voiceName, weight: 1.0 }]);
        }
    };

    const removeVoice = (voiceName: string): void => {
        setSelectedVoices(selectedVoices.filter(v => v.name !== voiceName));
    };

    const updateVoiceWeight = (voiceName: string, weight: string): void => {
        setSelectedVoices(selectedVoices.map(v =>
            v.name === voiceName ? { ...v, weight: parseFloat(weight) } : v
        ));
    };

    const generateVoiceString = (): string => {
        if (selectedVoices.length === 0) return '';
        if (selectedVoices.length === 1) return selectedVoices[0].name;
        return selectedVoices.map(v => `${v.name}(${v.weight})`).join('+');
    };

    const generateSpeech = async (): Promise<void> => {
        if (!inputText.trim() || selectedVoices.length === 0) return;

        setIsLoading(true);
        const voiceString = generateVoiceString();

        const payload = {
            model: "kokoro",
            voice: voiceString,
            input: inputText,
            response_format: responseFormat,
            speed: speed,
            lang_code: langCode
        };

        try {
            const response = await fetch('http://localhost:8880/v1/audio/speech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);

                if (currentAudio) {
                    URL.revokeObjectURL(currentAudio);
                }

                setCurrentAudio(audioUrl);

                if (audioRef.current) {
                    audioRef.current.src = audioUrl;
                    audioRef.current.load();
                }
            } else {
                alert('Error generating speech. Make sure your Kokoro API is running on localhost:8880');
            }
        } catch (error) {
            alert('Connection error. Make sure your Kokoro API is running on localhost:8880');
            console.error('Error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const togglePlayback = (): void => {
        if (!audioRef.current || !currentAudio) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const savePreset = (): void => {
        if (!presetName.trim() || selectedVoices.length === 0) return;

        const preset: Preset = {
            id: Date.now(),
            name: presetName,
            voices: selectedVoices,
            voiceString: generateVoiceString(),
            speed,
            langCode,
            createdAt: new Date().toISOString()
        };

        setSavedPresets([...savedPresets, preset]);
        setPresetName('');
        setShowSaveDialog(false);

        // In a real app, you'd save this to a file or backend
        console.log('Preset saved:', preset);
    };

    const loadPreset = (preset: Preset): void => {
        setSelectedVoices(preset.voices);
        setSpeed(preset.speed);
        setLangCode(preset.langCode);
    };

    const deletePreset = (presetId: number): void => {
        setSavedPresets(savedPresets.filter(p => p.id !== presetId));
    };

    const downloadAudio = (): void => {
        if (!currentAudio) return;

        const a = document.createElement('a');
        a.href = currentAudio;
        a.download = `kokoro-voice-${Date.now()}.${responseFormat}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const updateTime = (): void => {
        if (audioRef.current) {
            setPlaybackTime(audioRef.current.currentTime);
            setDuration(audioRef.current.duration || 0);
        }
    };

    const seekAudio = (e: React.MouseEvent<HTMLDivElement>): void => {
        if (!audioRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audioRef.current.currentTime = percent * duration;
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (audio) {
            const handleEnded = () => setIsPlaying(false);
            const handlePlay = () => setIsPlaying(true);
            const handlePause = () => setIsPlaying(false);

            audio.addEventListener('ended', handleEnded);
            audio.addEventListener('play', handlePlay);
            audio.addEventListener('pause', handlePause);
            audio.addEventListener('timeupdate', updateTime);

            return () => {
                audio.removeEventListener('ended', handleEnded);
                audio.removeEventListener('play', handlePlay);
                audio.removeEventListener('pause', handlePause);
                audio.removeEventListener('timeupdate', updateTime);
            };
        }
    }, [currentAudio]);

    const formatTime = (time: number): string => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">Kokoro Voice Manager</h1>
                    <p className="text-purple-200">Advanced voice mixing and preset management</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Voice Selection Panel */}
                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
                        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                            <Volume2 size={20} />
                            Voice Library
                        </h2>

                        <input
                            type="text"
                            placeholder="Search voices..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none mb-4"
                        />

                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {Object.entries(voiceCategories).map(([category, categoryVoices]) => {
                                const visibleVoices = categoryVoices.filter(voice =>
                                    voice.toLowerCase().includes(searchTerm.toLowerCase())
                                );

                                if (visibleVoices.length === 0) return null;

                                return (
                                    <div key={category}>
                                        <h3 className="text-sm font-medium text-purple-300 mb-2">{category}</h3>
                                        <div className="space-y-1 mb-4">
                                            {visibleVoices.map(voice => (
                                                <button
                                                    key={voice}
                                                    onClick={() => addVoice(voice)}
                                                    disabled={!!selectedVoices.find(v => v.name === voice)}
                                                    className="w-full text-left px-3 py-2 bg-gray-700/50 text-white rounded-lg hover:bg-purple-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                                                >
                                                    {voice}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Main Control Panel */}
                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
                        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                            <Settings size={20} />
                            Voice Mixer
                        </h2>

                        {/* Selected Voices */}
                        <div className="mb-6">
                            <h3 className="text-sm font-medium text-purple-300 mb-3">Selected Voices ({selectedVoices.length})</h3>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {selectedVoices.map(voice => (
                                    <div key={voice.name} className="flex items-center gap-2 bg-gray-700/50 rounded-lg p-3">
                                        <span className="text-white text-sm flex-1">{voice.name}</span>
                                        <input
                                            type="number"
                                            value={voice.weight}
                                            onChange={(e) => updateVoiceWeight(voice.name, e.target.value)}
                                            min="0.1"
                                            max="2.0"
                                            step="0.1"
                                            className="w-16 px-2 py-1 bg-gray-600 text-white rounded text-sm"
                                        />
                                        <button
                                            onClick={() => removeVoice(voice.name)}
                                            className="text-red-400 hover:text-red-300 transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Voice String Preview */}
                        {selectedVoices.length > 0 && (
                            <div className="mb-4">
                                <h3 className="text-sm font-medium text-purple-300 mb-2">Voice String</h3>
                                <div className="bg-gray-700 rounded-lg p-3 text-xs text-gray-300 font-mono break-all">
                                    {generateVoiceString()}
                                </div>
                            </div>
                        )}

                        {/* Text Input */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-purple-300 mb-2">Text to Synthesize</label>
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                rows={4}
                                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none resize-none"
                                placeholder="Enter text to convert to speech..."
                            />
                        </div>

                        {/* Controls */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-purple-300 mb-2">Speed</label>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="2.0"
                                    step="0.1"
                                    value={speed}
                                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                                    className="w-full"
                                />
                                <div className="text-center text-sm text-gray-400">{speed}x</div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-purple-300 mb-2">Language</label>
                                <select
                                    value={langCode}
                                    onChange={(e) => setLangCode(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
                                >
                                    <option value="e">English</option>
                                    <option value="j">Japanese</option>
                                    <option value="z">Chinese</option>
                                    <option value="s">Spanish</option>
                                    <option value="f">French</option>
                                    <option value="h">Hindi</option>
                                    <option value="i">Italian</option>
                                    <option value="p">Portuguese</option>
                                </select>
                            </div>
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={generateSpeech}
                            disabled={isLoading || selectedVoices.length === 0 || !inputText.trim()}
                            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-700 hover:to-blue-700 transition-all"
                        >
                            {isLoading ? 'Generating...' : 'Generate Speech'}
                        </button>

                        {/* Audio Player */}
                        {currentAudio && (
                            <div className="mt-6 bg-gray-700/50 rounded-lg p-4">
                                <div className="flex items-center gap-4 mb-3">
                                    <button
                                        onClick={togglePlayback}
                                        className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-full transition-colors"
                                    >
                                        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                                    </button>
                                    <div className="text-sm text-gray-300">
                                        {formatTime(playbackTime)} / {formatTime(duration)}
                                    </div>
                                    <button
                                        onClick={downloadAudio}
                                        className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-full transition-colors ml-auto"
                                    >
                                        <Download size={16} />
                                    </button>
                                </div>
                                <div
                                    className="w-full h-2 bg-gray-600 rounded-full cursor-pointer"
                                    onClick={seekAudio}
                                >
                                    <div
                                        className="h-2 bg-purple-500 rounded-full transition-all"
                                        style={{ width: `${duration ? (playbackTime / duration) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <audio ref={audioRef} style={{ display: 'none' }} />
                    </div>

                    {/* Presets Panel */}
                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
                        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                            <Save size={20} />
                            Voice Presets
                        </h2>

                        {/* Save Current Configuration */}
                        <div className="mb-6">
                            <button
                                onClick={() => setShowSaveDialog(true)}
                                disabled={selectedVoices.length === 0}
                                className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus size={16} />
                                Save Current Mix
                            </button>
                        </div>

                        {/* Saved Presets */}
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {savedPresets.map(preset => (
                                <div key={preset.id} className="bg-gray-700/50 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-medium text-white">{preset.name}</h3>
                                        <button
                                            onClick={() => deletePreset(preset.id)}
                                            className="text-red-400 hover:text-red-300 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <div className="text-xs text-gray-400 mb-2">
                                        {preset.voices.length} voices • Speed: {preset.speed}x
                                    </div>
                                    <div className="text-xs text-gray-500 font-mono mb-3 break-all">
                                        {preset.voiceString}
                                    </div>
                                    <button
                                        onClick={() => loadPreset(preset)}
                                        className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded text-sm transition-colors"
                                    >
                                        Load Preset
                                    </button>
                                </div>
                            ))}
                        </div>

                        {savedPresets.length === 0 && (
                            <div className="text-center text-gray-400 py-8">
                                <Save size={32} className="mx-auto mb-2 opacity-50" />
                                <p>No saved presets yet</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Save Dialog */}
                {showSaveDialog && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
                            <h3 className="text-xl font-semibold text-white mb-4">Save Voice Preset</h3>
                            <input
                                type="text"
                                value={presetName}
                                onChange={(e) => setPresetName(e.target.value)}
                                placeholder="Enter preset name..."
                                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none mb-4"
                                autoFocus
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowSaveDialog(false)}
                                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={savePreset}
                                    disabled={!presetName.trim()}
                                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default KokoroVoiceManager;