# OptiFlow - Product Requirements Document (PRD)

## Executive Summary

**OptiFlow** is a modern project management application with interactive Gantt chart visualization. It provides Microsoft Project-style hierarchical task management, resource assignment, dependency tracking, and customizable views to help teams plan and track project schedules effectively.

---

## Product Vision

To provide an intuitive, web-based project management tool that combines the power of traditional Gantt charts with modern UX patterns, enabling teams to visualize, plan, and execute projects efficiently.

---

## Target Users

| User Type | Description |
|-----------|-------------|
| **Project Managers** | Create projects, define task hierarchies, assign resources, track progress |
| **Team Members** | View assigned tasks, update status, track dependencies |
| **Stakeholders** | View project timelines and progress at various zoom levels |

---

## Core Features

### 1. Project Management

#### 1.1 Project Operations
- Create, edit, and delete projects
- Project metadata: Name, Code, Description
- Project dashboard showing all projects with task counts

#### 1.2 Project Dashboard
- Grid view of all projects
- Quick access to project details
- Task count display per project

---

### 2. Task Management

#### 2.1 Basic Task Properties
| Field | Description |
|-------|-------------|
| Task ID | Auto-generated unique identifier (e.g., `PRJ-001`) |
| Description | Task name/description |
| Start Date | Task start date |
| End Date | Task end date |
| Estimate | Duration in working days |
| Resource | Assigned team member |
| Status | Current task status (configurable) |
| Task Type | Task, Milestone, or Summary |
| Progress | Completion percentage (0-100) |

#### 2.2 Hierarchical Task Structure
- **Indent/Outdent** - Create parent-child relationships
- **WBS Codes** - Auto-generated Work Breakdown Structure codes (e.g., `1.2.1`)
- **Summary Tasks** - Parent tasks that aggregate child data
- **Expand/Collapse** - Toggle visibility of child tasks

#### 2.3 Summary Task Auto-Calculations
| Calculation | Rule |
|-------------|------|
| Start Date | `MIN(children.start_date)` |
| End Date | `MAX(children.end_date)` |
| Estimate | `SUM(children.estimate)` |
| Status | Based on children: All Complete → Complete, Any In Progress → In Progress |

#### 2.4 Task Dependencies
- Define predecessor tasks via `parent_ids` field
- Visual dependency lines in Gantt chart
- Two line styles: End-to-Start, Bottom-to-Left

---

### 3. Gantt Chart Visualization

#### 3.1 View Modes
| Mode | Header Display | Granularity |
|------|----------------|-------------|
| Daily | Days | Individual days |
| Weekly | Week dates | Week intervals |
| Monthly | Month names | Month intervals |
| Quarterly | Q1, Q2, Q3, Q4 | Quarter intervals |

#### 3.2 Chart Features
- **Two-row header** - Parent (Month/Year) and child (Day/Week) rows
- **Task bars** - Color-coded by status
- **Milestones** - Diamond markers for milestone tasks
- **Summary tasks** - Bracket-style rendering
- **Today line** - Visual indicator for current date
- **Weekend highlighting** - Shaded weekend columns
- **Dependency lines** - Arrows connecting related tasks
- **Scrollable** - Horizontal scroll for long projects

#### 3.3 Chart Customization (Settings)
| Option | Description |
|--------|-------------|
| Show Weekends | Highlight Saturday/Sunday columns |
| Show Task IDs | Display task IDs on bars |
| Show Dependencies | Toggle dependency line visibility |
| Bar Style | Default or Round Corners |
| Dependency Line Style | End-to-Start or Bottom-to-Left |

---

### 4. Resource Management

#### 4.1 Resource Properties
| Field | Description |
|-------|-------------|
| Name | Resource/team member name |
| Email | Contact email (optional) |
| Color | Display color for Gantt bars |

#### 4.2 Resource Views
- **Task View** - Primary Gantt organized by task order
- **Resource View** - Gantt grouped by assigned resource
  - Complete mode: Show all tasks per resource
  - Task mode: Show aggregated resource allocation

---

### 5. Status Configuration

#### 5.1 Status Properties
| Field | Description |
|-------|-------------|
| Name | Status label (e.g., "In Progress") |
| Color | Visual indicator color |
| Order Index | Display order in dropdowns |

