# Justfile for the HoroHelper project

# --- Configuration ---
# Set the name for your remote SSH host connection
REMOTE_HOST := "heartwood"

# Set the base name for your Docker images
BACKEND_IMAGE_NAME := "horotw/horohelper-backend"
FRONTEND_IMAGE_NAME := "horotw/horohelper-frontend"

# --- Individual Service Recipes ---

# Build the backend Docker image
build-backend:
    docker build -t {{BACKEND_IMAGE_NAME}}:latest ./backend
    @echo "✅ Backend image built successfully: {{BACKEND_IMAGE_NAME}}:latest"

# Build the frontend Docker image
build-frontend:
    docker build -t {{FRONTEND_IMAGE_NAME}}:latest ./frontend
    @echo "✅ Frontend image built successfully: {{FRONTEND_IMAGE_NAME}}:latest"

# Save the backend image to a gzipped tarball
save-backend: build-backend
    docker save {{BACKEND_IMAGE_NAME}}:latest | gzip > backend.tar.gz
    @echo "📦 Backend image saved to backend.tar.gz"

# Save the frontend image to a gzipped tarball
save-frontend: build-frontend
    docker save {{FRONTEND_IMAGE_NAME}}:latest | gzip > frontend.tar.gz
    @echo "📦 Frontend image saved to frontend.tar.gz"

# Transfer the backend image to the remote host
transfer-backend: save-backend
    scp backend.tar.gz {{REMOTE_HOST}}:/tmp/backend.tar.gz
    @echo "🚀 Backend image transferred to {{REMOTE_HOST}}"
    ssh {{REMOTE_HOST}} 'docker load < /tmp/backend.tar.gz && docker tag {{BACKEND_IMAGE_NAME}}:latest {{BACKEND_IMAGE_NAME}}:$(date +%Y%m%d%H%M%S) && rm /tmp/backend.tar.gz'
    @echo "✅ Backend image loaded and tagged on remote host."

# Transfer the frontend image to the remote host
transfer-frontend: save-frontend
    scp frontend.tar.gz {{REMOTE_HOST}}:/tmp/frontend.tar.gz
    @echo "🚀 Frontend image transferred to {{REMOTE_HOST}}"
    ssh {{REMOTE_HOST}} 'docker load < /tmp/frontend.tar.gz && docker tag {{FRONTEND_IMAGE_NAME}}:latest {{FRONTEND_IMAGE_NAME}}:$(date +%Y%m%d%H%M%S) && rm /tmp/frontend.tar.gz'
    @echo "✅ Frontend image loaded and tagged on remote host."


local-dev-docker:
    @echo "Starting local development environment..."
    docker-compose -f docker-compose.dev.yml up --build

local-dev:
    @echo "Starting local development environment using .venv env for backend..."
    tmux new-session -d -s horohelper 'bash -c "cd backend && pwd && source ../.venv/bin/activate && echo activated && DATABASE_URL=sqlite:///../data/database.db python -m uvicorn main:app --reload --port 8000"'
    tmux split-window -h 'bash -c "cd frontend && pwd && python -m http.server 3000"'
    tmux attach -t horohelper
    @echo "Local development environment started. Backend on port 8000, Frontend on port 3000."



# --- Aggregate Recipes ---

# Build both images
build: build-backend build-frontend

# Save both images
save: save-backend save-frontend

# Transfer both images
transfer: transfer-backend transfer-frontend

# Deploy everything: build, save, and transfer both images
deploy: transfer
    @echo "🎉 Deployment completed successfully for both services."

# Clean up local tarballs
clean:
    rm -f backend.tar.gz frontend.tar.gz
    @echo "🧹 Cleaned up local image tarballs."
