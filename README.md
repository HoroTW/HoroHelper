# Self-Hosted Tracker App

A minimal self-rolled app to log structured data (e.g. weight, habits, metrics) and later visualize it.  
This project uses a **Python FastAPI backend** with an **SQLite database** and a **lightweight HTML/JS/CSS frontend**.

---

## ✨ Features (planned / implemented)
- Structured logging with validation (e.g. numeric-only for weight).
- Auto-filled date & time fields.
- Pre-filled last value for convenience.
- Mobile-friendly input (number picker / roller).
- Simple JSON API (so future mobile apps can connect).
- Data stored locally in **SQLite**, but can be migrated to Postgres/MySQL.
- Easy integration with Metabase / Grafana for visualization.


## Currently tracked fields:
- Date (auto-filled) (required)
- Time (auto-filled) (required)
- Weight (numeric, e.g. 70.5) kg
- Body Fat (numeric, e.g. 15.2) %
- Muscle (numeric, e.g. 40.3) %
- Visceral Fat (numeric, e.g. 10) (just a magic number)
- Sleep (numeric, e.g. 7.5) hours
- Notes (text)

---

## 🗂 Project Structure
```
HoroHelper/
├── backend/
│   ├── main.py         # FastAPI backend
│   ├── models.py       # SQLAlchemy models
│   ├── Dockerfile      # Dockerfile for the backend
│   └── requirements.txt  # Python deps
├── frontend/
│   ├── index.html      # Main tracker input form
│   ├── stats.html      # Statistics page
│   ├── style.css       # Shared styling
│   ├── app.js          # JS for the tracker page
│   ├── stats.js        # JS for the statistics page
│   └── Dockerfile      # Dockerfile for the frontend
├── docker-compose.yml  # Docker Compose file to orchestrate services
└── README.md
```

## 🖥 Requirements

### Backend
- Python 3.10+
- FastAPI
- Uvicorn
- SQLAlchemy

### Frontend
- Any modern web browser.

## Running the App

### Using Docker (Recommended)
1. Make sure you have Docker and Docker Compose installed.
2. From the `HoroHelper` project root, run:
    ```bash
    docker-compose up --build
    ```
3. Open your browser and navigate to `http://localhost:8080`.

### For local development without Docker:
1. **Start the backend:** From the `backend` directory, run:
    ```bash
    # You might need to install dependencies from requirements.txt first
    # pip install -r requirements.txt
    DATABASE_URL=sqlite:///../data/database.db python -m uvicorn main:app --reload --port 8000
    ```
2. **Open the frontend:** Open the `frontend/index.html` file directly in your browser.