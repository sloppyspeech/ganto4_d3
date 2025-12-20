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
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'code': self.code,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'task_count': len(self.tasks)
        }


class Task(db.Model):
    """Task model for storing task details"""
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.String(20), nullable=False)  # e.g., MIG-001
    description = db.Column(db.Text, nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    estimate = db.Column(db.Float, default=0.0)
    resource = db.Column(db.String(100))
    status = db.Column(db.String(50), default='Not Started')
    task_type = db.Column(db.String(20), default='Task')  # Task or Milestone
    parent_ids = db.Column(db.String(200))  # Comma-separated parent task IDs
    progress = db.Column(db.Integer, default=0)  # Progress percentage 0-100
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    order_index = db.Column(db.Integer, default=0)

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
            'order_index': self.order_index
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
    
    return jsonify(task.to_dict()), 201


@app.route('/api/tasks/<int:task_id>', methods=['GET'])
def get_task(task_id):
    """Get a single task by ID"""
    task = Task.query.get_or_404(task_id)
    return jsonify(task.to_dict())


@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    """Update a task"""
    task = Task.query.get_or_404(task_id)
    data = request.get_json()
    
    if 'description' in data:
        task.description = data['description']
    if 'start_date' in data:
        task.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
    if 'end_date' in data:
        task.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
    if 'estimate' in data:
        task.estimate = data['estimate']
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
    
    # Validate dates
    if task.end_date < task.start_date:
        return jsonify({'error': 'End date must be after start date'}), 400
    
    db.session.commit()
    return jsonify(task.to_dict())


@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    """Delete a task"""
    task = Task.query.get_or_404(task_id)
    db.session.delete(task)
    db.session.commit()
    return jsonify({'message': 'Task deleted successfully'})


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
