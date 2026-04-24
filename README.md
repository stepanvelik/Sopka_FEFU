# Описание
Пусто

# Frontend
пока пусто


# Backend (FastAPI + PostgreSQL)

REST API для формы: студенты и банковские реквизиты. Структура: `backend/` — приложение, `database/` — SQL-схема, `frontend/` — заглушка под будущий фронт.

## Запуск через Docker

1. Установите и запустите [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows) или Docker Engine с Compose v2.

2. В терминале перейдите в корень проекта:

   ```powershell
   cd C:\папка проекта
   ```

3. Поднимите PostgreSQL и API (при изменениях в коде пересоберёт образ API):

   ```powershell
   docker compose up --build -d
   ```

4. Проверка:

   - API: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) (Swagger)
   - Проверка без БД: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

5. Остановка контейнеров (данные БД в volume сохраняются):

   ```powershell
   docker compose down
   ```

6. Полный сброс данных БД (удалит том, при следующем запуске снова выполнится `database/schema.sql`):

   ```powershell
   docker compose down -v
   ```

### Переменные окружения

Скопируйте `.env.example` в `.env` и при необходимости измените логин/пароль БД, порты (`API_PORT`, `POSTGRES_PORT`) и `DATABASE_URL` для сервиса `api`.

### Только база данных

Если API запускаете локально (`uvicorn`), достаточно БД:

```powershell
docker compose up -d db
```

В `.env` для приложения укажите `DATABASE_URL` с `localhost` и тем же портом, что проброшен у сервиса `db` (по умолчанию `5432`).

### Если сборка образа падает по сети

Повторите `docker compose build api` или `docker compose up --build -d`. Ошибки TLS/таймаута при скачивании образов с Docker Hub обычно проходят после повторной попытки или при более стабильном интернете.

## Локальный запуск API без Docker

Из корня репозитория (нужен запущенный PostgreSQL и совпадающий `DATABASE_URL`):

```powershell
pip install -r requirements.txt
uvicorn main:app --reload
```

Альтернатива из папки `backend`: `uvicorn app.main:app --reload`.
