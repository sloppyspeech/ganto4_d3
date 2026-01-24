import axios from 'axios';
import type { Task, Resource } from './api';

// Types for Ollama API
export interface OllamaModel {
    name: string;
    model: string;
    modified_at: string;
    size: number;
}

export interface OllamaTagsResponse {
    models: OllamaModel[];
}

export interface TaskOverlap {
    task1: { task_id: string; description: string };
    task2: { task_id: string; description: string };
    overlapDays: number;
}

export interface ResourceAnalysisInput {
    name: string;
    availabilityStart: string | null;
    availabilityEnd: string | null;
    allocationPercent: number;
    availableWorkingDays: number;
    tasks: {
        task_id: string;
        description: string;
        start_date: string;
        end_date: string;
        estimate: number;
    }[];
    totalEstimate: number;
    overlappingTasks: TaskOverlap[];
}

export interface ResourceAnalysisResult {
    status: 'optimal' | 'under-loaded' | 'over-loaded';
    summary: string;
    percentage: number;
    hasOverlaps: boolean;
    overlaps: TaskOverlap[];
}

// Create Ollama API client
const createOllamaClient = (port: string) => {
    return axios.create({
        baseURL: `http://localhost:${port}`,
        headers: {
            'Content-Type': 'application/json',
        },
        timeout: 120000, // 120 second timeout for AI generation
    });
};

// Fetch available models from Ollama
export const fetchOllamaModels = async (port: string): Promise<string[]> => {
    try {
        const client = createOllamaClient(port);
        const response = await client.get<OllamaTagsResponse>('/api/tags');
        return response.data.models.map(m => m.name);
    } catch (error) {
        console.error('Failed to fetch Ollama models:', error);
        throw new Error('Failed to connect to Ollama server. Make sure Ollama is running.');
    }
};

// Calculate working days between two dates (excluding weekends)
const calculateWorkingDays = (startDate: Date, endDate: Date): number => {
    let count = 0;
    const current = new Date(startDate);
    while (current <= endDate) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
};

// Get intersection of two date ranges
const getDateIntersection = (
    start1: Date, end1: Date,
    start2: Date, end2: Date
): { start: Date; end: Date } | null => {
    const intersectStart = new Date(Math.max(start1.getTime(), start2.getTime()));
    const intersectEnd = new Date(Math.min(end1.getTime(), end2.getTime()));

    if (intersectStart <= intersectEnd) {
        return { start: intersectStart, end: intersectEnd };
    }
    return null;
};

// Detect overlapping tasks for a resource
const detectTaskOverlaps = (tasks: { task_id: string; description: string; start_date: string; end_date: string }[]): TaskOverlap[] => {
    const overlaps: TaskOverlap[] = [];

    for (let i = 0; i < tasks.length; i++) {
        for (let j = i + 1; j < tasks.length; j++) {
            const task1 = tasks[i];
            const task2 = tasks[j];

            const start1 = new Date(task1.start_date);
            const end1 = new Date(task1.end_date);
            const start2 = new Date(task2.start_date);
            const end2 = new Date(task2.end_date);

            const intersection = getDateIntersection(start1, end1, start2, end2);
            if (intersection) {
                const overlapDays = calculateWorkingDays(intersection.start, intersection.end);
                if (overlapDays > 0) {
                    overlaps.push({
                        task1: { task_id: task1.task_id, description: task1.description },
                        task2: { task_id: task2.task_id, description: task2.description },
                        overlapDays,
                    });
                }
            }
        }
    }

    return overlaps;
};

// Build the analysis prompt for Ollama with enhanced data
const buildAnalysisPrompt = (
    resources: ResourceAnalysisInput[],
    projectStartDate: string | null,
    projectEndDate: string | null
): string => {
    const projectInfo = projectStartDate && projectEndDate
        ? `Project Timeline: ${projectStartDate} to ${projectEndDate}`
        : 'Project Timeline: Not specified';

    const resourceDetails = resources.map(resource => {
        const taskDetails = resource.tasks.map(task =>
            `    - ${task.task_id}: "${task.description}" (${task.start_date} to ${task.end_date}, ${task.estimate} days)`
        ).join('\n');

        const overlapInfo = resource.overlappingTasks.length > 0
            ? `\n  ⚠️ OVERLAPPING TASKS DETECTED:\n` + resource.overlappingTasks.map(o =>
                `    - ${o.task1.task_id} overlaps with ${o.task2.task_id} for ${o.overlapDays} working days`
            ).join('\n')
            : '';

        return `Resource: ${resource.name}
  Availability: ${resource.availabilityStart || 'Not set'} to ${resource.availabilityEnd || 'Not set'}
  Allocation: ${resource.allocationPercent}%
  Available Working Days (within project): ${resource.availableWorkingDays} days
  Total Task Estimates: ${resource.totalEstimate} days
  Tasks:
${taskDetails || '    No tasks assigned'}${overlapInfo}`;
    }).join('\n\n');

    return `You are a project management AI. Analyze resource utilization based on their availability and task assignments.

${projectInfo}

Resources:
${resourceDetails}

UTILIZATION CALCULATION:
- Utilization % = (Total Task Estimates / Available Working Days) * 100
- Under-utilized: < 80% (shown as NEGATIVE, resource has spare capacity)
- Optimal: 80-110%
- Over-utilized: > 110% (shown as POSITIVE, resource is overcommitted)

For resources with overlapping tasks, factor in that they cannot work on multiple tasks simultaneously during overlap periods.

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "resources": {
    "ResourceName1": {
      "status": "optimal|under-loaded|over-loaded",
      "summary": "Brief explanation mentioning any overlaps",
      "percentage": 95
    }
  }
}

Percentages: under-loaded shows how much UNDER capacity (e.g., 60% means 40% spare capacity), over-loaded shows how much OVER capacity (e.g., 130% means 30% overload).`;
};

