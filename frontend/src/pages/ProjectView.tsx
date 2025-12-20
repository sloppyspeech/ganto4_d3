import { useEffect, useCallback, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, IconButton, Tooltip, ToggleButtonGroup, ToggleButton, Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import { saveAs } from 'file-saver';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchProject } from '../store/slices/projectsSlice';
import { fetchTasks, createTask } from '../store/slices/tasksSlice';
import { fetchSettings } from '../store/slices/settingsSlice';
import { setViewMode, setSplitPosition, setGanttViewType, ViewMode, GanttViewType } from '../store/slices/uiSlice';
import TaskGrid from '../components/TaskGrid';
import GanttChart from '../components/GanttChart';
import ResourceGanttChart from '../components/ResourceGanttChart';
import type { TaskCreateData } from '../api/api';

const SEPARATOR = '§';

const ProjectView = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { currentProject } = useAppSelector((state) => state.projects);
    const { items: tasks } = useAppSelector((state) => state.tasks);
    const { viewMode, splitPosition, ganttViewType } = useAppSelector((state) => state.ui);

    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [leftWidth, setLeftWidth] = useState(splitPosition);
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [importText, setImportText] = useState('');
    const [importMode, setImportMode] = useState<'keep' | 'auto'>('auto');
    const [importPreview, setImportPreview] = useState<{ original: string; newId: string; description: string }[]>([]);
    const [showPreview, setShowPreview] = useState(false);

    const projectId = id ? parseInt(id, 10) : 0;

    useEffect(() => {
        if (id) {
            dispatch(fetchProject(projectId));
            dispatch(fetchTasks(projectId));
            dispatch(fetchSettings());
        }
    }, [dispatch, id, projectId]);

    const handleViewModeChange = (_: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => {
        if (newMode) {
            dispatch(setViewMode(newMode));
        }
    };

    const handleTabChange = (_: React.SyntheticEvent, newValue: GanttViewType) => {
        dispatch(setGanttViewType(newValue));
    };

    // Export tasks - using native File System API when available
    const handleExport = useCallback(async () => {
        const headers = ['task_id', 'description', 'start_date', 'end_date', 'estimate', 'resource', 'status', 'task_type', 'parent_ids', 'progress'];
        const csvContent = [
            headers.join(SEPARATOR),
            ...tasks.map(task => [
                task.task_id,
                task.description,
                task.start_date,
                task.end_date,
                task.estimate?.toString() || '0',
                task.resource || '',
                task.status,
                task.task_type,
                task.parent_ids || '',
                task.progress?.toString() || '0'
            ].join(SEPARATOR))
        ].join('\r\n');

        const BOM = '\uFEFF';
        const content = BOM + csvContent;
        const filename = 'tasks_export_' + new Date().toISOString().slice(0, 10) + '.csv';

        // Try native File System Access API first (opens native save dialog)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ('showSaveFilePicker' in window) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: 'CSV Files',
                        accept: { 'text/csv': ['.csv'] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(content);
                await writable.close();
                return;
            } catch (err) {
                // User cancelled, fall through
                if ((err as Error).name === 'AbortError') return;
                console.error('File System API failed:', err);
            }
        }

        // Fallback: prompt user to enter filename
        const userFilename = window.prompt('Enter filename for export:', filename);
        if (userFilename) {
            const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
            saveAs(blob, userFilename);
        }
    }, [tasks]);

    // Parse import data and preview changes
    const parseImportData = useCallback(() => {
        const lines = importText.trim().split('\n');
        if (lines.length < 2) return [];

        const headers = lines[0].split(SEPARATOR);
        const taskIdIdx = headers.indexOf('task_id');
        const descIdx = headers.indexOf('description');

        const existingIds = new Set(tasks.map(t => t.task_id));
        let maxNum = 0;
        tasks.forEach(t => {
            const match = t.task_id.match(/-(\d+)$/);
            if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
        });

        const preview: typeof importPreview = [];
        let nextNum = maxNum + 1;

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(SEPARATOR);
            if (values.length < 2) continue;

            const originalId = taskIdIdx >= 0 ? values[taskIdIdx] : '';
            const description = descIdx >= 0 ? values[descIdx] : '';

            let newId = originalId;
            if (importMode === 'auto') {
                // Always assign new ID in auto mode
                const prefix = currentProject?.code || 'TASK';
                newId = `${prefix}-${String(nextNum).padStart(3, '0')}`;
                nextNum++;
            } else if (existingIds.has(originalId)) {
                // Keep mode but ID exists - assign new
                const prefix = currentProject?.code || 'TASK';
                newId = `${prefix}-${String(nextNum).padStart(3, '0')}`;
                nextNum++;
            }

            preview.push({ original: originalId, newId, description });
        }
        return preview;
    }, [importText, tasks, importMode, currentProject]);

    // Preview import
    const handlePreviewImport = () => {
        const preview = parseImportData();
        setImportPreview(preview);
        setShowPreview(true);
    };

    // Import tasks with ID handling
    const handleImport = async () => {
        const lines = importText.trim().split('\n');
        if (lines.length < 2) {
            alert('No data to import');
            return;
        }

        const headers = lines[0].split(SEPARATOR);
        const taskIdIdx = headers.indexOf('task_id');
        const descIdx = headers.indexOf('description');
        const startIdx = headers.indexOf('start_date');
        const endIdx = headers.indexOf('end_date');
        const estIdx = headers.indexOf('estimate');
        const resIdx = headers.indexOf('resource');
        const statIdx = headers.indexOf('status');
        const typeIdx = headers.indexOf('task_type');
        const parentIdx = headers.indexOf('parent_ids');
        const progressIdx = headers.indexOf('progress');

        const preview = parseImportData();
        const changedIds: string[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(SEPARATOR);
            if (values.length < 2) continue;

            const previewItem = preview[i - 1];
            if (previewItem && previewItem.original !== previewItem.newId) {
                changedIds.push(`${previewItem.original} → ${previewItem.newId}`);
            }

            const taskData: TaskCreateData = {
                description: descIdx >= 0 ? values[descIdx] : '',
                start_date: startIdx >= 0 ? values[startIdx] : new Date().toISOString().split('T')[0],
                end_date: endIdx >= 0 ? values[endIdx] : new Date().toISOString().split('T')[0],
                estimate: estIdx >= 0 ? parseFloat(values[estIdx]) || 0 : 0,
                resource: resIdx >= 0 ? values[resIdx] : '',
                status: statIdx >= 0 ? values[statIdx] : 'Not Started',
                task_type: typeIdx >= 0 ? values[typeIdx] : 'Task',
                parent_ids: parentIdx >= 0 ? values[parentIdx] : '',
                progress: progressIdx >= 0 ? parseInt(values[progressIdx], 10) || 0 : 0,
            };

            if (taskData.description) {
                await dispatch(createTask({ projectId, data: taskData }));
            }
        }

        if (changedIds.length > 0) {
            alert(`Import complete!\n\nTask IDs changed:\n${changedIds.join('\n')}`);
        } else {
            alert('Import complete!');
        }

        setImportDialogOpen(false);
        setImportText('');
        setShowPreview(false);
        setImportPreview([]);
    };

    // Handle file upload
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setImportText(e.target?.result as string || '');
                setImportDialogOpen(true);
            };
            reader.readAsText(file);
        }
        event.target.value = '';
    };

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !containerRef.current) return;

        const container = containerRef.current;
        const containerRect = container.getBoundingClientRect();
        const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

        const constrainedWidth = Math.max(20, Math.min(70, newLeftWidth));
        setLeftWidth(constrainedWidth);
    }, [isDragging]);

    const handleMouseUp = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
            dispatch(setSplitPosition(leftWidth));
        }
    }, [isDragging, leftWidth, dispatch]);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 2,
                    py: 1,
                    borderBottom: '1px solid rgba(99, 102, 241, 0.1)',
                    bgcolor: 'background.paper',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Tooltip title="Back to Dashboard">
                        <IconButton onClick={() => navigate('/')} size="small">
                            <ArrowBackIcon />
                        </IconButton>
                    </Tooltip>
                    <Box>
                        <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                            {currentProject?.name || 'Loading...'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {currentProject?.code}
                        </Typography>
                    </Box>
                </Box>

                {/* Center: Tab selector */}
                <Tabs
                    value={ganttViewType}
                    onChange={handleTabChange}
                    sx={{
                        minHeight: 32,
                        '& .MuiTab-root': {
                            minHeight: 32,
                            py: 0.5,
                            px: 2,
                            textTransform: 'none',
                            fontSize: '0.85rem',
                        },
                        '& .MuiTabs-indicator': {
                            bgcolor: '#6366f1',
                        },
                    }}
                >
                    <Tab label="Tasks" value="tasks" />
                    <Tab label="Resources" value="resources" />
                </Tabs>

                {/* Right: Export/Import + View mode buttons */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Tooltip title="Export Tasks">
                        <IconButton onClick={handleExport} color="primary" size="small">
                            <FileDownloadIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Import Tasks">
                        <IconButton component="label" color="primary" size="small">
                            <FileUploadIcon />
                            <input type="file" accept=".csv,.txt" hidden onChange={handleFileUpload} />
                        </IconButton>
                    </Tooltip>
                    <Box sx={{ width: 8 }} />
                    <ToggleButtonGroup
                        value={viewMode}
                        exclusive
                        onChange={handleViewModeChange}
                        size="small"
                        sx={{
                            '& .MuiToggleButton-root': {
                                px: 2,
                                py: 0.5,
                                textTransform: 'none',
                                fontSize: '0.8rem',
                                '&.Mui-selected': {
                                    bgcolor: 'rgba(99, 102, 241, 0.2)',
                                    color: '#818cf8',
                                    '&:hover': {
                                        bgcolor: 'rgba(99, 102, 241, 0.3)',
                                    },
                                },
                            },
                        }}
                    >
                        <ToggleButton value="daily">Daily</ToggleButton>
                        <ToggleButton value="weekly">Weekly</ToggleButton>
                        <ToggleButton value="monthly">Monthly</ToggleButton>
                        <ToggleButton value="quarterly">Quarterly</ToggleButton>
                    </ToggleButtonGroup>
                </Box>
            </Box>

            {/* Content based on selected tab */}
            {ganttViewType === 'tasks' ? (
                // Tasks view: Split pane with TaskGrid + GanttChart
                <Box
                    ref={containerRef}
                    sx={{
                        flexGrow: 1,
                        display: 'flex',
                        overflow: 'hidden',
                        userSelect: isDragging ? 'none' : 'auto',
                    }}
                >
                    {/* Left Panel - Task Grid */}
                    <Box
                        sx={{
                            width: `${leftWidth}%`,
                            minWidth: '20%',
                            maxWidth: '70%',
                            overflow: 'auto',
                            flexShrink: 0,
                        }}
                    >
                        <TaskGrid projectId={projectId} />
                    </Box>

                    {/* Resize Handle */}
                    <Box
                        onMouseDown={handleMouseDown}
                        sx={{
                            width: 6,
                            flexShrink: 0,
                            background: isDragging
                                ? 'linear-gradient(180deg, rgba(99, 102, 241, 0.6) 0%, rgba(99, 102, 241, 0.4) 100%)'
                                : 'linear-gradient(180deg, rgba(99, 102, 241, 0.3) 0%, rgba(99, 102, 241, 0.1) 100%)',
                            cursor: 'col-resize',
                            transition: isDragging ? 'none' : 'background 0.2s',
                            '&:hover': {
                                background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.5) 0%, rgba(99, 102, 241, 0.3) 100%)',
                            },
                        }}
                    />

                    {/* Right Panel - Gantt Chart */}
                    <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                        <GanttChart />
                    </Box>
                </Box>
            ) : (
                // Resources view: Full-width ResourceGanttChart
                <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                    <ResourceGanttChart />
                </Box>
            )}

            {/* Import Dialog */}
            <Dialog open={importDialogOpen} onClose={() => { setImportDialogOpen(false); setShowPreview(false); }} maxWidth="md" fullWidth>
                <DialogTitle>Import Tasks</DialogTitle>
                <DialogContent>
                    {!showPreview ? (
                        <>
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>Task ID Mode:</Typography>
                                <ToggleButtonGroup
                                    value={importMode}
                                    exclusive
                                    onChange={(_, v) => v && setImportMode(v)}
                                    size="small"
                                >
                                    <ToggleButton value="auto">Auto-number (recommended)</ToggleButton>
                                    <ToggleButton value="keep">Keep IDs from file</ToggleButton>
                                </ToggleButtonGroup>
                                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                                    {importMode === 'auto'
                                        ? 'New IDs will be assigned based on project code + running number'
                                        : 'IDs from file will be used. Conflicts will get new IDs.'}
                                </Typography>
                            </Box>
                            <TextField
                                multiline
                                rows={8}
                                fullWidth
                                variant="outlined"
                                value={importText}
                                onChange={(e) => setImportText(e.target.value)}
                                placeholder={`task_id§description§start_date§end_date§estimate§resource§status§task_type§parent_ids`}
                                sx={{ fontFamily: 'monospace' }}
                            />
                            <Box sx={{ mt: 1, color: 'text.secondary', fontSize: '0.85rem' }}>
                                <strong>Format:</strong> Fields separated by § (section sign). First row is header.
                            </Box>
                        </>
                    ) : (
                        <>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>Preview - Task ID Changes:</Typography>
                            <Box sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                                {importPreview.map((item, idx) => (
                                    <Box key={idx} sx={{ display: 'flex', gap: 2, py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                                        <Typography sx={{ width: 100, color: item.original !== item.newId ? 'warning.main' : 'text.secondary' }}>
                                            {item.original || '(none)'}
                                        </Typography>
                                        <Typography sx={{ width: 20 }}>→</Typography>
                                        <Typography sx={{ width: 100, fontWeight: item.original !== item.newId ? 600 : 400 }}>
                                            {item.newId}
                                        </Typography>
                                        <Typography sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {item.description}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                            <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
                                {importPreview.filter(p => p.original !== p.newId).length} task(s) will have their ID changed.
                            </Typography>
                        </>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => { setImportDialogOpen(false); setShowPreview(false); }}>Cancel</Button>
                    {!showPreview ? (
                        <Button variant="contained" onClick={handlePreviewImport} disabled={!importText.trim()}>Preview</Button>
                    ) : (
                        <>
                            <Button onClick={() => setShowPreview(false)}>Back</Button>
                            <Button variant="contained" onClick={handleImport}>Import {importPreview.length} Tasks</Button>
                        </>
                    )}
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ProjectView;
