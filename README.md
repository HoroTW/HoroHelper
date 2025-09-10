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


## Currently tracked fileds:
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
tracker-app/
├── backend/
│ ├── main.py # FastAPI backend
│ ├── models.py # SQLAlchemy models
│ ├── database.db # SQLite database (auto-created)
│ └── requirements.txt # Python deps
├── frontend/
│ ├── index.html # Input form
│ ├── style.css # Styling
│ └── app.js # Frontend logic (fetch → API)
└── README.md
```

## 🖥 Requirements

### Backend
- Python 3.10+
- FastAPI
- Uvicorn
- SQLAlchemy

Install dependencies:
```bash
uv pip install -r backend/requirements.txt
```

Run the backend:
```bash
uvicorn backend.main:app --reload
```
### Frontend
- Any web server (or just open `frontend/index.html` in a browser).
- Modern browser (for Fetch API).

## Running the App
1. Start the backend server:
    ```bash
    cd backend
    uvicorn main:app --reload
    ```
2. Open `frontend/index.html` in your browser.
  - Form posts data to http://host/api/logs
  - Fetches last log from http://host/api/logs/last for pre-filling.
