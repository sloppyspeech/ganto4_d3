import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
    AppBar,
    Box,
    Toolbar,
    Typography,
    IconButton,
    Tooltip,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SettingsIcon from '@mui/icons-material/Settings';
import TimelineIcon from '@mui/icons-material/Timeline';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { toggleTheme } from '../store/slices/uiSlice';

const Layout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useAppDispatch();
    const themeMode = useAppSelector((state) => state.ui.themeMode);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <AppBar
                position="static"
                elevation={0}
                sx={{
                    background: themeMode === 'dark'
                        ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                        : 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
                    borderBottom: themeMode === 'dark'
                        ? '1px solid rgba(99, 102, 241, 0.2)'
                        : '1px solid rgba(99, 102, 241, 0.3)',
                }}
            >
                <Toolbar>
                    <TimelineIcon
                        sx={{
                            mr: 1.5,
                            color: '#6366f1',
                            fontSize: 28,
                        }}
                    />
                    <Typography
                        variant="h5"
                        component="div"
                        sx={{
                            flexGrow: 1,
                            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            fontWeight: 700,
                            letterSpacing: '-0.5px',
                        }}
                    >
                        OptiFlow
                    </Typography>
                    <Tooltip title={themeMode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                        <IconButton
                            onClick={() => dispatch(toggleTheme())}
                            sx={{
                                color: themeMode === 'dark' ? '#fbbf24' : '#6366f1',
                                '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.1)' },
                            }}
                        >
                            {themeMode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Dashboard">
                        <IconButton
                            onClick={() => navigate('/')}
                            sx={{
                                color: location.pathname === '/' ? '#6366f1' : (themeMode === 'dark' ? 'rgba(255,255,255,0.7)' : '#475569'),
                                '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.1)' },
                            }}
                        >
                            <DashboardIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Settings">
                        <IconButton
                            onClick={() => navigate('/settings')}
                            sx={{
                                color: location.pathname === '/settings' ? '#6366f1' : (themeMode === 'dark' ? 'rgba(255,255,255,0.7)' : '#475569'),
                                '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.1)' },
                            }}
                        >
                            <SettingsIcon />
                        </IconButton>
                    </Tooltip>
                </Toolbar>
            </AppBar>
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    overflow: 'hidden',
                    bgcolor: 'background.default',
                }}
            >
                <Outlet />
            </Box>
        </Box>
    );
};

export default Layout;
