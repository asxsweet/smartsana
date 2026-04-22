# SmartSana - Дипломдық жоба түсіндірмесі / Пояснение к дипломному проекту

Бұл файл GitHub-та ыңғайлы оқу үшін Markdown форматында берілді.  
Деректер осы репозиторийдің нақты архитектурасына сәйкес жазылды.

## Қазақша нұсқа

### 1. Жобаның мақсаты
SmartSana - Arduino және IoT бойынша оқу процесін цифрландыруға арналған full-stack веб-портал.

Негізгі мақсаттар:

- мұғалімге контент (видео, датчик, код, AI шаблон сұрақтары) басқаруды жеңілдету;
- студентке тапсырманы ыңғайлы түрде жіберу;
- мұғалімге жіберілімдерді тез тексеріп, баға қою;
- чат пен аналитика арқылы оқу барысын бір жерден бақылау.

### 2. Қолданушылар рөлі

- **Teacher (мұғалім):** видео/датчик/код қосады, студенттерді басқарады, тапсырмаларды бағалайды, чат жүргізеді.
- **Student (студент):** видеоны оқиды, тапсырма жібереді, чатта сұрақ қояды, AI көмекшіден жауап алады.

### 3. Технологиялық стек

#### Frontend

- HTML5
- CSS3
- Vanilla JavaScript (SPA тәрізді құрылым)
- Fetch API

#### Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT
- Zod
- Cloudinary (файл сақтау)

#### AI

- Groq/xAI compatible endpoint (env арқылы)
- fallback модель логикасы

### 4. Архитектура

Backend қабатталған түрде ұйымдастырылған:

- `routes` - endpoint маршруттары
- `models` - MongoDB схемалары
- `middlewares` - auth/role
- `services` - сыртқы сервистер (Cloudinary)
- `config` - env конфигурациясы

Frontend:

- `frontend/index.html` - негізгі layout
- `frontend/js/app.js` - негізгі бизнес логика
- `frontend/js/api.js` - API клиент
- `frontend/js/ui-utils.js` - UI utility
- `frontend/js/profile-module.js` - профиль модулі

### 5. Қауіпсіздік

- JWT арқылы авторизация
- RBAC: teacher-only endpoint-тер
- Zod валидация
- API қателерін орталық өңдеу
- Logger + error middleware
- Env production-check (`CLIENT_ORIGIN`, `TEACHER_SETUP_CODE`)

### 6. Негізгі модульдер

#### Видео және тапсырма модулі

- видео құру/жою
- әр видеоға тапсырма қосу
- студент жауабы мен файл жіберу

#### Бағалау модулі

- мұғалім submission-ды көреді
- score + feedback қояды

#### Датчик/код модулі

- мұғалім датчик сипаттамаларын басқарады
- мұғалім код үлгілерін басқарады

#### Чат модулі

- студент-мұғалім диалогтары
- unread count
- last seen

#### Профиль модулі

- аты-жөні, био, телефон, орналасқан жер
- аватар жүктеу + preview
- құпиясөз өзгерту

#### Аналитика/басқару модулі

- submissions overview
- студент прогресі
- фильтр/іздеу/сұрыптау

### 7. UX/UI ерекшеліктері

- Top-center toast хабарламалар
- Custom confirm modal
- Loading/disabled state (double-submit болдырмау)
- Empty-state CTA
- Mobile header/nav бейімделуі

### 8. Деректер тұтастығы

- Submission бір студент + бір видео үшін unique
- Video view tracking (refresh-тен кейін жоғалмайды)
- Duplicate контент backend-та тексеріледі (`video`, `site-config`)

### 9. Өнімділік және тұрақтылық

- Async/await
- Сұрау timeout/retry (`api.js`)
- Орталық error mapping
- Logger арқылы request/error мониторинг

### 10. Тесттер

- Backend integration (Jest + Supertest)
- In-memory MongoDB (`mongodb-memory-server`)
- E2E инфрақұрылым (Playwright config + smoke/flow skeleton)

### 11. Диплом қорғауға қысқа мәтін

Менің дипломдық жобам - SmartSana веб-порталы. Бұл жүйе мұғалім мен студент арасындағы оқу циклін автоматтандырады: мұғалім видео мен тапсырма жариялайды, студент жауап пен файл жібереді, мұғалім бағалайды, ал чат және аналитика арқылы прогресті бақылайды. Жоба Node.js + Express + MongoDB және vanilla JS негізінде жасалды. Қауіпсіздік JWT, рөлдік авторизация және валидация арқылы шешілді. Профиль, AI көмекші, файл жүктеу, прогресс трекинг және тест инфрақұрылымы енгізілді. Нәтижесінде практикалық қолдануға дайын тұрақты платформа жасалды.

