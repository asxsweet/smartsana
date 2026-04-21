# Arduino IoT Fullstack

Бұл жоба енді fullstack форматта жұмыс істейді:
- Frontend: `frontend/index.html`, `frontend/css/main.css`, `frontend/js/*`
- Backend: Express + MongoDB (`backend/server/src/*`)
- Auth: JWT + role-based (`student`, `teacher`)

## 1) Орнату

```bash
npm install
```

`.env.example` файлын `.env` деп көшіріңіз және мәндерді толтырыңыз:

- `MONGODB_URI`
- `JWT_SECRET`
- `GROK_API_KEY`
- `GROK_MODEL` (мысалы: `grok-2-latest`)
- `AI_BASE_URL` (міндетті емес; бос болса key форматына қарап `xAI` не `Groq` автоматты таңдалады)
- `PORT`
- `CLIENT_ORIGIN`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

## 2) Seed

```bash
npm run seed
```

Seed келесілерді қосады:
- Demo teacher: `teacher@demo.kz` / `demo123`
- Бастапқы 4 видео

## Файл сақтау (Cloudinary)

- Студент тапсырмаға файл жүктегенде, файлдар MongoDB-ға base64 болып сақталмайды.
- Backend файлды Cloudinary-ге жүктеп, MongoDB-да тек `url/publicId` метадерегін сақтайды.
- Render deploy үшін Cloudinary env мәндерін міндетті түрде толтырыңыз.

## 3) Іске қосу

```bash
npm run dev
```

Сайт: `http://localhost:5000`

Егер фронтты бөлек статик ретінде ашқыңыз келсе (`Live Server`, `Vercel preview`):
- `CLIENT_ORIGIN` ішінде сол домен/порт болуы керек
- `frontend/vercel.json` арқылы `/api/*` сұраулары Render-ге проксиланады

## 3.1) Deploy (Render + Vercel)

### A) Backend-ті Render-ге шығару

1. Git репозиторийді Render-ге қосыңыз.
2. Root: жоба түбірі (`aichat`).
3. Render `render.yaml` файлын автоматты оқиды.
4. Render Environment Variables ішінде міндетті мәндерді толтырыңыз:
   - `MONGODB_URI` (MongoDB Atlas URI)
   - `JWT_SECRET`
   - `GROK_API_KEY`
   - `CLIENT_ORIGIN=https://<your-project>.vercel.app,http://localhost:5000,http://localhost:3000`
5. Deploy кейін тексеріңіз: `https://<your-render-service>.onrender.com/api/health`

### B) Frontend-ті Vercel-ге шығару

1. Сол репозиторийді Vercel-ге импорттаңыз.
2. Root Directory: `frontend`
3. Framework preset: `Other` (static).
4. Build command қажет емес.
5. Deploy алдында `frontend/vercel.json` ішіндегі:
   - `https://your-render-service.onrender.com`
   мәнін өз Render URL-іңізге ауыстырыңыз.
6. Deploy кейін Vercel доменінен сайт ашылып, `/api/*` сұраулары Render API-ға барады.

## 3.2) Бір уақытта local + internet режимі

- Local backend + local frontend:
  - `npm run dev`
  - `http://localhost:5000`
- Internet режимі:
  - Frontend: Vercel URL
  - Backend: Render URL
- Екеуі қатар жұмыс істеуі үшін `CLIENT_ORIGIN`-де localhost және vercel домендері бірге тұрады (үтірмен бөлінген).

## 4) Негізгі API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/videos`
- `POST /api/videos` (teacher)
- `DELETE /api/videos/:id` (teacher)
- `POST /api/messages`
- `GET /api/messages` (teacher)
- `DELETE /api/messages/:id` (teacher)
- `GET /api/users` (teacher)
- `DELETE /api/users/:id` (teacher)
- `GET /api/stats/overview` (teacher)
- `POST /api/ai/chat` (auth required)

## 5) Smoke test

1. Register student account.
2. Login және video list ашылады.
3. Student ретінде feedback жіберіледі.
4. Teacher аккаунтпен кіріп:
   - user list көреді
   - message list көреді
   - жаңа video қосады/жояды
5. AI chat хабарлама жіберіп жауап алады.
