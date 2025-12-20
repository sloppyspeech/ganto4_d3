import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    CardActions,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    IconButton,
    Chip,
    CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchProjects, createProject, deleteProject } from '../store/slices/projectsSlice';

const Dashboard = () => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { items: projects, loading } = useAppSelector((state) => state.projects);
    const themeMode = useAppSelector((state) => state.ui.themeMode);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [newProject, setNewProject] = useState({ name: '', code: '', description: '' });

    const isDark = themeMode === 'dark';

    useEffect(() => {
        dispatch(fetchProjects());
    }, [dispatch]);

    const handleCreateProject = async () => {
        if (newProject.name && newProject.code) {
            await dispatch(createProject(newProject));
            setDialogOpen(false);
            setNewProject({ name: '', code: '', description: '' });
        }
    };

    const handleDeleteProject = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (window.confirm('Delete this project and all its tasks?')) {
            await dispatch(deleteProject(id));
        }
    };

    if (loading) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                }}
            >
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 4 }}>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 4,
                }}
            >
                <Box>
                    <Typography variant="h4" sx={{ mb: 0.5, color: 'text.primary' }}>
                        Projects
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Manage your project portfolio
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setDialogOpen(true)}
                    sx={{
                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                        '&:hover': {
                            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                        },
                    }}
                >
                    New Project
                </Button>
            </Box>

            {projects.length === 0 ? (
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: 300,
                        bgcolor: 'background.paper',
                        borderRadius: 2,
                        border: '2px dashed',
                        borderColor: isDark ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.5)',
                    }}
                >
                    <FolderOpenIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">
                        No projects yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Create your first project to get started
                    </Typography>
                    <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => setDialogOpen(true)}
                    >
                        Create Project
                    </Button>
                </Box>
            ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {projects.map((project) => (
                        <Box key={project.id} sx={{ width: { xs: '100%', sm: 'calc(50% - 12px)', md: 'calc(33.333% - 16px)' } }}>
                            <Card
                                sx={{
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease-in-out',
                                    bgcolor: 'background.paper',
                                    border: '1px solid',
                                    borderColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.3)',
                                    boxShadow: isDark
                                        ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                                        : '0 4px 12px rgba(99, 102, 241, 0.1)',
                                    '&:hover': {
                                        transform: 'translateY(-4px)',
                                        boxShadow: isDark
                                            ? '0 12px 40px rgba(99, 102, 241, 0.2)'
                                            : '0 12px 40px rgba(99, 102, 241, 0.15)',
                                        borderColor: 'primary.main',
                                    },
                                }}
                                onClick={() => navigate(`/project/${project.id}`)}
                            >
                                <CardContent>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                                        <Chip
                                            label={project.code}
                                            size="small"
                                            sx={{
                                                bgcolor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.15)',
                                                color: 'primary.main',
                                                fontWeight: 600,
                                                mr: 1,
                                            }}
                                        />
                                        <Chip
                                            label={`${project.task_count} tasks`}
                                            size="small"
                                            variant="outlined"
                                            sx={{
                                                borderColor: isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(100, 116, 139, 0.4)',
                                                color: 'text.secondary',
                                            }}
                                        />
                                    </Box>
                                    <Typography variant="h6" sx={{ mb: 1, color: 'text.primary' }}>
                                        {project.name}
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                            minHeight: 40,
                                        }}
                                    >
                                        {project.description || 'No description'}
                                    </Typography>
                                </CardContent>
                                <CardActions sx={{ px: 2, pb: 2 }}>
                                    <Button size="small" color="primary">
                                        Open
                                    </Button>
                                    <IconButton
                                        size="small"
                                        color="error"
                                        onClick={(e) => handleDeleteProject(e, project.id)}
                                        sx={{ ml: 'auto' }}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </CardActions>
                            </Card>
                        </Box>
                    ))}
                </Box>
            )}

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Project Name"
                        fullWidth
                        variant="outlined"
                        value={newProject.name}
                        onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        margin="dense"
                        label="Project Code"
                        fullWidth
                        variant="outlined"
                        value={newProject.code}
                        onChange={(e) => setNewProject({ ...newProject, code: e.target.value.toUpperCase() })}
                        helperText="Unique code (e.g., MIG, PROJ)"
                        inputProps={{ maxLength: 10 }}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        margin="dense"
                        label="Description"
                        fullWidth
                        variant="outlined"
                        multiline
                        rows={3}
                        value={newProject.description}
                        onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleCreateProject}
                        disabled={!newProject.name || !newProject.code}
                    >
                        Create
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Dashboard;
