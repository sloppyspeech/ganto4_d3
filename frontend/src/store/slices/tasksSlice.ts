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
    const response = await taskApi.delete(taskId);
    return response.data;  // Returns updated task list
});

// Hierarchy operations
export const indentTask = createAsyncThunk(
    'tasks/indent',
    async (taskId: number) => {
        const response = await taskApi.indent(taskId);
        return response.data;  // Returns updated task list
    }
);

export const outdentTask = createAsyncThunk(
    'tasks/outdent',
    async (taskId: number) => {
        const response = await taskApi.outdent(taskId);
        return response.data;  // Returns updated task list
    }
);

export const toggleTaskExpand = createAsyncThunk(
    'tasks/toggleExpand',
    async (taskId: number) => {
        const response = await taskApi.toggleExpand(taskId);
        return response.data;  // Returns updated single task
    }
);

export const reorderTasks = createAsyncThunk(
    'tasks/reorder',
    async ({ projectId, taskOrders }: { projectId: number; taskOrders: { id: number; order_index: number }[] }) => {
        const response = await taskApi.reorder(projectId, taskOrders);
        return response.data;  // Returns updated task list
    }
);

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
                // Backend now returns all tasks when creating (for hierarchy updates)
                if (Array.isArray(action.payload)) {
                    state.items = action.payload;
                } else {
                    state.items.push(action.payload);
                }
            })
            .addCase(updateTask.fulfilled, (state, action) => {
                // When status changes, backend returns all tasks; otherwise single task
                if (Array.isArray(action.payload)) {
                    state.items = action.payload;
                } else {
                    const index = state.items.findIndex((t) => t.id === action.payload.id);
                    if (index !== -1) {
                        state.items[index] = action.payload;
                    }
                }
            })
            // Delete now returns updated task list from backend
            .addCase(deleteTask.fulfilled, (state, action) => {
                state.items = action.payload;
            })
            // Hierarchy operations - all return updated task list
            .addCase(indentTask.fulfilled, (state, action) => {
                state.items = action.payload;
            })
            .addCase(outdentTask.fulfilled, (state, action) => {
                state.items = action.payload;
            })
            .addCase(toggleTaskExpand.fulfilled, (state, action) => {
                const index = state.items.findIndex((t) => t.id === action.payload.id);
                if (index !== -1) {
                    state.items[index] = action.payload;
                }
            })
            .addCase(reorderTasks.fulfilled, (state, action) => {
                state.items = action.payload;
            });
    },
});

export const { clearTasks } = tasksSlice.actions;
export default tasksSlice.reducer;
