# EvoFit

SaaS multitenant para seguimiento de entrenamiento en el gimnasio. Stack: **React (Vite + TypeScript)**, **Laravel API**, **MariaDB**, **Docker Compose**.

## Requisitos

- Docker y Docker Compose

## Arranque rápido

```bash
cp .env.example .env
docker compose up --build
```

- **Frontend:** http://localhost:5173  
- **API:** http://localhost:8080/api/v1  
- **MariaDB:** localhost:3306  

## Funcionalidades (MVP)

- Registro e inicio de sesión por email (Sanctum + cookies, preparado para web y futura app iOS)
- Rutinas con ejercicios (series y repeticiones por defecto)
- Sesiones de entrenamiento con registro de peso, series y reps
- Calendario semanal de sesiones
- Progreso corporal: peso y fotos semanales
- Aislamiento multitenant en una sola base de datos (`tenant_id` + scope global)

## Desarrollo local (sin Docker)

### Backend

```bash
cd backend
cp .env.example .env
# Configura DB_* hacia tu MariaDB/MySQL
composer install
php artisan migrate
php artisan serve
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Estructura

- `backend/` — Laravel 13, API REST `/api/v1`
- `frontend/` — React, diseño mobile-first
- `docker-compose.yml` — MariaDB, backend, frontend

## Próximos pasos sugeridos

- Invitaciones a un mismo tenant (equipos / entrenadores)
- Notificaciones y recordatorios de sesión
- App iOS consumiendo la misma API (tokens Sanctum)
