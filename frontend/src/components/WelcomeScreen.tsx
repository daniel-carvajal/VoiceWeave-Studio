import React, { useState, useRef } from 'react';
import { useProject } from '../hooks/useProject';
import {
    Plus,
    Folder,
    Play,
    Clock,
    Video,
    FileAudio,
    Link,
    Upload,
    ChevronRight,
    Trash2
} from 'lucide-react';

const WelcomeScreen: React.FC = () => {
    const {
        recentProjects,
        isLoading,
        error,
        createProject,
        loadProject,
        clearError,
        deleteProject,
        showProjectInFolder
    } = useProject();

    const [showCreateForm, setShowCreateForm] = useState(false);
    const [sourceType, setSourceType] = useState<'youtube' | 'video' | 'audio'>('youtube');
    const [source, setSource] = useState('');
    const [customName, setCustomName] = useState('');
    const [targetLang, setTargetLang] = useState('es');
    const [dragActive, setDragActive] = useState(false);

    const videoInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);

    // Auto-populate name from source
    const getAutoName = () => {
        if (sourceType === 'youtube') {
            return '';  // ✅ Start empty for YouTube
        } else if (source) {
            const filename = source.split('/').pop() || source;
            return filename.replace(/\.[^/.]+$/, ''); // Remove extension
        }
        return '';
    };

    // Update name field when source changes
    React.useEffect(() => {
        if (!customName) {
            setCustomName(getAutoName());
        }
    }, [source, sourceType]);

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
            setSource(file.name);  // ✅ Just use file.name like in DubbingPipeline

            if (file.type.startsWith('video/')) {
                setSourceType('video');
            } else if (file.type.startsWith('audio/')) {
                setSourceType('audio');
            }

            // Auto-populate name from filename
            const filename = file.name.replace(/\.[^/.]+$/, '');
            setCustomName(filename);
        }
    };

    const handleFileSelect = (type: 'video' | 'audio') => {
        const input = type === 'video' ? videoInputRef.current : audioInputRef.current;
        input?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'audio') => {
        const file = e.target.files?.[0];
        if (file) {
            setSource(file.name);  // ✅ Just use file.name like in DubbingPipeline
            setSourceType(type);

            // Auto-populate name from filename
            const filename = file.name.replace(/\.[^/.]+$/, '');
            setCustomName(filename);
        }
    };

    const handleCreateProject = async () => {
        if (!source.trim()) return;

        try {
            // Use customName if provided, otherwise let backend auto-generate
            const finalName = customName.trim() || '';
            const project = await createProject(sourceType, source, targetLang, finalName);
            if (project) {
                console.log('Project created:', project);
            }
        } catch (err) {
            console.error('Failed to create project:', err);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getProgressPercent = (project: any) => {
        if (!project.completedSteps) return 0;
        const steps = Object.values(project.completedSteps);
        const completed = steps.filter(Boolean).length;
        return Math.round((completed / steps.length) * 100);
    };

    const getSourceIcon = (sourceType: string) => {
        switch (sourceType) {
            case 'youtube': return <Link size={16} className="text-red-400" />;
            case 'video': return <Video size={16} className="text-blue-400" />;
            case 'audio': return <FileAudio size={16} className="text-green-400" />;
            default: return <Folder size={16} className="text-gray-400" />;
        }
    };

    return (
        <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
                <h1 className="text-5xl font-bold text-white mb-4">Welcome to Kokoro Studio</h1>
                <p className="text-xl text-purple-200">AI-powered video dubbing made simple</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Create New Project */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
                    <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-3">
                        <Plus size={24} className="text-purple-400" />
                        Create New Project
                    </h2>

                    {!showCreateForm ? (
                        <button
                            onClick={() => setShowCreateForm(true)}
                            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 px-6 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all flex items-center justify-center gap-3 text-lg"
                        >
                            <Plus size={20} />
                            Start New Dubbing Project
                        </button>
                    ) : (
                        <div className="space-y-6">
                            {/* Source Type Selection */}
                            <div>
                                <label className="block text-sm font-medium text-purple-300 mb-3">
                                    Choose Input Type
                                </label>
                                <div className="flex gap-2">
                                    {[
                                        { type: 'youtube' as const, icon: Link, label: 'YouTube URL' },
                                        { type: 'video' as const, icon: Video, label: 'Video File' },
                                        { type: 'audio' as const, icon: FileAudio, label: 'Audio File' }
                                    ].map(({ type, icon: Icon, label }) => (
                                        <button
                                            key={type}
                                            onClick={() => setSourceType(type)}
                                            className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-all ${sourceType === type
                                                ? 'bg-purple-600 text-white'
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                }`}
                                        >
                                            <Icon size={16} />
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Source Input */}
                            <div>
                                {sourceType === 'youtube' ? (
                                    <div>
                                        <label className="block text-sm font-medium text-purple-300 mb-2">
                                            YouTube URL
                                        </label>
                                        <input
                                            type="text"
                                            value={source}
                                            onChange={(e) => setSource(e.target.value)}
                                            placeholder="https://youtube.com/watch?v=..."
                                            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-medium text-purple-300 mb-2">
                                            {sourceType === 'video' ? 'Upload Video File' : 'Upload Audio File'}
                                        </label>
                                        <div
                                            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${dragActive
                                                ? 'border-purple-500 bg-purple-500/10'
                                                : 'border-gray-600 hover:border-purple-500/50'
                                                }`}
                                            onDragEnter={handleDrag}
                                            onDragLeave={handleDrag}
                                            onDragOver={handleDrag}
                                            onDrop={handleDrop}
                                            onClick={() => handleFileSelect(sourceType)}
                                        >
                                            <input
                                                ref={sourceType === 'video' ? videoInputRef : audioInputRef}
                                                type="file"
                                                accept={sourceType === 'video' ? 'video/*' : 'audio/*'}
                                                onChange={(e) => handleFileChange(e, sourceType)}
                                                className="hidden"
                                            />
                                            {source ? (
                                                <div className="space-y-2">
                                                    {sourceType === 'video' ? (
                                                        <Video className="mx-auto text-purple-400" size={32} />
                                                    ) : (
                                                        <FileAudio className="mx-auto text-purple-400" size={32} />
                                                    )}
                                                    <p className="text-white font-medium">{source.split('/').pop()}</p>
                                                    <p className="text-gray-400 text-sm">Click to change file</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <Upload className="mx-auto text-gray-400" size={32} />
                                                    <p className="text-gray-300">
                                                        Drop {sourceType} file here or click to browse
                                                    </p>
                                                    <p className="text-gray-500 text-sm">
                                                        Supports {sourceType === 'video' ? 'MP4, AVI, MOV, and more' : 'MP3, WAV, M4A, and more'}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Project Name */}
                            <div>
                                <label className="block text-sm font-medium text-purple-300 mb-2">
                                    Project Name (optional)
                                </label>
                                <input
                                    type="text"
                                    value={customName}
                                    onChange={(e) => setCustomName(e.target.value)}
                                    placeholder="My awesome project..."
                                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                                />
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
                                </select>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowCreateForm(false)}
                                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateProject}
                                    disabled={!source.trim() || isLoading}
                                    className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? 'Creating...' : 'Create Project'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Recent Projects */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
                    <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-3">
                        <Clock size={24} className="text-purple-400" />
                        Recent Projects
                    </h2>

                    {recentProjects && recentProjects.length > 0 ? (
                        <div className="space-y-3">
                            {recentProjects.map((project) => (
                                <div
                                    key={project.id}
                                    className="bg-gray-700/50 rounded-lg p-4 hover:bg-gray-700/70 transition-all group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div
                                            className="flex-1 cursor-pointer"
                                            onClick={async () => {
                                                console.log('Project clicked:', project.id);
                                                try {
                                                    console.log('About to call loadProject...');
                                                    await loadProject(project.id);
                                                    console.log('loadProject completed successfully');
                                                } catch (err) {
                                                    console.error('Failed to load project:', err);
                                                }
                                            }}
                                        >
                                            <div className="flex items-center gap-3 mb-2">
                                                {getSourceIcon(project.sourceType)}
                                                <h3 className="font-medium text-white group-hover:text-purple-200 transition-colors">
                                                    {project.name}
                                                </h3>
                                                <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs font-semibold">
                                                    {project.targetLanguage.toUpperCase()}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-4 text-sm text-gray-400">
                                                <div className="flex items-center gap-1">
                                                    <Clock size={14} />
                                                    {formatDate(project.lastModified)}
                                                </div>
                                                <div>
                                                    Progress: {getProgressPercent(project)}%
                                                </div>
                                            </div>

                                            <div className="w-full bg-gray-600 rounded-full h-1.5 mt-2">
                                                <div
                                                    className="bg-gradient-to-r from-purple-500 to-blue-500 h-1.5 rounded-full transition-all"
                                                    style={{ width: `${getProgressPercent(project)}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-2 ml-4">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    showProjectInFolder(project.id);
                                                }}
                                                className="p-2 text-gray-400 hover:text-blue-400 transition-colors rounded-lg hover:bg-gray-600/50"
                                                title="Show in folder"
                                            >
                                                <Folder size={16} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm(`Delete project "${project.name}"? This cannot be undone.`)) {
                                                        deleteProject(project.id);
                                                    }
                                                }}
                                                className="p-2 text-gray-400 hover:text-red-400 transition-colors rounded-lg hover:bg-gray-600/50"
                                                title="Delete project"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            <ChevronRight
                                                size={20}
                                                className="text-gray-400 group-hover:text-purple-400 transition-colors cursor-pointer"
                                                onClick={() => loadProject(project.id)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <Folder size={48} className="mx-auto mb-4 text-gray-500" />
                            <h3 className="text-lg font-semibold text-gray-400 mb-2">No Recent Projects</h3>
                            <p className="text-gray-500">Create your first project to get started</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mt-6 bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div className="text-red-400">{error}</div>
                        <button
                            onClick={clearError}
                            className="text-red-400 hover:text-red-300"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            {/* Getting Started Info */}
            {(!recentProjects || recentProjects.length === 0) && !showCreateForm && (
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6 mt-8">
                    <h3 className="text-blue-300 font-semibold mb-3">🚀 Getting Started</h3>
                    <ul className="text-blue-200 text-sm space-y-2">
                        <li>• Choose your input: YouTube URL, video file, or audio file</li>
                        <li>• Give your project a memorable name</li>
                        <li>• Select target language for dubbing</li>
                        <li>• Our AI will transcribe, translate, and generate new voice audio</li>
                        <li>• Get a fully dubbed video with natural timing and pronunciation</li>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default WelcomeScreen;