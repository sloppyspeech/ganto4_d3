import { useEffect, useRef, useMemo, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import * as d3 from 'd3';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { toggleTodayLine } from '../store/slices/uiSlice';
import type { Task } from '../api/api';

const ROW_HEIGHT = 36;
const HEADER_ROW_0 = 20; // Parent row (Month/Year)
const HEADER_ROW_1 = 20; // Child row (Day/Week/Quarter)
const HEADER_HEIGHT = HEADER_ROW_0 + HEADER_ROW_1; // Total header height
const BAR_HEIGHT = 20;
const BAR_PADDING = (ROW_HEIGHT - BAR_HEIGHT) / 2;
const MILESTONE_SIZE = 32;

const GanttChart = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const dispatch = useAppDispatch();
    const { items: tasks } = useAppSelector((state) => state.tasks);
    const { statuses } = useAppSelector((state) => state.settings);
    const { viewMode, ganttScrollTop, themeMode, showTodayLine, showWeekends, showTaskIdInGantt, showDependencyLines, ganttBarStyle } = useAppSelector((state) => state.ui);

    const colors = useMemo(() => ({
        headerBg: themeMode === 'dark' ? '#1e293b' : '#e2e8f0',
        headerBgAlt: themeMode === 'dark' ? '#0f172a' : '#cbd5e1',
        headerText: themeMode === 'dark' ? '#e2e8f0' : '#1e293b',
        rowEven: themeMode === 'dark' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.06)',
        rowOdd: themeMode === 'dark' ? 'rgba(15, 23, 42, 0.5)' : 'rgba(241, 245, 249, 0.8)',
        gridLine: themeMode === 'dark' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.35)',
        rowBorder: themeMode === 'dark' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.2)',
        weekend: themeMode === 'dark' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.08)',
    }), [themeMode]);

    const statusColorMap = useMemo(() => {
        const map: Record<string, string> = {};
        statuses.forEach((s) => { map[s.name] = s.color; });
        return map;
    }, [statuses]);

    const taskMap = useMemo(() => {
        const map: Record<string, Task> = {};
        tasks.forEach((t) => { map[t.task_id] = t; });
        return map;
    }, [tasks]);

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
            const margin = { top: HEADER_HEIGHT, right: 20, bottom: 20, left: 10 };

            const daysDiff = d3.timeDay.count(minDate, maxDate);
            const pixelsPerDay = getPixelsPerDay();
            const calculatedWidth = Math.max(daysDiff * pixelsPerDay, containerWidth - margin.left - margin.right);

            const chartWidth = calculatedWidth;
            const chartHeight = Math.max(tasks.length * ROW_HEIGHT, 200);
            const totalWidth = chartWidth + margin.left + margin.right;
            const totalHeight = chartHeight + margin.top + margin.bottom;

            svg.attr('width', totalWidth).attr('height', totalHeight);
            svg.selectAll('*').remove();

            const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);
            const xScale = d3.scaleTime().domain([minDate, maxDate]).range([0, chartWidth]);
            const timeInterval = getTimeInterval();
            const ticks = xScale.ticks(timeInterval);

            // Weekend highlighting (only for daily and weekly views)
            if (showWeekends && (viewMode === 'daily' || viewMode === 'weekly')) {
                const allDays = d3.timeDay.range(minDate, maxDate);
                allDays.forEach((day) => {
                    const dayOfWeek = day.getDay();
                    if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday=0, Saturday=6
                        const x = xScale(day);
                        const nextDay = d3.timeDay.offset(day, 1);
                        const width = xScale(nextDay) - x;

                        // Weekend column in chart area
                        g.append('rect')
                            .attr('x', x)
                            .attr('y', 0)
                            .attr('width', width)
                            .attr('height', chartHeight)
                            .attr('fill', colors.weekend);
                    }
                });
            }

            // Row backgrounds
            g.selectAll('.row-bg').data(tasks).enter().append('rect')
                .attr('class', 'row-bg')
                .attr('x', 0).attr('y', (_, i) => i * ROW_HEIGHT)
                .attr('width', chartWidth).attr('height', ROW_HEIGHT)
                .attr('fill', (_, i) => (i % 2 === 0 ? colors.rowEven : colors.rowOdd));

            // Horizontal row lines
            g.selectAll('.row-line').data(tasks).enter().append('line')
                .attr('class', 'row-line')
                .attr('x1', 0).attr('x2', chartWidth)
                .attr('y1', (_, i) => (i + 1) * ROW_HEIGHT).attr('y2', (_, i) => (i + 1) * ROW_HEIGHT)
                .attr('stroke', colors.rowBorder).attr('stroke-width', 1);

            // Vertical grid lines
            g.selectAll('.grid-line').data(ticks).enter().append('line')
                .attr('class', 'grid-line')
                .attr('x1', d => xScale(d)).attr('x2', d => xScale(d))
                .attr('y1', 0).attr('y2', chartHeight)
                .attr('stroke', colors.gridLine).attr('stroke-width', 1);

            // Today line
            const today = new Date();
            if (showTodayLine && today >= minDate && today <= maxDate) {
                g.append('line').attr('class', 'today-line')
                    .attr('x1', xScale(today)).attr('x2', xScale(today))
                    .attr('y1', 0).attr('y2', chartHeight)
                    .attr('stroke', '#ef4444').attr('stroke-width', 2);
            }

            // Task bars
            tasks.forEach((task, i) => {
                const startDate = new Date(task.start_date);
                const endDate = new Date(task.end_date);
                const x = xScale(startDate);
                const barWidth = Math.max(xScale(endDate) - xScale(startDate), 6);
                const y = i * ROW_HEIGHT + BAR_PADDING;
                const statusColor = statusColorMap[task.status] || '#6366f1';

                if (task.task_type === 'Milestone') {
                    const centerX = x, centerY = i * ROW_HEIGHT + ROW_HEIGHT / 2, halfSize = MILESTONE_SIZE / 2;
                    g.append('polygon')
                        .attr('points', `${centerX},${centerY - halfSize} ${centerX + halfSize},${centerY} ${centerX},${centerY + halfSize} ${centerX - halfSize},${centerY}`)
                        .attr('fill', statusColor).attr('stroke', '#fff').attr('stroke-width', 1).style('cursor', 'pointer');
                } else {
                    // Calculate bar height based on style
                    const actualBarHeight = ganttBarStyle === 'round-corners' ? BAR_HEIGHT * 1.2 : BAR_HEIGHT;
                    const actualBarPadding = (ROW_HEIGHT - actualBarHeight) / 2;
                    const actualY = i * ROW_HEIGHT + actualBarPadding;
                    const borderRadius = ganttBarStyle === 'round-corners' ? actualBarHeight / 2 : 3;
                    const borderColor = d3.color(statusColor)?.darker(0.5)?.toString() || statusColor;

                    const gradientId = `gradient-${task.id}`;
                    const defs = svg.append('defs');
                    const gradient = defs.append('linearGradient').attr('id', gradientId).attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%');
                    gradient.append('stop').attr('offset', '0%').attr('stop-color', d3.color(statusColor)?.brighter(0.3)?.toString() || statusColor);
                    gradient.append('stop').attr('offset', '100%').attr('stop-color', statusColor);

                    // Shadow
                    g.append('rect').attr('x', x + 1).attr('y', actualY + 1).attr('width', barWidth).attr('height', actualBarHeight).attr('rx', borderRadius).attr('fill', 'rgba(0,0,0,0.15)');

                    // Main bar with border for round-corners style
                    const mainBar = g.append('rect').attr('x', x).attr('y', actualY).attr('width', barWidth).attr('height', actualBarHeight).attr('rx', borderRadius).attr('fill', `url(#${gradientId})`).style('cursor', 'pointer');
                    if (ganttBarStyle === 'round-corners') {
                        mainBar.attr('stroke', borderColor).attr('stroke-width', 1.5);
                    }

                    // Progress bar (bullet chart style) - darker bar inside
                    const progress = Math.max(0, Math.min(100, task.progress || 0));
                    if (progress > 0) {
                        const progressWidth = (barWidth - 4) * (progress / 100);
                        const progressColor = d3.color(statusColor)?.darker(0.8)?.toString() || '#1e1e1e';
                        const progressHeight = ganttBarStyle === 'round-corners' ? 11 : 9;
                        g.append('rect')
                            .attr('x', x + 2)
                            .attr('y', actualY + actualBarHeight / 2 - progressHeight / 2)
                            .attr('width', progressWidth)
                            .attr('height', progressHeight)
                            .attr('rx', ganttBarStyle === 'round-corners' ? progressHeight / 2 : 2)
                            .attr('fill', progressColor)
                            .attr('opacity', 0.9);
                    }

                    const labelText = task.task_id, labelWidth = labelText.length * 6;
                    if (showTaskIdInGantt && barWidth > labelWidth + 8) {
                        g.append('text').attr('x', x + 4).attr('y', y + BAR_HEIGHT / 2 + 4).attr('fill', '#fff').attr('font-size', '10px').attr('font-weight', '500').text(labelText);
                    }
                }
            });

            // Dependency lines
            if (showDependencyLines) {
                tasks.forEach((task, taskIndex) => {
                    if (task.parent_ids) {
                        const parentIds = task.parent_ids.split(',').map((id) => id.trim());
                        parentIds.forEach((parentId) => {
                            const parentTask = taskMap[parentId];
                            if (parentTask) {
                                const parentIndex = tasks.findIndex((t) => t.task_id === parentId);
                                if (parentIndex !== -1) {
                                    const parentStartX = xScale(new Date(parentTask.start_date));
                                    const parentBarWidth = Math.max(xScale(new Date(parentTask.end_date)) - parentStartX, 6);
                                    const parentBarEndX = parentStartX + parentBarWidth;
                                    const parentY = parentIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                                    const childStartX = xScale(new Date(task.start_date));
                                    const childY = taskIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

                                    const midX = parentBarEndX + 8;
                                    g.append('path').attr('d', `M ${parentBarEndX} ${parentY} H ${midX} V ${childY} H ${childStartX}`)
                                        .attr('fill', 'none').attr('stroke', '#6366f1').attr('stroke-width', 1.5).attr('stroke-opacity', 0.7);
                                    g.append('polygon').attr('points', '-5,-3 0,0 -5,3').attr('transform', `translate(${childStartX}, ${childY})`).attr('fill', '#6366f1').attr('opacity', 0.8);
                                }
                            }
                        });
                    }
                });
            }

            // === TWO-ROW HEADER ===
            // Row 0 background (darker)
            svg.append('rect').attr('x', 0).attr('y', 0).attr('width', totalWidth).attr('height', HEADER_ROW_0).attr('fill', colors.headerBgAlt);
            // Row 1 background
            svg.append('rect').attr('x', 0).attr('y', HEADER_ROW_0).attr('width', totalWidth).attr('height', HEADER_ROW_1).attr('fill', colors.headerBg);
            // Separator line
            svg.append('line').attr('x1', 0).attr('x2', totalWidth).attr('y1', HEADER_ROW_0).attr('y2', HEADER_ROW_0).attr('stroke', colors.gridLine).attr('stroke-width', 1);

            // Group ticks by parent (month or year)
            const parentGroups: Map<string, { start: Date; end: Date; label: string }> = new Map();

            ticks.forEach((tick, idx) => {
                let parentKey: string;
                let parentLabel: string;

                if (viewMode === 'daily' || viewMode === 'weekly') {
                    // Parent = Month Year
                    parentKey = d3.timeFormat('%Y-%m')(tick);
                    parentLabel = d3.timeFormat('%B %Y')(tick);
                } else {
                    // Parent = Year
                    parentKey = d3.timeFormat('%Y')(tick);
                    parentLabel = d3.timeFormat('%Y')(tick);
                }

                if (!parentGroups.has(parentKey)) {
                    parentGroups.set(parentKey, { start: tick, end: tick, label: parentLabel });
                } else {
                    const group = parentGroups.get(parentKey)!;
                    group.end = tick;
                }
            });

            // Draw Row 0 labels (parent groups) with separators
            let groupIndex = 0;
            parentGroups.forEach((group) => {
                const startX = xScale(group.start) + margin.left;
                const endX = xScale(group.end) + margin.left + 50; // Add some width for last tick
                const centerX = (startX + endX) / 2;

                // Separator line between groups (skip first)
                if (groupIndex > 0) {
                    svg.append('line')
                        .attr('x1', startX)
                        .attr('x2', startX)
                        .attr('y1', 0)
                        .attr('y2', HEADER_ROW_0)
                        .attr('stroke', colors.gridLine)
                        .attr('stroke-width', 1);
                }

                svg.append('text')
                    .attr('x', centerX)
                    .attr('y', HEADER_ROW_0 / 2 + 4)
                    .attr('text-anchor', 'middle')
                    .attr('fill', colors.headerText)
                    .attr('font-size', '10px')
                    .attr('font-weight', '600')
                    .text(group.label);

                groupIndex++;
            });

            // Draw Row 1 labels (individual ticks)
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
                        case 'daily': return d3.timeFormat('%d')(d); // Just day number
                        case 'weekly': return d3.timeFormat('%d')(d); // Just day number
                        case 'monthly': return d3.timeFormat('%b')(d); // Just month name
                        case 'quarterly': return `Q${Math.floor((d as Date).getMonth() / 3) + 1}`; // Just quarter
                        default: return d3.timeFormat('%d')(d);
                    }
                });

            // Today label in header
            if (showTodayLine && today >= minDate && today <= maxDate) {
                svg.append('text').attr('x', xScale(today) + margin.left).attr('y', HEADER_HEIGHT - 2)
                    .attr('text-anchor', 'middle').attr('fill', '#ef4444').attr('font-size', '7px').attr('font-weight', '600').text('▼');
            }

            // Today toggle button in header Row 0
            svg.append('rect')
                .attr('x', 4).attr('y', 2)
                .attr('width', 16).attr('height', 16)
                .attr('rx', 3)
                .attr('fill', showTodayLine ? 'rgba(239, 68, 68, 0.3)' : 'rgba(99, 102, 241, 0.2)')
                .attr('stroke', showTodayLine ? '#ef4444' : 'rgba(99, 102, 241, 0.5)')
                .attr('stroke-width', 1)
                .style('cursor', 'pointer')
                .on('click', () => dispatch(toggleTodayLine()));

            svg.append('text')
                .attr('x', 12).attr('y', 14)
                .attr('text-anchor', 'middle')
                .attr('fill', showTodayLine ? '#ef4444' : colors.headerText)
                .attr('font-size', '9px').attr('font-weight', '600')
                .style('cursor', 'pointer')
                .text('T')
                .on('click', () => dispatch(toggleTodayLine()));
        };

        const resizeObserver = new ResizeObserver(() => updateChart());
        resizeObserver.observe(container);
        updateChart();

        return () => resizeObserver.disconnect();
    }, [tasks, minDate, maxDate, viewMode, themeMode, showTodayLine, showWeekends, showTaskIdInGantt, showDependencyLines, colors, statusColorMap, taskMap, getTimeInterval, getPixelsPerDay, dispatch]);

    useEffect(() => {
        if (containerRef.current) containerRef.current.scrollTop = ganttScrollTop;
    }, [ganttScrollTop]);

    if (tasks.length === 0) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', bgcolor: 'background.default' }}>
                <Typography color="text.secondary">No tasks to display</Typography>
            </Box>
        );
    }

    return (
        <Box ref={containerRef} sx={{ width: '100%', height: '100%', overflow: 'auto', bgcolor: 'background.default' }}>
            <svg ref={svgRef} style={{ display: 'block' }} />
        </Box>
    );
};

export default GanttChart;
