import { useEffect, useRef, useMemo } from 'react';
import { Box, Typography, Paper, Grid } from '@mui/material';
import * as d3 from 'd3';
import { useAppSelector } from '../store/hooks';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

const ProjectDashboard = () => {
    const { items: tasks } = useAppSelector((state) => state.tasks);
    const { statuses, resources } = useAppSelector((state) => state.settings);
    const { themeMode } = useAppSelector((state) => state.ui);

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

    // Status Distribution - Modern Donut
    useEffect(() => {
        if (!statusChartRef.current || statusData.length === 0) return;
        const svg = d3.select(statusChartRef.current);
        svg.selectAll('*').remove();

        const width = 240, height = 240;
        const radius = Math.min(width, height) / 2 - 10;

        const g = svg.attr('width', width).attr('height', height)
            .append('g').attr('transform', `translate(${width / 2}, ${height / 2})`);

        // Add glow filter
        const defs = svg.append('defs');
        const filter = defs.append('filter').attr('id', 'glow');
        filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
        const feMerge = filter.append('feMerge');
        feMerge.append('feMergeNode').attr('in', 'coloredBlur');
        feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

        const pie = d3.pie<typeof statusData[0]>().value(d => d.value).sort(null).padAngle(0.03);
        const arc = d3.arc<d3.PieArcDatum<typeof statusData[0]>>()
            .innerRadius(radius * 0.6)
            .outerRadius(radius)
            .cornerRadius(6);

        g.selectAll('.arc')
            .data(pie(statusData))
            .enter()
            .append('path')
            .attr('d', arc)
            .attr('fill', d => d.data.color)
            .style('filter', 'url(#glow)')
            .style('transition', 'transform 0.2s')
            .on('mouseover', function () { d3.select(this).attr('transform', 'scale(1.05)'); })
            .on('mouseout', function () { d3.select(this).attr('transform', 'scale(1)'); });

        // Center content
        g.append('text').attr('text-anchor', 'middle').attr('dy', '-0.1em')
            .attr('fill', colors.text).attr('font-size', '32px').attr('font-weight', '700')
            .text(tasks.length);
        g.append('text').attr('text-anchor', 'middle').attr('dy', '1.5em')
            .attr('fill', colors.textSecondary).attr('font-size', '12px').attr('font-weight', '500')
            .text('TOTAL TASKS');
    }, [statusData, colors, tasks.length]);

    // Resource Workload - Modern Bars
    useEffect(() => {
        if (!resourceChartRef.current || resourceData.length === 0) return;
        const svg = d3.select(resourceChartRef.current);
        svg.selectAll('*').remove();

        const width = 280, height = 200;
        const margin = { top: 10, right: 30, bottom: 10, left: 70 };
        const chartW = width - margin.left - margin.right;
        const chartH = height - margin.top - margin.bottom;

        const g = svg.attr('width', width).attr('height', height)
            .append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

        const maxVal = d3.max(resourceData, d => d.value) || 1;
        const xScale = d3.scaleLinear().domain([0, maxVal]).range([0, chartW]);
        const yScale = d3.scaleBand().domain(resourceData.map(d => d.name)).range([0, chartH]).padding(0.35);

        // Gradient for bars
        const defs = svg.append('defs');
        resourceData.forEach((d, i) => {
            const grad = defs.append('linearGradient').attr('id', `bar-grad-${i}`).attr('x1', '0%').attr('x2', '100%');
            grad.append('stop').attr('offset', '0%').attr('stop-color', d.color);
            grad.append('stop').attr('offset', '100%').attr('stop-color', d3.color(d.color)?.brighter(0.3)?.toString() || d.color);
        });

        // Background bars
        g.selectAll('.bg-bar').data(resourceData).enter().append('rect')
            .attr('x', 0).attr('y', d => yScale(d.name) || 0)
            .attr('width', chartW).attr('height', yScale.bandwidth())
            .attr('fill', colors.gridLine).attr('rx', yScale.bandwidth() / 2);

        // Value bars
        g.selectAll('.bar').data(resourceData).enter().append('rect')
            .attr('x', 0).attr('y', d => yScale(d.name) || 0)
            .attr('width', d => xScale(d.value)).attr('height', yScale.bandwidth())
            .attr('fill', (_, i) => `url(#bar-grad-${i})`).attr('rx', yScale.bandwidth() / 2);

        // Labels
        g.selectAll('.label').data(resourceData).enter().append('text')
            .attr('x', -8).attr('y', d => (yScale(d.name) || 0) + yScale.bandwidth() / 2)
            .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
            .attr('fill', colors.textSecondary).attr('font-size', '11px').attr('font-weight', '500')
            .text(d => d.name.length > 8 ? d.name.slice(0, 8) + '..' : d.name);

        // Values
        g.selectAll('.value').data(resourceData).enter().append('text')
            .attr('x', d => xScale(d.value) + 8)
            .attr('y', d => (yScale(d.name) || 0) + yScale.bandwidth() / 2)
            .attr('dominant-baseline', 'middle')
            .attr('fill', colors.text).attr('font-size', '12px').attr('font-weight', '700')
            .text(d => d.value);
    }, [resourceData, colors]);

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

        // Gradient defs
        const defs = svg.append('defs');
        progressData.forEach((d, i) => {
            const grad = defs.append('linearGradient').attr('id', `prog-grad-${i}`).attr('x1', '0%').attr('y1', '100%').attr('x2', '0%').attr('y2', '0%');
            grad.append('stop').attr('offset', '0%').attr('stop-color', d.color).attr('stop-opacity', 0.8);
            grad.append('stop').attr('offset', '100%').attr('stop-color', d3.color(d.color)?.brighter(0.5)?.toString() || d.color);
        });

        // Bars with rounded top
        g.selectAll('.bar').data(progressData).enter().append('rect')
            .attr('x', d => xScale(d.name) || 0).attr('y', d => yScale(d.value))
            .attr('width', xScale.bandwidth()).attr('height', d => chartH - yScale(d.value))
            .attr('fill', (_, i) => `url(#prog-grad-${i})`).attr('rx', 4);

        // X axis labels
        g.selectAll('.x-label').data(progressData).enter().append('text')
            .attr('x', d => (xScale(d.name) || 0) + xScale.bandwidth() / 2)
            .attr('y', chartH + 18).attr('text-anchor', 'middle')
            .attr('fill', colors.textSecondary).attr('font-size', '9px').attr('font-weight', '500')
            .text(d => d.name);

        // Value labels
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

        // Gradient
        const defs = svg.append('defs');
        const areaGrad = defs.append('linearGradient').attr('id', 'area-gradient').attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%');
        areaGrad.append('stop').attr('offset', '0%').attr('stop-color', '#8b5cf6').attr('stop-opacity', 0.6);
        areaGrad.append('stop').attr('offset', '100%').attr('stop-color', '#6366f1').attr('stop-opacity', 0.05);

        const lineGrad = defs.append('linearGradient').attr('id', 'line-gradient').attr('x1', '0%').attr('x2', '100%');
        lineGrad.append('stop').attr('offset', '0%').attr('stop-color', '#6366f1');
        lineGrad.append('stop').attr('offset', '100%').attr('stop-color', '#a855f7');

        // Area
        const area = d3.area<typeof timelineData[0]>()
            .x(d => (xScale(d.month) || 0) + xScale.bandwidth() / 2)
            .y0(chartH).y1(d => yScale(d.count)).curve(d3.curveMonotoneX);

        g.append('path').datum(timelineData).attr('d', area).attr('fill', 'url(#area-gradient)');

        // Line
        const line = d3.line<typeof timelineData[0]>()
            .x(d => (xScale(d.month) || 0) + xScale.bandwidth() / 2)
            .y(d => yScale(d.count)).curve(d3.curveMonotoneX);

        g.append('path').datum(timelineData).attr('d', line)
            .attr('fill', 'none').attr('stroke', 'url(#line-gradient)').attr('stroke-width', 3);

        // Points with glow
        g.selectAll('.point').data(timelineData).enter().append('circle')
            .attr('cx', d => (xScale(d.month) || 0) + xScale.bandwidth() / 2)
            .attr('cy', d => yScale(d.count)).attr('r', 5)
            .attr('fill', '#8b5cf6').attr('stroke', colors.chartBg).attr('stroke-width', 2);

        // X labels
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

    const MetricCard = ({ icon, title, value, gradient, iconBg }: { icon: React.ReactNode; title: string; value: string | number; gradient: string; iconBg: string }) => (
        <Paper
            elevation={0}
            sx={{
                p: 2.5,
                display: 'flex',
                alignItems: 'center',
                gap: 2.5,
                background: colors.cardBg,
                border: `1px solid ${colors.cardBorder}`,
                borderRadius: 3,
                boxShadow: colors.cardShadow,
                backdropFilter: 'blur(10px)',
                transition: 'all 0.3s ease',
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: isDark
                        ? '0 12px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                        : '0 12px 40px rgba(99, 102, 241, 0.15), 0 4px 12px rgba(0, 0, 0, 0.08)',
                }
            }}
        >
            <Box sx={{
                p: 1.5,
                borderRadius: 2.5,
                background: gradient,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 4px 12px ${iconBg}`,
            }}>
                {icon}
            </Box>
            <Box>
                <Typography sx={{ fontSize: '2rem', fontWeight: 700, color: colors.text, lineHeight: 1.1 }}>
                    {value}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: colors.textSecondary, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {title}
                </Typography>
            </Box>
        </Paper>
    );

    const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
        <Paper
            elevation={0}
            sx={{
                p: 2.5,
                height: '100%',
                background: colors.cardBg,
                border: `1px solid ${colors.cardBorder}`,
                borderRadius: 3,
                boxShadow: colors.cardShadow,
                backdropFilter: 'blur(10px)',
            }}
        >
            <Typography sx={{ mb: 2, color: colors.text, fontWeight: 600, fontSize: '0.95rem' }}>
                {title}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {children}
            </Box>
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
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <MetricCard
                        icon={<CheckCircleIcon sx={{ fontSize: 28 }} />}
                        title="Completion Rate"
                        value={`${metrics.completionRate}%`}
                        gradient="linear-gradient(135deg, #10b981 0%, #34d399 100%)"
                        iconBg="rgba(16, 185, 129, 0.4)"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <MetricCard
                        icon={<WarningAmberIcon sx={{ fontSize: 28 }} />}
                        title="Overdue Tasks"
                        value={metrics.overdue}
                        gradient={metrics.overdue > 0 ? "linear-gradient(135deg, #ef4444 0%, #f97316 100%)" : "linear-gradient(135deg, #22c55e 0%, #4ade80 100%)"}
                        iconBg={metrics.overdue > 0 ? "rgba(239, 68, 68, 0.4)" : "rgba(34, 197, 94, 0.4)"}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <MetricCard
                        icon={<TrendingUpIcon sx={{ fontSize: 28 }} />}
                        title="Avg. Progress"
                        value={`${metrics.avgProgress}%`}
                        gradient="linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)"
                        iconBg="rgba(59, 130, 246, 0.4)"
                    />
                </Grid>
            </Grid>

            {/* Charts */}
            <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                    <ChartCard title="Status Distribution">
                        <svg ref={statusChartRef} />
                    </ChartCard>
                </Grid>
                <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                    <ChartCard title="Resource Workload">
                        <svg ref={resourceChartRef} />
                    </ChartCard>
                </Grid>
                <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                    <ChartCard title="Progress Distribution">
                        <svg ref={progressChartRef} />
                    </ChartCard>
                </Grid>
                <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                    <ChartCard title="Tasks by Month">
                        <svg ref={timelineChartRef} />
                    </ChartCard>
                </Grid>
            </Grid>

            {/* Legend */}
            <Box sx={{ mt: 3, p: 2, background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: 2 }}>
                <Typography sx={{ mb: 1.5, color: colors.text, fontWeight: 600, fontSize: '0.85rem' }}>Status Legend</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5 }}>
                    {statusData.map((status) => (
                        <Box key={status.name} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: status.color, boxShadow: `0 2px 6px ${status.color}50` }} />
                            <Typography sx={{ fontSize: '0.8rem', color: colors.textSecondary, fontWeight: 500 }}>
                                {status.name} <Box component="span" sx={{ color: colors.text, fontWeight: 600 }}>({status.value})</Box>
                            </Typography>
                        </Box>
                    ))}
                </Box>
            </Box>
        </Box>
    );
};

export default ProjectDashboard;
