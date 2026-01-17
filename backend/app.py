"""
OptiFlow Backend - Flask Application
Project Management Tool with Gantt Chart Visualization
"""
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime
import os

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"], "allow_headers": ["Content-Type"]}})

# Configure SQLite database
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(basedir, "optiflow.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# =============================================================================
# DATABASE MODELS
# =============================================================================

class Project(db.Model):
    """Project model for storing project information"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    code = db.Column(db.String(10), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    tasks = db.relationship('Task', backref='project', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        # Calculate summary statistics from tasks
        tasks = self.tasks
        total_estimate = sum(t.estimate or 0 for t in tasks)
        completed_estimate = sum((t.estimate or 0) * (t.progress or 0) / 100 for t in tasks)
        progress = round(completed_estimate / total_estimate * 100) if total_estimate > 0 else 0
        
        # Calculate date range
        start_dates = [t.start_date for t in tasks if t.start_date]
        end_dates = [t.end_date for t in tasks if t.end_date]
        project_start = min(start_dates).isoformat() if start_dates else None
        project_end = max(end_dates).isoformat() if end_dates else None
        
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'code': self.code,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'task_count': len(tasks),
            'total_estimate': round(total_estimate, 1),
            'completed_estimate': round(completed_estimate, 1),
            'progress': progress,
            'start_date': project_start,
            'end_date': project_end
        }


class Task(db.Model):
    """Task model for storing task details with hierarchical support"""
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.String(20), nullable=False)  # e.g., MIG-001
    description = db.Column(db.Text, nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    estimate = db.Column(db.Float, default=0.0)
    resource = db.Column(db.String(100))
    status = db.Column(db.String(50), default='Not Started')
    task_type = db.Column(db.String(20), default='Task')  # Task or Milestone
    parent_ids = db.Column(db.String(200))  # Comma-separated dependency task IDs (predecessors)
    progress = db.Column(db.Integer, default=0)  # Progress percentage 0-100
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    order_index = db.Column(db.Integer, default=0)
    
    # Hierarchy fields for WBS (Work Breakdown Structure)
    parent_id = db.Column(db.Integer, db.ForeignKey('task.id'), nullable=True)  # Hierarchical parent
    level = db.Column(db.Integer, default=0)  # Nesting depth (0 = top-level)
    wbs_code = db.Column(db.String(50), nullable=True)  # e.g., "1.2.1" for sorting/display
    is_summary = db.Column(db.Boolean, default=False)  # True = has children (Summary Task)
    expanded = db.Column(db.Boolean, default=True)  # UI collapse/expand state
    
    # Self-referential relationship for hierarchy
    children = db.relationship('Task', backref=db.backref('parent', remote_side=[id]), lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'description': self.description,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'estimate': self.estimate,
            'resource': self.resource,
            'status': self.status,
            'task_type': self.task_type,
            'parent_ids': self.parent_ids,
            'progress': self.progress or 0,
            'project_id': self.project_id,
            'order_index': self.order_index,
            'parent_id': self.parent_id,
            'level': self.level or 0,
            'wbs_code': self.wbs_code,
            'is_summary': self.is_summary or False,
            'expanded': self.expanded if self.expanded is not None else True
        }


class Resource(db.Model):
    """Resource model for team members/resources"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(200))
    color = db.Column(db.String(7), default='#3498db')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'color': self.color
        }


class Status(db.Model):
    """Status model for task statuses with colors"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    color = db.Column(db.String(7), nullable=False)
    order_index = db.Column(db.Integer, default=0)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'color': self.color,
            'order_index': self.order_index
        }


class TaskType(db.Model):
    """Task Type model (Task, Milestone, etc.)"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name
        }


# =============================================================================
# API ROUTES - PROJECTS
# =============================================================================

# =============================================================================
# HIERARCHY HELPER FUNCTIONS
# =============================================================================

