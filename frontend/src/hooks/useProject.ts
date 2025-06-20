import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { main } from '../../wailsjs/go/models';
import {
    CreateProject,
    LoadProject,
    UpdateProject,
    GetRecentProjects,
    RunPipelineStep,
    RunFullPipeline,
    CopyLinkedFilesToProject,
    DeleteProject,
    ShowProjectInFolder
} from '../../wailsjs/go/main/App';

// Use the Wails-generated types
type ProjectConfig = main.ProjectConfig;

// Create a robust external store for project state
class ProjectStore {
    private state = {
        currentProject: null as ProjectConfig | null,
        recentProjects: [] as ProjectConfig[],
        isLoading: false,
        error: null as string | null
    };

    private listeners = new Set<() => void>();

    // Required for useSyncExternalStore
    getSnapshot = () => {
        console.log('ProjectStore.getSnapshot called:', this.state.currentProject ? this.state.currentProject.name : 'null');
        return this.state;
    };

    // Required for useSyncExternalStore
    subscribe = (callback: () => void) => {
        console.log('ProjectStore.subscribe called, listeners:', this.listeners.size);
        this.listeners.add(callback);
        return () => {
            console.log('ProjectStore.unsubscribe called');
            this.listeners.delete(callback);
        };
    };

    // Update state and notify all subscribers
    setState = (updates: Partial<typeof this.state>) => {
        const oldProject = this.state.currentProject;
        this.state = { ...this.state, ...updates };
        const newProject = this.state.currentProject;

        console.log('ProjectStore.setState called:', {
            oldProject: oldProject ? oldProject.name : 'null',
            newProject: newProject ? newProject.name : 'null',
            listenersCount: this.listeners.size
        });

        // Notify all subscribers
        this.listeners.forEach(listener => {
            console.log('Calling listener...');
            listener();
        });
    };

    // Convenience methods
    setCurrentProject = (project: ProjectConfig | null) => {
        this.setState({ currentProject: project });
    };

    setRecentProjects = (projects: ProjectConfig[]) => {
        this.setState({ recentProjects: projects });
    };

    setLoading = (loading: boolean) => {
        this.setState({ isLoading: loading });
    };

    setError = (error: string | null) => {
        this.setState({ error });
    };

    clearError = () => {
        this.setState({ error: null });
    };

    closeProject = () => {
        this.setState({ currentProject: null });
    };
}

// Create a single instance of the store
const projectStore = new ProjectStore();

