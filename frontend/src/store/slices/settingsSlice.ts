import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { settingsApi } from '../../api/api';
import type { Resource, Status, TaskType } from '../../api/api';

interface SettingsState {
    resources: Resource[];
    statuses: Status[];
    taskTypes: TaskType[];
    loading: boolean;
    error: string | null;
}

const initialState: SettingsState = {
    resources: [],
    statuses: [],
    taskTypes: [],
    loading: false,
    error: null,
};

export const fetchSettings = createAsyncThunk('settings/fetchAll', async () => {
    const response = await settingsApi.getAll();
    return response.data;
});

export const createResource = createAsyncThunk(
    'settings/createResource',
    async (data: { name: string; email?: string; color?: string }) => {
        const response = await settingsApi.createResource(data);
        return response.data;
    }
);

export const updateResource = createAsyncThunk(
    'settings/updateResource',
    async ({ id, data }: { id: number; data: { name?: string; email?: string; color?: string } }) => {
        const response = await settingsApi.updateResource(id, data);
        return response.data;
    }
);

export const deleteResource = createAsyncThunk(
    'settings/deleteResource',
    async (id: number) => {
        await settingsApi.deleteResource(id);
        return id;
    }
);

export const createStatus = createAsyncThunk(
    'settings/createStatus',
    async (data: { name: string; color: string; order_index?: number }) => {
        const response = await settingsApi.createStatus(data);
        return response.data;
    }
);

export const updateStatus = createAsyncThunk(
    'settings/updateStatus',
    async ({ id, data }: { id: number; data: { name?: string; color?: string; order_index?: number } }) => {
        const response = await settingsApi.updateStatus(id, data);
        return response.data;
    }
);

export const deleteStatus = createAsyncThunk(
    'settings/deleteStatus',
    async (id: number) => {
        await settingsApi.deleteStatus(id);
        return id;
    }
);

const settingsSlice = createSlice({
    name: 'settings',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchSettings.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchSettings.fulfilled, (state, action) => {
                state.loading = false;
                state.resources = action.payload.resources;
                state.statuses = action.payload.statuses;
                state.taskTypes = action.payload.task_types;
            })
            .addCase(fetchSettings.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to fetch settings';
            })
            .addCase(createResource.fulfilled, (state, action) => {
                state.resources.push(action.payload);
            })
            .addCase(updateResource.fulfilled, (state, action) => {
                const index = state.resources.findIndex((r) => r.id === action.payload.id);
                if (index !== -1) {
                    state.resources[index] = action.payload;
                }
            })
            .addCase(deleteResource.fulfilled, (state, action) => {
                state.resources = state.resources.filter((r) => r.id !== action.payload);
            })
            .addCase(createStatus.fulfilled, (state, action) => {
                state.statuses.push(action.payload);
            })
            .addCase(updateStatus.fulfilled, (state, action) => {
                const index = state.statuses.findIndex((s) => s.id === action.payload.id);
                if (index !== -1) {
                    state.statuses[index] = action.payload;
                }
            })
            .addCase(deleteStatus.fulfilled, (state, action) => {
                state.statuses = state.statuses.filter((s) => s.id !== action.payload);
            });
    },
});

export default settingsSlice.reducer;