def recalculate_summary_dates(project_id):
    """
    Bottom-up recalculation of summary task dates.
    For each summary task, compute:
    - start_date = MIN(children.start_date)
    - end_date = MAX(children.end_date)
    - estimate = working days between start and end
    """
    tasks = Task.query.filter_by(project_id=project_id).all()
    task_dict = {t.id: t for t in tasks}
    
    # Build parent-children map
    children_map = {}
    for t in tasks:
        if t.parent_id:
            if t.parent_id not in children_map:
                children_map[t.parent_id] = []
            children_map[t.parent_id].append(t)
    
    # Get all tasks that have children (summary tasks)
    summary_ids = set(children_map.keys())
    
    # Process from deepest level up
    def get_date_range(task_id):
        """Recursively get min start and max end for a task including all descendants"""
        task = task_dict.get(task_id)
        if not task:
            return None, None
        
        children = children_map.get(task_id, [])
        if not children:
            # Leaf task - return its own dates
            return task.start_date, task.end_date
        
        # For summary tasks, calculate dates PURELY from children (not own dates)
        min_start = None
        max_end = None
        
        for child in children:
            child_start, child_end = get_date_range(child.id)
            if child_start:
                if min_start is None or child_start < min_start:
                    min_start = child_start
            if child_end:
                if max_end is None or child_end > max_end:
                    max_end = child_end
        
        return min_start, max_end
    
    def get_total_estimate(task_id):
        """Recursively get total estimate for a task (sum of all descendants)"""
        task = task_dict.get(task_id)
        if not task:
            return 0
        
        children = children_map.get(task_id, [])
        if not children:
            # Leaf task - return its own estimate
            return task.estimate or 0
        
        # Sum estimates from all children
        total = 0
        for child in children:
            total += get_total_estimate(child.id)
        return total
    
    # Update all summary tasks
    for summary_id in summary_ids:
        summary_task = task_dict.get(summary_id)
        if summary_task:
            min_start, max_end = get_date_range(summary_id)
            if min_start and max_end:
                summary_task.start_date = min_start
                summary_task.end_date = max_end
            # Calculate estimate as SUM of child estimates (not date difference)
            summary_task.estimate = get_total_estimate(summary_id)
            summary_task.is_summary = True
    
    db.session.commit()


def update_wbs_codes(project_id):
    """
    Update WBS codes for all tasks in a project.
    Top-level tasks get "1", "2", etc.
    Children get "1.1", "1.2", "2.1", etc.
    """
    tasks = Task.query.filter_by(project_id=project_id).order_by(Task.order_index).all()
    
    # Build hierarchy
    root_tasks = [t for t in tasks if t.parent_id is None]
    children_map = {}
    for t in tasks:
        if t.parent_id:
            if t.parent_id not in children_map:
                children_map[t.parent_id] = []
            children_map[t.parent_id].append(t)
    
    def assign_wbs(task_list, prefix=''):
        for idx, task in enumerate(task_list, 1):
            wbs = f"{prefix}{idx}" if prefix else str(idx)
            task.wbs_code = wbs
            children = children_map.get(task.id, [])
            if children:
                task.is_summary = True
                assign_wbs(children, f"{wbs}.")
            else:
                task.is_summary = False
    
    assign_wbs(root_tasks)
    db.session.commit()


def recalculate_order_indices(project_id):
    """
    Recalculate order_index for all tasks to maintain proper tree order.
    Uses depth-first traversal to assign indices.
    """
    tasks = Task.query.filter_by(project_id=project_id).order_by(Task.order_index).all()
    
    # Build hierarchy
    root_tasks = [t for t in tasks if t.parent_id is None]
    children_map = {}
    for t in tasks:
        if t.parent_id:
            if t.parent_id not in children_map:
                children_map[t.parent_id] = []
            children_map[t.parent_id].append(t)
    
    # Sort children by current order_index
    for children in children_map.values():
        children.sort(key=lambda x: x.order_index)
    root_tasks.sort(key=lambda x: x.order_index)
    
    def assign_order(task_list, counter=0):
        for task in task_list:
            task.order_index = counter
            counter += 1
            children = children_map.get(task.id, [])
            if children:
                counter = assign_order(children, counter)
        return counter
    
    assign_order(root_tasks)
    db.session.commit()


