import React, { useState } from 'react';
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
    Settings,
    Trash2
} from 'lucide-react';

const ProjectManager: React.FC = () => {
    const {
        currentProject,
        recentProjects,
        isLoading,
        error,
        createProject,
        loadProject,
        clearError
    } = useProject();

    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [sourceType, setSourceType] = useState<'youtube' | 'video' | 'audio'>('youtube');
    const [source, setSource] = useState('');
    const [targetLang, setTargetLang] = useState('es');

    const handleCreateProject = async () => {
        if (!source.trim()) return;

        try {
            await createProject(sourceType, source, targetLang);
            setShowCreateDialog(false);
            setSource('');
        } catch (err) {
            console.error('Failed to create project:', err);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString();
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

    if (currentProject) {
        // Show current project details
        return (
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
                <h2 className="text-xl font-semibold text-white mb-4">Current Project</h2>

                <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-medium text-white">{currentProject.name}</h3>
                        <div className="flex items-center gap-2">
                            {getSourceIcon(currentProject.sourceType)}
                            <span className="text-sm text-gray-300">{currentProject.targetLanguage.toUpperCase()}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 mb-3">
                        <div className="text-sm text-gray-400">
                            Created: {formatDate(currentProject.created)}
                        </div>
                        <div className="text-sm text-gray-400">
                            Progress: {getProgressPercent(currentProject)}%
                        </div>
                    </div>

                    <div className="w-full bg-gray-600 rounded-full h-2">
                        <div
                            className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full"
                            style={{ width: `${getProgressPercent(currentProject)}%` }}
                        />
                    </div>
                </div>

                <button
                    onClick={() => window.location.href = '/dubbing'}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2"
                >
                    <Play size={20} />
                    Continue Project
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-white mb-2">Welcome to Kokoro Studio</h1>
                <p className="text-purple-200">AI-powered video dubbing made simple</p>
            </div>

            {/* Create New Project */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30 mb-6">
                <h2 className="text-xl font-semibold text-white mb-4">Create New Project</h2>

                {!showCreateDialog ? (
                    <button
                        onClick={() => setShowCreateDialog(true)}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2"
                    >
                        <Plus size={20} />
                        Start New Dubbing Project
                    </button>
                ) : (
                    <div className="space-y-4">
                        {/* Source Type Selection */}
                        <div>
                            <label className="block text-sm font-medium text-purple-300 mb-2">
                                Input Type
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
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${sourceType === type
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
                            <label className="block text-sm font-medium text-purple-300 mb-2">
                                {sourceType === 'youtube' ? 'YouTube URL' : 'File Path'}
                            </label>
                            <input
                                type="text"
                                value={source}
                                onChange={(e) => setSource(e.target.value)}
                                placeholder={
                                    sourceType === 'youtube'
                                        ? 'https://youtube.com/watch?v=...'
                                        : 'Path to your file...'
                                }
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
                                onClick={() => setShowCreateDialog(false)}
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
            {recentProjects && recentProjects.length > 0 && (
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
                    <h2 className="text-xl font-semibold text-white mb-4">Recent Projects</h2>

                    <div className="space-y-3">
                        {recentProjects.map((project) => (
                            <div
                                key={project.id}
                                className="bg-gray-700/50 rounded-lg p-4 hover:bg-gray-700/70 transition-all cursor-pointer"
                                onClick={() => loadProject(project.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            {getSourceIcon(project.sourceType)}
                                            <h3 className="font-medium text-white">{project.name}</h3>
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
                                                className="bg-gradient-to-r from-purple-500 to-blue-500 h-1.5 rounded-full"
                                                style={{ width: `${getProgressPercent(project)}%` }}
                                            />
                                        </div>
                                    </div>

                                    <ChevronRight size={20} className="text-gray-400" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="mt-6 bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div className="text-red-400">{error}</div>
                        <button
                            onClick={clearError}
                            className="text-red-400 hover:text-red-300"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Getting Started Info */}
            {(!recentProjects || recentProjects.length === 0) && !showCreateDialog && (
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6 mt-6">
                    <h3 className="text-blue-300 font-semibold mb-3">🚀 Getting Started</h3>
                    <ul className="text-blue-200 text-sm space-y-2">
                        <li>• Choose your input: YouTube URL, video file, or audio file</li>
                        <li>• Select target language for dubbing</li>
                        <li>• Our AI will transcribe, translate, and generate new voice audio</li>
                        <li>• Get a fully dubbed video with natural timing and pronunciation</li>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ProjectManager;