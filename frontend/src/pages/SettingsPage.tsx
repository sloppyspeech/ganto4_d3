import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    TextField,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControlLabel,
    Switch,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CircularProgress from '@mui/material/CircularProgress';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
    fetchSettings,
    createResource,
    updateResource,
    deleteResource,
    createStatus,
    updateStatus,
    deleteStatus,
} from '../store/slices/settingsSlice';
import { toggleWeekends, toggleTaskIdInGantt, toggleDependencyLines, toggleDoubleClickEdit, setDateFormat, DateFormat, setGanttBarStyle, GanttBarStyle, setDependencyLineStyle, DependencyLineStyle, setOllamaPort, setOllamaModel, setOllamaModels } from '../store/slices/uiSlice';
import { fetchOllamaModels } from '../api/ollamaApi';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

const TabPanel = ({ children, value, index }: TabPanelProps) => (
    <div role="tabpanel" hidden={value !== index}>
        {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
);

const SettingsPage = () => {
    const dispatch = useAppDispatch();
    const { resources, statuses, taskTypes } = useAppSelector((state) => state.settings);
    const showWeekends = useAppSelector((state) => state.ui.showWeekends);
    const showTaskIdInGantt = useAppSelector((state) => state.ui.showTaskIdInGantt);
    const showDependencyLines = useAppSelector((state) => state.ui.showDependencyLines);
    const enableDoubleClickEdit = useAppSelector((state) => state.ui.enableDoubleClickEdit);
    const dateFormat = useAppSelector((state) => state.ui.dateFormat);
    const ganttBarStyle = useAppSelector((state) => state.ui.ganttBarStyle);
    const dependencyLineStyle = useAppSelector((state) => state.ui.dependencyLineStyle);
    const ollamaPort = useAppSelector((state) => state.ui.ollamaPort);
    const ollamaModel = useAppSelector((state) => state.ui.ollamaModel);
    const ollamaModels = useAppSelector((state) => state.ui.ollamaModels);
    const [tabValue, setTabValue] = useState(0);


    // Helper to format dates according to the selected setting
    const formatDate = (value: string | null | undefined) => {
        if (!value) return '-';
        const d = new Date(value);
        if (isNaN(d.getTime())) return '-';

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
    };

    // AI Settings local state
    const [localPort, setLocalPort] = useState(ollamaPort);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'error'>('idle');
    const [connectionError, setConnectionError] = useState('');

    // Resource dialog state
    const [resourceDialogOpen, setResourceDialogOpen] = useState(false);
    const [editingResource, setEditingResource] = useState<{
        id?: number;
        name: string;
        email: string;
        color: string;
        availability_start: string;
        availability_end: string;
        allocation_percent: number;
    }>({
        name: '',
        email: '',
        color: '#3498db',
        availability_start: '2025-10-01',
        availability_end: '2026-01-30',
        allocation_percent: 100,
    });

    // Status dialog state
    const [statusDialogOpen, setStatusDialogOpen] = useState(false);
    const [editingStatus, setEditingStatus] = useState<{ id?: number; name: string; color: string }>({
        name: '',
        color: '#3498db',
    });

    useEffect(() => {
        dispatch(fetchSettings());
    }, [dispatch]);

    const handleSaveResource = async () => {
        if (editingResource.name) {
            if (editingResource.id) {
                await dispatch(updateResource({ id: editingResource.id, data: editingResource }));
            } else {
                await dispatch(createResource(editingResource));
            }
            setResourceDialogOpen(false);
            setEditingResource({
                name: '',
                email: '',
                color: '#3498db',
                availability_start: '2025-10-01',
                availability_end: '2026-01-30',
                allocation_percent: 100,
            });
        }
    };


    const handleDeleteResource = async (id: number) => {
        if (window.confirm('Delete this resource?')) {
            await dispatch(deleteResource(id));
        }
    };

    const handleSaveStatus = async () => {
        if (editingStatus.name && editingStatus.color) {
            if (editingStatus.id) {
                await dispatch(updateStatus({ id: editingStatus.id, data: editingStatus }));
            } else {
                await dispatch(createStatus(editingStatus));
            }
            setStatusDialogOpen(false);
            setEditingStatus({ name: '', color: '#3498db' });
        }
    };

    const handleDeleteStatus = async (id: number) => {
        if (window.confirm('Delete this status?')) {
            await dispatch(deleteStatus(id));
        }
    };

    // Fetch Ollama models
    const handleFetchModels = async () => {
        setIsLoadingModels(true);
        setConnectionError('');
        try {
            const models = await fetchOllamaModels(localPort);
            dispatch(setOllamaModels(models));
            dispatch(setOllamaPort(localPort));
            setConnectionStatus('connected');
            // Auto-select first model if none selected
            if (!ollamaModel && models.length > 0) {
                dispatch(setOllamaModel(models[0]));
            }
        } catch (error) {
            setConnectionStatus('error');
            setConnectionError(error instanceof Error ? error.message : 'Failed to connect');
            dispatch(setOllamaModels([]));
        } finally {
            setIsLoadingModels(false);
        }
    };

    return (
        <Box sx={{ p: 4 }}>
            <Typography variant="h4" sx={{ mb: 3 }}>
                Settings
            </Typography>

            <Paper sx={{ bgcolor: 'background.paper' }}>
                <Tabs
                    value={tabValue}
                    onChange={(_, newValue) => setTabValue(newValue)}
                    sx={{
                        borderBottom: 1,
                        borderColor: 'divider',
                        '& .MuiTab-root': { textTransform: 'none' },
                    }}
                >
                    <Tab label="Resources" />
                    <Tab label="Statuses" />
                    <Tab label="Task Types" />
                    <Tab label="Gantt Chart" />
                    <Tab label="AI Settings" />
                </Tabs>

                {/* Resources Tab */}
                <TabPanel value={tabValue} index={0}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => {
                                setEditingResource({
                                    name: '',
                                    email: '',
                                    color: '#3498db',
                                    availability_start: '2025-10-01',
                                    availability_end: '2026-01-30',
                                    allocation_percent: 100,
                                });
                                setResourceDialogOpen(true);
                            }}
                        >
                            Add Resource
                        </Button>
                    </Box>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Email</TableCell>
                                    <TableCell>Avail. Start</TableCell>
                                    <TableCell>Avail. End</TableCell>
                                    <TableCell>Allocation</TableCell>
                                    <TableCell>Color</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {resources.map((resource) => (
                                    <TableRow key={resource.id}>
                                        <TableCell>{resource.name}</TableCell>
                                        <TableCell>{resource.email}</TableCell>
                                        <TableCell>{formatDate(resource.availability_start)}</TableCell>
                                        <TableCell>{formatDate(resource.availability_end)}</TableCell>
                                        <TableCell>
                                            <Typography variant="body2">{resource.allocation_percent}%</Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Box
                                                sx={{
                                                    width: 24,
                                                    height: 24,
                                                    borderRadius: '50%',
                                                    bgcolor: resource.color,
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell align="right">
                                            <IconButton
                                                size="small"
                                                onClick={() => {
                                                    setEditingResource({
                                                        id: resource.id,
                                                        name: resource.name,
                                                        email: resource.email || '',
                                                        color: resource.color,
                                                        availability_start: resource.availability_start || '2025-10-01',
                                                        availability_end: resource.availability_end || '2026-01-30',
                                                        allocation_percent: resource.allocation_percent ?? 100,
                                                    });
                                                    setResourceDialogOpen(true);
                                                }}
                                            >
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => handleDeleteResource(resource.id)}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </TabPanel>

                {/* Statuses Tab */}
                <TabPanel value={tabValue} index={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => {
                                setEditingStatus({ name: '', color: '#3498db' });
                                setStatusDialogOpen(true);
                            }}
                        >
                            Add Status
                        </Button>
                    </Box>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Color</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {statuses.map((status) => (
                                    <TableRow key={status.id}>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Box
                                                    sx={{
                                                        width: 12,
                                                        height: 12,
                                                        borderRadius: '50%',
                                                        bgcolor: status.color,
                                                    }}
                                                />
                                                {status.name}
                                            </Box>
                                        </TableCell>
                                        <TableCell>{status.color}</TableCell>
                                        <TableCell align="right">
                                            <IconButton
                                                size="small"
                                                onClick={() => {
                                                    setEditingStatus({
                                                        id: status.id,
                                                        name: status.name,
                                                        color: status.color,
                                                    });
                                                    setStatusDialogOpen(true);
                                                }}
                                            >
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => handleDeleteStatus(status.id)}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </TabPanel>

                {/* Task Types Tab */}
                <TabPanel value={tabValue} index={2}>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {taskTypes.map((type) => (
                                    <TableRow key={type.id}>
                                        <TableCell>{type.name}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </TabPanel>

                {/* Gantt Chart Tab */}
                <TabPanel value={tabValue} index={3}>
                    <Typography variant="h6" sx={{ mb: 2 }}>Display Settings</Typography>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={showWeekends}
                                onChange={() => dispatch(toggleWeekends())}
                                color="primary"
                            />
                        }
                        label="Highlight weekends (Sat/Sun) in Daily and Weekly views"
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, ml: 4, mb: 2 }}>
                        When enabled, Saturday and Sunday columns will be highlighted with a subtle background color.
                    </Typography>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={showTaskIdInGantt}
                                onChange={() => dispatch(toggleTaskIdInGantt())}
                                color="primary"
                            />
                        }
                        label="Show task ID labels on Gantt chart bars"
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, ml: 4, mb: 2 }}>
                        When enabled, task IDs will be displayed on the task bars in the Gantt chart.
                    </Typography>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={showDependencyLines}
                                onChange={() => dispatch(toggleDependencyLines())}
                                color="primary"
                            />
                        }
                        label="Show dependency lines between tasks"
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, ml: 4, mb: 3 }}>
                        When enabled, lines will be drawn connecting dependent tasks.
                    </Typography>

                    <Typography variant="h6" sx={{ mb: 2, mt: 2 }}>Task Grid Settings</Typography>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={enableDoubleClickEdit}
                                onChange={() => dispatch(toggleDoubleClickEdit())}
                                color="primary"
                            />
                        }
                        label="Enable double-click to edit task"
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, ml: 4, mb: 3 }}>
                        When enabled, double-clicking on a task row in the grid will open the Edit Task dialog.
                    </Typography>

                    <FormControl sx={{ minWidth: 200, mt: 2 }}>
                        <InputLabel id="date-format-label">Date Display Format</InputLabel>
                        <Select
                            labelId="date-format-label"
                            id="date-format-select"
                            value={dateFormat}
                            label="Date Display Format"
                            onChange={(e) => dispatch(setDateFormat(e.target.value as DateFormat))}
                        >
                            <MenuItem value="DD/MMM/YYYY">DD/MMM/YYYY (e.g., 12/Dec/2026)</MenuItem>
                            <MenuItem value="DD/MMM/YY">DD/MMM/YY (e.g., 12/Dec/26)</MenuItem>
                            <MenuItem value="DD/MM/YYYY">DD/MM/YYYY (e.g., 12/12/2026)</MenuItem>
                            <MenuItem value="DD/MM/YY">DD/MM/YY (e.g., 12/12/26)</MenuItem>
                            <MenuItem value="DD-MMM-YYYY">DD-MMM-YYYY (e.g., 12-Dec-2026)</MenuItem>
                            <MenuItem value="DD-MMM-YY">DD-MMM-YY (e.g., 12-Dec-26)</MenuItem>
                            <MenuItem value="DD-MM-YYYY">DD-MM-YYYY (e.g., 12-12-2026)</MenuItem>
                            <MenuItem value="DD-MM-YY">DD-MM-YY (e.g., 12-12-26)</MenuItem>
                        </Select>
                    </FormControl>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, ml: 0.5, mb: 3 }}>
                        Format used for displaying dates in the Task Grid columns.
                    </Typography>

                    <FormControl sx={{ minWidth: 200 }}>
                        <InputLabel id="bar-style-label">Gantt Bar Style</InputLabel>
                        <Select
                            labelId="bar-style-label"
                            id="bar-style-select"
                            value={ganttBarStyle}
                            label="Gantt Bar Style"
                            onChange={(e) => dispatch(setGanttBarStyle(e.target.value as GanttBarStyle))}
                        >
                            <MenuItem value="default">Default (subtle corners)</MenuItem>
                            <MenuItem value="round-corners">Round Corners (thicker, fully rounded)</MenuItem>
                        </Select>
                    </FormControl>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, ml: 0.5, mb: 3 }}>
                        Style of task bars in the Gantt chart. Round corners are 20% thicker with fully rounded edges.
                    </Typography>

                    <FormControl sx={{ minWidth: 280 }}>
                        <InputLabel id="dependency-line-style-label">Dependency Line Style</InputLabel>
                        <Select
                            labelId="dependency-line-style-label"
                            id="dependency-line-style-select"
                            value={dependencyLineStyle}
                            label="Dependency Line Style"
                            onChange={(e) => dispatch(setDependencyLineStyle(e.target.value as DependencyLineStyle))}
                        >
                            <MenuItem value="end-to-start">End-to-Start (horizontal routing)</MenuItem>
                            <MenuItem value="bottom-to-left">Bottom-to-Left (vertical routing)</MenuItem>
                        </Select>
                    </FormControl>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, ml: 0.5 }}>
                        How dependency lines connect parent and child tasks. End-to-Start connects right side to left side. Bottom-to-Left connects bottom center to left center.
                    </Typography>
                </TabPanel>

                {/* AI Settings Tab */}
                <TabPanel value={tabValue} index={4}>
                    <Typography variant="h6" sx={{ mb: 3 }}>Ollama Configuration</Typography>

                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 3 }}>
                        <TextField
                            label="Ollama Server Port"
                            value={localPort}
                            onChange={(e) => setLocalPort(e.target.value)}
                            size="small"
                            sx={{ width: 150 }}
                            helperText="Default: 11435"
                        />
                        <Button
                            variant="contained"
                            onClick={handleFetchModels}
                            disabled={isLoadingModels}
                            startIcon={isLoadingModels ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
                        >
                            {isLoadingModels ? 'Connecting...' : 'Connect & Fetch Models'}
                        </Button>
                        {connectionStatus === 'connected' && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'success.main' }}>
                                <CheckCircleIcon fontSize="small" />
                                <Typography variant="body2">Connected</Typography>
                            </Box>
                        )}
                        {connectionStatus === 'error' && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'error.main' }}>
                                <ErrorIcon fontSize="small" />
                                <Typography variant="body2">{connectionError}</Typography>
                            </Box>
                        )}
                    </Box>

                    <FormControl sx={{ minWidth: 300, mb: 3 }} disabled={ollamaModels.length === 0}>
                        <InputLabel id="model-select-label">Default AI Model</InputLabel>
                        <Select
                            labelId="model-select-label"
                            value={ollamaModel}
                            label="Default AI Model"
                            onChange={(e) => dispatch(setOllamaModel(e.target.value))}
                        >
                            {ollamaModels.map((model) => (
                                <MenuItem key={model} value={model}>{model}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {ollamaModels.length === 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Click "Connect & Fetch Models" to load available models from your Ollama server.
                        </Typography>
                    )}

                    <Box sx={{ mt: 4, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>How to use AI Analysis</Typography>
                        <Typography variant="body2" color="text.secondary">
                            1. Make sure Ollama is running on your machine (port {ollamaPort || '11435'})<br />
                            2. Connect and select a model above<br />
                            3. Go to any project → Resources tab<br />
                            4. Click the "Analyze by AI" button to get resource loading insights
                        </Typography>
                    </Box>
                </TabPanel>
            </Paper>

            {/* Resource Dialog */}
            <Dialog open={resourceDialogOpen} onClose={() => setResourceDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editingResource.id ? 'Edit Resource' : 'Add Resource'}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Name"
                        fullWidth
                        variant="outlined"
                        value={editingResource.name}
                        onChange={(e) => setEditingResource({ ...editingResource, name: e.target.value })}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        margin="dense"
                        label="Email"
                        fullWidth
                        variant="outlined"
                        value={editingResource.email}
                        onChange={(e) => setEditingResource({ ...editingResource, email: e.target.value })}
                        sx={{ mb: 2 }}
                    />

                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Availability Period</Typography>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <TextField
                            label="Start Date"
                            type="date"
                            value={editingResource.availability_start}
                            onChange={(e) => setEditingResource({ ...editingResource, availability_start: e.target.value })}
                            InputLabelProps={{ shrink: true }}
                            sx={{ flex: 1 }}
                        />
                        <TextField
                            label="End Date"
                            type="date"
                            value={editingResource.availability_end}
                            onChange={(e) => setEditingResource({ ...editingResource, availability_end: e.target.value })}
                            InputLabelProps={{ shrink: true }}
                            sx={{ flex: 1 }}
                        />
                    </Box>

                    <TextField
                        margin="dense"
                        label="Allocation %"
                        type="number"
                        variant="outlined"
                        value={editingResource.allocation_percent}
                        onChange={(e) => setEditingResource({ ...editingResource, allocation_percent: Math.max(1, Math.min(100, parseInt(e.target.value) || 100)) })}
                        inputProps={{ min: 1, max: 100 }}
                        helperText="Percentage of time resource is allocated (1-100%)"
                        sx={{ mb: 2, width: 150 }}
                    />

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
                        <Typography>Color:</Typography>
                        <input
                            type="color"
                            value={editingResource.color}
                            onChange={(e) => setEditingResource({ ...editingResource, color: e.target.value })}
                            style={{ width: 50, height: 30, cursor: 'pointer' }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setResourceDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSaveResource}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Status Dialog */}
            <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editingStatus.id ? 'Edit Status' : 'Add Status'}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Name"
                        fullWidth
                        variant="outlined"
                        value={editingStatus.name}
                        onChange={(e) => setEditingStatus({ ...editingStatus, name: e.target.value })}
                        sx={{ mb: 2 }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography>Color:</Typography>
                        <input
                            type="color"
                            value={editingStatus.color}
                            onChange={(e) => setEditingStatus({ ...editingStatus, color: e.target.value })}
                            style={{ width: 50, height: 30, cursor: 'pointer' }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSaveStatus}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default SettingsPage;