def recalculate_summary_status(project_id):
    """
    Recalculate status for summary tasks based on children status.
    Rules:
    - If any child is "In Progress", parent becomes "In Progress"
    - If all children are "Complete", parent becomes "Complete"
    - If all children are "Not Started", parent stays "Not Started"
    """
    tasks = Task.query.filter_by(project_id=project_id).all()
    
    # Build hierarchy
    children_map = {}
    for t in tasks:
        if t.parent_id:
            if t.parent_id not in children_map:
                children_map[t.parent_id] = []
            children_map[t.parent_id].append(t)
    
    # Process summary tasks (bottom-up by traversing children first - handled by recursion)
    def update_parent_status(task):
        children = children_map.get(task.id, [])
        if not children:
            return
        
        # First update nested children
        for child in children:
            update_parent_status(child)
        
        # Get child statuses
        child_statuses = [c.status for c in children]
        
        # Determine parent status based on children
        if 'In Progress' in child_statuses:
            task.status = 'In Progress'
        elif all(s == 'Complete' for s in child_statuses):
            task.status = 'Complete'
        elif all(s == 'Not Started' for s in child_statuses):
            task.status = 'Not Started'
        else:
            # Mixed status (some complete, some not started) - set to In Progress
            task.status = 'In Progress'
    
    # Process all root tasks
    root_tasks = [t for t in tasks if t.parent_id is None]
    for task in root_tasks:
        update_parent_status(task)
    
    db.session.commit()


# =============================================================================
# API ROUTES - PROJECTS
# =============================================================================

@app.route('/api/projects', methods=['GET'])
def get_projects():
    """Get all projects"""
    projects = Project.query.all()
    return jsonify([p.to_dict() for p in projects])


@app.route('/api/projects', methods=['POST'])
def create_project():
    """Create a new project"""
    data = request.get_json()
    
    if not data.get('name') or not data.get('code'):
        return jsonify({'error': 'Name and code are required'}), 400
    
    # Check if code already exists
    existing = Project.query.filter_by(code=data['code'].upper()).first()
    if existing:
        return jsonify({'error': 'Project code already exists'}), 400
    
    project = Project(
        name=data['name'],
        description=data.get('description', ''),
        code=data['code'].upper()
    )
    db.session.add(project)
    db.session.commit()
    
    return jsonify(project.to_dict()), 201


@app.route('/api/projects/<int:project_id>', methods=['GET'])
def get_project(project_id):
    """Get a single project by ID"""
    project = Project.query.get_or_404(project_id)
    return jsonify(project.to_dict())