// Parse the AI response to extract resource analysis
const parseAnalysisResponse = (
    response: string,
    resourceOverlaps: Map<string, TaskOverlap[]>
): Record<string, ResourceAnalysisResult> => {
    try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in response');
        }

        const parsed = JSON.parse(jsonMatch[0]);

        if (parsed.resources && typeof parsed.resources === 'object') {
            const results: Record<string, ResourceAnalysisResult> = {};

            for (const [name, data] of Object.entries(parsed.resources)) {
                const resourceData = data as {
                    status?: string;
                    summary?: string;
                    percentage?: number;
                };

                // Validate and normalize status
                let status: ResourceAnalysisResult['status'] = 'optimal';
                if (resourceData.status === 'under-loaded' || resourceData.status === 'underloaded') {
                    status = 'under-loaded';
                } else if (resourceData.status === 'over-loaded' || resourceData.status === 'overloaded') {
                    status = 'over-loaded';
                } else if (resourceData.status === 'optimal') {
                    status = 'optimal';
                }

                const overlaps = resourceOverlaps.get(name) || [];

                results[name] = {
                    status,
                    summary: resourceData.summary || 'Analysis completed',
                    percentage: typeof resourceData.percentage === 'number' ? resourceData.percentage : 100,
                    hasOverlaps: overlaps.length > 0,
                    overlaps,
                };
            }

            return results;
        }

        throw new Error('Invalid response format');
    } catch (error) {
        console.error('Failed to parse AI response:', error);
        throw new Error('Failed to parse AI response. Please try again.');
    }
};

// Main analysis function with enhanced availability calculations
export const analyzeResources = async (
    port: string,
    model: string,
    tasks: Task[],
    projectStartDate: string | null,
    projectEndDate: string | null,
    resourcesData?: Resource[]
): Promise<Record<string, ResourceAnalysisResult>> => {
    // Build resource lookup map
    const resourceLookup = new Map<string, Resource>();
    if (resourcesData) {
        resourcesData.forEach(r => resourceLookup.set(r.name, r));
    }

    // Group tasks by resource
    const resourceMap = new Map<string, Task[]>();
    tasks.forEach(task => {
        const resourceName = task.resource || 'Unassigned';
        if (!resourceMap.has(resourceName)) {
            resourceMap.set(resourceName, []);
        }
        resourceMap.get(resourceName)!.push(task);
    });

    // Calculate project date range
    const projectStart = projectStartDate ? new Date(projectStartDate) : null;
    const projectEnd = projectEndDate ? new Date(projectEndDate) : null;

    // Build enhanced analysis data
    const resourceOverlaps = new Map<string, TaskOverlap[]>();
    const analysisInputs: ResourceAnalysisInput[] = Array.from(resourceMap.entries()).map(([name, resourceTasks]) => {
        const resource = resourceLookup.get(name);

        // Get resource availability dates
        const availStart = resource?.availability_start ? new Date(resource.availability_start) : null;
        const availEnd = resource?.availability_end ? new Date(resource.availability_end) : null;
        const allocation = resource?.allocation_percent ?? 100;

        // Calculate available working days within project timeline
        let availableWorkingDays = 0;
        if (projectStart && projectEnd && availStart && availEnd) {
            const intersection = getDateIntersection(projectStart, projectEnd, availStart, availEnd);
            if (intersection) {
                const rawDays = calculateWorkingDays(intersection.start, intersection.end);
                availableWorkingDays = Math.round(rawDays * (allocation / 100));
            }
        } else if (availStart && availEnd) {
            const rawDays = calculateWorkingDays(availStart, availEnd);
            availableWorkingDays = Math.round(rawDays * (allocation / 100));
        } else if (projectStart && projectEnd) {
            availableWorkingDays = Math.round(calculateWorkingDays(projectStart, projectEnd) * (allocation / 100));
        }

        // Prepare task data
        const taskData = resourceTasks.map(t => ({
            task_id: t.task_id,
            description: t.description,
            start_date: t.start_date,
            end_date: t.end_date,
            estimate: t.estimate,
        }));

        // Detect overlapping tasks
        const overlaps = detectTaskOverlaps(taskData);
        resourceOverlaps.set(name, overlaps);

        return {
            name,
            availabilityStart: resource?.availability_start || null,
            availabilityEnd: resource?.availability_end || null,
            allocationPercent: allocation,
            availableWorkingDays,
            tasks: taskData,
            totalEstimate: resourceTasks.reduce((sum, t) => sum + (t.estimate || 0), 0),
            overlappingTasks: overlaps,
        };
    });

    const prompt = buildAnalysisPrompt(analysisInputs, projectStartDate, projectEndDate);

    try {
        const client = createOllamaClient(port);
        const response = await client.post('/api/generate', {
            model,
            prompt,
            stream: false,
            options: {
                temperature: 0.3,
            },
        });

        return parseAnalysisResponse(response.data.response, resourceOverlaps);
    } catch (error) {
        console.error('Failed to analyze resources:', error);
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNREFUSED') {
                throw new Error('Cannot connect to Ollama server. Make sure Ollama is running.');
            }
            if (error.response?.status === 404) {
                throw new Error(`Model "${model}" not found. Please select a different model.`);
            }
        }
        throw new Error('Failed to analyze resources. Please try again.');
    }
};
