.PHONY: dev backend frontend

dev:
	@echo "Starting StockTracker backend and frontend..."
	@powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command','cd \"$(CURDIR)\backend\"; python -m uv run uvicorn app.main:app --host 127.0.0.1 --port 8000'"
	@powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command','cd \"$(CURDIR)\frontend\"; pnpm dev --host 127.0.0.1 --port 5173'"
	@echo "Backend:  http://127.0.0.1:8000"
	@echo "Frontend: http://127.0.0.1:5173"

backend:
	cd backend && python -m uv run uvicorn app.main:app --host 127.0.0.1 --port 8000

frontend:
	cd frontend && pnpm dev --host 127.0.0.1 --port 5173