@app.route('/api/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id):
    """Update a project"""
    project = Project.query.get_or_404(project_id)
    data = request.get_json()
    
    if 'name' in data:
        project.name = data['name']
    if 'description' in data:
        project.description = data['description']
    
    db.session.commit()
    return jsonify(project.to_dict())


@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    """Delete a project and all its tasks"""
    project = Project.query.get_or_404(project_id)
    db.session.delete(project)
    db.session.commit()
    return jsonify({'message': 'Project deleted successfully'})


# =============================================================================
# API ROUTES - TASKS
# =============================================================================

@app.route('/api/projects/<int:project_id>/tasks', methods=['GET'])
def get_tasks(project_id):
    """Get all tasks for a project"""
    project = Project.query.get_or_404(project_id)
    tasks = Task.query.filter_by(project_id=project_id).order_by(Task.order_index).all()
    return jsonify([t.to_dict() for t in tasks])


@app.route('/api/projects/<int:project_id>/tasks', methods=['POST'])
def create_task(project_id):
    """Create a new task with auto-generated ID"""
    project = Project.query.get_or_404(project_id)
    data = request.get_json()
    
    # Generate unique task ID (e.g., MIG-001)
    task_count = Task.query.filter_by(project_id=project_id).count()
    task_id = f"{project.code}-{str(task_count + 1).zfill(3)}"
    
    # Parse dates
    start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
    end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
    
    # Validate end_date >= start_date
    if end_date < start_date:
        return jsonify({'error': 'End date must be after start date'}), 400
    
    task = Task(
        task_id=task_id,
        description=data.get('description', ''),
        start_date=start_date,
        end_date=end_date,
        estimate=data.get('estimate', 0.0),
        resource=data.get('resource'),
        status=data.get('status', 'Not Started'),
        task_type=data.get('task_type', 'Task'),
        parent_ids=data.get('parent_ids'),
        progress=data.get('progress', 0),
        project_id=project_id,
        order_index=task_count
    )
    db.session.add(task)
    db.session.commit()
    
    # Update WBS codes for the project
    update_wbs_codes(project_id)
    
    # Reload task to get updated wbs_code
    db.session.refresh(task)
    
    return jsonify(task.to_dict()), 201


@app.route('/api/tasks/<int:task_id>', methods=['GET'])
def get_task(task_id):
    """Get a single task by ID"""
    task = Task.query.get_or_404(task_id)
    return jsonify(task.to_dict())


@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    """Update a task. Summary tasks have read-only dates."""
    task = Task.query.get_or_404(task_id)
    data = request.get_json()
    project_id = task.project_id
    dates_changed = False
    
    if 'description' in data:
        task.description = data['description']
    
    # Only allow date changes for non-summary tasks
    if not task.is_summary:
        if 'start_date' in data:
            task.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
            dates_changed = True
        if 'end_date' in data:
            task.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
            dates_changed = True
        if 'estimate' in data:
            task.estimate = data['estimate']
    
    # Track if estimate changed (for non-summary tasks, this affects parent estimates)
    estimate_changed = 'estimate' in data and not task.is_summary
    
    if 'resource' in data:
        task.resource = data['resource']
    if 'status' in data:
        task.status = data['status']
    if 'task_type' in data:
        task.task_type = data['task_type']
    if 'parent_ids' in data:
        task.parent_ids = data['parent_ids']
    if 'progress' in data:
        task.progress = max(0, min(100, data['progress']))  # Clamp 0-100
    if 'order_index' in data:
        task.order_index = data['order_index']
    if 'expanded' in data:
        task.expanded = data['expanded']
    
    # Validate dates for non-summary tasks
    if not task.is_summary and task.end_date < task.start_date:
        return jsonify({'error': 'End date must be after start date'}), 400
    
    db.session.commit()
    
    # Recalculate parent summary tasks if dates OR estimates changed
    if dates_changed or estimate_changed:
        recalculate_summary_dates(project_id)
    
    # Recalculate parent status if this task's status changed
    status_changed = 'status' in data
    if status_changed:
        recalculate_summary_status(project_id)
    
    # Return all tasks if dates, estimate, or status changed (to reflect parent changes)
    if dates_changed or estimate_changed or status_changed:
        all_tasks = Task.query.filter_by(project_id=project_id).order_by(Task.order_index).all()
        return jsonify([t.to_dict() for t in all_tasks])
    
    return jsonify(task.to_dict())


@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    """Delete a task and handle hierarchy cleanup"""
    task = Task.query.get_or_404(task_id)
    project_id = task.project_id
    
    # Move children up one level (to deleted task's parent)
    children = Task.query.filter_by(parent_id=task_id).all()
    for child in children:
        child.parent_id = task.parent_id
        if task.parent_id:
            child.level = task.level
        else:
            child.level = 0
    
    db.session.delete(task)
    db.session.commit()
    
    # Recalculate hierarchy
    update_wbs_codes(project_id)
    recalculate_summary_dates(project_id)
    recalculate_order_indices(project_id)
    
    # Return updated task list
    tasks = Task.query.filter_by(project_id=project_id).order_by(Task.order_index).all()
    return jsonify([t.to_dict() for t in tasks])


# =============================================================================
# API ROUTES - TASK HIERARCHY
# =============================================================================

@app.route('/api/tasks/<int:task_id>/indent', methods=['POST'])
def indent_task(task_id):
    """
    Indent (demote) a task - make it a child of the task immediately above it.
    The task above becomes a Summary Task.
    """
    task = Task.query.get_or_404(task_id)
    project_id = task.project_id
    
    # Find the task immediately above this one
    tasks = Task.query.filter_by(project_id=project_id).order_by(Task.order_index).all()
    task_index = next((i for i, t in enumerate(tasks) if t.id == task_id), -1)
    
    if task_index <= 0:
        return jsonify({'error': 'Cannot indent the first task'}), 400
    
    # Find potential parent - the task directly above
    potential_parent = None
    for i in range(task_index - 1, -1, -1):
        if tasks[i].level <= task.level:
            potential_parent = tasks[i]
            break
    
    if not potential_parent:
        return jsonify({'error': 'No valid parent found'}), 400
    
    # Update hierarchy
    task.parent_id = potential_parent.id
    task.level = potential_parent.level + 1
    potential_parent.is_summary = True
    
    # Also indent all children (descendants) of this task
    def update_descendants(parent_task, level_offset):
        children = Task.query.filter_by(parent_id=parent_task.id).all()
        for child in children:
            child.level = parent_task.level + 1
            update_descendants(child, level_offset)
    
    update_descendants(task, 1)
    
    db.session.commit()
    
    # Recalculate everything
    update_wbs_codes(project_id)
    recalculate_summary_dates(project_id)
    recalculate_order_indices(project_id)
    
    # Return updated task list
    tasks = Task.query.filter_by(project_id=project_id).order_by(Task.order_index).all()
    return jsonify([t.to_dict() for t in tasks])


@app.route('/api/tasks/<int:task_id>/outdent', methods=['POST'])
def outdent_task(task_id):
    """
    Outdent (promote) a task - move it up one level in the hierarchy.
    Siblings below this task become its children.
    """
    task = Task.query.get_or_404(task_id)
    project_id = task.project_id
    
    if task.level == 0 or task.parent_id is None:
        return jsonify({'error': 'Cannot outdent a top-level task'}), 400
    
    old_parent = Task.query.get(task.parent_id)
    if not old_parent:
        return jsonify({'error': 'Parent task not found'}), 400
    
    # Move task to parent's level
    task.parent_id = old_parent.parent_id
    task.level = old_parent.level
    
    # Find siblings that were below this task and make them children of this task
    all_tasks = Task.query.filter_by(project_id=project_id).order_by(Task.order_index).all()
    task_index = next((i for i, t in enumerate(all_tasks) if t.id == task_id), -1)
    
    # Siblings that come after this task (with same original parent) become children
    for i in range(task_index + 1, len(all_tasks)):
        sibling = all_tasks[i]
        if sibling.parent_id == old_parent.id:
            sibling.parent_id = task.id
            sibling.level = task.level + 1
            task.is_summary = True
        elif sibling.level <= old_parent.level:
            break  # Stop when we reach a task at same or higher level as old parent
    
    # Update descendants' levels
    def update_descendants(parent_task):
        children = Task.query.filter_by(parent_id=parent_task.id).all()
        for child in children:
            child.level = parent_task.level + 1
            update_descendants(child)
    
    update_descendants(task)
    
    # Check if old parent still has children
    old_parent_children = Task.query.filter_by(parent_id=old_parent.id).count()
    if old_parent_children == 0:
        old_parent.is_summary = False
    
    db.session.commit()
    
    # Recalculate everything
    update_wbs_codes(project_id)
    recalculate_summary_dates(project_id)
    recalculate_order_indices(project_id)
    
    # Return updated task list
    tasks = Task.query.filter_by(project_id=project_id).order_by(Task.order_index).all()
    return jsonify([t.to_dict() for t in tasks])


@app.route('/api/tasks/<int:task_id>/toggle-expand', methods=['POST'])
def toggle_expand_task(task_id):
    """Toggle the expanded/collapsed state of a summary task."""
    task = Task.query.get_or_404(task_id)
    
    if not task.is_summary:
        return jsonify({'error': 'Only summary tasks can be expanded/collapsed'}), 400
    
    task.expanded = not task.expanded
    db.session.commit()
    
    return jsonify(task.to_dict())


@app.route('/api/projects/<int:project_id>/reorder', methods=['POST'])
def reorder_tasks(project_id):
    """
    Reorder tasks based on new order_index values.
    Used for drag-and-drop reordering.
    """
    Project.query.get_or_404(project_id)
    data = request.get_json()
    
    task_orders = data.get('task_orders', [])  # List of {id: number, order_index: number}
    
    for item in task_orders:
        task = Task.query.get(item['id'])
        if task and task.project_id == project_id:
            task.order_index = item['order_index']
    
    db.session.commit()
    
    # Recalculate WBS codes and dates
    update_wbs_codes(project_id)
    recalculate_summary_dates(project_id)
    
    # Return updated task list
    tasks = Task.query.filter_by(project_id=project_id).order_by(Task.order_index).all()
    return jsonify([t.to_dict() for t in tasks])


# =============================================================================
# API ROUTES - SETTINGS
# =============================================================================

@app.route('/api/settings', methods=['GET'])
def get_settings():
    """Get all settings (resources, statuses, task types)"""
    resources = Resource.query.all()
    statuses = Status.query.order_by(Status.order_index).all()
    task_types = TaskType.query.all()
    
    return jsonify({
        'resources': [r.to_dict() for r in resources],
        'statuses': [s.to_dict() for s in statuses],
        'task_types': [t.to_dict() for t in task_types]
    })


@app.route('/api/resources', methods=['GET'])
def get_resources():
    """Get all resources"""
    resources = Resource.query.all()
    return jsonify([r.to_dict() for r in resources])


@app.route('/api/resources', methods=['POST'])
def create_resource():
    """Create a new resource"""
    data = request.get_json()
    resource = Resource(
        name=data['name'],
        email=data.get('email'),
        color=data.get('color', '#3498db')
    )
    db.session.add(resource)
    db.session.commit()
    return jsonify(resource.to_dict()), 201


@app.route('/api/resources/<int:resource_id>', methods=['PUT'])
def update_resource(resource_id):
    """Update a resource"""
    resource = Resource.query.get_or_404(resource_id)
    data = request.get_json()
    
    if 'name' in data:
        resource.name = data['name']
    if 'email' in data:
        resource.email = data['email']
    if 'color' in data:
        resource.color = data['color']
    
    db.session.commit()
    return jsonify(resource.to_dict())


@app.route('/api/resources/<int:resource_id>', methods=['DELETE'])
def delete_resource(resource_id):
    """Delete a resource"""
    resource = Resource.query.get_or_404(resource_id)
    db.session.delete(resource)
    db.session.commit()
    return jsonify({'message': 'Resource deleted successfully'})


@app.route('/api/statuses', methods=['GET'])
def get_statuses():
    """Get all statuses"""
    statuses = Status.query.order_by(Status.order_index).all()
    return jsonify([s.to_dict() for s in statuses])


@app.route('/api/statuses', methods=['POST'])
def create_status():
    """Create a new status"""
    data = request.get_json()
    status = Status(
        name=data['name'],
        color=data['color'],
        order_index=data.get('order_index', 0)
    )
    db.session.add(status)
    db.session.commit()
    return jsonify(status.to_dict()), 201


@app.route('/api/statuses/<int:status_id>', methods=['PUT'])
def update_status(status_id):
    """Update a status"""
    status = Status.query.get_or_404(status_id)
    data = request.get_json()
    
    if 'name' in data:
        status.name = data['name']
    if 'color' in data:
        status.color = data['color']
    if 'order_index' in data:
        status.order_index = data['order_index']
    
    db.session.commit()
    return jsonify(status.to_dict())


@app.route('/api/statuses/<int:status_id>', methods=['DELETE'])
def delete_status(status_id):
    """Delete a status"""
    status = Status.query.get_or_404(status_id)
    db.session.delete(status)
    db.session.commit()
    return jsonify({'message': 'Status deleted successfully'})


@app.route('/api/task-types', methods=['GET'])
def get_task_types():
    """Get all task types"""
    task_types = TaskType.query.all()
    return jsonify([t.to_dict() for t in task_types])


@app.route('/api/task-types', methods=['POST'])
def create_task_type():
    """Create a new task type"""
    data = request.get_json()
    task_type = TaskType(name=data['name'])
    db.session.add(task_type)
    db.session.commit()
    return jsonify(task_type.to_dict()), 201


# =============================================================================
# INITIALIZE DATABASE WITH DEFAULT DATA
# =============================================================================

def init_db():
    """Initialize database with default settings"""
    db.create_all()
    
    # Add default statuses if none exist
    if Status.query.count() == 0:
        default_statuses = [
            {'name': 'Not Started', 'color': '#9E9E9E', 'order_index': 0},
            {'name': 'In Progress', 'color': '#2196F3', 'order_index': 1},
            {'name': 'On Hold', 'color': '#FF9800', 'order_index': 2},
            {'name': 'Completed', 'color': '#4CAF50', 'order_index': 3},
            {'name': 'Cancelled', 'color': '#F44336', 'order_index': 4}
        ]
        for s in default_statuses:
            db.session.add(Status(**s))
    
    # Add default task types if none exist
    if TaskType.query.count() == 0:
        default_types = ['Task', 'Milestone']
        for t in default_types:
            db.session.add(TaskType(name=t))
    
    db.session.commit()


# =============================================================================
# RUN APPLICATION
# =============================================================================

if __name__ == '__main__':
    with app.app_context():
        init_db()
    app.run(debug=True, port=5000)
