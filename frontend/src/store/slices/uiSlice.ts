import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export type ViewMode = 'daily' | 'weekly' | 'monthly' | 'quarterly';
export type ThemeMode = 'light' | 'dark';
export type GanttViewType = 'tasks' | 'resources' | 'dashboard';
export type ResourceViewMode = 'task' | 'complete';
export type DateFormat = 'DD/MMM/YYYY' | 'DD/MMM/YY' | 'DD/MM/YYYY' | 'DD-MM-YYYY' | 'DD-MMM-YYYY' | 'DD-MMM-YY' | 'DD-MM-YY' | 'DD/MM/YY';
export type GanttBarStyle = 'default' | 'round-corners';
export type DependencyLineStyle = 'end-to-start' | 'bottom-to-left';
export type ResourceLoadingStatus = 'optimal' | 'under-loaded' | 'over-loaded';

export interface TaskOverlap {
    task1: { task_id: string; description: string };
    task2: { task_id: string; description: string };
    overlapDays: number;
}

export interface ResourceAnalysisResult {
    status: ResourceLoadingStatus;
    summary: string;
    percentage: number;
    hasOverlaps?: boolean;
    overlaps?: TaskOverlap[];
}


interface UiState {
    viewMode: ViewMode;
    themeMode: ThemeMode;
    showTodayLine: boolean;
    showWeekends: boolean;
    showTaskIdInGantt: boolean;
    showDependencyLines: boolean;
    enableDoubleClickEdit: boolean;
    splitPosition: number;
    ganttScrollTop: number;
    ganttViewType: GanttViewType;
    resourceViewMode: ResourceViewMode;
    dateFormat: DateFormat;
    ganttBarStyle: GanttBarStyle;
    dependencyLineStyle: DependencyLineStyle;
    // AI/Ollama settings
    ollamaPort: string;
    ollamaModel: string;
    ollamaModels: string[];
    aiAnalysisLoading: boolean;
    resourceAnalysis: Record<string, ResourceAnalysisResult>;
}

const initialState: UiState = {
    viewMode: 'weekly',
    themeMode: (localStorage.getItem('themeMode') as ThemeMode) || 'dark',
    showTodayLine: localStorage.getItem('showTodayLine') !== 'false',
    showWeekends: localStorage.getItem('showWeekends') !== 'false',
    showTaskIdInGantt: localStorage.getItem('showTaskIdInGantt') !== 'false',
    showDependencyLines: localStorage.getItem('showDependencyLines') !== 'false',
    enableDoubleClickEdit: localStorage.getItem('enableDoubleClickEdit') !== 'false',
    splitPosition: parseInt(localStorage.getItem('splitPosition') || '50', 10),
    ganttScrollTop: 0,
    ganttViewType: 'tasks',
    resourceViewMode: 'task',
    dateFormat: (localStorage.getItem('dateFormat') as DateFormat) || 'DD-MMM-YYYY',
    ganttBarStyle: (localStorage.getItem('ganttBarStyle') as GanttBarStyle) || 'default',
    dependencyLineStyle: (localStorage.getItem('dependencyLineStyle') as DependencyLineStyle) || 'end-to-start',
    // AI/Ollama settings
    ollamaPort: localStorage.getItem('ollamaPort') || '11435',
    ollamaModel: localStorage.getItem('ollamaModel') || '',
    ollamaModels: [],
    aiAnalysisLoading: false,
    resourceAnalysis: {},
};

const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        setViewMode: (state, action: PayloadAction<ViewMode>) => {
            state.viewMode = action.payload;
        },
        toggleTheme: (state) => {
            state.themeMode = state.themeMode === 'dark' ? 'light' : 'dark';
            localStorage.setItem('themeMode', state.themeMode);
        },
        setThemeMode: (state, action: PayloadAction<ThemeMode>) => {
            state.themeMode = action.payload;
            localStorage.setItem('themeMode', state.themeMode);
        },
        toggleTodayLine: (state) => {
            state.showTodayLine = !state.showTodayLine;
            localStorage.setItem('showTodayLine', state.showTodayLine.toString());
        },
        toggleWeekends: (state) => {
            state.showWeekends = !state.showWeekends;
            localStorage.setItem('showWeekends', state.showWeekends.toString());
        },
        setSplitPosition: (state, action: PayloadAction<number>) => {
            state.splitPosition = action.payload;
            localStorage.setItem('splitPosition', action.payload.toString());
        },
        setGanttScrollTop: (state, action: PayloadAction<number>) => {
            state.ganttScrollTop = action.payload;
        },
        setGanttViewType: (state, action: PayloadAction<GanttViewType>) => {
            state.ganttViewType = action.payload;
        },
        setResourceViewMode: (state, action: PayloadAction<ResourceViewMode>) => {
            state.resourceViewMode = action.payload;
        },
        toggleTaskIdInGantt: (state) => {
            state.showTaskIdInGantt = !state.showTaskIdInGantt;
            localStorage.setItem('showTaskIdInGantt', state.showTaskIdInGantt.toString());
        },
        toggleDependencyLines: (state) => {
            state.showDependencyLines = !state.showDependencyLines;
            localStorage.setItem('showDependencyLines', state.showDependencyLines.toString());
        },
        setDateFormat: (state, action: PayloadAction<DateFormat>) => {
            state.dateFormat = action.payload;
            localStorage.setItem('dateFormat', action.payload);
        },
        setGanttBarStyle: (state, action: PayloadAction<GanttBarStyle>) => {
            state.ganttBarStyle = action.payload;
            localStorage.setItem('ganttBarStyle', action.payload);
        },
        setDependencyLineStyle: (state, action: PayloadAction<DependencyLineStyle>) => {
            state.dependencyLineStyle = action.payload;
            localStorage.setItem('dependencyLineStyle', action.payload);
        },
        toggleDoubleClickEdit: (state) => {
            state.enableDoubleClickEdit = !state.enableDoubleClickEdit;
            localStorage.setItem('enableDoubleClickEdit', state.enableDoubleClickEdit.toString());
        },
        // AI/Ollama actions
        setOllamaPort: (state, action: PayloadAction<string>) => {
            state.ollamaPort = action.payload;
            localStorage.setItem('ollamaPort', action.payload);
        },
        setOllamaModel: (state, action: PayloadAction<string>) => {
            state.ollamaModel = action.payload;
            localStorage.setItem('ollamaModel', action.payload);
        },
        setOllamaModels: (state, action: PayloadAction<string[]>) => {
            state.ollamaModels = action.payload;
        },
        setAiAnalysisLoading: (state, action: PayloadAction<boolean>) => {
            state.aiAnalysisLoading = action.payload;
        },
        setResourceAnalysis: (state, action: PayloadAction<Record<string, ResourceAnalysisResult>>) => {
            state.resourceAnalysis = action.payload;
        },
        clearResourceAnalysis: (state) => {
            state.resourceAnalysis = {};
        },
    },
});

export const {
    setViewMode,
    toggleTheme,
    setThemeMode,
    toggleTodayLine,
    toggleWeekends,
    toggleTaskIdInGantt,
    toggleDependencyLines,
    toggleDoubleClickEdit,
    setSplitPosition,
    setGanttScrollTop,
    setGanttViewType,
    setResourceViewMode,
    setDateFormat,
    setGanttBarStyle,
    setDependencyLineStyle,
    setOllamaPort,
    setOllamaModel,
    setOllamaModels,
    setAiAnalysisLoading,
    setResourceAnalysis,
    clearResourceAnalysis,
} = uiSlice.actions;
export default uiSlice.reducer;
