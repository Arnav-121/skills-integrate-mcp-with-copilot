"""
High School Management System API

A simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

from fastapi import FastAPI, HTTPException, Depends, Header, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from pathlib import Path
import hashlib
import uuid
import os

app = FastAPI(
    title="Mergington High School API",
    description="API for viewing and signing up for extracurricular activities",
)

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount(
    "/static",
    StaticFiles(directory=os.path.join(current_dir, "static")),
    name="static",
)

# In-memory user store and session tokens
users = {
    "admin@mergington.edu": {
        "password_hash": hashlib.sha256("admin123".encode("utf-8")).hexdigest(),
        "role": "admin",
    },
    "student@mergington.edu": {
        "password_hash": hashlib.sha256("student123".encode("utf-8")).hexdigest(),
        "role": "student",
    },
}

sessions = {}

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"],
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"],
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"],
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"],
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"],
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"],
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"],
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"],
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"],
    },
}


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def get_current_user(authorization: str = Header(None)):
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
        )

    token = authorization.split(" ", 1)[1]
    email = sessions.get(token)
    if not email or email not in users:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token.",
        )

    return {"email": email, "role": users[email]["role"]}


def require_admin(user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return user


class AuthRequest(BaseModel):
    email: str
    password: str


class ActivityCreateRequest(BaseModel):
    name: str
    description: str
    schedule: str
    max_participants: int


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.post("/auth/register")
def register(auth_request: AuthRequest):
    email = auth_request.email.lower().strip()
    if email in users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with that email already exists.",
        )

    users[email] = {
        "password_hash": hash_password(auth_request.password),
        "role": "student",
    }
    token = uuid.uuid4().hex
    sessions[token] = email
    return {
        "access_token": token,
        "token_type": "bearer",
        "email": email,
        "role": "student",
    }


@app.post("/auth/login")
def login(auth_request: AuthRequest):
    email = auth_request.email.lower().strip()
    user = users.get(email)
    if not user or user["password_hash"] != hash_password(auth_request.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = uuid.uuid4().hex
    sessions[token] = email
    return {
        "access_token": token,
        "token_type": "bearer",
        "email": email,
        "role": user["role"],
    }


@app.get("/auth/me")
def get_me(user=Depends(get_current_user)):
    return user


@app.get("/activities")
def get_activities(user=Depends(get_current_user)):
    return activities


@app.post("/activities")
def create_activity(activity: ActivityCreateRequest, user=Depends(require_admin)):
    if activity.name in activities:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An activity with that name already exists.",
        )

    activities[activity.name] = {
        "description": activity.description,
        "schedule": activity.schedule,
        "max_participants": activity.max_participants,
        "participants": [],
    }
    return {"message": f"Activity {activity.name} created."}


@app.delete("/activities/{activity_name}")
def delete_activity(activity_name: str, user=Depends(require_admin)):
    if activity_name not in activities:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")

    del activities[activity_name]
    return {"message": f"Activity {activity_name} deleted."}


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(activity_name: str, user=Depends(get_current_user)):
    """Sign up a student for an activity"""
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    activity = activities[activity_name]
    email = user["email"]

    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up",
        )

    if len(activity["participants"]) >= activity["max_participants"]:
        raise HTTPException(
            status_code=400,
            detail="This activity is full.",
        )

    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(activity_name: str, user=Depends(get_current_user)):
    """Unregister a student from an activity"""
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    activity = activities[activity_name]
    email = user["email"]

    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity",
        )

    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
