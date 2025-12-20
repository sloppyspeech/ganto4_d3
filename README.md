# OptiFlow - Project Management & Gantt Chart Tool

A modern project management application with interactive Gantt chart visualization, built with React (TypeScript) and Flask (Python).

![OptiFlow](https://img.shields.io/badge/OptiFlow-Project%20Management-6366f1)

## Features

- 📊 **Interactive Gantt Chart** - Visualize tasks with D3.js-powered charts
- 📅 **Multiple View Modes** - Daily, Weekly, Monthly, Quarterly views
- 👥 **Resource Management** - Assign and track resources
- 📈 **Task Progress** - Track completion with bullet chart progress bars
- 🎨 **Customizable** - Dark/Light themes, configurable date formats, bar styles
- 📤 **Import/Export** - CSV import/export with conflict resolution
- 🔗 **Task Dependencies** - Visual dependency lines between tasks

---

## Prerequisites

- **Python 3.10+** (for backend)
- **Node.js 18+** (for frontend)
- **npm** or **yarn**

---

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ganto4_d3
```

### 2. Backend Setup (Flask)

```bash
# Navigate to backend directory
cd backend

# Create Python virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup (React)

```bash
# Navigate to frontend directory
cd ../frontend

# Install Node.js dependencies
npm install
```

---

## Running the Application

### Start Backend Server

```bash
# From the backend directory (with venv activated)
cd backend
python app.py
```

The backend will start at: `http://127.0.0.1:5000`

### Start Frontend Development Server

```bash
# From the frontend directory (in a new terminal)
cd frontend
npm run dev
```

The frontend will start at: `http://localhost:5173`

---

## Project Structure

```
ganto4_d3/
├── backend/
│   ├── app.py              # Flask application & API routes
│   ├── requirements.txt    # Python dependencies
│   └── optiflow.db         # SQLite database (auto-created)
├── frontend/
│   ├── src/
│   │   ├── api/            # API client
│   │   ├── components/     # React components (GanttChart, TaskGrid, etc.)
│   │   ├── pages/          # Page components (Dashboard, ProjectView, Settings)
│   │   └── store/          # Redux state management
│   ├── package.json        # Node.js dependencies
│   └── vite.config.ts      # Vite configuration
└── README.md
```

---

## Configuration

### Settings Page

Access **Settings** from the header to configure:

- **Resources** - Add team members with colors
- **Statuses** - Define task statuses (Not Started, In Progress, Completed, etc.)
- **Task Types** - Configure task types (Task, Milestone, Summary)
- **Gantt Chart** - Date format, bar style, display options

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create a project |
| GET | `/api/projects/<id>` | Get project details |
| DELETE | `/api/projects/<id>` | Delete a project |
| GET | `/api/projects/<id>/tasks` | List project tasks |
| POST | `/api/projects/<id>/tasks` | Create a task |
| PUT | `/api/tasks/<id>` | Update a task |
| DELETE | `/api/tasks/<id>` | Delete a task |
| GET | `/api/settings` | Get all settings |
| POST | `/api/resources` | Create a resource |
| POST | `/api/statuses` | Create a status |

---

## Tech Stack

**Frontend:**
- React 18 + TypeScript
- Material UI (MUI)
- D3.js (Gantt chart rendering)
- Redux Toolkit (state management)
- Vite (build tool)

**Backend:**
- Flask (Python)
- SQLAlchemy (ORM)
- SQLite (database)
- Flask-CORS (cross-origin support)

---

## License

MIT License