---

## Русская версия

### 1. Цель проекта

SmartSana - full-stack веб-портал для цифровизации учебного процесса по Arduino и IoT.

Ключевые задачи:

- упростить преподавателю управление контентом и проверкой;
- дать студенту удобную отправку решений;
- обеспечить коммуникацию через чат;
- дать базовую аналитику по обучению.

### 2. Роли пользователей

- **Teacher:** управляет видео/датчиками/кодом, проверяет работы, выставляет оценки, работает со студентами.
- **Student:** изучает уроки, отправляет задания, получает обратную связь, общается в чате, использует AI.

### 3. Технологии

#### Frontend

- HTML5
- CSS3
- Vanilla JavaScript
- Fetch API

#### Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT
- Zod
- Cloudinary

#### AI

- Groq/xAI-compatible endpoint
- fallback по моделям

### 4. Архитектура

Backend:

- `routes`
- `models`
- `middlewares`
- `services`
- `config`

Frontend:

- `index.html`
- `app.js`
- `api.js`
- `ui-utils.js`
- `profile-module.js`

### 5. Безопасность

- JWT-аутентификация
- RBAC (ограничение по ролям)
- строгая валидация входных данных
- централизованный error handling
- логирование запросов и ошибок
- production-проверка env

### 6. Основной функционал

- модуль видео и заданий
- модуль проверок и оценивания
- модуль датчиков и кодовых примеров
- чат между студентом и преподавателем
- профиль пользователя (включая аватар и смену пароля)
- аналитика и управление студентами

### 7. UX/UI

- toast-уведомления
- единый confirm modal
- loading/disabled состояния кнопок
- CTA в пустых состояниях
- адаптация под мобильные экраны

### 8. Целостность данных

- уникальные submission для пары student+video
- трекинг просмотра видео с сохранением
- backend-проверки на дубликаты контента

### 9. Производительность и стабильность

- async/await
- timeout + retry в API клиенте
- единый error mapper
- логирование для мониторинга

### 10. Тестирование

- integration-тесты backend
- изолированная БД в тестах (memory server)
- подготовлен E2E слой на Playwright

### 11. Короткий текст для защиты

Тема моего дипломного проекта - веб-портал SmartSana. Система автоматизирует учебный цикл: преподаватель публикует видео и задания, студент отправляет решение, преподаватель выставляет итоговую оценку, а чат и аналитика позволяют контролировать прогресс. Проект реализован на Node.js + Express + MongoDB и vanilla JavaScript. Безопасность обеспечена JWT, ролевой моделью доступа и валидацией данных. Реализованы профиль пользователя, AI-помощник, загрузка файлов, трекинг просмотра и тестовая инфраструктура. В результате получена стабильная платформа, готовая к практическому использованию.

---

## Қысқаша / Кратко

- Толық full-stack шешім / Полноценное full-stack решение
- Нақты оқу сценарийіне бейімделген / Адаптирован под реальный учебный процесс
- Тұрақты және кеңейтуге дайын / Стабильная и готовая к масштабированию архитектура

---

## Код үзінділері (дипломға қосуға)

### 1) JWT auth middleware

```js
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    req.user = user;
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
}
```

### 2) Teacher-only route (RBAC)

```js
router.post("/", requireAuth, requireRole("teacher"), async (req, res) => {
  const parsed = createVideoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request" });
  }
  const video = await Video.create({ ...parsed.data, createdBy: req.user._id });
  return res.status(201).json({ video });
});
```

### 3) Submission grading

```js
router.patch("/:id/submissions/:submissionId/grade", requireAuth, requireRole("teacher"), async (req, res) => {
  const submission = await VideoSubmission.findOneAndUpdate(
    { _id: req.params.submissionId, videoId: req.params.id },
    { $set: { status: "graded", score: req.body.score, feedback: req.body.feedback } },
    { new: true }
  );
  if (!submission) return res.status(404).json({ message: "Submission not found" });
  return res.json({ submission });
});
```

### 4) Frontend API client (error mapping)

```js
async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}
```

### 5) Toast хабарлама utility

```js
function showToast(message, type = "success", duration = 3800) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove("success", "error", "show");
  toast.classList.add(type === "error" ? "error" : "success");
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => toast.classList.remove("show"), duration);
}
```

### 6) Видео просмотр прогресі

```js
router.post("/:id/viewed", requireAuth, async (req, res) => {
  if (req.user.role !== "student") return res.status(403).json({ message: "Only students can track progress" });
  const viewed = await VideoView.findOneAndUpdate(
    { videoId: req.params.id, studentId: req.user._id },
    { $set: { lastViewedAt: new Date() } },
    { upsert: true, new: true }
  );
  return res.json({ viewed });
});
```
