import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { projectApi } from '../../api/api';
import type { Project } from '../../api/api';

interface ProjectsState {
    items: Project[];
    currentProject: Project | null;
    loading: boolean;
    error: string | null;
}

const initialState: ProjectsState = {
    items: [],
    currentProject: null,
    loading: false,
    error: null,
};

export const fetchProjects = createAsyncThunk('projects/fetchAll', async () => {
    const response = await projectApi.getAll();
    return response.data;
});

export const fetchProject = createAsyncThunk(
    'projects/fetchOne',
    async (id: number) => {
        const response = await projectApi.get(id);
        return response.data;
    }
);

export const createProject = createAsyncThunk(
    'projects/create',
    async (data: { name: string; code: string; description?: string }) => {
        const response = await projectApi.create(data);
        return response.data;
    }
);

export const deleteProject = createAsyncThunk(
    'projects/delete',
    async (id: number) => {
        await projectApi.delete(id);
        return id;
    }
);

const projectsSlice = createSlice({
    name: 'projects',
    initialState,
    reducers: {
        setCurrentProject: (state, action: PayloadAction<Project | null>) => {
            state.currentProject = action.payload;
        },
        clearError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchProjects.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchProjects.fulfilled, (state, action) => {
                state.loading = false;
                state.items = action.payload;
            })
            .addCase(fetchProjects.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to fetch projects';
            })
            .addCase(fetchProject.fulfilled, (state, action) => {
                state.currentProject = action.payload;
            })
            .addCase(createProject.fulfilled, (state, action) => {
                state.items.push(action.payload);
            })
            .addCase(deleteProject.fulfilled, (state, action) => {
                state.items = state.items.filter((p) => p.id !== action.payload);
                if (state.currentProject?.id === action.payload) {
                    state.currentProject = null;
                }
            });
    },
});

export const { setCurrentProject, clearError } = projectsSlice.actions;
export default projectsSlice.reducer;
