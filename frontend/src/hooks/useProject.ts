import { useState, useEffect, useCallback } from 'react';
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

export const useProject = () => {
    const [currentProject, setCurrentProject] = useState<ProjectConfig | null>(null);
    const [recentProjects, setRecentProjects] = useState<ProjectConfig[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load recent projects on hook initialization
    useEffect(() => {
        loadRecentProjects();
    }, []);

    const closeProject = useCallback(() => {
        setCurrentProject(null);
    }, []);

    const loadRecentProjects = useCallback(async () => {
        try {
            setIsLoading(true);
            const projects = await GetRecentProjects();
            setRecentProjects(projects);
        } catch (err) {
            setError(`Failed to load recent projects: ${err}`);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createProject = useCallback(async (
        sourceType: string,
        source: string,
        targetLang: string,
        customName: string = ''  // Add optional custom name parameter
    ): Promise<ProjectConfig | null> => {
        try {
            setIsLoading(true);
            setError(null);

            const project = await CreateProject(sourceType, source, targetLang, customName);
            setCurrentProject(project);
            await loadRecentProjects();

            return project;
        } catch (err) {
            const errorMsg = `Failed to create project: ${err}`;
            setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            setIsLoading(false);
        }
    }, [loadRecentProjects]);

    const loadProject = useCallback(async (projectId: string): Promise<void> => {
        try {
            setIsLoading(true);
            setError(null);

            const project = await LoadProject(projectId);
            setCurrentProject(project);
        } catch (err) {
            const errorMsg = `Failed to load project: ${err}`;
            setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updateProject = useCallback(async (project: ProjectConfig): Promise<void> => {
        try {
            await UpdateProject(project);
            setCurrentProject(project);
        } catch (err) {
            const errorMsg = `Failed to update project: ${err}`;
            setError(errorMsg);
            throw new Error(errorMsg);
        }
    }, []);

    const runPipelineStep = useCallback(async (step: string): Promise<any> => {
        if (!currentProject) {
            throw new Error('No current project');
        }

        try {
            setIsLoading(true);
            setError(null);

            const result = await RunPipelineStep(currentProject.id, step);

            // Reload project to get updated completion status
            await loadProject(currentProject.id);

            return result;
        } catch (err) {
            const errorMsg = `Pipeline step '${step}' failed: ${err}`;
            setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            setIsLoading(false);
        }
    }, [currentProject, loadProject]);

    const runFullPipeline = useCallback(async (): Promise<any> => {
        if (!currentProject) {
            throw new Error('No current project');
        }

        try {
            setIsLoading(true);
            setError(null);

            const result = await RunFullPipeline(currentProject.id);

            // Reload project to get updated completion status
            await loadProject(currentProject.id);

            return result;
        } catch (err) {
            const errorMsg = `Full pipeline failed: ${err}`;
            setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            setIsLoading(false);
        }
    }, [currentProject, loadProject]);

    const copyLinkedFiles = useCallback(async (): Promise<void> => {
        if (!currentProject) {
            throw new Error('No current project');
        }

        try {
            setIsLoading(true);
            setError(null);

            await CopyLinkedFilesToProject(currentProject.id);

            // Reload project to get updated file references
            await loadProject(currentProject.id);
        } catch (err) {
            const errorMsg = `Failed to copy linked files: ${err}`;
            setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            setIsLoading(false);
        }
    }, [currentProject, loadProject]);

    const deleteProject = useCallback(async (projectId: string): Promise<void> => {
        try {
            setIsLoading(true);
            setError(null);

            await DeleteProject(projectId);
            await loadRecentProjects(); // Refresh the list

            // If we're deleting the current project, close it
            if (currentProject && currentProject.id === projectId) {
                setCurrentProject(null);
            }
        } catch (err) {
            const errorMsg = `Failed to delete project: ${err}`;
            setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            setIsLoading(false);
        }
    }, [currentProject, loadRecentProjects]);

    const showProjectInFolder = useCallback(async (projectId: string): Promise<void> => {
        try {
            await ShowProjectInFolder(projectId);
        } catch (err) {
            const errorMsg = `Failed to show project in folder: ${err}`;
            setError(errorMsg);
            throw new Error(errorMsg);
        }
    }, []);

    return {
        // State
        currentProject,
        recentProjects,
        isLoading,
        error,
        closeProject,

        // Actions
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
        clearError: () => setError(null),
        hasProject: currentProject !== null,
        getProjectProgress: () => {
            if (!currentProject) return 0;
            const steps = currentProject.completedSteps;
            const completed = Object.values(steps).filter(Boolean).length;
            const total = Object.keys(steps).length;
            return Math.round((completed / total) * 100);
        }
    };
};