#### 5.2 Default Statuses
- Not Started (Gray)
- In Progress (Blue)
- Complete (Green)
- On Hold (Yellow)
- Cancelled (Red)

---

### 6. Data Import/Export

#### 6.1 CSV Import
- Upload CSV files with task data
- Field mapping
- Conflict resolution (skip/overwrite/merge)

#### 6.2 CSV Export
- Export tasks to CSV format
- Include all task fields

---

### 7. User Interface

#### 7.1 Layout
- **Header Bar** - Navigation, theme toggle, settings access
- **Split View** - Task grid (left) + Gantt chart (right)
- **Resizable panels** - Adjustable split position

#### 7.2 Theme Support
- Light mode
- Dark mode (default)
- Persisted in localStorage

#### 7.3 Date Format Options
| Format | Example |
|--------|---------|
| DD/MMM/YYYY | 12/Dec/2026 |
| DD/MMM/YY | 12/Dec/26 |
| DD/MM/YYYY | 12/12/2026 |
| DD-MMM-YYYY | 12-Dec-2026 |
| (and more...) | |

---

## Technical Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript |
| UI Components | Material UI (MUI) |
| Charts | D3.js |
| State Management | Redux Toolkit |
| Build Tool | Vite |
| Backend | Flask (Python) |
| ORM | SQLAlchemy |
| Database | SQLite |
| API | RESTful JSON |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/<id>` | Get project |
| DELETE | `/api/projects/<id>` | Delete project |
| GET | `/api/projects/<id>/tasks` | Get project tasks |
| POST | `/api/projects/<id>/tasks` | Create task |
| POST | `/api/projects/<id>/reorder` | Reorder tasks |
| PUT | `/api/tasks/<id>` | Update task |
| DELETE | `/api/tasks/<id>` | Delete task |
| POST | `/api/tasks/<id>/indent` | Indent task |
| POST | `/api/tasks/<id>/outdent` | Outdent task |
| POST | `/api/tasks/<id>/toggle-expand` | Toggle expand |
| GET | `/api/settings` | Get all settings |
| POST | `/api/resources` | Create resource |
| PUT | `/api/resources/<id>` | Update resource |
| DELETE | `/api/resources/<id>` | Delete resource |
| POST | `/api/statuses` | Create status |
| PUT | `/api/statuses/<id>` | Update status |
| DELETE | `/api/statuses/<id>` | Delete status |

---

## Data Models

### Project
```
id: Integer (PK)
name: String (required)
description: Text
code: String (unique, required)
created_at: DateTime
```

### Task
```
id: Integer (PK)
task_id: String (auto-generated)
description: Text (required)
start_date: Date (required)
end_date: Date (required)
estimate: Integer (days)
resource: String (nullable)
status: String
task_type: String (Task/Milestone/Summary)
parent_ids: String (dependency IDs)
parent_id: Integer (FK, hierarchical parent)
level: Integer (nesting depth)
wbs_code: String (e.g., "1.2.1")
is_summary: Boolean
expanded: Boolean
progress: Integer (0-100)
project_id: Integer (FK)
order_index: Integer
```

### Resource
```
id: Integer (PK)
name: String (required)
email: String
color: String (hex)
```

### Status
```
id: Integer (PK)
name: String (required)
color: String (hex, required)
order_index: Integer
```

---

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Browser Support | Chrome, Firefox, Edge, Safari (latest) |
| Responsive | Desktop-first, min 1024px width |
| Performance | Render 100+ tasks smoothly |
| Data Persistence | SQLite (development), upgradeable |
| State Persistence | UI preferences in localStorage |

---

## Future Enhancements (Backlog)

- [ ] User authentication and authorization
- [ ] Multi-user collaboration
- [ ] Real-time updates (WebSocket)
- [ ] Resource capacity planning
- [ ] Critical path highlighting
- [ ] Baseline comparison
- [ ] Custom fields
- [ ] Integration with external tools (Jira, etc.)
- [ ] PDF/Image export of Gantt chart
- [ ] Mobile-responsive design

---

## Document Information

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Last Updated | December 2024 |
| Status | Active Development |