export const useProject = () => {
    // Use useSyncExternalStore for guaranteed re-renders
    const state = useSyncExternalStore(
        projectStore.subscribe,
        projectStore.getSnapshot,
        projectStore.getSnapshot // Server snapshot (same as client)
    );

    console.log('useProject hook called, current state:', state.currentProject ? state.currentProject.name : 'null');

    // Load recent projects on hook initialization
    useEffect(() => {
        loadRecentProjects();
    }, []);

    const loadRecentProjects = useCallback(async () => {
        try {
            projectStore.setLoading(true);
            const projects = await GetRecentProjects();
            projectStore.setRecentProjects(projects);
        } catch (err) {
            projectStore.setError(`Failed to load recent projects: ${err}`);
        } finally {
            projectStore.setLoading(false);
        }
    }, []);

    const createProject = useCallback(async (
        sourceType: string,
        source: string,
        targetLang: string,
        customName: string = ''
    ): Promise<ProjectConfig | null> => {
        try {
            projectStore.setLoading(true);
            projectStore.setError(null);

            const project = await CreateProject(sourceType, source, targetLang, customName);
            projectStore.setCurrentProject(project);
            await loadRecentProjects();

            return project;
        } catch (err) {
            const errorMsg = `Failed to create project: ${err}`;
            projectStore.setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            projectStore.setLoading(false);
        }
    }, [loadRecentProjects]);

    const loadProject = useCallback(async (projectId: string): Promise<void> => {
        console.log('loadProject called with ID:', projectId);
        try {
            projectStore.setLoading(true);
            projectStore.setError(null);

            console.log('Calling LoadProject from Wails...');
            const project = await LoadProject(projectId);
            console.log('LoadProject returned:', project);

            console.log('Setting current project in store...');
            projectStore.setCurrentProject(project);
            console.log('Project set in store successfully');
        } catch (err) {
            console.error('LoadProject error:', err);
            const errorMsg = `Failed to load project: ${err}`;
            projectStore.setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            projectStore.setLoading(false);
            console.log('loadProject finally block');
        }
    }, []);

    const updateProject = useCallback(async (project: ProjectConfig): Promise<void> => {
        try {
            await UpdateProject(project);
            projectStore.setCurrentProject(project);
        } catch (err) {
            const errorMsg = `Failed to update project: ${err}`;
            projectStore.setError(errorMsg);
            throw new Error(errorMsg);
        }
    }, []);

    const runPipelineStep = useCallback(async (step: string): Promise<any> => {
        if (!state.currentProject) {
            throw new Error('No current project');
        }

        try {
            projectStore.setLoading(true);
            projectStore.setError(null);

            const result = await RunPipelineStep(state.currentProject.id, step);

            // Reload project to get updated completion status
            await loadProject(state.currentProject.id);

            return result;
        } catch (err) {
            const errorMsg = `Pipeline step '${step}' failed: ${err}`;
            projectStore.setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            projectStore.setLoading(false);
        }
    }, [state.currentProject, loadProject]);

    const runFullPipeline = useCallback(async (): Promise<any> => {
        if (!state.currentProject) {
            throw new Error('No current project');
        }

        try {
            projectStore.setLoading(true);
            projectStore.setError(null);

            const result = await RunFullPipeline(state.currentProject.id);

            // Reload project to get updated completion status
            await loadProject(state.currentProject.id);

            return result;
        } catch (err) {
            const errorMsg = `Full pipeline failed: ${err}`;
            projectStore.setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            projectStore.setLoading(false);
        }
    }, [state.currentProject, loadProject]);

    const copyLinkedFiles = useCallback(async (): Promise<void> => {
        if (!state.currentProject) {
            throw new Error('No current project');
        }

        try {
            projectStore.setLoading(true);
            projectStore.setError(null);

            await CopyLinkedFilesToProject(state.currentProject.id);

            // Reload project to get updated file references
            await loadProject(state.currentProject.id);
        } catch (err) {
            const errorMsg = `Failed to copy linked files: ${err}`;
            projectStore.setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            projectStore.setLoading(false);
        }
    }, [state.currentProject, loadProject]);

    const deleteProject = useCallback(async (projectId: string): Promise<void> => {
        try {
            projectStore.setLoading(true);
            projectStore.setError(null);

            await DeleteProject(projectId);
            await loadRecentProjects(); // Refresh the list

            // If we're deleting the current project, close it
            if (state.currentProject && state.currentProject.id === projectId) {
                projectStore.closeProject();
            }
        } catch (err) {
            const errorMsg = `Failed to delete project: ${err}`;
            projectStore.setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            projectStore.setLoading(false);
        }
    }, [state.currentProject, loadRecentProjects]);

    const showProjectInFolder = useCallback(async (projectId: string): Promise<void> => {
        try {
            await ShowProjectInFolder(projectId);
        } catch (err) {
            const errorMsg = `Failed to show project in folder: ${err}`;
            projectStore.setError(errorMsg);
            throw new Error(errorMsg);
        }
    }, []);

    return {
        // State from useSyncExternalStore
        currentProject: state.currentProject,
        recentProjects: state.recentProjects,
        isLoading: state.isLoading,
        error: state.error,

        // Actions
        closeProject: projectStore.closeProject,
        createProject,
        loadProject,
        updateProject,
        runPipelineStep,
        runFullPipeline,
        copyLinkedFiles,
        loadRecentProjects,
        deleteProject,
        showProjectInFolder,

        // Utilities
        clearError: projectStore.clearError,
        hasProject: state.currentProject !== null,
        getProjectProgress: () => {
            if (!state.currentProject) return 0;
            const steps = state.currentProject.completedSteps;
            const completed = Object.values(steps).filter(Boolean).length;
            const total = Object.keys(steps).length;
            return Math.round((completed / total) * 100);
        }
    };
};