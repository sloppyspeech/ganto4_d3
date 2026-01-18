import { useState, useCallback, useMemo } from 'react';
import { Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, IconButton, Tooltip, Autocomplete, Chip, Divider, Menu, Checkbox, ListItemIcon, ListItemText } from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { createTask, updateTask, deleteTask, indentTask, outdentTask, toggleTaskExpand } from '../store/slices/tasksSlice';
import { setGanttScrollTop } from '../store/slices/uiSlice';
import type { Task, TaskCreateData } from '../api/api';

interface TaskGridProps {
    projectId: number;
}

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 40;

// Calculate working days between two dates (excluding weekends)
const calculateWorkingDays = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let count = 0;
    const current = new Date(start);

    while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
};

// Calculate end date from start date and working days
const calculateEndDate = (startDate: string, workingDays: number): string => {
    const start = new Date(startDate);
    let count = 0;
    const current = new Date(start);

    while (count < workingDays) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            count++;
        }
        if (count < workingDays) {
            current.setDate(current.getDate() + 1);
        }
    }
    // If we land on a weekend, move to next Monday
    while (current.getDay() === 0 || current.getDay() === 6) {
        current.setDate(current.getDate() + 1);
    }
    return current.toISOString().split('T')[0];
};

const TaskGrid = ({ projectId }: TaskGridProps) => {
    const dispatch = useAppDispatch();
    const { items: tasks, loading } = useAppSelector((state) => state.tasks);
    const { resources, statuses, taskTypes } = useAppSelector((state) => state.settings);
    const dateFormat = useAppSelector((state) => state.ui.dateFormat);
    const enableDoubleClickEdit = useAppSelector((state) => state.ui.enableDoubleClickEdit);
    const themeMode = useAppSelector((state) => state.ui.themeMode);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [newTask, setNewTask] = useState<TaskCreateData>({
        description: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        estimate: 1,
        resource: '',
        status: 'Not Started',
        task_type: 'Task',
        parent_ids: '',
    });

    // Task options for dependency autocomplete
    const taskOptions = useMemo(() => tasks.map(t => t.task_id), [tasks]);

    // Selected task for hierarchy operations
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

    // Column visibility state with localStorage persistence
    const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
        const saved = localStorage.getItem('taskGridColumnVisibility');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                return {};
            }
        }
        // Default: all columns visible
        return {
            wbs_code: true,
            task_id: true,
            description: true,
            start_date: true,
            end_date: true,
            estimate: true,
            resource: true,
            status: true,
            progress: true,
            actions: true,
        };
    });

    // Column menu anchor
    const [columnMenuAnchor, setColumnMenuAnchor] = useState<null | HTMLElement>(null);

    // Toggle column visibility
    const handleToggleColumn = (field: string) => {
        const newVisibility = { ...columnVisibility, [field]: !columnVisibility[field] };
        setColumnVisibility(newVisibility);
        localStorage.setItem('taskGridColumnVisibility', JSON.stringify(newVisibility));
    };

    // Filter visible tasks based on parent expand state
    const visibleTasks = useMemo(() => {
        // Build a set of collapsed ancestor IDs
        const collapsedParentIds = new Set(
            tasks.filter(t => t.is_summary && !t.expanded).map(t => t.id)
        );

        // Check if any ancestor is collapsed
        const isAncestorCollapsed = (task: Task): boolean => {
            if (!task.parent_id) return false;
            if (collapsedParentIds.has(task.parent_id)) return true;
            const parent = tasks.find(t => t.id === task.parent_id);
            return parent ? isAncestorCollapsed(parent) : false;
        };

        return tasks.filter(task => !isAncestorCollapsed(task));
    }, [tasks]);

    // Hierarchy operations
    const handleIndent = useCallback(async () => {
        if (selectedTaskId) {
            await dispatch(indentTask(selectedTaskId));
        }
    }, [dispatch, selectedTaskId]);

    const handleOutdent = useCallback(async () => {
        if (selectedTaskId) {
            await dispatch(outdentTask(selectedTaskId));
        }
    }, [dispatch, selectedTaskId]);

    const handleToggleExpand = useCallback(async (taskId: number) => {
        await dispatch(toggleTaskExpand(taskId));
    }, [dispatch]);

    // Parse parent_ids string to array
    const parseParentIds = (parentIds: string | null | undefined): string[] => {
        if (!parentIds) return [];
        return parentIds.split(',').map(id => id.trim()).filter(id => id);
    };

    // Convert parent_ids array to string
    const joinParentIds = (ids: string[]): string => ids.join(', ');

    const handleCreateTask = async () => {
        if (newTask.description && newTask.start_date && newTask.end_date) {
            await dispatch(createTask({ projectId, data: newTask }));
            setAddDialogOpen(false);
            setNewTask({
                description: '',
                start_date: new Date().toISOString().split('T')[0],
                end_date: new Date().toISOString().split('T')[0],
                estimate: 1,
                resource: '',
                status: 'Not Started',
                task_type: 'Task',
                parent_ids: '',
            });
        }
    };

    const handleOpenEditDialog = (event: React.MouseEvent, task: Task) => {
        event.stopPropagation();
        event.preventDefault();
        setEditingTask(task);
        setEditDialogOpen(true);
    };

    const handleSaveEditTask = async () => {
        if (editingTask) {
            await dispatch(updateTask({
                taskId: editingTask.id,
                data: {
                    description: editingTask.description,
                    start_date: editingTask.start_date,
                    end_date: editingTask.end_date,
                    estimate: editingTask.estimate,
                    resource: editingTask.resource,
                    status: editingTask.status,
                    task_type: editingTask.task_type,
                    parent_ids: editingTask.parent_ids,
                    progress: editingTask.progress,
                }
            }));
            setEditDialogOpen(false);
            setEditingTask(null);
        }
    };

    const handleDeleteTask = useCallback(async (event: React.MouseEvent, taskId: number) => {
        event.stopPropagation();
        event.preventDefault();
        if (window.confirm('Delete this task?')) {
            await dispatch(deleteTask(taskId));
        }
    }, [dispatch]);

    const handleCellEdit = useCallback(
        async (params: { id: number; field: string; value: unknown }) => {
            const { id, field, value } = params;
            await dispatch(updateTask({ taskId: id, data: { [field]: value } }));
        },
        [dispatch]
    );

    // Handle date/estimate changes with auto-calculation
    const handleTaskFieldChange = (task: TaskCreateData | Task, field: string, value: any, setTask: (t: any) => void) => {
        let updatedTask = { ...task, [field]: value };

        if (field === 'start_date' && updatedTask.end_date) {
            // Recalculate estimate when start date changes
            const days = calculateWorkingDays(value, updatedTask.end_date);
            updatedTask.estimate = days;
        } else if (field === 'end_date' && updatedTask.start_date) {
            // Recalculate estimate when end date changes
            const days = calculateWorkingDays(updatedTask.start_date, value);
            updatedTask.estimate = days;
        } else if (field === 'estimate' && updatedTask.start_date && value > 0) {
            // Calculate end date when estimate changes
            const endDate = calculateEndDate(updatedTask.start_date, Math.ceil(value));
            updatedTask.end_date = endDate;
        }

        setTask(updatedTask);
    };

    const totalEstDays = useMemo(() => {
        return tasks.reduce((sum, task) => sum + (task.estimate || 0), 0);
    }, [tasks]);

    const columns: GridColDef[] = [
        {
            field: 'wbs_code',
            headerName: 'WBS',
            width: 60,
            sortable: false,
            renderCell: (params: GridRenderCellParams) => (
                <Box sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                    {params.value || ''}
                </Box>
            ),
        },
        {
            field: 'task_id',
            headerName: 'ID',
            width: 80,
            sortable: false,
        },
        {
            field: 'description',
            headerName: 'Task Name',
            flex: 1,
            minWidth: 200,
            editable: true,
            renderCell: (params: GridRenderCellParams) => {
                const task = params.row as Task;
                const indent = (task.level || 0) * 16;
                return (
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        {/* Indentation spacer */}
                        <Box sx={{ width: indent, flexShrink: 0 }} />

                        {/* Expand/Collapse button for summary tasks */}
                        {task.is_summary ? (
                            <IconButton
                                size="small"
                                onClick={(e) => { e.stopPropagation(); handleToggleExpand(task.id); }}
                                sx={{ p: 0.25, mr: 0.5 }}
                            >
                                {task.expanded ? (
                                    <ExpandMoreIcon sx={{ fontSize: 16 }} />
                                ) : (
                                    <ChevronRightIcon sx={{ fontSize: 16 }} />
                                )}
                            </IconButton>
                        ) : (
                            <Box sx={{ width: 20, flexShrink: 0 }} />
                        )}

                        {/* Task name - bold for summary tasks */}
                        <Box sx={{
                            fontWeight: task.is_summary ? 600 : 400,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>
                            {params.value}
                        </Box>
                    </Box>
                );
            },
        },
        {
            field: 'start_date',
            headerName: 'Start',
            width: 100,
            editable: true,  // Will be disabled for summary tasks via isCellEditable
            type: 'date',
            valueGetter: (value) => value ? new Date(value) : null,
            valueSetter: (value, row) => {
                const date = value instanceof Date ? value.toISOString().split('T')[0] : value;
                return { ...row, start_date: date };
            },
            renderCell: (params: GridRenderCellParams) => {
                if (!params.value) return '';
                const d = params.value as Date;
                const day = String(d.getDate()).padStart(2, '0');
                const mon = String(d.getMonth() + 1).padStart(2, '0');
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const mmm = months[d.getMonth()];
                const yyyy = d.getFullYear();
                const yy = String(yyyy).slice(-2);
                switch (dateFormat) {
                    case 'DD/MMM/YYYY': return `${day}/${mmm}/${yyyy}`;
                    case 'DD/MMM/YY': return `${day}/${mmm}/${yy}`;
                    case 'DD/MM/YYYY': return `${day}/${mon}/${yyyy}`;
                    case 'DD/MM/YY': return `${day}/${mon}/${yy}`;
                    case 'DD-MMM-YYYY': return `${day}-${mmm}-${yyyy}`;
                    case 'DD-MMM-YY': return `${day}-${mmm}-${yy}`;
                    case 'DD-MM-YYYY': return `${day}-${mon}-${yyyy}`;
                    case 'DD-MM-YY': return `${day}-${mon}-${yy}`;
                    default: return `${day}/${mmm}/${yyyy}`;
                }
            },
        },
        {
            field: 'end_date',
            headerName: 'End',
            width: 100,
            editable: true,  // Will be disabled for summary tasks via isCellEditable
            type: 'date',
            valueGetter: (value) => value ? new Date(value) : null,
            valueSetter: (value, row) => {
                const date = value instanceof Date ? value.toISOString().split('T')[0] : value;
                return { ...row, end_date: date };
            },
            renderCell: (params: GridRenderCellParams) => {
                if (!params.value) return '';
                const d = params.value as Date;
                const day = String(d.getDate()).padStart(2, '0');
                const mon = String(d.getMonth() + 1).padStart(2, '0');
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const mmm = months[d.getMonth()];
                const yyyy = d.getFullYear();
                const yy = String(yyyy).slice(-2);
                switch (dateFormat) {
                    case 'DD/MMM/YYYY': return `${day}/${mmm}/${yyyy}`;
                    case 'DD/MMM/YY': return `${day}/${mmm}/${yy}`;
                    case 'DD/MM/YYYY': return `${day}/${mon}/${yyyy}`;
                    case 'DD/MM/YY': return `${day}/${mon}/${yy}`;
                    case 'DD-MMM-YYYY': return `${day}-${mmm}-${yyyy}`;
                    case 'DD-MMM-YY': return `${day}-${mmm}-${yy}`;
                    case 'DD-MM-YYYY': return `${day}-${mon}-${yyyy}`;
                    case 'DD-MM-YY': return `${day}-${mon}-${yy}`;
                    default: return `${day}/${mmm}/${yyyy}`;
                }
            },
        },
        {
            field: 'estimate',
            headerName: `Est. Days (${totalEstDays.toFixed(1)})`,
            width: 120,
            editable: true,
            type: 'number',
            valueFormatter: (value: number) => value?.toFixed(1) || '0.0',
        },
        {
            field: 'resource',
            headerName: 'Resource',
            width: 120,
            editable: true,
            type: 'singleSelect',
            valueOptions: resources.map((r) => r.name),
        },
        {
            field: 'status',
            headerName: 'Status',
            width: 110,
            editable: true,
            type: 'singleSelect',
            valueOptions: statuses.map((s) => s.name),
            renderCell: (params: GridRenderCellParams) => {
                const status = statuses.find((s) => s.name === params.value);
                const statusColor = status?.color || '#9E9E9E';
                const isDark = themeMode === 'dark';
                return (
                    <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                        <Box
                            sx={{
                                px: 1.25,
                                py: 0.25,
                                borderRadius: '12px',
                                bgcolor: `${statusColor}${isDark ? '70' : '90'}`,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                color: isDark ? '#f5f5f5' : '#1a1a1a',
                                whiteSpace: 'nowrap',
                                lineHeight: 1.4,
                            }}
                        >
                            {params.value}
                        </Box>
                    </Box>
                );
            },
        },
        {
            field: 'progress',
            headerName: 'Progress',
            width: 90,
            editable: true,
            type: 'number',
            renderCell: (params: GridRenderCellParams) => {
                const value = params.value as number || 0;
                const isDark = themeMode === 'dark';
                return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' }}>
                        <Box sx={{
                            flex: 1,
                            height: 8,
                            bgcolor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.12)',
                            borderRadius: 1,
                            overflow: 'hidden',
                            border: isDark ? '1px solid rgba(255,255,255,0.2)' : 'none'
                        }}>
                            <Box sx={{
                                width: `${value}%`,
                                height: '100%',
                                bgcolor: value >= 100
                                    ? (isDark ? '#4ade80' : '#4caf50')
                                    : (isDark ? '#a5b4fc' : '#6366f1'),
                                transition: 'width 0.2s'
                            }} />
                        </Box>
                        <span style={{ fontSize: '0.75rem', minWidth: 28, color: isDark ? '#e0e0e0' : 'inherit' }}>{value}%</span>
                    </Box>
                );
            },
        },
        {
            field: 'actions',
            headerName: '+',
            width: 70,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            renderHeader: () => (
                <Tooltip title="Add Task">
                    <IconButton size="small" onClick={() => setAddDialogOpen(true)} sx={{ p: 0.25, color: 'success.main' }}>
                        <AddIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                </Tooltip>
            ),
            renderCell: (params: GridRenderCellParams) => (
                <Box sx={{ display: 'flex', gap: 0.25 }}>
                    <Tooltip title="Edit Task">
                        <IconButton size="small" color="primary" onClick={(e) => handleOpenEditDialog(e, params.row as Task)} sx={{ p: 0.25 }}>
                            <EditIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Task">
                        <IconButton size="small" color="error" onClick={(e) => handleDeleteTask(e, params.row.id)} sx={{ p: 0.25 }}>
                            <DeleteIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                    </Tooltip>
                </Box>
            ),
        },
    ];

    // Column definitions for the visibility menu
    const columnDefinitions = [
        { field: 'wbs_code', label: 'WBS' },
        { field: 'task_id', label: 'ID' },
        { field: 'description', label: 'Task Name' },
        { field: 'start_date', label: 'Start' },
        { field: 'end_date', label: 'End' },
        { field: 'estimate', label: 'Est. Days' },
        { field: 'resource', label: 'Resource' },
        { field: 'status', label: 'Status' },
        { field: 'progress', label: 'Progress' },
        { field: 'actions', label: 'Actions' },
    ];

    // Filter columns based on visibility
    const filteredColumns = useMemo(() => {
        return columns.filter(col => columnVisibility[col.field] !== false);
    }, [columns, columnVisibility]);

    const renderTaskDialog = (
        open: boolean,
        onClose: () => void,
        title: string,
        task: TaskCreateData | Task,
        setTask: (task: any) => void,
        onSubmit: () => void,
        submitLabel: string
    ) => {
        const currentTaskId = 'task_id' in task ? task.task_id : null;
        const availableOptions = taskOptions.filter(id => id !== currentTaskId);
        const selectedParents = parseParentIds(task.parent_ids);

        return (
            <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
                <DialogTitle>{title}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus margin="dense" label="Description" fullWidth variant="outlined"
                        value={task.description} onChange={(e) => setTask({ ...task, description: e.target.value })} sx={{ mb: 2 }}
                    />
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <TextField
                            margin="dense" label="Start Date" type="date" fullWidth variant="outlined"
                            value={task.start_date}
                            onChange={(e) => handleTaskFieldChange(task, 'start_date', e.target.value, setTask)}
                            slotProps={{ inputLabel: { shrink: true } }}
                        />
                        <TextField
                            margin="dense" label="End Date" type="date" fullWidth variant="outlined"
                            value={task.end_date}
                            onChange={(e) => handleTaskFieldChange(task, 'end_date', e.target.value, setTask)}
                            slotProps={{ inputLabel: { shrink: true } }}
                        />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <TextField
                            margin="dense" label="Resource" select fullWidth variant="outlined"
                            value={task.resource || ''} onChange={(e) => setTask({ ...task, resource: e.target.value })}
                        >
                            <MenuItem value="">None</MenuItem>
                            {resources.map((r) => (<MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>))}
                        </TextField>
                        <TextField
                            margin="dense" label="Status" select fullWidth variant="outlined"
                            value={task.status} onChange={(e) => setTask({ ...task, status: e.target.value })}
                        >
                            {statuses.map((s) => (<MenuItem key={s.id} value={s.name}>{s.name}</MenuItem>))}
                        </TextField>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <TextField
                            margin="dense" label="Type" select variant="outlined"
                            value={task.task_type} onChange={(e) => setTask({ ...task, task_type: e.target.value })}
                            sx={{ flex: 1 }}
                        >
                            {taskTypes.map((t) => (<MenuItem key={t.id} value={t.name}>{t.name}</MenuItem>))}
                        </TextField>
                        <TextField
                            margin="dense" label="Est. Days" type="number" variant="outlined"
                            value={task.estimate || 0}
                            onChange={(e) => handleTaskFieldChange(task, 'estimate', parseFloat(e.target.value) || 0, setTask)}
                            slotProps={{
                                inputLabel: { shrink: true },
                                htmlInput: { step: 0.5, min: 0.5 }
                            }}
                            helperText="Working days (excl. weekends)"
                            sx={{ flex: 1 }}
                        />
                    </Box>
                    {/* Progress field - only show for edit dialog (task has 'id' property) */}
                    {'id' in task && (
                        <TextField
                            margin="dense"
                            label="Progress (%)"
                            type="number"
                            fullWidth
                            variant="outlined"
                            value={(task as Task).progress || 0}
                            onChange={(e) => setTask({ ...task, progress: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                            slotProps={{
                                inputLabel: { shrink: true },
                                htmlInput: { min: 0, max: 100, step: 5 }
                            }}
                            helperText="Task completion percentage (0-100)"
                            sx={{ mb: 2 }}
                        />
                    )}
                    {/* Dependencies Autocomplete */}
                    <Autocomplete
                        multiple
                        options={availableOptions}
                        value={selectedParents}
                        onChange={(_, newValue) => setTask({ ...task, parent_ids: joinParentIds(newValue) })}
                        renderTags={(value, getTagProps) =>
                            value.map((option, index) => (
                                <Chip {...getTagProps({ index })} key={option} label={option} size="small" />
                            ))
                        }
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                margin="dense"
                                label="Dependencies (Parent Tasks)"
                                variant="outlined"
                                placeholder="Search tasks..."
                                helperText="Select tasks that must complete before this one"
                            />
                        )}
                        sx={{ mb: 1 }}
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button variant="contained" onClick={onSubmit} disabled={!task.description || !task.start_date || !task.end_date}>
                        {submitLabel}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.paper' }}>
            {/* Hierarchy Toolbar */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1,
                py: 0.5,
                borderBottom: '1px solid rgba(99, 102, 241, 0.15)',
                bgcolor: 'rgba(99, 102, 241, 0.03)'
            }}>
                <Tooltip title="Indent Task (Make child of task above)">
                    <span>
                        <IconButton
                            size="small"
                            onClick={handleIndent}
                            disabled={!selectedTaskId}
                            sx={{ p: 0.5 }}
                        >
                            <KeyboardArrowRightIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </span>
                </Tooltip>
                <Tooltip title="Outdent Task (Move up one level)">
                    <span>
                        <IconButton
                            size="small"
                            onClick={handleOutdent}
                            disabled={!selectedTaskId}
                            sx={{ p: 0.5 }}
                        >
                            <KeyboardArrowLeftIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </span>
                </Tooltip>
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                <Tooltip title="Add Task">
                    <IconButton
                        size="small"
                        onClick={() => setAddDialogOpen(true)}
                        sx={{ p: 0.5, color: 'success.main' }}
                    >
                        <AddIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Tooltip>
                <Box sx={{ flex: 1 }} />
                {selectedTaskId && (
                    <Box sx={{ fontSize: '0.75rem', color: 'text.secondary', mr: 1 }}>
                        Selected: {tasks.find(t => t.id === selectedTaskId)?.task_id}
                    </Box>
                )}
                <Tooltip title="Show/Hide Columns">
                    <IconButton
                        size="small"
                        onClick={(e) => setColumnMenuAnchor(e.currentTarget)}
                        sx={{ p: 0.5 }}
                    >
                        <ViewColumnIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Column Visibility Menu */}
            <Menu
                anchorEl={columnMenuAnchor}
                open={Boolean(columnMenuAnchor)}
                onClose={() => setColumnMenuAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                {columnDefinitions.map((col) => (
                    <MenuItem key={col.field} onClick={() => handleToggleColumn(col.field)} dense>
                        <ListItemIcon>
                            <Checkbox
                                checked={columnVisibility[col.field] !== false}
                                size="small"
                                sx={{ p: 0 }}
                            />
                        </ListItemIcon>
                        <ListItemText primary={col.label} />
                    </MenuItem>
                ))}
            </Menu>

            <DataGrid
                rows={visibleTasks}
                columns={filteredColumns}
                loading={loading}
                rowHeight={ROW_HEIGHT}
                columnHeaderHeight={HEADER_HEIGHT}
                hideFooter
                rowSelectionModel={selectedTaskId ? { type: 'include', ids: new Set([selectedTaskId]) } : { type: 'include', ids: new Set() }}
                onRowSelectionModelChange={(newSelection) => {
                    const ids = Array.from(newSelection.ids);
                    setSelectedTaskId(ids.length > 0 ? ids[0] as number : null);
                }}
                isCellEditable={(params) => {
                    // Disable editing dates and estimate for summary tasks
                    if (params.row.is_summary && ['start_date', 'end_date', 'estimate'].includes(params.field)) {
                        return false;
                    }
                    return true;
                }}
                processRowUpdate={(newRow, oldRow) => {
                    const changedField = Object.keys(newRow).find(
                        (key) => newRow[key as keyof typeof newRow] !== oldRow[key as keyof typeof oldRow]
                    );
                    if (changedField && changedField !== 'actions') {
                        let value = newRow[changedField as keyof typeof newRow];
                        // Clamp progress value between 0 and 100
                        if (changedField === 'progress' && typeof value === 'number') {
                            value = Math.max(0, Math.min(100, value));
                            newRow.progress = value;
                        }
                        handleCellEdit({
                            id: newRow.id,
                            field: changedField,
                            value,
                        });
                    }
                    return newRow;
                }}
                onProcessRowUpdateError={(error) => console.error(error)}
                onRowDoubleClick={(params) => {
                    if (enableDoubleClickEdit) {
                        setEditingTask(params.row as Task);
                        setEditDialogOpen(true);
                    }
                }}
                sx={{
                    border: 'none',
                    fontSize: '0.8rem',
                    '& .MuiDataGrid-cell': {
                        borderColor: 'rgba(99, 102, 241, 0.15)',
                        borderRight: '1px solid rgba(99, 102, 241, 0.15)',
                        py: 0,
                    },
                    '& .MuiDataGrid-cell:last-of-type': {
                        borderRight: 'none',
                    },
                    '& .MuiDataGrid-columnHeader': {
                        borderRight: '1px solid rgba(99, 102, 241, 0.2)',
                    },
                    '& .MuiDataGrid-columnHeader:last-of-type': {
                        borderRight: 'none',
                    },
                    '& .MuiDataGrid-columnHeaders': {
                        bgcolor: 'rgba(99, 102, 241, 0.05)',
                        borderColor: 'rgba(99, 102, 241, 0.15)',
                        minHeight: `${HEADER_HEIGHT}px !important`,
                        maxHeight: `${HEADER_HEIGHT}px !important`,
                    },
                    '& .MuiDataGrid-row:hover': { bgcolor: 'rgba(99, 102, 241, 0.05)' },
                    '& .MuiDataGrid-row.Mui-selected': {
                        bgcolor: 'rgba(99, 102, 241, 0.12)',
                        '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.15)' }
                    },
                    '& .MuiDataGrid-virtualScroller': { overflowY: 'auto' },
                }}
            />

            {/* Add Task Dialog */}
            {renderTaskDialog(addDialogOpen, () => setAddDialogOpen(false), 'Add New Task', newTask, setNewTask, handleCreateTask, 'Add Task')}

            {/* Edit Task Dialog */}
            {editingTask && renderTaskDialog(editDialogOpen, () => { setEditDialogOpen(false); setEditingTask(null); }, 'Edit Task', editingTask, setEditingTask, handleSaveEditTask, 'Save Changes')}
        </Box>
    );
};

export default TaskGrid;
