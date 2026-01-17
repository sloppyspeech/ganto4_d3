import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Project API
export const projectApi = {
    getAll: () => api.get('/projects'),
    get: (id: number) => api.get(`/projects/${id}`),
    create: (data: { name: string; code: string; description?: string }) =>
        api.post('/projects', data),
    update: (id: number, data: { name?: string; description?: string }) =>
        api.put(`/projects/${id}`, data),
    delete: (id: number) => api.delete(`/projects/${id}`),
};

// Task API
export const taskApi = {
    getAll: (projectId: number) => api.get(`/projects/${projectId}/tasks`),
    get: (taskId: number) => api.get(`/tasks/${taskId}`),
    create: (projectId: number, data: TaskCreateData) =>
        api.post(`/projects/${projectId}/tasks`, data),
    update: (taskId: number, data: Partial<TaskCreateData & { expanded?: boolean }>) =>
        api.put(`/tasks/${taskId}`, data),
    delete: (taskId: number) => api.delete(`/tasks/${taskId}`),
    // Hierarchy operations
    indent: (taskId: number) => api.post(`/tasks/${taskId}/indent`),
    outdent: (taskId: number) => api.post(`/tasks/${taskId}/outdent`),
    toggleExpand: (taskId: number) => api.post(`/tasks/${taskId}/toggle-expand`),
    reorder: (projectId: number, taskOrders: { id: number; order_index: number }[]) =>
        api.post(`/projects/${projectId}/reorder`, { task_orders: taskOrders }),
};

// Settings API
export const settingsApi = {
    getAll: () => api.get('/settings'),
    getResources: () => api.get('/resources'),
    createResource: (data: { name: string; email?: string; color?: string }) =>
        api.post('/resources', data),
    updateResource: (id: number, data: { name?: string; email?: string; color?: string }) =>
        api.put(`/resources/${id}`, data),
    deleteResource: (id: number) => api.delete(`/resources/${id}`),
    getStatuses: () => api.get('/statuses'),
    createStatus: (data: { name: string; color: string; order_index?: number }) =>
        api.post('/statuses', data),
    updateStatus: (id: number, data: { name?: string; color?: string; order_index?: number }) =>
        api.put(`/statuses/${id}`, data),
    deleteStatus: (id: number) => api.delete(`/statuses/${id}`),
    getTaskTypes: () => api.get('/task-types'),
    createTaskType: (data: { name: string }) => api.post('/task-types', data),
};

// Types
export interface Project {
    id: number;
    name: string;
    description: string;
    code: string;
    created_at: string;
    task_count: number;
    total_estimate: number;
    completed_estimate: number;
    progress: number;
    start_date: string | null;
    end_date: string | null;
}

export interface Task {
    id: number;
    task_id: string;
    description: string;
    start_date: string;
    end_date: string;
    estimate: number;
    resource: string | null;
    status: string;
    task_type: string;
    parent_ids: string | null;  // Dependencies (predecessor task IDs)
    parent_id: number | null;   // Hierarchical parent task ID
    level: number;              // Nesting depth (0 = top-level)
    wbs_code: string | null;    // WBS code e.g., "1.2.1"
    is_summary: boolean;        // True if task has children
    expanded: boolean;          // Collapse/expand state for UI
    progress: number;
    project_id: number;
    order_index: number;
}

export interface TaskCreateData {
    description: string;
    start_date: string;
    end_date: string;
    estimate?: number;
    resource?: string;
    status?: string;
    task_type?: string;
    parent_ids?: string;
    progress?: number;
}

export interface Resource {
    id: number;
    name: string;
    email: string | null;
    color: string;
}

export interface Status {
    id: number;
    name: string;
    color: string;
    order_index: number;
}

export interface TaskType {
    id: number;
    name: string;
}

export interface Settings {
    resources: Resource[];
    statuses: Status[];
    task_types: TaskType[];
}

export default api;
