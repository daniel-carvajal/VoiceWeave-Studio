// src/types/ProjectTypes.ts

// Type definitions

// Re-export the Wails-generated types with proper typing
import { main } from '../../wailsjs/go/models';

// Use the Wails-generated types as the source of truth
export type ProjectConfig = main.ProjectConfig;
export type FileReference = main.FileReference;
export type TranscriptionSettings = main.TranscriptionSettings;
export type TranslationSettings = main.TranslationSettings;
export type AudioSettings = main.AudioSettings;
export type CleanupSettings = main.CleanupSettings;
export type TextRule = main.TextRule;
export type SegmentRule = main.SegmentRule;
export type AppSettings = main.AppSettings;
export type CompletedSteps = main.CompletedSteps;
export type FileReferences = main.FileReferences;
export type ProjectSettings = main.ProjectSettings;
export type AdvancedTranslationSettings = main.AdvancedTranslationSettings;

export interface ProjectCreationRequest {
    sourceType: 'youtube' | 'video' | 'audio';
    source: string;
    targetLang: string;
}

// export interface ProjectConfig {
//     // Core Identity
//     id: string;                           // UUID v4
//     name: string;                         // Display name
//     created: string;                      // ISO 8601 timestamp
//     lastModified: string;                 // ISO 8601 timestamp
//     version: number;                      // Auto-increment for name clashes

//     // Source Information
//     sourceType: 'youtube' | 'video' | 'audio';
//     sourceUrl?: string;                   // YouTube URL (if applicable)
//     videoId?: string;                     // YouTube video ID or generated ID
//     originalFilename?: string;            // Original file name for uploads

//     // Target Configuration
//     targetLanguage: string;               // ISO 639-1 code (e.g., "es", "fr")

//     // Pipeline Progress
//     completedSteps: {
//         download: boolean;
//         transcribe: boolean;
//         translate: boolean;
//         synthesize: boolean;
//         combine: boolean;
//     };

//     // File References (relative to project folder)
//     fileReferences: {
//         videoFile?: FileReference;
//         audioFile?: FileReference;
//         segmentsFile?: string;              // transcripts/segments.json
//         finalAudio?: string;                // audio/final_dubbed.mp3
//         finalVideo?: string;                // output/final_video.mp4
//     };

//     // Pipeline Settings
//     settings: {
//         transcription: TranscriptionSettings;
//         translation: TranslationSettings;
//         audio: AudioSettings;
//         cleanup: CleanupSettings;
//     };

//     // Text and Segment Rules
//     textRules: TextRule[];
//     segmentRules: SegmentRule[];
// }

// export interface FileReference {
//     path: string;                         // File path (absolute or relative)
//     isLinked: boolean;                    // true = linked, false = copied
//     originalPath?: string;                // Original path if copied
//     size?: number;                        // File size in bytes
//     lastModified?: string;                // File modification time
// }

// export interface TranscriptionSettings {
//     source: 'whisperx' | 'youtube' | 'upload';
//     enableDiarization: boolean;
//     language: string;                     // Source language code
//     model?: string;                       // WhisperX model name
// }

// export interface TranslationSettings {
//     mode: 'simple' | 'advanced';
//     simpleModel: string;
//     cloudProvider?: string;
//     advancedSettings?: {
//         contextWindow: number;
//         enableJudge: boolean;
//         models: string[];
//     };
// }

// export interface AudioSettings {
//     preventOverlaps: boolean;
//     minGap: number;                       // Milliseconds
//     globalCrossfade: boolean;
//     crossfadeDuration: number;            // Milliseconds
//     effectsPreset: string;                // 'voice', 'music', 'off'
// }

// export interface CleanupSettings {
//     mode: 'keep' | 'auto' | 'ask';
//     keepIntermediateFiles: boolean;
// }

// export interface TextRule {
//     id: string;
//     originalText: string;
//     replacementText: string;
//     language: string;                     // Target language or 'all'
//     priority: 'high' | 'medium' | 'low';
//     caseSensitive: boolean;
//     createdAt: string;
// }

// export interface SegmentRule {
//     id: string;
//     type: 'timing' | 'voice' | 'effect';
//     conditions: Record<string, any>;
//     actions: Record<string, any>;
//     enabled: boolean;
//     createdAt: string;
// }

// export interface AppSettings {
//     defaultProjectsPath: string;          // Default project location
//     autoCleanup: 'ask' | 'auto' | 'never';
//     showOnboarding: boolean;              // First-run flag
//     recentProjects: string[];             // Project IDs (max 5)
//     exportLocation: 'project-folder' | 'ask-each-time' | 'custom';
//     customExportPath?: string;
// }