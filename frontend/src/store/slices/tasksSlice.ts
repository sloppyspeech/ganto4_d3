import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { taskApi } from '../../api/api';
import type { Task, TaskCreateData } from '../../api/api';

interface TasksState {
    items: Task[];
    loading: boolean;
    error: string | null;
}

const initialState: TasksState = {
    items: [],
    loading: false,
    error: null,
};

export const fetchTasks = createAsyncThunk(
    'tasks/fetchAll',
    async (projectId: number) => {
        const response = await taskApi.getAll(projectId);
        return response.data;
    }
);

export const createTask = createAsyncThunk(
    'tasks/create',
    async ({ projectId, data }: { projectId: number; data: TaskCreateData }) => {
        const response = await taskApi.create(projectId, data);
        return response.data;
    }
);

export const updateTask = createAsyncThunk(
    'tasks/update',
    async ({ taskId, data }: { taskId: number; data: Partial<TaskCreateData> }) => {
        const response = await taskApi.update(taskId, data);
        return response.data;
    }
);

export const deleteTask = createAsyncThunk('tasks/delete', async (taskId: number) => {
    await taskApi.delete(taskId);
    return taskId;
});

const tasksSlice = createSlice({
    name: 'tasks',
    initialState,
    reducers: {
        clearTasks: (state) => {
            state.items = [];
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchTasks.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchTasks.fulfilled, (state, action) => {
                state.loading = false;
                state.items = action.payload;
            })
            .addCase(fetchTasks.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to fetch tasks';
            })
            .addCase(createTask.fulfilled, (state, action) => {
                state.items.push(action.payload);
            })
            .addCase(updateTask.fulfilled, (state, action) => {
                const index = state.items.findIndex((t) => t.id === action.payload.id);
                if (index !== -1) {
                    state.items[index] = action.payload;
                }
            })
            .addCase(deleteTask.fulfilled, (state, action) => {
                state.items = state.items.filter((t) => t.id !== action.payload);
            });
    },
});

export const { clearTasks } = tasksSlice.actions;
export default tasksSlice.reducer;
