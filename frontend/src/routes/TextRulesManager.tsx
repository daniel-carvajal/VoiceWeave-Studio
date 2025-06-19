import { useState, useRef } from 'react';
import { Plus, Download, Upload, Trash2, Edit, FileText } from 'lucide-react';

interface TextRule {
    id: string;
    originalText: string;
    replacementText: string;
    language: string;
    priority: 'high' | 'medium' | 'low';
    caseSensitive: boolean;
    createdAt: Date;
}

const TextRulesManager: React.FC = () => {
    const [textRules, setTextRules] = useState<TextRule[]>([]);
    const [originalText, setOriginalText] = useState('');
    const [replacementText, setReplacementText] = useState('');
    const [language, setLanguage] = useState('es');
    const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [editingRule, setEditingRule] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const showStatus = (message: string, type: 'success' | 'warning' | 'info' = 'info') => {
        setStatusMessage(message);
        setTimeout(() => setStatusMessage(''), 3000);
    };

    const addTextRule = () => {
        if (!originalText.trim() || !replacementText.trim()) {
            showStatus('Please fill in both original and replacement text', 'warning');
            return;
        }

        const newRule: TextRule = {
            id: Date.now().toString(),
            originalText: originalText.trim(),
            replacementText: replacementText.trim(),
            language,
            priority,
            caseSensitive,
            createdAt: new Date()
        };

        if (editingRule) {
            setTextRules(prev => prev.map(rule =>
                rule.id === editingRule ? { ...newRule, id: editingRule } : rule
            ));
            setEditingRule(null);
            showStatus('Rule updated successfully', 'success');
        } else {
            setTextRules(prev => [...prev, newRule]);
            showStatus('Rule added successfully', 'success');
        }

        // Reset form
        setOriginalText('');
        setReplacementText('');
        setLanguage('es');
        setPriority('medium');
        setCaseSensitive(false);
    };

    const editRule = (rule: TextRule) => {
        setOriginalText(rule.originalText);
        setReplacementText(rule.replacementText);
        setLanguage(rule.language);
        setPriority(rule.priority);
        setCaseSensitive(rule.caseSensitive);
        setEditingRule(rule.id);
        showStatus('Editing rule - click Add Rule to save changes', 'info');
    };

    const deleteRule = (id: string) => {
        setTextRules(prev => prev.filter(rule => rule.id !== id));
        showStatus('Rule deleted', 'info');
    };

    const loadExampleRules = () => {
        const examples: Omit<TextRule, 'id' | 'createdAt'>[] = [
            {
                originalText: 'machine learning',
                replacementText: 'machine-learning',
                language: 'es',
                priority: 'high',
                caseSensitive: false
            },
            {
                originalText: 'deep learning',
                replacementText: 'deep-learning',
                language: 'es',
                priority: 'high',
                caseSensitive: false
            },
            {
                originalText: 'AI',
                replacementText: 'A-I',
                language: 'all',
                priority: 'medium',
                caseSensitive: true
            },
            {
                originalText: 'weekend',
                replacementText: 'week-end',
                language: 'fr',
                priority: 'low',
                caseSensitive: false
            }
        ];

        const newRules = examples.map(rule => ({
            ...rule,
            id: Date.now().toString() + Math.random(),
            createdAt: new Date()
        }));

        setTextRules(prev => [...prev, ...newRules]);
        showStatus('Example rules loaded', 'success');
    };

    const exportRules = () => {
        const dataStr = JSON.stringify(textRules, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'text-rules.json';
        link.click();
        URL.revokeObjectURL(url);
        showStatus('Rules exported successfully', 'success');
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const rawData = JSON.parse(e.target?.result as string);

                // Handle your specific JSON structure with textRules array
                let rulesArray: any[] = [];

                if (rawData.textRules && Array.isArray(rawData.textRules)) {
                    // Your format: { textRules: [...], version: "1.0", ... }
                    rulesArray = rawData.textRules;
                } else if (Array.isArray(rawData)) {
                    // Direct array format
                    rulesArray = rawData;
                } else {
                    // Single object format
                    rulesArray = [rawData];
                }

                // Convert your format to our component format
                const importedRules: TextRule[] = rulesArray
                    .filter((item: any) => item && typeof item === 'object')
                    .map((item: any) => ({
                        id: item.id ? item.id.toString() : `imported-${Date.now()}-${Math.random()}`,
                        originalText: item.original || item.originalText || '',
                        replacementText: item.replacement || item.replacementText || '',
                        language: item.language || 'es',
                        priority: (item.priority === 'high' || item.priority === 'medium' || item.priority === 'low')
                            ? item.priority : 'medium',
                        caseSensitive: Boolean(item.caseSensitive),
                        createdAt: item.created ? new Date(item.created) : (item.createdAt ? new Date(item.createdAt) : new Date())
                    }))
                    .filter(rule => rule.originalText && rule.replacementText);

                if (importedRules.length === 0) {
                    showStatus('No valid rules found in file', 'warning');
                    return;
                }

                setTextRules(prev => [...prev, ...importedRules]);
                showStatus(`Imported ${importedRules.length} rules from ${rawData.type || 'file'}`, 'success');
            } catch (error) {
                console.error('Import error:', error);
                showStatus('Error importing rules - invalid JSON file', 'warning');
            }
        };
        reader.readAsText(file);
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return 'border-red-500';
            case 'medium': return 'border-yellow-500';
            case 'low': return 'border-green-500';
            default: return 'border-purple-500';
        }
    };

    const getPriorityBadge = (priority: string) => {
        switch (priority) {
            case 'high': return 'bg-red-500/20 text-red-400';
            case 'medium': return 'bg-yellow-500/20 text-yellow-400';
            case 'low': return 'bg-green-500/20 text-green-400';
            default: return 'bg-purple-500/20 text-purple-400';
        }
    };

    const getLanguageLabel = (lang: string) => {
        const labels: Record<string, string> = {
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'it': 'Italian',
            'pt': 'Portuguese',
            'all': 'All Languages'
        };
        return labels[lang] || lang;
    };

    const sortedRules = [...textRules].sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    return (
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-white mb-2">Text Rules Manager</h1>
                <p className="text-purple-200">Create global text replacement rules for better pronunciation in dubbed content</p>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30 mb-6">
                <h3 className="text-xl font-semibold text-white mb-6">Add New Text Rule</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-purple-300 mb-2">
                            Original Text
                        </label>
                        <input
                            type="text"
                            value={originalText}
                            onChange={(e) => setOriginalText(e.target.value)}
                            placeholder="e.g., machine learning"
                            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-purple-300 mb-2">
                            Replacement Text
                        </label>
                        <input
                            type="text"
                            value={replacementText}
                            onChange={(e) => setReplacementText(e.target.value)}
                            placeholder="e.g., machine-learning"
                            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-purple-300 mb-2">
                            Target Language
                        </label>
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                        >
                            <option value="es">Spanish (es)</option>
                            <option value="fr">French (fr)</option>
                            <option value="de">German (de)</option>
                            <option value="it">Italian (it)</option>
                            <option value="pt">Portuguese (pt)</option>
                            <option value="all">All Languages</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-purple-300 mb-2">
                            Priority
                        </label>
                        <select
                            value={priority}
                            onChange={(e) => setPriority(e.target.value as 'high' | 'medium' | 'low')}
                            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                        >
                            <option value="high">High (applied first)</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low (applied last)</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-3 mb-6">
                    <input
                        type="checkbox"
                        id="case-sensitive"
                        checked={caseSensitive}
                        onChange={(e) => setCaseSensitive(e.target.checked)}
                        className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                    />
                    <label htmlFor="case-sensitive" className="text-purple-300">
                        Case sensitive matching
                    </label>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                    <button
                        onClick={addTextRule}
                        className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all flex items-center gap-2"
                    >
                        <Plus size={20} />
                        {editingRule ? 'Update Rule' : 'Add Rule'}
                    </button>

                    <button
                        onClick={exportRules}
                        disabled={textRules.length === 0}
                        className="bg-gray-700 text-gray-300 px-4 py-3 rounded-lg font-semibold hover:bg-gray-600 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        <Download size={18} />
                        Export
                    </button>

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-gray-700 text-gray-300 px-4 py-3 rounded-lg font-semibold hover:bg-gray-600 transition-all flex items-center gap-2"
                    >
                        <Upload size={18} />
                        Import
                    </button>

                    <button
                        onClick={loadExampleRules}
                        className="bg-gray-700 text-gray-300 px-4 py-3 rounded-lg font-semibold hover:bg-gray-600 transition-all"
                    >
                        🎭 Examples
                    </button>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileImport}
                        className="hidden"
                    />

                    {statusMessage && (
                        <span className="ml-auto text-green-400 text-sm font-medium">
                            {statusMessage}
                        </span>
                    )}
                </div>
            </div>

            {/* Example Rules Info */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6 mb-6">
                <h4 className="text-blue-300 font-semibold mb-4">💡 Common Text Rule Examples</h4>
                <div className="space-y-2 text-sm">
                    <div className="bg-blue-800/20 rounded-lg p-3">
                        <strong className="text-blue-200">Spanish:</strong> <span className="text-gray-300">"machine learning" → "machine-learning" (prevents awkward pauses)</span>
                    </div>
                    <div className="bg-blue-800/20 rounded-lg p-3">
                        <strong className="text-blue-200">Any Language:</strong> <span className="text-gray-300">"AI" → "A-I" (spells out abbreviations)</span>
                    </div>
                    <div className="bg-blue-800/20 rounded-lg p-3">
                        <strong className="text-blue-200">French:</strong> <span className="text-gray-300">"weekend" → "week-end" (localized spelling)</span>
                    </div>
                </div>
            </div>

            {/* Rules List */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
                <h3 className="text-xl font-semibold text-white mb-6">
                    Active Text Rules ({textRules.length})
                </h3>

                {textRules.length === 0 ? (
                    <div className="text-center py-12">
                        <FileText size={48} className="mx-auto mb-4 text-gray-500" />
                        <h3 className="text-lg font-semibold text-gray-400 mb-2">No Text Rules Defined</h3>
                        <p className="text-gray-500">Add your first text replacement rule above to get started</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {sortedRules.map((rule) => (
                            <div
                                key={rule.id}
                                className={`bg-gray-700/50 rounded-lg p-6 border-l-4 ${getPriorityColor(rule.priority)} hover:bg-gray-700/70 transition-all`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityBadge(rule.priority)}`}>
                                                {rule.priority.toUpperCase()}
                                            </span>
                                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300">
                                                {getLanguageLabel(rule.language)}
                                            </span>
                                            {rule.caseSensitive && (
                                                <span className="px-2 py-1 rounded text-xs bg-gray-600 text-gray-300">
                                                    Case Sensitive
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-lg font-semibold text-white mb-1">
                                            "{rule.originalText}"
                                        </div>
                                        <div className="text-lg text-purple-300 font-medium">
                                            → "{rule.replacementText}"
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => editRule(rule)}
                                            className="p-2 text-gray-400 hover:text-blue-400 transition-colors"
                                            title="Edit rule"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button
                                            onClick={() => deleteRule(rule.id)}
                                            className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                                            title="Delete rule"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="text-xs text-gray-500">
                                    Created: {rule.createdAt.toLocaleDateString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TextRulesManager;