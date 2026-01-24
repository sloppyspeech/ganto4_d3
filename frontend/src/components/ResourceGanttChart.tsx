import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { Box, Typography, ToggleButton, ToggleButtonGroup, Button, Tooltip, CircularProgress, Chip, Snackbar, Alert } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import * as d3 from 'd3';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { toggleTodayLine, setResourceViewMode, ResourceViewMode, setAiAnalysisLoading, setResourceAnalysis, clearResourceAnalysis, type ResourceAnalysisResult } from '../store/slices/uiSlice';
import type { Task } from '../api/api';
import { analyzeResources } from '../api/ollamaApi';

const ROW_HEIGHT = 36;
const HEADER_ROW_0 = 20;
const HEADER_ROW_1 = 20;
const HEADER_HEIGHT = HEADER_ROW_0 + HEADER_ROW_1;
const BAR_HEIGHT = 20;
const BAR_PADDING = (ROW_HEIGHT - BAR_HEIGHT) / 2;
const GROUP_HEADER_HEIGHT = 28;

interface ResourceGroup {
    resource: string;
    tasks: Task[];
    minDate: Date;
    maxDate: Date;
    color: string;
}

const ResourceGanttChart = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const dispatch = useAppDispatch();
    const { items: tasks } = useAppSelector((state) => state.tasks);
    const { resources, statuses } = useAppSelector((state) => state.settings);
    const { viewMode, themeMode, showTodayLine, showWeekends, resourceViewMode, ganttBarStyle, ollamaPort, ollamaModel, aiAnalysisLoading, resourceAnalysis } = useAppSelector((state) => state.ui);
    const { currentProject } = useAppSelector((state) => state.projects);

    // Local state for error handling
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    const colors = useMemo(() => ({
        headerBg: themeMode === 'dark' ? '#1e293b' : '#e2e8f0',
        headerBgAlt: themeMode === 'dark' ? '#0f172a' : '#cbd5e1',
        headerText: themeMode === 'dark' ? '#e2e8f0' : '#1e293b',
        rowEven: themeMode === 'dark' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(226, 232, 240, 0.6)',
        rowOdd: themeMode === 'dark' ? 'rgba(15, 23, 42, 0.5)' : 'rgba(248, 250, 252, 0.6)',
        gridLine: themeMode === 'dark' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.35)',
        rowBorder: themeMode === 'dark' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.2)',
        weekend: themeMode === 'dark' ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.12)',
        groupBg: themeMode === 'dark' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.12)',
    }), [themeMode]);

    const statusColorMap = useMemo(() => {
        const map: Record<string, string> = {};
        statuses.forEach((s) => { map[s.name] = s.color; });
        return map;
    }, [statuses]);

    const resourceColorMap = useMemo(() => {
        const map: Record<string, string> = {};
        resources.forEach((r) => { map[r.name] = r.color; });
        return map;
    }, [resources]);

    // Group tasks by resource
    const resourceGroups: ResourceGroup[] = useMemo(() => {
        const groups: Map<string, Task[]> = new Map();

        tasks.forEach((task) => {
            const resourceName = task.resource || 'Unassigned';
            if (!groups.has(resourceName)) {
                groups.set(resourceName, []);
            }
            groups.get(resourceName)!.push(task);
        });

        return Array.from(groups.entries()).map(([resource, resourceTasks]) => {
            const dates = resourceTasks.flatMap(t => [new Date(t.start_date), new Date(t.end_date)]);
            return {
                resource,
                tasks: resourceTasks,
                minDate: d3.min(dates) || new Date(),
                maxDate: d3.max(dates) || new Date(),
                color: resourceColorMap[resource] || '#6366f1',
            };
        }).sort((a, b) => a.resource.localeCompare(b.resource));
    }, [tasks, resourceColorMap]);

    // Calculate overall date range
    const { minDate, maxDate } = useMemo(() => {
        if (tasks.length === 0) {
            const today = new Date();
            return {
                minDate: new Date(today.getFullYear(), today.getMonth(), 1),
                maxDate: new Date(today.getFullYear(), today.getMonth() + 3, 0),
            };
        }
        const dates = tasks.flatMap((t) => [new Date(t.start_date), new Date(t.end_date)]);
        const min = d3.min(dates) || new Date();
        const max = d3.max(dates) || new Date();
        let daysPadding = 7;
        if (viewMode === 'monthly') daysPadding = 15;
        if (viewMode === 'quarterly') daysPadding = 30;
        return { minDate: d3.timeDay.offset(min, -daysPadding), maxDate: d3.timeDay.offset(max, daysPadding * 2) };
    }, [tasks, viewMode]);

    const getTimeInterval = useCallback(() => {
        switch (viewMode) {
            case 'daily': return d3.timeDay;
            case 'weekly': return d3.timeWeek;
            case 'monthly': return d3.timeMonth;
            case 'quarterly': return d3.timeMonth.every(3);
            default: return d3.timeWeek;
        }
    }, [viewMode]);

    const getPixelsPerDay = useCallback(() => {
        switch (viewMode) {
            case 'daily': return 30;
            case 'weekly': return 12;
            case 'monthly': return 4;
            case 'quarterly': return 1.5;
            default: return 12;
        }
    }, [viewMode]);

    useEffect(() => {
        if (!containerRef.current || !svgRef.current) return;

        const container = containerRef.current;
        const svg = d3.select(svgRef.current);

        const updateChart = () => {
            const containerWidth = container.clientWidth;
            const margin = { top: HEADER_HEIGHT, right: 20, bottom: 20, left: 120 };

            const daysDiff = d3.timeDay.count(minDate, maxDate);
            const pixelsPerDay = getPixelsPerDay();
            const calculatedWidth = Math.max(daysDiff * pixelsPerDay, containerWidth - margin.left - margin.right);

            const chartWidth = calculatedWidth;

            // Calculate total height based on mode
            let totalRows = 0;
            if (resourceViewMode === 'complete') {
                totalRows = resourceGroups.length;
            } else {
                resourceGroups.forEach(group => {
                    totalRows += 1; // Group header
                    totalRows += group.tasks.length;
                });
            }

            const chartHeight = Math.max(totalRows * ROW_HEIGHT, 200);
            const totalWidth = chartWidth + margin.left + margin.right;
            const totalHeight = chartHeight + margin.top + margin.bottom;

            svg.attr('width', totalWidth).attr('height', totalHeight);
            svg.selectAll('*').remove();

            const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);
            const xScale = d3.scaleTime().domain([minDate, maxDate]).range([0, chartWidth]);
            const timeInterval = getTimeInterval();
            const ticks = xScale.ticks(timeInterval);

            // Vertical grid lines
            g.selectAll('.grid-line').data(ticks).enter().append('line')
                .attr('class', 'grid-line')
                .attr('x1', d => xScale(d)).attr('x2', d => xScale(d))
                .attr('y1', 0).attr('y2', chartHeight)
                .attr('stroke', colors.gridLine).attr('stroke-width', 1);

            // Weekend highlighting - drawn BEFORE bars so it appears as background
            if (showWeekends && (viewMode === 'daily' || viewMode === 'weekly')) {
                const allDays = d3.timeDay.range(minDate, maxDate);
                allDays.forEach((day) => {
                    const dayOfWeek = day.getDay();
                    if (dayOfWeek === 0 || dayOfWeek === 6) {
                        const x = xScale(day);
                        const nextDay = d3.timeDay.offset(day, 1);
                        const width = xScale(nextDay) - x;
                        g.append('rect')
                            .attr('x', x).attr('y', 0)
                            .attr('width', width).attr('height', chartHeight)
                            .attr('fill', colors.weekend);
                    }
                });
            }

            // Today line
            const today = new Date();
            if (showTodayLine && today >= minDate && today <= maxDate) {
                g.append('line').attr('class', 'today-line')
                    .attr('x1', xScale(today)).attr('x2', xScale(today))
                    .attr('y1', 0).attr('y2', chartHeight)
                    .attr('stroke', '#ef4444').attr('stroke-width', 2);
            }

            // Draw content based on mode
            let currentY = 0;

            if (resourceViewMode === 'complete') {
                // Complete mode: one bar per resource
                resourceGroups.forEach((group, i) => {
                    const y = i * ROW_HEIGHT;

                    // Row background
                    g.append('rect')
                        .attr('x', 0).attr('y', y)
                        .attr('width', chartWidth).attr('height', ROW_HEIGHT)
                        .attr('fill', i % 2 === 0 ? colors.rowEven : colors.rowOdd);

                    // Horizontal line
                    g.append('line')
                        .attr('x1', 0).attr('x2', chartWidth)
                        .attr('y1', y + ROW_HEIGHT).attr('y2', y + ROW_HEIGHT)
                        .attr('stroke', colors.rowBorder).attr('stroke-width', 1);

                    // Resource label (in left margin)
                    svg.append('text')
                        .attr('x', margin.left - 8)
                        .attr('y', margin.top + y + ROW_HEIGHT / 2 + 4)
                        .attr('text-anchor', 'end')
                        .attr('fill', colors.headerText)
                        .attr('font-size', '11px')
                        .attr('font-weight', '500')
                        .text(group.resource);

                    // Occupancy bar
                    const barX = xScale(group.minDate);
                    const barWidth = Math.max(xScale(group.maxDate) - barX, 6);
                    const actualBarHeight = ganttBarStyle === 'round-corners' ? BAR_HEIGHT * 1.2 : BAR_HEIGHT;
                    const actualBarPadding = (ROW_HEIGHT - actualBarHeight) / 2;
                    const barY = y + actualBarPadding;
                    const borderRadius = ganttBarStyle === 'round-corners' ? actualBarHeight / 2 : 3;
                    const borderColor = d3.color(group.color)?.darker(0.5)?.toString() || group.color;

                    const mainBar = g.append('rect')
                        .attr('x', barX).attr('y', barY)
                        .attr('width', barWidth).attr('height', actualBarHeight)
                        .attr('rx', borderRadius)
                        .attr('fill', group.color)
                        .attr('opacity', 0.95);
                    if (ganttBarStyle === 'round-corners') {
                        mainBar.attr('stroke', borderColor).attr('stroke-width', 1.5);
                    }

                    // Task count label
                    if (barWidth > 40) {
                        g.append('text')
                            .attr('x', barX + 4)
                            .attr('y', barY + actualBarHeight / 2 + 4)
                            .attr('fill', '#fff')
                            .attr('font-size', '10px')
                            .attr('font-weight', '500')
                            .text(`${group.tasks.length} tasks`);
                    }
                });
            } else {
                // Task mode: group header + individual tasks
                resourceGroups.forEach((group) => {
                    // Group header row
                    g.append('rect')
                        .attr('x', 0).attr('y', currentY)
                        .attr('width', chartWidth).attr('height', ROW_HEIGHT)
                        .attr('fill', colors.groupBg);

                    svg.append('text')
                        .attr('x', margin.left - 8)
                        .attr('y', margin.top + currentY + ROW_HEIGHT / 2 + 4)
                        .attr('text-anchor', 'end')
                        .attr('fill', group.color)
                        .attr('font-size', '12px')
                        .attr('font-weight', '600')
                        .text(group.resource);

                    g.append('line')
                        .attr('x1', 0).attr('x2', chartWidth)
                        .attr('y1', currentY + ROW_HEIGHT).attr('y2', currentY + ROW_HEIGHT)
                        .attr('stroke', colors.rowBorder).attr('stroke-width', 1);

                    currentY += ROW_HEIGHT;

                    // Task rows under this resource
                    group.tasks.forEach((task, taskIdx) => {
                        const y = currentY;

                        // Row background
                        g.append('rect')
                            .attr('x', 0).attr('y', y)
                            .attr('width', chartWidth).attr('height', ROW_HEIGHT)
                            .attr('fill', taskIdx % 2 === 0 ? colors.rowEven : colors.rowOdd);

                        g.append('line')
                            .attr('x1', 0).attr('x2', chartWidth)
                            .attr('y1', y + ROW_HEIGHT).attr('y2', y + ROW_HEIGHT)
                            .attr('stroke', colors.rowBorder).attr('stroke-width', 1);

                        // Task label
                        svg.append('text')
                            .attr('x', margin.left - 8)
                            .attr('y', margin.top + y + ROW_HEIGHT / 2 + 4)
                            .attr('text-anchor', 'end')
                            .attr('fill', colors.headerText)
                            .attr('font-size', '10px')
                            .text(task.task_id);

                        // Task bar
                        const startDate = new Date(task.start_date);
                        const endDate = new Date(task.end_date);
                        const barX = xScale(startDate);
                        const barWidth = Math.max(xScale(endDate) - barX, 6);
                        const actualBarHeight = ganttBarStyle === 'round-corners' ? BAR_HEIGHT * 1.2 : BAR_HEIGHT;
                        const actualBarPadding = (ROW_HEIGHT - actualBarHeight) / 2;
                        const barY = y + actualBarPadding;
                        const statusColor = statusColorMap[task.status] || '#6366f1';
                        const borderRadius = ganttBarStyle === 'round-corners' ? actualBarHeight / 2 : 3;
                        const borderColor = d3.color(statusColor)?.darker(0.5)?.toString() || statusColor;

                        g.append('rect')
                            .attr('x', barX + 1).attr('y', barY + 1)
                            .attr('width', barWidth).attr('height', actualBarHeight)
                            .attr('rx', borderRadius).attr('fill', 'rgba(0,0,0,0.15)');

                        const mainBar = g.append('rect')
                            .attr('x', barX).attr('y', barY)
                            .attr('width', barWidth).attr('height', actualBarHeight)
                            .attr('rx', borderRadius).attr('fill', statusColor)
                            .attr('opacity', 0.95)
                            .style('cursor', 'pointer');
                        if (ganttBarStyle === 'round-corners') {
                            mainBar.attr('stroke', borderColor).attr('stroke-width', 1.5);
                        }

                        currentY += ROW_HEIGHT;
                    });
                });
            }

            // === HEADER ===
            svg.append('rect').attr('x', 0).attr('y', 0).attr('width', totalWidth).attr('height', HEADER_ROW_0).attr('fill', colors.headerBgAlt);
            svg.append('rect').attr('x', 0).attr('y', HEADER_ROW_0).attr('width', totalWidth).attr('height', HEADER_ROW_1).attr('fill', colors.headerBg);
            svg.append('line').attr('x1', 0).attr('x2', totalWidth).attr('y1', HEADER_ROW_0).attr('y2', HEADER_ROW_0).attr('stroke', colors.gridLine).attr('stroke-width', 1);

            // Group ticks by parent
            const parentGroups: Map<string, { start: Date; end: Date; label: string }> = new Map();
            ticks.forEach((tick) => {
                let parentKey: string, parentLabel: string;
                if (viewMode === 'daily' || viewMode === 'weekly') {
                    parentKey = d3.timeFormat('%Y-%m')(tick);
                    parentLabel = d3.timeFormat('%B %Y')(tick);
                } else {
                    parentKey = d3.timeFormat('%Y')(tick);
                    parentLabel = d3.timeFormat('%Y')(tick);
                }
                if (!parentGroups.has(parentKey)) {
                    parentGroups.set(parentKey, { start: tick, end: tick, label: parentLabel });
                } else {
                    parentGroups.get(parentKey)!.end = tick;
                }
            });

            // Header Row 0
            let groupIndex = 0;
            parentGroups.forEach((group) => {
                const startX = xScale(group.start) + margin.left;
                const endX = xScale(group.end) + margin.left + 50;
                if (groupIndex > 0) {
                    svg.append('line').attr('x1', startX).attr('x2', startX).attr('y1', 0).attr('y2', HEADER_ROW_0).attr('stroke', colors.gridLine).attr('stroke-width', 1);
                }
                svg.append('text').attr('x', (startX + endX) / 2).attr('y', HEADER_ROW_0 / 2 + 4).attr('text-anchor', 'middle').attr('fill', colors.headerText).attr('font-size', '10px').attr('font-weight', '600').text(group.label);
                groupIndex++;
            });

            // Header Row 1
            svg.selectAll('.header-text-r1').data(ticks).enter().append('text')
                .attr('class', 'header-text-r1')
                .attr('x', d => xScale(d) + margin.left)
                .attr('y', HEADER_ROW_0 + HEADER_ROW_1 / 2 + 4)
                .attr('text-anchor', 'middle')
                .attr('fill', colors.headerText)
                .attr('font-size', viewMode === 'daily' ? '9px' : '10px')
                .attr('font-weight', '500')
                .text(d => {
                    switch (viewMode) {
                        case 'daily': return d3.timeFormat('%d')(d);
                        case 'weekly': return d3.timeFormat('%d')(d);
                        case 'monthly': return d3.timeFormat('%b')(d);
                        case 'quarterly': return `Q${Math.floor((d as Date).getMonth() / 3) + 1}`;
                        default: return d3.timeFormat('%d')(d);
                    }
                });

            // Today label
            if (showTodayLine && today >= minDate && today <= maxDate) {
                svg.append('text').attr('x', xScale(today) + margin.left).attr('y', HEADER_HEIGHT - 2)
                    .attr('text-anchor', 'middle').attr('fill', '#ef4444').attr('font-size', '7px').attr('font-weight', '600').text('▼');
            }

            // Today toggle
            svg.append('rect')
                .attr('x', 4).attr('y', 2).attr('width', 16).attr('height', 16).attr('rx', 3)
                .attr('fill', showTodayLine ? 'rgba(239, 68, 68, 0.3)' : 'rgba(99, 102, 241, 0.2)')
                .attr('stroke', showTodayLine ? '#ef4444' : 'rgba(99, 102, 241, 0.5)')
                .attr('stroke-width', 1).style('cursor', 'pointer')
                .on('click', () => dispatch(toggleTodayLine()));
            svg.append('text')
                .attr('x', 12).attr('y', 14).attr('text-anchor', 'middle')
                .attr('fill', showTodayLine ? '#ef4444' : colors.headerText)
                .attr('font-size', '9px').attr('font-weight', '600').style('cursor', 'pointer').text('T')
                .on('click', () => dispatch(toggleTodayLine()));

            // Left margin header
            svg.append('rect').attr('x', 0).attr('y', 0).attr('width', margin.left).attr('height', HEADER_HEIGHT).attr('fill', colors.headerBg);
            svg.append('text').attr('x', margin.left / 2).attr('y', HEADER_HEIGHT / 2 + 4).attr('text-anchor', 'middle').attr('fill', colors.headerText).attr('font-size', '11px').attr('font-weight', '600').text('Resources');
        };

        const resizeObserver = new ResizeObserver(() => updateChart());
        resizeObserver.observe(container);
        updateChart();

        return () => resizeObserver.disconnect();
    }, [resourceGroups, minDate, maxDate, viewMode, themeMode, showTodayLine, showWeekends, resourceViewMode, colors, statusColorMap, getTimeInterval, getPixelsPerDay, dispatch]);

    const handleModeChange = (_: React.MouseEvent<HTMLElement>, newMode: ResourceViewMode | null) => {
        if (newMode) {
            dispatch(setResourceViewMode(newMode));
        }
    };

    // Handle AI analysis
    const handleAnalyzeResources = async () => {
        if (!ollamaModel) {
            setAnalysisError('No AI model configured. Please go to Settings → AI Settings to configure Ollama.');
            return;
        }

        dispatch(setAiAnalysisLoading(true));
        dispatch(clearResourceAnalysis());
        setAnalysisError(null);

        try {
            const results = await analyzeResources(
                ollamaPort,
                ollamaModel,
                tasks,
                currentProject?.start_date || null,
                currentProject?.end_date || null,
                resources // Pass resources data for availability calculations
            );
            dispatch(setResourceAnalysis(results));
        } catch (error) {
            setAnalysisError(error instanceof Error ? error.message : 'Analysis failed');
            dispatch(clearResourceAnalysis());
        } finally {
            dispatch(setAiAnalysisLoading(false));
        }
    };

    // Resource status indicator component
    const ResourceStatusIndicator = ({ resourceName }: { resourceName: string }) => {
        const analysis = resourceAnalysis[resourceName];
        if (!analysis) return null;

        const statusConfig = {
            'optimal': {
                color: '#10b981',
                bgColor: 'rgba(16, 185, 129, 0.15)',
                icon: <CheckCircleIcon sx={{ fontSize: 14 }} />,
                label: 'Optimal'
            },
            'under-loaded': {
                color: '#3b82f6', // Blue for under (has spare capacity)
                bgColor: 'rgba(59, 130, 246, 0.15)',
                icon: <WarningIcon sx={{ fontSize: 14 }} />,
                label: 'Under'
            },
            'over-loaded': {
                color: '#ef4444',
                bgColor: 'rgba(239, 68, 68, 0.15)',
                icon: <ErrorOutlineIcon sx={{ fontSize: 14 }} />,
                label: 'Over'
            }
        };

        const config = statusConfig[analysis.status];
        const roundedPercent = Math.round(analysis.percentage);

        // Build tooltip content
        let tooltipContent = `${roundedPercent}% - ${analysis.summary}`;
        if (analysis.hasOverlaps && analysis.overlaps && analysis.overlaps.length > 0) {
            tooltipContent += `\n\n⚠️ OVERLAPPING TASKS:\n` +
                analysis.overlaps.map(o =>
                    `• ${o.task1.task_id} ↔ ${o.task2.task_id} (${o.overlapDays} days)`
                ).join('\n');
        }

        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{tooltipContent}</span>} arrow placement="right">
                    <Chip
                        size="small"
                        icon={config.icon}
                        label={`${roundedPercent}%`}

                        sx={{
                            height: 22,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: config.color,
                            bgcolor: config.bgColor,
                            border: `1px solid ${config.color}`,
                            '& .MuiChip-icon': {
                                color: config.color,
                                marginLeft: '6px',
                                marginRight: '-2px',
                            },
                            '& .MuiChip-label': {
                                padding: '0 8px 0 6px',
                            },
                        }}

                    />
                </Tooltip>
                {analysis.hasOverlaps && (
                    <Tooltip title="Has overlapping tasks" arrow>
                        <WarningIcon sx={{ fontSize: 14, color: '#f59e0b' }} />
                    </Tooltip>
                )}
            </Box>
        );
    };

    if (tasks.length === 0) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', bgcolor: 'background.default' }}>
                <Typography color="text.secondary">No tasks to display</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.default' }}>
            {/* Mode Toggle and AI Button */}
            <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="caption" color="text.secondary">View:</Typography>
                <ToggleButtonGroup
                    value={resourceViewMode}
                    exclusive
                    onChange={handleModeChange}
                    size="small"
                    sx={{
                        '& .MuiToggleButton-root': {
                            px: 1.5, py: 0.25, textTransform: 'none', fontSize: '0.75rem',
                            '&.Mui-selected': { bgcolor: 'rgba(99, 102, 241, 0.2)', color: '#818cf8' },
                        },
                    }}
                >
                    <ToggleButton value="task">Task</ToggleButton>
                    <ToggleButton value="complete">Complete</ToggleButton>
                </ToggleButtonGroup>

                <Box sx={{ flex: 1 }} />

                {/* AI Analysis Button */}
                <Tooltip title={ollamaModel ? `Analyze with ${ollamaModel}` : 'Configure AI model in Settings → AI Settings'}>
                    <span>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={handleAnalyzeResources}
                            disabled={aiAnalysisLoading || !ollamaModel}
                            startIcon={aiAnalysisLoading ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon />}
                            sx={{
                                textTransform: 'none',
                                fontSize: '0.75rem',
                                borderColor: 'rgba(99, 102, 241, 0.5)',
                                color: '#818cf8',
                                '&:hover': {
                                    borderColor: '#818cf8',
                                    bgcolor: 'rgba(99, 102, 241, 0.1)',
                                },
                                '&.Mui-disabled': {
                                    borderColor: 'rgba(99, 102, 241, 0.2)',
                                },
                            }}
                        >
                            {aiAnalysisLoading ? 'Analyzing...' : 'Analyze by AI'}
                        </Button>
                    </span>
                </Tooltip>

                {/* Clear Analysis Button */}
                {Object.keys(resourceAnalysis).length > 0 && (
                    <Button
                        variant="text"
                        size="small"
                        onClick={() => dispatch(clearResourceAnalysis())}
                        sx={{
                            textTransform: 'none',
                            fontSize: '0.7rem',
                            color: 'text.secondary',
                            minWidth: 'auto',
                        }}
                    >
                        Clear
                    </Button>
                )}
            </Box>

            {/* Analysis Status Chips */}
            {Object.keys(resourceAnalysis).length > 0 && (
                <Box sx={{ px: 1, py: 0.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', flexWrap: 'wrap', gap: 1, bgcolor: 'action.hover' }}>
                    {resourceGroups.map(group => (
                        <Box key={group.resource} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                                {group.resource}:
                            </Typography>
                            <ResourceStatusIndicator resourceName={group.resource} />
                        </Box>
                    ))}
                </Box>
            )}

            {/* Chart */}
            <Box ref={containerRef} sx={{ flexGrow: 1, overflow: 'auto' }}>
                <svg ref={svgRef} style={{ display: 'block' }} />
            </Box>

            {/* Error Snackbar */}
            <Snackbar
                open={!!analysisError}
                autoHideDuration={6000}
                onClose={() => setAnalysisError(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setAnalysisError(null)} severity="error" sx={{ width: '100%' }}>
                    {analysisError}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default ResourceGanttChart;
