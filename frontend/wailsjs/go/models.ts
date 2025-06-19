export namespace main {
	
	export class AdvancedTranslationSettings {
	    contextWindow: number;
	    enableJudge: boolean;
	    models: string[];
	
	    static createFrom(source: any = {}) {
	        return new AdvancedTranslationSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.contextWindow = source["contextWindow"];
	        this.enableJudge = source["enableJudge"];
	        this.models = source["models"];
	    }
	}
	export class AppSettings {
	    defaultProjectsPath: string;
	    autoCleanup: string;
	    showOnboarding: boolean;
	    recentProjects: string[];
	    exportLocation: string;
	    customExportPath?: string;
	
	    static createFrom(source: any = {}) {
	        return new AppSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.defaultProjectsPath = source["defaultProjectsPath"];
	        this.autoCleanup = source["autoCleanup"];
	        this.showOnboarding = source["showOnboarding"];
	        this.recentProjects = source["recentProjects"];
	        this.exportLocation = source["exportLocation"];
	        this.customExportPath = source["customExportPath"];
	    }
	}
	export class AudioSettings {
	    preventOverlaps: boolean;
	    minGap: number;
	    globalCrossfade: boolean;
	    crossfadeDuration: number;
	    effectsPreset: string;
	
	    static createFrom(source: any = {}) {
	        return new AudioSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.preventOverlaps = source["preventOverlaps"];
	        this.minGap = source["minGap"];
	        this.globalCrossfade = source["globalCrossfade"];
	        this.crossfadeDuration = source["crossfadeDuration"];
	        this.effectsPreset = source["effectsPreset"];
	    }
	}
	export class CleanupSettings {
	    mode: string;
	    keepIntermediateFiles: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CleanupSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.mode = source["mode"];
	        this.keepIntermediateFiles = source["keepIntermediateFiles"];
	    }
	}
	export class CompletedSteps {
	    download: boolean;
	    transcribe: boolean;
	    translate: boolean;
	    synthesize: boolean;
	    combine: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CompletedSteps(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.download = source["download"];
	        this.transcribe = source["transcribe"];
	        this.translate = source["translate"];
	        this.synthesize = source["synthesize"];
	        this.combine = source["combine"];
	    }
	}
	export class FileReference {
	    path: string;
	    isLinked: boolean;
	    originalPath?: string;
	    size?: number;
	    lastModified?: string;
	
	    static createFrom(source: any = {}) {
	        return new FileReference(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.isLinked = source["isLinked"];
	        this.originalPath = source["originalPath"];
	        this.size = source["size"];
	        this.lastModified = source["lastModified"];
	    }
	}
	export class FileReferences {
	    videoFile?: FileReference;
	    audioFile?: FileReference;
	    segmentsFile?: string;
	    finalAudio?: string;
	    finalVideo?: string;
	
	    static createFrom(source: any = {}) {
	        return new FileReferences(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.videoFile = this.convertValues(source["videoFile"], FileReference);
	        this.audioFile = this.convertValues(source["audioFile"], FileReference);
	        this.segmentsFile = source["segmentsFile"];
	        this.finalAudio = source["finalAudio"];
	        this.finalVideo = source["finalVideo"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PipelineConfig {
	    videoUrl: string;
	    targetLang: string;
	    outputDir: string;
	    audioSettings: Record<string, any>;
	    textRules: any[];
	    segmentRules: any[];
	
	    static createFrom(source: any = {}) {
	        return new PipelineConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.videoUrl = source["videoUrl"];
	        this.targetLang = source["targetLang"];
	        this.outputDir = source["outputDir"];
	        this.audioSettings = source["audioSettings"];
	        this.textRules = source["textRules"];
	        this.segmentRules = source["segmentRules"];
	    }
	}
	export class SegmentRule {
	    id: string;
	    type: string;
	    conditions: Record<string, any>;
	    actions: Record<string, any>;
	    enabled: boolean;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new SegmentRule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.conditions = source["conditions"];
	        this.actions = source["actions"];
	        this.enabled = source["enabled"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class TextRule {
	    id: string;
	    originalText: string;
	    replacementText: string;
	    language: string;
	    priority: string;
	    caseSensitive: boolean;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new TextRule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.originalText = source["originalText"];
	        this.replacementText = source["replacementText"];
	        this.language = source["language"];
	        this.priority = source["priority"];
	        this.caseSensitive = source["caseSensitive"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class TranslationSettings {
	    mode: string;
	    simpleModel: string;
	    cloudProvider?: string;
	    advancedSettings?: AdvancedTranslationSettings;
	
	    static createFrom(source: any = {}) {
	        return new TranslationSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.mode = source["mode"];
	        this.simpleModel = source["simpleModel"];
	        this.cloudProvider = source["cloudProvider"];
	        this.advancedSettings = this.convertValues(source["advancedSettings"], AdvancedTranslationSettings);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TranscriptionSettings {
	    source: string;
	    enableDiarization: boolean;
	    language: string;
	    model?: string;
	
	    static createFrom(source: any = {}) {
	        return new TranscriptionSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.source = source["source"];
	        this.enableDiarization = source["enableDiarization"];
	        this.language = source["language"];
	        this.model = source["model"];
	    }
	}
	export class ProjectSettings {
	    transcription: TranscriptionSettings;
	    translation: TranslationSettings;
	    audio: AudioSettings;
	    cleanup: CleanupSettings;
	
	    static createFrom(source: any = {}) {
	        return new ProjectSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.transcription = this.convertValues(source["transcription"], TranscriptionSettings);
	        this.translation = this.convertValues(source["translation"], TranslationSettings);
	        this.audio = this.convertValues(source["audio"], AudioSettings);
	        this.cleanup = this.convertValues(source["cleanup"], CleanupSettings);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ProjectConfig {
	    id: string;
	    name: string;
	    created: string;
	    lastModified: string;
	    version: number;
	    sourceType: string;
	    sourceUrl?: string;
	    videoId?: string;
	    originalFilename?: string;
	    targetLanguage: string;
	    completedSteps: CompletedSteps;
	    fileReferences: FileReferences;
	    settings: ProjectSettings;
	    textRules: TextRule[];
	    segmentRules: SegmentRule[];
	
	    static createFrom(source: any = {}) {
	        return new ProjectConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.created = source["created"];
	        this.lastModified = source["lastModified"];
	        this.version = source["version"];
	        this.sourceType = source["sourceType"];
	        this.sourceUrl = source["sourceUrl"];
	        this.videoId = source["videoId"];
	        this.originalFilename = source["originalFilename"];
	        this.targetLanguage = source["targetLanguage"];
	        this.completedSteps = this.convertValues(source["completedSteps"], CompletedSteps);
	        this.fileReferences = this.convertValues(source["fileReferences"], FileReferences);
	        this.settings = this.convertValues(source["settings"], ProjectSettings);
	        this.textRules = this.convertValues(source["textRules"], TextRule);
	        this.segmentRules = this.convertValues(source["segmentRules"], SegmentRule);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	
	
	export class VoiceRequest {
	    model: string;
	    voice: string;
	    input: string;
	    response_format: string;
	    speed: number;
	    lang_code: string;
	
	    static createFrom(source: any = {}) {
	        return new VoiceRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.model = source["model"];
	        this.voice = source["voice"];
	        this.input = source["input"];
	        this.response_format = source["response_format"];
	        this.speed = source["speed"];
	        this.lang_code = source["lang_code"];
	    }
	}

}

