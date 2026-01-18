import { useEffect, useRef, useMemo, useState } from 'react';
import { Box, Typography, Paper, Grid, IconButton, Tooltip } from '@mui/material';
import * as d3 from 'd3';
import { useAppSelector } from '../store/hooks';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PieChartIcon from '@mui/icons-material/PieChart';
import BarChartIcon from '@mui/icons-material/BarChart';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const ProjectDashboard = () => {
    const { items: tasks } = useAppSelector((state) => state.tasks);
    const { statuses, resources } = useAppSelector((state) => state.settings);
    const { themeMode } = useAppSelector((state) => state.ui);

    // Chart type toggles
    const [statusChartType, setStatusChartType] = useState<'donut' | 'bar'>('donut');
    const [resourceChartType, setResourceChartType] = useState<'bar' | 'donut'>('bar');

    const statusChartRef = useRef<SVGSVGElement>(null);
    const resourceChartRef = useRef<SVGSVGElement>(null);
    const progressChartRef = useRef<SVGSVGElement>(null);
    const timelineChartRef = useRef<SVGSVGElement>(null);

    const isDark = themeMode === 'dark';

    const colors = useMemo(() => ({
        cardBg: isDark
            ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(241, 245, 249, 0.9) 100%)',
        cardBorder: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.15)',
        cardShadow: isDark
            ? '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
            : '0 8px 32px rgba(99, 102, 241, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05)',
        text: isDark ? '#f1f5f9' : '#0f172a',
        textSecondary: isDark ? '#94a3b8' : '#64748b',
        chartBg: isDark ? '#0f172a' : '#ffffff',
        gridLine: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)',
        accent: '#6366f1',
        accentGlow: isDark ? 'rgba(99, 102, 241, 0.4)' : 'rgba(99, 102, 241, 0.2)',
    }), [isDark]);

    // Calculate metrics
    const metrics = useMemo(() => {
        const total = tasks.length;
        const completed = tasks.filter(t => t.status === 'Completed').length;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
        const avgProgress = total > 0 ? Math.round(tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / total) : 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const overdue = tasks.filter(t => {
            const endDate = new Date(t.end_date);
            endDate.setHours(0, 0, 0, 0);
            return endDate < today && t.status !== 'Completed';
        }).length;

        return { total, completed, completionRate, avgProgress, overdue };
    }, [tasks]);

    // Status distribution data
    const statusData = useMemo(() => {
        const counts: Record<string, number> = {};
        tasks.forEach(t => {
            counts[t.status] = (counts[t.status] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({
            name,
            value,
            color: statuses.find(s => s.name === name)?.color || '#6366f1'
        }));
    }, [tasks, statuses]);

    // Resource workload data
    const resourceData = useMemo(() => {
        const counts: Record<string, number> = {};
        tasks.forEach(t => {
            const resourceName = t.resource || 'Unassigned';
            counts[resourceName] = (counts[resourceName] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({
                name,
                value,
                color: resources.find(r => r.name === name)?.color || '#8b5cf6'
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);
    }, [tasks, resources]);

    // Progress distribution data
    const progressData = useMemo(() => {
        const ranges = [
            { name: '0%', min: 0, max: 0, color: '#ef4444' },
            { name: '1-25%', min: 1, max: 25, color: '#f97316' },
            { name: '26-50%', min: 26, max: 50, color: '#eab308' },
            { name: '51-75%', min: 51, max: 75, color: '#22c55e' },
            { name: '76-99%', min: 76, max: 99, color: '#3b82f6' },
            { name: '100%', min: 100, max: 100, color: '#10b981' },
        ];
        return ranges.map(range => ({
            ...range,
            value: tasks.filter(t => {
                const p = t.progress || 0;
                return p >= range.min && p <= range.max;
            }).length
        }));
    }, [tasks]);

    // Timeline data
    const timelineData = useMemo(() => {
        if (tasks.length === 0) return [];
        const monthCounts: Record<string, number> = {};
        tasks.forEach(t => {
            const date = new Date(t.start_date);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthCounts[key] = (monthCounts[key] || 0) + 1;
        });
        return Object.entries(monthCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, count]) => ({ month, count }));
    }, [tasks]);

    // Status Distribution Chart (Donut or Bar)
    useEffect(() => {
        if (!statusChartRef.current || statusData.length === 0) return;
        const svg = d3.select(statusChartRef.current);
        svg.selectAll('*').remove();

        const width = 240, height = 220;

        if (statusChartType === 'donut') {
            // Donut Chart
            const radius = Math.min(width, height) / 2 - 10;
            const g = svg.attr('width', width).attr('height', height)
                .append('g').attr('transform', `translate(${width / 2}, ${height / 2})`);

            const defs = svg.append('defs');
            const filter = defs.append('filter').attr('id', 'glow');
            filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
            const feMerge = filter.append('feMerge');
            feMerge.append('feMergeNode').attr('in', 'coloredBlur');
            feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

            const pie = d3.pie<typeof statusData[0]>().value(d => d.value).sort(null).padAngle(0.03);
            const arc = d3.arc<d3.PieArcDatum<typeof statusData[0]>>()
                .innerRadius(radius * 0.6).outerRadius(radius).cornerRadius(6);

            g.selectAll('.arc').data(pie(statusData)).enter().append('path')
                .attr('d', arc).attr('fill', d => d.data.color)
                .style('filter', 'url(#glow)').style('cursor', 'pointer')
                .on('mouseover', function () { d3.select(this).attr('transform', 'scale(1.05)'); })
                .on('mouseout', function () { d3.select(this).attr('transform', 'scale(1)'); });

            g.append('text').attr('text-anchor', 'middle').attr('dy', '-0.1em')
                .attr('fill', colors.text).attr('font-size', '32px').attr('font-weight', '700')
                .text(tasks.length);
            g.append('text').attr('text-anchor', 'middle').attr('dy', '1.5em')
                .attr('fill', colors.textSecondary).attr('font-size', '11px').attr('font-weight', '500')
                .text('TOTAL TASKS');
        } else {
            // Bar Chart
            const margin = { top: 15, right: 30, bottom: 25, left: 90 };
            const chartW = width - margin.left - margin.right;
            const chartH = height - margin.top - margin.bottom;

            const g = svg.attr('width', width).attr('height', height)
                .append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

            const maxVal = d3.max(statusData, d => d.value) || 1;
            const xScale = d3.scaleLinear().domain([0, maxVal]).range([0, chartW]);
            const yScale = d3.scaleBand().domain(statusData.map(d => d.name)).range([0, chartH]).padding(0.3);

            const defs = svg.append('defs');
            statusData.forEach((d, i) => {
                const grad = defs.append('linearGradient').attr('id', `status-bar-${i}`).attr('x1', '0%').attr('x2', '100%');
                grad.append('stop').attr('offset', '0%').attr('stop-color', d.color);
                grad.append('stop').attr('offset', '100%').attr('stop-color', d3.color(d.color)?.brighter(0.3)?.toString() || d.color);
            });

            g.selectAll('.bg-bar').data(statusData).enter().append('rect')
                .attr('x', 0).attr('y', d => yScale(d.name) || 0)
                .attr('width', chartW).attr('height', yScale.bandwidth())
                .attr('fill', colors.gridLine).attr('rx', yScale.bandwidth() / 2);

            g.selectAll('.bar').data(statusData).enter().append('rect')
                .attr('x', 0).attr('y', d => yScale(d.name) || 0)
                .attr('width', d => xScale(d.value)).attr('height', yScale.bandwidth())
                .attr('fill', (_, i) => `url(#status-bar-${i})`).attr('rx', yScale.bandwidth() / 2);

            g.selectAll('.label').data(statusData).enter().append('text')
                .attr('x', -8).attr('y', d => (yScale(d.name) || 0) + yScale.bandwidth() / 2)
                .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
                .attr('fill', colors.textSecondary).attr('font-size', '10px').attr('font-weight', '500')
                .text(d => d.name);

            g.selectAll('.value').data(statusData).enter().append('text')
                .attr('x', d => xScale(d.value) + 6)
                .attr('y', d => (yScale(d.name) || 0) + yScale.bandwidth() / 2)
                .attr('dominant-baseline', 'middle')
                .attr('fill', colors.text).attr('font-size', '11px').attr('font-weight', '700')
                .text(d => d.value);
        }
    }, [statusData, colors, tasks.length, statusChartType]);

    // Resource Workload Chart (Bar or Donut)
    useEffect(() => {
        if (!resourceChartRef.current || resourceData.length === 0) return;
        const svg = d3.select(resourceChartRef.current);
        svg.selectAll('*').remove();

        const width = 280, height = 200;

        if (resourceChartType === 'bar') {
            // Bar Chart
            const margin = { top: 10, right: 30, bottom: 10, left: 90 };
            const chartW = width - margin.left - margin.right;
            const chartH = height - margin.top - margin.bottom;

            const g = svg.attr('width', width).attr('height', height)
                .append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

            const maxVal = d3.max(resourceData, d => d.value) || 1;
            const xScale = d3.scaleLinear().domain([0, maxVal]).range([0, chartW]);
            const yScale = d3.scaleBand().domain(resourceData.map(d => d.name)).range([0, chartH]).padding(0.35);

            const defs = svg.append('defs');
            resourceData.forEach((d, i) => {
                const grad = defs.append('linearGradient').attr('id', `res-bar-${i}`).attr('x1', '0%').attr('x2', '100%');
                grad.append('stop').attr('offset', '0%').attr('stop-color', d.color);
                grad.append('stop').attr('offset', '100%').attr('stop-color', d3.color(d.color)?.brighter(0.3)?.toString() || d.color);
            });

            g.selectAll('.bg-bar').data(resourceData).enter().append('rect')
                .attr('x', 0).attr('y', d => yScale(d.name) || 0)
                .attr('width', chartW).attr('height', yScale.bandwidth())
                .attr('fill', colors.gridLine).attr('rx', yScale.bandwidth() / 2);

            g.selectAll('.bar').data(resourceData).enter().append('rect')
                .attr('x', 0).attr('y', d => yScale(d.name) || 0)
                .attr('width', d => xScale(d.value)).attr('height', yScale.bandwidth())
                .attr('fill', (_, i) => `url(#res-bar-${i})`).attr('rx', yScale.bandwidth() / 2);

            g.selectAll('.label').data(resourceData).enter().append('text')
                .attr('x', -8).attr('y', d => (yScale(d.name) || 0) + yScale.bandwidth() / 2)
                .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
                .attr('fill', colors.textSecondary).attr('font-size', '11px').attr('font-weight', '500')
                .text(d => d.name);

            g.selectAll('.value').data(resourceData).enter().append('text')
                .attr('x', d => xScale(d.value) + 8)
                .attr('y', d => (yScale(d.name) || 0) + yScale.bandwidth() / 2)
                .attr('dominant-baseline', 'middle')
                .attr('fill', colors.text).attr('font-size', '12px').attr('font-weight', '700')
                .text(d => d.value);
        } else {
            // Donut Chart
            const radius = Math.min(width, height) / 2 - 15;
            const g = svg.attr('width', width).attr('height', height)
                .append('g').attr('transform', `translate(${width / 2}, ${height / 2})`);

            const defs = svg.append('defs');
            const filter = defs.append('filter').attr('id', 'glow-res');
            filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
            const feMerge = filter.append('feMerge');
            feMerge.append('feMergeNode').attr('in', 'coloredBlur');
            feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

            const pie = d3.pie<typeof resourceData[0]>().value(d => d.value).sort(null).padAngle(0.03);
            const arc = d3.arc<d3.PieArcDatum<typeof resourceData[0]>>()
                .innerRadius(radius * 0.55).outerRadius(radius).cornerRadius(5);

            g.selectAll('.arc').data(pie(resourceData)).enter().append('path')
                .attr('d', arc).attr('fill', d => d.data.color)
                .style('filter', 'url(#glow-res)').style('cursor', 'pointer')
                .on('mouseover', function () { d3.select(this).attr('transform', 'scale(1.05)'); })
                .on('mouseout', function () { d3.select(this).attr('transform', 'scale(1)'); });

            const totalResources = resourceData.reduce((sum, d) => sum + d.value, 0);
            g.append('text').attr('text-anchor', 'middle').attr('dy', '-0.1em')
                .attr('fill', colors.text).attr('font-size', '28px').attr('font-weight', '700')
                .text(totalResources);
            g.append('text').attr('text-anchor', 'middle').attr('dy', '1.4em')
                .attr('fill', colors.textSecondary).attr('font-size', '10px').attr('font-weight', '500')
                .text('ASSIGNMENTS');
        }
    }, [resourceData, colors, resourceChartType]);

    // Progress Distribution - Gradient Bars
    useEffect(() => {
        if (!progressChartRef.current) return;
        const svg = d3.select(progressChartRef.current);
        svg.selectAll('*').remove();

        const width = 280, height = 200;
        const margin = { top: 15, right: 15, bottom: 35, left: 30 };
        const chartW = width - margin.left - margin.right;
        const chartH = height - margin.top - margin.bottom;

        const g = svg.attr('width', width).attr('height', height)
            .append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

        const maxVal = Math.max(d3.max(progressData, d => d.value) || 1, 1);
        const xScale = d3.scaleBand().domain(progressData.map(d => d.name)).range([0, chartW]).padding(0.25);
        const yScale = d3.scaleLinear().domain([0, maxVal]).range([chartH, 0]);

        const defs = svg.append('defs');
        progressData.forEach((d, i) => {
            const grad = defs.append('linearGradient').attr('id', `prog-grad-${i}`).attr('x1', '0%').attr('y1', '100%').attr('x2', '0%').attr('y2', '0%');
            grad.append('stop').attr('offset', '0%').attr('stop-color', d.color).attr('stop-opacity', 0.8);
            grad.append('stop').attr('offset', '100%').attr('stop-color', d3.color(d.color)?.brighter(0.5)?.toString() || d.color);
        });

        g.selectAll('.bar').data(progressData).enter().append('rect')
            .attr('x', d => xScale(d.name) || 0).attr('y', d => yScale(d.value))
            .attr('width', xScale.bandwidth()).attr('height', d => chartH - yScale(d.value))
            .attr('fill', (_, i) => `url(#prog-grad-${i})`).attr('rx', 4);

        g.selectAll('.x-label').data(progressData).enter().append('text')
            .attr('x', d => (xScale(d.name) || 0) + xScale.bandwidth() / 2)
            .attr('y', chartH + 18).attr('text-anchor', 'middle')
            .attr('fill', colors.textSecondary).attr('font-size', '9px').attr('font-weight', '500')
            .text(d => d.name);

        g.selectAll('.val-label').data(progressData).enter().append('text')
            .attr('x', d => (xScale(d.name) || 0) + xScale.bandwidth() / 2)
            .attr('y', d => yScale(d.value) - 6).attr('text-anchor', 'middle')
            .attr('fill', colors.text).attr('font-size', '11px').attr('font-weight', '600')
            .text(d => d.value > 0 ? d.value : '');
    }, [progressData, colors]);

    // Timeline - Smooth Area Chart
    useEffect(() => {
        if (!timelineChartRef.current || timelineData.length === 0) return;
        const svg = d3.select(timelineChartRef.current);
        svg.selectAll('*').remove();

        const width = 280, height = 200;
        const margin = { top: 20, right: 20, bottom: 35, left: 35 };
        const chartW = width - margin.left - margin.right;
        const chartH = height - margin.top - margin.bottom;

        const g = svg.attr('width', width).attr('height', height)
            .append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

        const xScale = d3.scaleBand().domain(timelineData.map(d => d.month)).range([0, chartW]).padding(0.1);
        const maxCount = d3.max(timelineData, d => d.count) || 1;
        const yScale = d3.scaleLinear().domain([0, maxCount]).range([chartH, 0]);

        const defs = svg.append('defs');
        const areaGrad = defs.append('linearGradient').attr('id', 'area-gradient').attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%');
        areaGrad.append('stop').attr('offset', '0%').attr('stop-color', '#8b5cf6').attr('stop-opacity', 0.6);
        areaGrad.append('stop').attr('offset', '100%').attr('stop-color', '#6366f1').attr('stop-opacity', 0.05);

        const lineGrad = defs.append('linearGradient').attr('id', 'line-gradient').attr('x1', '0%').attr('x2', '100%');
        lineGrad.append('stop').attr('offset', '0%').attr('stop-color', '#6366f1');
        lineGrad.append('stop').attr('offset', '100%').attr('stop-color', '#a855f7');

        const area = d3.area<typeof timelineData[0]>()
            .x(d => (xScale(d.month) || 0) + xScale.bandwidth() / 2)
            .y0(chartH).y1(d => yScale(d.count)).curve(d3.curveMonotoneX);

        g.append('path').datum(timelineData).attr('d', area).attr('fill', 'url(#area-gradient)');

        const line = d3.line<typeof timelineData[0]>()
            .x(d => (xScale(d.month) || 0) + xScale.bandwidth() / 2)
            .y(d => yScale(d.count)).curve(d3.curveMonotoneX);

        g.append('path').datum(timelineData).attr('d', line)
            .attr('fill', 'none').attr('stroke', 'url(#line-gradient)').attr('stroke-width', 3);

        g.selectAll('.point').data(timelineData).enter().append('circle')
            .attr('cx', d => (xScale(d.month) || 0) + xScale.bandwidth() / 2)
            .attr('cy', d => yScale(d.count)).attr('r', 5)
            .attr('fill', '#8b5cf6').attr('stroke', colors.chartBg).attr('stroke-width', 2);

        g.selectAll('.x-label').data(timelineData).enter().append('text')
            .attr('x', d => (xScale(d.month) || 0) + xScale.bandwidth() / 2)
            .attr('y', chartH + 18).attr('text-anchor', 'middle')
            .attr('fill', colors.textSecondary).attr('font-size', '9px').attr('font-weight', '500')
            .text(d => {
                const [y, m] = d.month.split('-');
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return months[parseInt(m) - 1] + ' ' + y.slice(2);
            });
    }, [timelineData, colors]);

    const MetricCard = ({ icon, title, value, gradient, iconBg, infoTooltip }: { icon: React.ReactNode; title: string; value: string | number; gradient: string; iconBg: string; infoTooltip?: string }) => (
        <Paper
            elevation={0}
            sx={{
                p: 2.5, display: 'flex', alignItems: 'center', gap: 2.5,
                background: colors.cardBg, border: `1px solid ${colors.cardBorder}`,
                borderRadius: 2, boxShadow: colors.cardShadow, backdropFilter: 'blur(10px)',
                transition: 'all 0.3s ease',
                position: 'relative',
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: isDark
                        ? '0 12px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                        : '0 12px 40px rgba(99, 102, 241, 0.15), 0 4px 12px rgba(0, 0, 0, 0.08)',
                }
            }}
        >
            <Box sx={{ p: 1.5, borderRadius: 2.5, background: gradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 12px ${iconBg}` }}>
                {icon}
            </Box>
            <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '2rem', fontWeight: 700, color: colors.text, lineHeight: 1.1 }}>{value}</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: colors.textSecondary, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</Typography>
            </Box>
            {infoTooltip && (
                <Tooltip
                    title={infoTooltip}
                    placement="top"
                    arrow
                    slotProps={{
                        tooltip: {
                            sx: {
                                bgcolor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.9)',
                                color: '#fff',
                                fontSize: '0.75rem',
                                maxWidth: 250,
                                p: 1.5,
                                borderRadius: 1.5,
                                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                            }
                        }
                    }}
                >
                    <InfoOutlinedIcon sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        fontSize: 16,
                        color: colors.textSecondary,
                        cursor: 'help',
                        opacity: 0.6,
                        '&:hover': { opacity: 1 }
                    }} />
                </Tooltip>
            )}
        </Paper>
    );

    if (tasks.length === 0) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', p: 4 }}>
                <Typography color="text.secondary">No tasks to display. Add some tasks to see the dashboard.</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3, overflow: 'auto', height: '100%', background: isDark ? 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)' : 'linear-gradient(180deg, #f8fafc 0%, #e0e7ff 100%)' }}>
            {/* Metric Cards */}
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <MetricCard
                        icon={<AssignmentIcon sx={{ fontSize: 28 }} />}
                        title="Total Tasks"
                        value={metrics.total}
                        gradient="linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
                        iconBg="rgba(99, 102, 241, 0.4)"
                        infoTooltip="Total number of tasks in this project"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <MetricCard
                        icon={<CheckCircleIcon sx={{ fontSize: 28 }} />}
                        title="Completion Rate"
                        value={`${metrics.completionRate}%`}
                        gradient="linear-gradient(135deg, #10b981 0%, #34d399 100%)"
                        iconBg="rgba(16, 185, 129, 0.4)"
                        infoTooltip="Percentage of tasks with 'Completed' status. Formula: (Completed Tasks ÷ Total Tasks) × 100"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <MetricCard
                        icon={<WarningAmberIcon sx={{ fontSize: 28 }} />}
                        title="Overdue Tasks"
                        value={metrics.overdue}
                        gradient={metrics.overdue > 0 ? "linear-gradient(135deg, #ef4444 0%, #f97316 100%)" : "linear-gradient(135deg, #22c55e 0%, #4ade80 100%)"}
                        iconBg={metrics.overdue > 0 ? "rgba(239, 68, 68, 0.4)" : "rgba(34, 197, 94, 0.4)"}
                        infoTooltip="Tasks where end date has passed but status is not 'Completed'"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <MetricCard
                        icon={<TrendingUpIcon sx={{ fontSize: 28 }} />}
                        title="Avg. Progress"
                        value={`${metrics.avgProgress}%`}
                        gradient="linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)"
                        iconBg="rgba(59, 130, 246, 0.4)"
                        infoTooltip="Simple average of all task progress values. Formula: Sum of all progress % ÷ Total Tasks (treats all tasks equally)"
                    />
                </Grid>
            </Grid>

            {/* Charts */}
            <Grid container spacing={2.5}>
                {/* Status Distribution Chart */}
                <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                    <Paper elevation={0} sx={{ p: 2.5, height: '100%', background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 2, boxShadow: colors.cardShadow, backdropFilter: 'blur(10px)' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                            <Typography sx={{ color: colors.text, fontWeight: 600, fontSize: '0.95rem' }}>Status Distribution</Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, p: 0.5, borderRadius: 2, bgcolor: colors.gridLine }}>
                                <Tooltip title="Donut Chart">
                                    <IconButton size="small" onClick={() => setStatusChartType('donut')} sx={{ p: 0.5, bgcolor: statusChartType === 'donut' ? colors.accent : 'transparent', color: statusChartType === 'donut' ? '#fff' : colors.textSecondary, '&:hover': { bgcolor: statusChartType === 'donut' ? colors.accent : 'rgba(99, 102, 241, 0.2)' } }}>
                                        <PieChartIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Bar Chart">
                                    <IconButton size="small" onClick={() => setStatusChartType('bar')} sx={{ p: 0.5, bgcolor: statusChartType === 'bar' ? colors.accent : 'transparent', color: statusChartType === 'bar' ? '#fff' : colors.textSecondary, '&:hover': { bgcolor: statusChartType === 'bar' ? colors.accent : 'rgba(99, 102, 241, 0.2)' } }}>
                                        <BarChartIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <svg ref={statusChartRef} />
                        </Box>
                        {/* Legend for Donut Chart */}
                        {statusChartType === 'donut' && (
                            <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                                {statusData.map((item) => (
                                    <Box
                                        key={item.name}
                                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                                    >
                                        <Box
                                            sx={{
                                                width: 10,
                                                height: 10,
                                                borderRadius: '50%',
                                                bgcolor: item.color,
                                            }}
                                        />
                                        <Typography sx={{ fontSize: '0.7rem', color: colors.textSecondary }}>
                                            {item.name}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        )}
                    </Paper>
                </Grid>

                {/* Resource Workload Chart */}
                <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                    <Paper elevation={0} sx={{ p: 2.5, height: '100%', background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 2, boxShadow: colors.cardShadow, backdropFilter: 'blur(10px)' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                            <Typography sx={{ color: colors.text, fontWeight: 600, fontSize: '0.95rem' }}>Resource Workload</Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, p: 0.5, borderRadius: 2, bgcolor: colors.gridLine }}>
                                <Tooltip title="Donut Chart">
                                    <IconButton size="small" onClick={() => setResourceChartType('donut')} sx={{ p: 0.5, bgcolor: resourceChartType === 'donut' ? colors.accent : 'transparent', color: resourceChartType === 'donut' ? '#fff' : colors.textSecondary, '&:hover': { bgcolor: resourceChartType === 'donut' ? colors.accent : 'rgba(99, 102, 241, 0.2)' } }}>
                                        <PieChartIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Bar Chart">
                                    <IconButton size="small" onClick={() => setResourceChartType('bar')} sx={{ p: 0.5, bgcolor: resourceChartType === 'bar' ? colors.accent : 'transparent', color: resourceChartType === 'bar' ? '#fff' : colors.textSecondary, '&:hover': { bgcolor: resourceChartType === 'bar' ? colors.accent : 'rgba(99, 102, 241, 0.2)' } }}>
                                        <BarChartIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <svg ref={resourceChartRef} />
                        </Box>
                        {/* Legend for Donut Chart */}
                        {resourceChartType === 'donut' && (
                            <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                                {resourceData.map((item) => (
                                    <Box
                                        key={item.name}
                                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                                    >
                                        <Box
                                            sx={{
                                                width: 10,
                                                height: 10,
                                                borderRadius: '50%',
                                                bgcolor: item.color,
                                            }}
                                        />
                                        <Typography sx={{ fontSize: '0.7rem', color: colors.textSecondary }}>
                                            {item.name}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        )}
                    </Paper>
                </Grid>

                {/* Progress Distribution Chart */}
                <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                    <Paper elevation={0} sx={{ p: 2.5, height: '100%', background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 2, boxShadow: colors.cardShadow, backdropFilter: 'blur(10px)' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                            <Typography sx={{ color: colors.text, fontWeight: 600, fontSize: '0.95rem' }}>Progress Distribution</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <svg ref={progressChartRef} />
                        </Box>
                    </Paper>
                </Grid>

                {/* Tasks by Month Chart */}
                <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                    <Paper elevation={0} sx={{ p: 2.5, height: '100%', background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 2, boxShadow: colors.cardShadow, backdropFilter: 'blur(10px)' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                            <Typography sx={{ color: colors.text, fontWeight: 600, fontSize: '0.95rem' }}>Tasks by Month</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <svg ref={timelineChartRef} />
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* Legend */}
            <Box sx={{ mt: 3, p: 2, background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 2 }}>
                <Typography sx={{ mb: 1.5, color: colors.text, fontWeight: 600, fontSize: '0.85rem' }}>Status Legend</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                    {statusData.map((status) => (
                        <Box
                            key={status.name}
                            sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.75,
                                px: 1.5,
                                py: 0.5,
                                borderRadius: '9999px',
                                bgcolor: `${status.color}20`,
                                border: `1px solid ${status.color}40`,
                                boxShadow: `0 2px 8px ${status.color}25`,
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    transform: 'translateY(-1px)',
                                    boxShadow: `0 4px 12px ${status.color}35`,
                                }
                            }}
                        >
                            <Box
                                sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    bgcolor: status.color,
                                }}
                            />
                            <Typography sx={{ fontSize: '0.75rem', color: status.color, fontWeight: 600 }}>
                                {status.name}
                            </Typography>
                            <Typography
                                sx={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    color: '#fff',
                                    bgcolor: status.color,
                                    px: 0.75,
                                    py: 0.1,
                                    borderRadius: '9999px',
                                    minWidth: 20,
                                    textAlign: 'center',
                                }}
                            >
                                {status.value}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            </Box>
        </Box>
    );
};

export default ProjectDashboard;
