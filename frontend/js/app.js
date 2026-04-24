let currentUser = null;
let videos = [];
let students = [];
let conversations = [];
let activeConversationId = null;
let chatMessages = [];
let videoProgressById = {};
let siteConfig = { sensors: [], codes: [], quickQuestions: [] };
let aiHistory = { q: [] };
let crudSaveHandler = null;
let profileModule = null;
const feedbackDefaults = {
  title: document.querySelector("#sec-feedback .sec-title")?.textContent || "Мұғалімге жазу",
  sub: document.querySelector("#sec-feedback .sec-sub")?.textContent || "",
  grid: document.querySelector("#sec-feedback .fb-grid")?.innerHTML || "",
};

const SYS = 'Сен Arduino және IoT оқу платформасының AI көмекшісісің. Оқушылар мен мұғалімдер қазақша сұрақ қояды, сен де қазақша жауап бер. Жауаптарың қысқа әрі нақты болсын: артық созба, бірақ мағынасы толық және түсінікті болсын. Қажет болса 3-5 тармақпен бер.';

function getViewedStorageKey() {
  const userId = currentUser?.id || currentUser?._id || "guest";
  return `videoViewed:${userId}`;
}

function loadViewedFromStorage() {
  try {
    const raw = localStorage.getItem(getViewedStorageKey());
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_e) {
    return {};
  }
}

function saveViewedToStorage(map) {
  try {
    localStorage.setItem(getViewedStorageKey(), JSON.stringify(map || {}));
  } catch (_e) {
    // Ignore storage quota/security errors.
  }
}

function setHeaderUser(user) {
  const nameEl = document.getElementById("uName");
  const avatarEl = document.getElementById("uAvatar");
  if (nameEl) nameEl.textContent = user?.name || "";
  if (avatarEl) {
    if (user?.avatarUrl) {
      avatarEl.innerHTML = `<img src="${user.avatarUrl}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
      avatarEl.textContent = user?.name?.[0]?.toUpperCase?.() || "";
    }
  }
}

function setCurrentUser(user) {
  currentUser = user;
}

function getUnreadCount() {
  if (!currentUser) return 0;
  return (conversations || []).reduce((sum, c) => {
    return sum + (currentUser.role === "teacher" ? (c.unreadForTeacher || 0) : (c.unreadForStudent || 0));
  }, 0);
}

function switchAuthTab(t) {
  document.querySelectorAll('.auth-tab').forEach((b, i) => b.classList.toggle('active', i === (t === 'login' ? 0 : 1)));
  document.getElementById('loginForm').classList.toggle('active', t === 'login');
  document.getElementById('regForm').classList.toggle('active', t === 'reg');
}

function toggleTeacherRegMode(enabled) {
  const wrap = document.getElementById("rg_teacher_code_wrap");
  const roleInput = document.getElementById("rg_role");
  const classSelect = document.getElementById("rg_class");
  if (wrap) wrap.style.display = enabled ? "block" : "none";
  if (roleInput) roleInput.value = enabled ? "teacher" : "student";
  if (classSelect) classSelect.disabled = enabled;
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  if (btn) btn.classList.toggle("is-hidden", !isPassword);
}

async function doLogin() {
  try {
    const email = document.getElementById('li_email').value.trim();
    const password = document.getElementById('li_pass').value;
    const err = document.getElementById('li_err');
    const { token, user } = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    setToken(token);
    err.style.display = "none";
    await afterLogin(user);
  } catch (e) {
    const err = document.getElementById('li_err');
    err.textContent = e?.message || 'Email немесе құпиясөз қате';
    err.style.display = 'block';
  }
}

async function doRegister() {
  const name = document.getElementById('rg_name').value.trim();
  const email = document.getElementById('rg_email').value.trim();
  const className = document.getElementById('rg_class').value;
  const password = document.getElementById('rg_pass').value;
  const role = document.getElementById('rg_role').value || "student";
  const teacherSetupCode = (document.getElementById("rg_teacher_code")?.value || "").trim();
  const err = document.getElementById("rg_err");
  if (role === "teacher" && !teacherSetupCode) {
    err.textContent = "Мұғалім тіркеу кодын енгізіңіз.";
    err.style.display = "block";
    return;
  }
  try {
    const { token, user } = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, className, role, teacherSetupCode }),
    });
    setToken(token);
    err.style.display = "none";
    return afterLogin(user);
  } catch (e) {
    err.textContent = e?.message || "Тіркелу қатесі";
    err.style.display = "block";
  }
}

async function afterLogin(user) {
  currentUser = user;
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  setHeaderUser(user);
  document.getElementById('uBadge').textContent = user.role === 'teacher' ? 'Мұғалім' : 'Оқушы';
  buildNav();
  await loadData();
  renderAll();
  showSec('home');
}

function doLogout() {
  clearToken();
  currentUser = null;
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function buildNav() {
  const items = [['home', 'Басты'], ['video', 'Видео'], ['sensor', 'Датчиктер'], ['code', 'Код']];
  items.push(['question', 'AI Сұрақ']);
  const unread = getUnreadCount();
  const feedbackLabel = currentUser.role === 'teacher' ? 'Хабарламалар' : 'Байланыс';
  items.push(['feedback', unread > 0 ? `${feedbackLabel} (${unread})` : feedbackLabel]);
  if (currentUser.role === "teacher") {
    items.push(["students", "Студенттер"]);
    items.push(["submissions", "Тапсырмалар"]);
  }
  document.getElementById('headerNav').innerHTML = items.map(([id, label]) => `<button class="hnav-btn" onclick="showSec('${id}')">${label}</button>`).join('');
}

function showSec(id) {
  document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
  document.getElementById(`sec-${id}`).classList.add('active');
  if (id === "submissions" && currentUser?.role === "teacher") {
    renderSubmissionDashboard();
  }
  if (id === "students" && currentUser?.role === "teacher") {
    renderStudentsManage();
  }
}

async function loadData() {
  const requests = [apiRequest('/videos'), apiRequest('/site-config'), apiRequest('/messages/conversations')];
  if (currentUser.role === "student") {
    requests.push(apiRequest("/videos/progress/me"));
  }
  const [v, cfg, c, progressData] = await Promise.all(requests);
  videos = v.videos || [];
  siteConfig = cfg.config || siteConfig;
  conversations = c.conversations || [];
  const progress = progressData?.progress || [];
  const serverProgress = progress.reduce((acc, item) => {
    const key = String(item.videoId?._id || item.videoId || "");
    if (key) acc[key] = item.lastViewedAt;
    return acc;
  }, {});
  const localProgress = currentUser.role === "student" ? loadViewedFromStorage() : {};
  videoProgressById = { ...localProgress, ...serverProgress };
  if (currentUser.role === "student") {
    saveViewedToStorage(videoProgressById);
  }
  if (currentUser.role === "teacher") {
    const usersData = await apiRequest("/users");
    students = (usersData.users || []).filter((u) => u.role === "student");
  } else {
    students = [];
  }
  activeConversationId = conversations[0]?._id || null;
  if (activeConversationId) {
    await loadConversationMessages(activeConversationId);
  } else {
    chatMessages = [];
  }
  buildNav();
}

function renderAll() {
  renderVideos();
  renderSensors();
  renderCodes();
  renderQuestions();
  renderFeedbackSection();
  renderProfileSection();
}

function renderProfileSection() {
  return profileModule?.renderProfileSection();
}

async function saveProfile(buttonEl) {
  return profileModule?.saveProfile(buttonEl);
}

async function previewAvatarFile() {
  return profileModule?.previewAvatarFile();
}

async function changePassword(buttonEl) {
  return profileModule?.changePassword(buttonEl);
}

function teacherActionBar(section) {
  if (currentUser?.role !== 'teacher') return '';
  return `<div style="margin-bottom:10px;font-size:12px;color:var(--accent2);display:flex;align-items:center;justify-content:space-between;"><span>Мұғалім режимі: ${section}</span><span style="color:var(--text3)">Осы бөлімде контентті тікелей басқарасыз</span></div>`;
}

function renderVideos() {
  const canEdit = currentUser?.role === 'teacher';
  const grid = document.getElementById('videoGrid');
  const cards = videos.map((v) => {
    const viewedAt = videoProgressById[String(v._id)];
    const viewedBadge = (!canEdit && viewedAt)
      ? `<span class="badge b-green" style="margin-left:8px;">Қаралды</span><div class="msg-meta">Соңғы қаралғаны: ${new Date(viewedAt).toLocaleString("kk-KZ")}</div>`
      : (!canEdit ? `<span class="badge b-red" style="margin-left:8px;">Қаралмады</span>` : "");
    return `<div class="vcard"><div class="vthumb" onclick="${v.url ? `window.open('${v.url}','_blank')` : 'void(0)'}"><div class="vthumb-bg"></div><div class="play-btn"><div class="play-tri"></div></div><div class="vdur">${v.dur || ''}</div></div><div class="vinfo"><div class="vnum">Сабақ ${v.num}${viewedBadge}</div><div class="vtitle">${v.title}</div><div class="vdesc">${v.desc || ''}</div><div style="display:flex;gap:8px;margin-top:10px;"><button class="cpybtn" onclick="openVideoLesson('${v._id}')">Сабақты ашу</button>${canEdit ? `<button class="cpybtn" onclick="deleteVideo('${v._id}')">Жою</button>` : ''}</div></div></div>`;
  }).join('');
  const addCard = canEdit ? `<div class="add-card" onclick="addVideoPrompt()"><div style="font-size:32px;">+</div><div>Жаңа видео қосу</div></div>` : '';
  grid.innerHTML = teacherActionBar('Видео сабақтар') + cards + addCard;
}

async function addVideoPrompt() {
  openCrudModal("Жаңа видео қосу", [
    { key: "title", label: "Тақырып", value: "" },
    { key: "num", label: "Сабақ №", value: `${videos.length + 1}` },
    { key: "dur", label: "Ұзақтығы", value: "10:00" },
    { key: "desc", label: "Сипаттама", value: "" },
    { key: "url", label: "YouTube URL", value: "" },
    { key: "tasksText", label: "Тапсырма мәтіні (көп жол жазсаңыз да бір тапсырма болады)", value: "Схеманы сипаттаңыз", textarea: true },
  ], async (values) => {
    try {
      const videoTitle = normalizeText(values.title);
      const videoUrl = normalizeText(values.url);
      const duplicateVideo = videos.find((v) => (
        (videoTitle && normalizeText(v.title) === videoTitle) ||
        (videoUrl && normalizeText(v.url) === videoUrl)
      ));
      if (duplicateVideo) {
        const shouldContinue = await askConfirm("Бұл видео бұрын қосылған. Қайталап қосқыңыз келе ме?");
        if (!shouldContinue) {
          showToast("Видео қосудан бас тартылды.", "error");
          return;
        }
      }
      const instruction = (values.tasksText || "").trim();
      const tasks = instruction
        ? [{ title: "Тапсырма", instruction, maxScore: 10 }]
        : [];
      await apiRequest('/videos', { method: 'POST', body: JSON.stringify({ ...values, tasks }) });
      await loadData();
      renderVideos();
      showToast("Видео сәтті қосылды.", "success");
    } catch (e) {
      showToast(e?.message || "Видеоны қосу сәтсіз аяқталды.", "error");
      throw e;
    }
  });
}

async function deleteVideo(id) {
  if (!(await askConfirm("Видеоны жою керек пе?", "Жоюды растау"))) return;
  await apiRequest(`/videos/${id}`, { method: 'DELETE' });
  await loadData();
  renderVideos();
}

async function openVideoLesson(videoId) {
  const overlay = document.getElementById("lessonModalOverlay");
  const bodyEl = document.getElementById("lessonModalBody");
  const titleEl = document.getElementById("lessonModalTitle");
  const data = await apiRequest(`/videos/${videoId}/lesson`);
  const video = data.video;
  titleEl.textContent = `${video.num}. ${video.title}`;

  if (currentUser.role === "teacher") {
    const submissions = data.submissions || [];
    bodyEl.innerHTML = `
      <div class="fg"><div class="fl">Видео</div><div class="fi">${video.desc || ""}</div></div>
      <div class="fg"><div class="fl">Тапсырмалар</div>${(video.tasks || []).map((t, i) => `<div class="qq">${i + 1}) <strong>${t.title}</strong> — ${t.instruction} (${t.maxScore} ұпай)</div>`).join("") || '<div class="qq">Тапсырма қосылмаған</div>'}</div>
      <div class="fg"><div class="fl">Студент жіберілімдері</div>
        ${submissions.map((s) => `
          <div class="msg-item">
            <div class="msg-from">${s.studentId?.name || "Студент"} (${s.studentId?.className || "-"})</div>
            <div class="msg-meta">Статус: ${s.status} | Ұпай: ${s.score || 0}</div>
            <div class="msg-text">AI бағасы: ${s.aiEvaluatedAt ? (s.aiScore || 0) : "Әлі жоқ"}${s.aiFeedback ? ` · ${s.aiFeedback}` : ""}</div>
            ${s.aiSuggestion ? `<div class="msg-text">AI ұсынысы: ${s.aiSuggestion}</div>` : ""}
            <div class="msg-text">Мұғалім бағасы: ${s.status === "graded" ? (s.score || 0) : "Қойылмаған"}${s.feedback ? ` · ${s.feedback}` : ""}</div>
            ${(s.answers || []).map((a, i) => `<div class="msg-text">${i + 1}) ${a.answerText}</div>`).join("")}
            ${(s.files || []).length ? `<div class="msg-text">Файлдар: ${(s.files || []).map((f) => `<a href="${f.url || f.dataUrl}" download="${escapeHtml(f.name)}" target="_blank" rel="noopener">${escapeHtml(f.name)}</a>`).join(" · ")}</div>` : ""}
            <div style="display:flex;gap:8px;margin-top:8px;">
              <input class="fi" id="grade-score-${s._id}" placeholder="Ұпай" style="max-width:90px;">
              <input class="fi" id="grade-feedback-${s._id}" placeholder="Кері байланыс">
              <button class="cpybtn" onclick="gradeSubmission('${video._id}','${s._id}')">Бағалау</button>
            </div>
          </div>`).join("") || '<div class="empty-state">Жіберілім жоқ</div>'}
      </div>`;
  } else {
    const lastViewedAt = data.lastViewedAt || new Date().toISOString();
    videoProgressById[String(videoId)] = lastViewedAt;
    saveViewedToStorage(videoProgressById);
    renderVideos();
    const submission = data.submission;
    bodyEl.innerHTML = `
      <div class="fg"><div class="fl">Видео</div><div class="fi">${video.desc || ""}</div>${video.url ? `<button class="cpybtn" onclick="window.open('${video.url}','_blank')">Видеоны ашу</button>` : ""}</div>
      <div class="fg"><div class="fl">Тапсырмалар</div>
        ${(video.tasks || []).map((t, i) => `<div class="qq"><strong>${i + 1}. ${t.title}</strong><br>${t.instruction}<br><textarea class="fta" id="answer-${t._id}" placeholder="Жауабыңызды жазыңыз..."></textarea></div>`).join("") || '<div class="qq">Бұл видеода тапсырма жоқ</div>'}
      </div>
      <div class="fg">
        <div class="fl">Орындалған файлдар (әртүрлі формат қолдау бар)</div>
        <input class="fi" id="submission-files" type="file" multiple>
      </div>
      ${submission?.files?.length ? `<div class="note-box">Бұрын жіберілген файлдар: ${(submission.files || []).map((f) => `<a href="${f.url || f.dataUrl}" download="${escapeHtml(f.name)}" target="_blank" rel="noopener">${escapeHtml(f.name)}</a>`).join(" · ")}</div>` : ""}
      ${submission ? `<div class="note-box">AI бағасы: ${submission.aiEvaluatedAt ? (submission.aiScore || 0) : "Әлі жоқ"}${submission.aiFeedback ? ` · ${submission.aiFeedback}` : ""}</div>` : ""}
      ${submission?.aiSuggestion ? `<div class="note-box">AI ұсынысы: ${submission.aiSuggestion}</div>` : ""}
      ${submission ? `<div class="note-box">Мұғалім бағасы: ${submission.status === "graded" ? (submission.score || 0) : "Қойылмаған"}${submission.feedback ? ` · ${submission.feedback}` : ""}</div>` : ""}
      <button class="sub-btn" onclick="submitVideoTasks('${video._id}')">Тапсырманы жіберу</button>`;

    (submission?.answers || []).forEach((a) => {
      const el = document.getElementById(`answer-${a.taskId}`);
      if (el) el.value = a.answerText;
    });
  }
  overlay.classList.add("open");
}

function closeLessonModal() {
  document.getElementById("lessonModalOverlay").classList.remove("open");
}

async function submitVideoTasks(videoId) {
  const data = await apiRequest(`/videos/${videoId}/lesson`);
  const answers = (data.video.tasks || []).map((t) => ({
    taskId: String(t._id),
    answerText: (document.getElementById(`answer-${t._id}`)?.value || "").trim(),
  })).filter((a) => a.answerText);
  const filesInput = document.getElementById("submission-files");
  const rawFiles = Array.from(filesInput?.files || []);
  const maxPerFile = 8 * 1024 * 1024;
  const totalSize = rawFiles.reduce((sum, f) => sum + (f.size || 0), 0);
  if (rawFiles.some((f) => (f.size || 0) > maxPerFile)) {
    showToast("Әр файл көлемі 8MB-тан аспауы керек.", "error");
    return;
  }
  if (totalSize > 20 * 1024 * 1024) {
    showToast("Файлдардың жалпы көлемі 20MB-тан аспауы керек.", "error");
    return;
  }
  const files = await Promise.all(rawFiles.map(async (file) => ({
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size || 0,
    dataUrl: await fileToDataUrl(file),
  })));
  if (!answers.length && !files.length) {
    showToast("Кемінде мәтін жауабын немесе файл жүктеңіз.", "error");
    return;
  }
  await apiRequest(`/videos/${videoId}/submissions`, { method: "POST", body: JSON.stringify({ answers, files }) });
  showToast("Тапсырма сәтті жіберілді.", "success");
  await openVideoLesson(videoId);
}

async function gradeSubmission(videoId, submissionId) {
  const score = document.getElementById(`grade-score-${submissionId}`)?.value || "0";
  const feedback = document.getElementById(`grade-feedback-${submissionId}`)?.value || "";
  await apiRequest(`/videos/${videoId}/submissions/${submissionId}/grade`, {
    method: "PATCH",
    body: JSON.stringify({ score, feedback }),
  });
  await openVideoLesson(videoId);
  await renderSubmissionDashboard();
}

async function renderSubmissionDashboard() {
  const root = document.getElementById("submissionDashboard");
  if (!root || currentUser?.role !== "teacher") return;
  const data = await apiRequest("/videos/submissions/overview");
  const summary = data.summary || { total: 0, submitted: 0, graded: 0 };
  const searchText = normalizeText(document.getElementById("submissionSearchInput")?.value || "");
  const sortBy = document.getElementById("submissionSortSelect")?.value || "new";
  let list = data.submissions || [];
  if (searchText) {
    list = list.filter((s) => `${s.studentId?.name || ""} ${s.videoId?.title || ""}`.toLowerCase().includes(searchText));
  }
  if (sortBy === "old") list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  if (sortBy === "score") list.sort((a, b) => (b.score || 0) - (a.score || 0));
  root.innerHTML = `
    <div class="stats-row" style="margin-bottom:18px;">
      <div class="stat-card"><div class="n">${summary.total}</div><div class="l">Барлығы</div></div>
      <div class="stat-card"><div class="n">${summary.submitted}</div><div class="l">Бағаны күтіп тұр</div></div>
      <div class="stat-card"><div class="n">${summary.graded}</div><div class="l">Бағаланған</div></div>
    </div>
    <div class="msg-list">
      ${list.map((s) => `
        <div class="msg-item">
          <div class="msg-item-head">
            <div>
              <div class="msg-from">${s.studentId?.name || "Студент"} (${s.studentId?.className || "-"})</div>
              <div class="msg-meta">${s.videoId?.num || "-"}: ${s.videoId?.title || "Видео"} · ${new Date(s.createdAt).toLocaleString("kk-KZ")}</div>
            </div>
            <span class="badge ${s.status === "graded" ? "b-green" : "b-amber"}">${s.status === "graded" ? `Мұғалім бағалады (${s.score || 0})` : "Мұғалім бағасын күтіп тұр"}</span>
          </div>
          <div class="msg-text">AI: ${s.aiEvaluatedAt ? (s.aiScore || 0) : "Әлі жоқ"}${s.aiFeedback ? ` · ${s.aiFeedback}` : ""}</div>
          ${s.aiSuggestion ? `<div class="msg-text">AI ұсынысы: ${s.aiSuggestion}</div>` : ""}
          ${(s.answers || []).map((a, i) => `<div class="msg-text">${i + 1}) ${a.answerText}</div>`).join("")}
          ${(s.files || []).length ? `<div class="msg-text">Файлдар: ${(s.files || []).map((f) => `<a href="${f.url || f.dataUrl}" download="${escapeHtml(f.name)}" target="_blank" rel="noopener">${escapeHtml(f.name)}</a>`).join(" · ")}</div>` : ""}
          <div style="margin-top:10px;">
            <button class="cpybtn" onclick="openVideoLesson('${s.videoId?._id}')">Сабаққа өту</button>
          </div>
        </div>
      `).join("") || '<div class="empty-state">Жіберілген тапсырмалар жоқ<br><button class="cpybtn" style="margin-top:10px;" onclick="renderSubmissionDashboard()">Жаңарту</button></div>'}
    </div>
  `;
}

function renderStudentsManage() {
  const listEl = document.getElementById("studentsManageList");
  const progressEl = document.getElementById("studentProgressPanel");
  if (!listEl || !progressEl || currentUser?.role !== "teacher") return;

  const searchText = normalizeText(document.getElementById("studentSearchInput")?.value || "");
  const sortBy = document.getElementById("studentSortSelect")?.value || "new";
  let filtered = [...students];
  if (searchText) {
    filtered = filtered.filter((s) => `${s.name} ${s.email} ${s.className || ""}`.toLowerCase().includes(searchText));
  }
  if (sortBy === "name") filtered.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "kk"));
  if (sortBy === "new") filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  listEl.innerHTML = filtered.length
    ? filtered.map((s) => `
      <div class="qq">
        <strong>${s.name}</strong><br>
        <span style="font-size:11px;color:var(--text3)">${s.email} ${s.className ? `· ${s.className}` : ""}</span>
        <div style="margin-top:8px;display:flex;gap:8px;">
          <button class="cpybtn" onclick="openStudentProgress('${s.id}')">Прогресс</button>
          <button class="cpybtn" onclick="deleteStudent('${s.id}')" style="color:var(--red);border-color:rgba(252,129,129,.3);">Жою</button>
        </div>
      </div>`).join("")
    : '<div class="empty-state">Студент жоқ<br><button class="cpybtn" style="margin-top:10px;" onclick="loadData().then(renderStudentsManage)">Қайта жүктеу</button></div>';
}

async function openStudentProgress(studentId) {
  const panel = document.getElementById("studentProgressPanel");
  if (!panel) return;
  const data = await apiRequest(`/users/${studentId}/progress`);
  const st = data.student;
  const sm = data.summary;
  panel.innerHTML = `
    <div class="msg-item">
      <div class="msg-from">${st.name} (${st.className || "-"})</div>
      <div class="msg-meta">${st.email}</div>
    </div>
    <div class="stats-row" style="margin:10px 0;">
      <div class="stat-card"><div class="n">${sm.totalVideos}</div><div class="l">Барлық видео</div></div>
      <div class="stat-card"><div class="n">${sm.notSubmitted}</div><div class="l">Тапсырмаған</div></div>
      <div class="stat-card"><div class="n">${sm.submitted}</div><div class="l">Күтіп тұр</div></div>
      <div class="stat-card"><div class="n">${sm.graded}</div><div class="l">Бағаланған</div></div>
    </div>
    <div class="msg-list">
      ${data.progress.map((p) => `
        <div class="msg-item">
          <div class="msg-item-head">
            <div class="msg-from">${p.num}. ${p.title}</div>
            <span class="badge ${p.status === "graded" ? "b-green" : p.status === "submitted" ? "b-amber" : "b-red"}">
              ${p.status === "graded" ? `Бағаланған (${p.score})` : p.status === "submitted" ? "Баға күтіп тұр" : "Тапсырылмаған"}
            </span>
          </div>
          <div class="msg-meta">Тапсырма: ${p.answeredCount}/${p.tasksCount}</div>
          ${p.feedback ? `<div class="msg-text">Feedback: ${p.feedback}</div>` : ""}
        </div>`).join("") || '<div class="empty-state">Прогресс табылмады</div>'}
    </div>`;
}

async function deleteStudent(studentId) {
  if (!(await askConfirm("Студентті жоясыз ба?", "Жоюды растау"))) return;
  await apiRequest(`/users/${studentId}`, { method: "DELETE" });
  await loadData();
  renderStudentsManage();
  const panel = document.getElementById("studentProgressPanel");
  if (panel) panel.innerHTML = "Студентті таңдаңыз";
}

function renderSensors() {
  const holder = document.getElementById('sensorTabs');
  const tabs = siteConfig.sensors.map((s, i) => {
    if (currentUser?.role === "teacher") {
      return `<button class="stab${i === 0 ? ' active' : ''}" onclick="setSensor(${i},this)">${s.ico} ${s.lbl} <span style="margin-left:6px;color:var(--red);font-weight:700;cursor:pointer;" onclick="event.stopPropagation();deleteSensor(${i})">✕</span></button>`;
    }
    return `<button class="stab${i === 0 ? ' active' : ''}" onclick="setSensor(${i},this)">${s.ico} ${s.lbl}</button>`;
  }).join('');
  holder.innerHTML = teacherActionBar('Датчиктер') + tabs + (currentUser?.role === 'teacher' ? `<button class="stab" onclick="addSensorPrompt()">+ Қосу</button>` : '');
  if (siteConfig.sensors.length) setSensor(0);
}

function setSensor(i, btn) {
  if (btn) { document.querySelectorAll('.stab').forEach((t) => t.classList.remove('active')); btn.classList.add('active'); }
  const s = siteConfig.sensors[i];
  if (!s) return;
  const imageEl = document.getElementById('sImg');
  const iconEl = document.getElementById('sIco');
  const hintEl = document.getElementById('sPhotoHint');
  document.getElementById('sName').textContent = s.name;
  document.getElementById('sDesc').textContent = s.desc;
  iconEl.textContent = s.ico || "⚙️";
  document.getElementById('sLbl').textContent = `${s.lbl} датчигі`;
  document.getElementById('sNote').textContent = s.note;
  if (s.image) {
    imageEl.src = s.image;
    imageEl.style.display = "block";
    iconEl.style.display = "none";
    if (hintEl) hintEl.textContent = "Датчик суреті";
  } else {
    imageEl.removeAttribute("src");
    imageEl.style.display = "none";
    iconEl.style.display = "block";
    if (hintEl) hintEl.textContent = "Фото / схема осында";
  }
}

async function addSensorPrompt() {
  const iconOptions = ["⚙️", "🌡️", "💧", "🌫️", "☀️", "🌱", "🔥", "💡", "📡", "🔊", "📷", "🧭", "🛰️", "🔋", "⚡"];
  const overlay = document.getElementById("crudModalOverlay");
  const titleEl = document.getElementById("crudModalTitle");
  const bodyEl = document.getElementById("crudModalBody");
  const saveBtn = document.getElementById("crudModalSaveBtn");
  titleEl.textContent = "Жаңа датчик қосу";
  bodyEl.innerHTML = `
    <div class="fg"><label class="fl">Қысқа атауы (мыс: DHT11)</label><input class="fi" id="sensor_lbl"></div>
    <div class="fg"><label class="fl">Толық атауы</label><input class="fi" id="sensor_name"></div>
    <div class="fg">
      <label class="fl">Иконка таңдау</label>
      <select class="fs" id="sensor_ico_select">
        ${iconOptions.map((icon) => `<option value="${icon}">${icon}</option>`).join("")}
      </select>
      <div style="font-size:11px;color:var(--text3);margin-top:6px;">Немесе өз иконкаңызды/эмоджиді жазыңыз:</div>
      <input class="fi" id="sensor_ico_custom" value="">
    </div>
    <div class="fg"><label class="fl">Сипаттама</label><input class="fi" id="sensor_desc" value="Сипаттама"></div>
    <div class="fg"><label class="fl">Ескерту</label><input class="fi" id="sensor_note" value="Ескерту"></div>
    <div class="fg">
      <label class="fl">Датчик суреті (jpg, jpeg, png, webp, gif, svg)</label>
      <input class="fi" id="sensor_image_file" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.svg,image/jpeg,image/png,image/webp,image/gif,image/svg+xml">
      <div style="font-size:11px;color:var(--text3);margin-top:6px;">Сурет жүктесеңіз, иконка орнына сол көрсетіледі.</div>
    </div>
  `;

  crudSaveHandler = async () => {
    try {
      const lbl = document.getElementById("sensor_lbl")?.value.trim();
      const name = document.getElementById("sensor_name")?.value.trim();
      const selectedIcon = document.getElementById("sensor_ico_select")?.value || "⚙️";
      const customIcon = document.getElementById("sensor_ico_custom")?.value.trim();
      const ico = customIcon || selectedIcon || "⚙️";
      const desc = document.getElementById("sensor_desc")?.value.trim() || "Сипаттама";
      const note = document.getElementById("sensor_note")?.value.trim() || "Ескерту";
      const duplicateSensor = (siteConfig.sensors || []).find((s) => (
        (normalizeText(lbl) && normalizeText(s.lbl) === normalizeText(lbl)) ||
        (normalizeText(name) && normalizeText(s.name) === normalizeText(name))
      ));
      if (duplicateSensor) {
        const shouldContinue = await askConfirm("Бұл датчик бұрын қосылған. Қайталап қосқыңыз келе ме?");
        if (!shouldContinue) {
          showToast("Датчик қосудан бас тартылды.", "error");
          return;
        }
      }
      const fileEl = document.getElementById("sensor_image_file");
      const file = fileEl?.files?.[0];
      let image = "";
      if (file) {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
        const isAllowed = allowedTypes.includes(file.type) || /\.(jpe?g|png|webp|gif|svg)$/i.test(file.name);
        if (!isAllowed) {
          showToast("Қолдау бар форматтар: jpg, jpeg, png, webp, gif, svg", "error");
          return;
        }
        image = await fileToDataUrl(file);
      }
      siteConfig.sensors.push({
        name: name || `${lbl || "Датчик"} — Жаңа датчик`,
        desc,
        ico,
        image,
        lbl: lbl || "SENSOR",
        note,
        pins: [['PIN', 'D2', 'pd', 'Сипат']],
      });
      await apiRequest('/site-config', { method: 'PUT', body: JSON.stringify(siteConfig) });
      renderSensors();
      closeCrudModal();
      showToast("Датчик сәтті қосылды.", "success");
    } catch (e) {
      showToast(e?.message || "Датчикті қосу сәтсіз аяқталды.", "error");
    }
  };
  saveBtn.onclick = () => crudSaveHandler && crudSaveHandler();
  overlay.classList.add("open");
}

async function deleteSensor(index) {
  if (!(await askConfirm("Датчикті жоясыз ба?", "Жоюды растау"))) return;
  siteConfig.sensors.splice(index, 1);
  await apiRequest('/site-config', { method: 'PUT', body: JSON.stringify(siteConfig) });
  renderSensors();
  showToast("Датчик сәтті жойылды.", "success");
}

function renderCodes() {
  const list = document.getElementById('codeList');
  list.innerHTML = teacherActionBar('Код үлгілері') + (siteConfig.codes || []).map((c, i) => `
    <div class="citem"><div class="chead"><div class="ctitle">${c.title}</div><div class="cmeta">${c.meta}</div></div>
    <div class="code-body" style="display:block;"><pre>${highlightCodeSnippet(c.code)}</pre><div class="cactions">
      <button class="cpybtn" onclick="copyC(this)">Кодты көшіру</button>
      ${currentUser?.role === 'teacher' ? `<button class="cpybtn" onclick="deleteCode(${i})">Жою</button>` : ''}
    </div></div></div>`).join('')
    + (currentUser?.role === 'teacher' ? `<button class="add-btn" onclick="addCodePrompt()">+ Код қосу</button>` : '');
}

function decodeStoredCode(value) {
  const txt = document.createElement("textarea");
  txt.innerHTML = String(value || "");
  return txt.value;
}

function highlightCodeSnippet(rawCode) {
  const code = decodeStoredCode(rawCode);
  const escaped = escapeHtml(code);
  const withComments = escaped.replace(/(\/\/.*)$/gm, '<span class="cm">$1</span>');
  const withStrings = withComments.replace(/("([^"\\]|\\.)*")/g, '<span class="str">$1</span>');
  const withNumbers = withStrings.replace(/\b(\d+)\b/g, '<span class="num">$1</span>');
  const withKeywords = withNumbers.replace(/\b(void|int|float|double|bool|char|String|if|else|for|while|return|true|false|const|unsigned|long|short)\b/g, '<span class="kw">$1</span>');
  return withKeywords.replace(/\b(setup|loop|pinMode|digitalWrite|digitalRead|analogRead|analogWrite|delay|Serial|begin|println|print)\b/g, '<span class="fn">$1</span>');
}

async function addCodePrompt() {
  openCrudModal("Жаңа код үлгісі", [
    { key: "title", label: "Тақырыбы", value: "" },
    { key: "meta", label: "Meta", value: "Мұғалім қосты" },
    { key: "code", label: "Код", value: "void setup(){}\nvoid loop(){}", textarea: true },
  ], async (v) => {
    try {
      const duplicateCode = (siteConfig.codes || []).find((c) => (
        (normalizeText(v.title) && normalizeText(c.title) === normalizeText(v.title)) ||
        (normalizeText(v.code) && normalizeText(c.code) === normalizeText((v.code || '').replace(/</g, '&lt;')))
      ));
      if (duplicateCode) {
        const shouldContinue = await askConfirm("Бұл код бұрын қосылған. Қайталап қосқыңыз келе ме?");
        if (!shouldContinue) {
          showToast("Код қосудан бас тартылды.", "error");
          return;
        }
      }
      siteConfig.codes.push({ title: v.title, meta: v.meta, code: (v.code || '').replace(/</g, '&lt;') });
      await apiRequest('/site-config', { method: 'PUT', body: JSON.stringify(siteConfig) });
      renderCodes();
      showToast("Код сәтті қосылды.", "success");
    } catch (e) {
      showToast(e?.message || "Кодты қосу сәтсіз аяқталды.", "error");
      throw e;
    }
  });
}

async function deleteCode(i) {
  siteConfig.codes.splice(i, 1);
  await apiRequest('/site-config', { method: 'PUT', body: JSON.stringify(siteConfig) });
  renderCodes();
}

function copyC(btn) {
  const txt = btn.closest('.code-body').querySelector('pre').innerText;
  navigator.clipboard.writeText(txt);
}

function renderQuestions() {
  const quick = (siteConfig.quickQuestions || []).filter((q) => q.type === 'quick');
  const err = (siteConfig.quickQuestions || []).filter((q) => q.type === 'error');
  const cards = document.querySelectorAll('#sec-question .side-card');
  if (cards[0]) {
    cards[0].innerHTML = `<h4>Жылдам сұрақтар</h4>${quick.map((q) => {
      const idx = (siteConfig.quickQuestions || []).indexOf(q);
      const controls = currentUser?.role === 'teacher'
        ? `<div style="display:flex;gap:6px;margin-top:6px;">
            <button class="cpybtn" onclick="event.stopPropagation();editQuestionPrompt(${idx})">Өңдеу</button>
            <button class="cpybtn" onclick="event.stopPropagation();deleteQuestion(${idx})" style="color:var(--red);border-color:rgba(252,129,129,.35);">Жою</button>
          </div>`
        : "";
      return `<div class="qq" onclick="setQ('${q.prompt.replace(/'/g, "\\'")}')">${q.label}${controls}</div>`;
    }).join('')}${currentUser?.role === 'teacher' ? '<button class="cpybtn" onclick="addQuickQuestionPrompt()">+ Қосу</button>' : ''}`;
  }
  if (cards[1]) {
    cards[1].innerHTML = `<h4>Қате шешу</h4>${err.map((q) => {
      const idx = (siteConfig.quickQuestions || []).indexOf(q);
      const controls = currentUser?.role === 'teacher'
        ? `<div style="display:flex;gap:6px;margin-top:6px;">
            <button class="cpybtn" onclick="event.stopPropagation();editQuestionPrompt(${idx})">Өңдеу</button>
            <button class="cpybtn" onclick="event.stopPropagation();deleteQuestion(${idx})" style="color:var(--red);border-color:rgba(252,129,129,.35);">Жою</button>
          </div>`
        : "";
      return `<div class="qq" onclick="setQ('${q.prompt.replace(/'/g, "\\'")}')">${q.label}${controls}</div>`;
    }).join('')}${currentUser?.role === 'teacher' ? '<button class="cpybtn" onclick="addErrorQuestionPrompt()">+ Қосу</button>' : ''}`;
  }
}

async function addQuickQuestionPrompt() {
  openCrudModal("Жылдам AI сұрақ қосу", [
    { key: "label", label: "Көрінетін атауы", value: "" },
    { key: "prompt", label: "AI-ға жіберілетін текст", value: "", textarea: true },
  ], async (v) => {
    siteConfig.quickQuestions.push({ label: v.label, prompt: v.prompt, type: 'quick' });
    await apiRequest('/site-config', { method: 'PUT', body: JSON.stringify(siteConfig) });
    renderQuestions();
  });
}

async function addErrorQuestionPrompt() {
  openCrudModal("Қате-шешім сұрағын қосу", [
    { key: "label", label: "Көрінетін атауы", value: "" },
    { key: "prompt", label: "AI-ға жіберілетін текст", value: "", textarea: true },
  ], async (v) => {
    siteConfig.quickQuestions.push({ label: v.label, prompt: v.prompt, type: 'error' });
    await apiRequest('/site-config', { method: 'PUT', body: JSON.stringify(siteConfig) });
    renderQuestions();
  });
}

async function editQuestionPrompt(index) {
  const item = (siteConfig.quickQuestions || [])[index];
  if (!item) return;
  openCrudModal(item.type === "error" ? "Қате-шешім сұрағын өңдеу" : "Жылдам AI сұрағын өңдеу", [
    { key: "label", label: "Көрінетін атауы", value: item.label || "" },
    { key: "prompt", label: "AI-ға жіберілетін текст", value: item.prompt || "", textarea: true },
  ], async (v) => {
    if (!v.label || !v.prompt) {
      showToast("Атауы мен мәтінін толтырыңыз.", "error");
      return;
    }
    siteConfig.quickQuestions[index] = { ...item, label: v.label, prompt: v.prompt };
    await apiRequest('/site-config', { method: 'PUT', body: JSON.stringify(siteConfig) });
    renderQuestions();
    showToast("AI сұрағы жаңартылды.", "success");
  });
}

async function deleteQuestion(index) {
  const item = (siteConfig.quickQuestions || [])[index];
  if (!item) return;
  const ok = await askConfirm("Осы AI сұрағын жоясыз ба?", "Жоюды растау");
  if (!ok) return;
  siteConfig.quickQuestions.splice(index, 1);
  await apiRequest('/site-config', { method: 'PUT', body: JSON.stringify(siteConfig) });
  renderQuestions();
  showToast("AI сұрағы жойылды.", "success");
}

async function sendAI() {
  const inp = document.getElementById('qInput');
  const msgsEl = document.getElementById('qMsgs');
  const txt = inp.value.trim();
  if (!txt) return;
  inp.value = '';
  aiHistory.q.push({ role: 'user', content: txt });
  msgsEl.innerHTML += `<div class="msg user"><div class="mav uav">Мен</div><div class="bubble user-b">${txt}</div></div>`;
  msgsEl.innerHTML += `<div class="msg" id="aiTyping"><div class="mav bav">AI</div><div class="bubble bot-b">Жауап жазылып жатыр...</div></div>`;
  msgsEl.scrollTop = msgsEl.scrollHeight;
  try {
    const data = await apiRequest('/ai/chat', { method: 'POST', body: JSON.stringify({ system: SYS, messages: aiHistory.q }) });
    const reply = data.content?.map((x) => x.text || '').join('') || 'Қате орын алды.';
    aiHistory.q.push({ role: 'assistant', content: reply });
    document.getElementById('aiTyping')?.remove();
    msgsEl.innerHTML += `<div class="msg"><div class="mav bav">AI</div><div class="bubble bot-b">${reply.replace(/\n/g, '<br>')}</div></div>`;
  } catch (e) {
    document.getElementById('aiTyping')?.remove();
    const errText = e?.data?.providerMessage || e?.message || "AI қате қайтарды";
    msgsEl.innerHTML += `<div class="msg"><div class="mav bav">AI</div><div class="bubble bot-b" style="color:var(--red);">Қате: ${errText}</div></div>`;
  }
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

function setQ(q) { document.getElementById('qInput').value = q; sendAI(); }

function renderFeedbackSection() {
  const root = document.getElementById('sec-feedback');
  const titleEl = root.querySelector('.sec-title');
  const subEl = root.querySelector('.sec-sub');
  const grid = root.querySelector('.fb-grid');
  titleEl.textContent = currentUser?.role === "teacher" ? "Студенттермен чат" : "Мұғаліммен чат";
  subEl.textContent = currentUser?.role === "teacher" ? "Әр студентпен жеке диалог" : "Сұрақ қойып, мұғалімнен кері байланыс алыңыз";
  const searchInputId = "conversationSearchInput";
  const sortSelectId = "conversationSortSelect";
  const searchText = normalizeText(document.getElementById(searchInputId)?.value || "");
  const sortBy = document.getElementById(sortSelectId)?.value || "new";
  let filteredConversations = [...conversations];
  if (searchText) {
    filteredConversations = filteredConversations.filter((c) => `${c.subject} ${c.studentName || ""} ${c.className || ""}`.toLowerCase().includes(searchText));
  }
  if (sortBy === "old") filteredConversations.sort((a, b) => new Date(a.lastMessageAt) - new Date(b.lastMessageAt));
  if (sortBy === "unread") filteredConversations.sort((a, b) => (currentUser?.role === "teacher" ? (b.unreadForTeacher || 0) - (a.unreadForTeacher || 0) : (b.unreadForStudent || 0) - (a.unreadForStudent || 0)));

  grid.innerHTML = `
    <div class="fb-form">
      <h3>${currentUser?.role === "teacher" ? "Диалогтар" : "Диалогтарым"}</h3>
      ${currentUser?.role === "student" ? `<button class="cpybtn" onclick="createConversationPrompt()">+ Жаңа диалог</button>` : `<button class="cpybtn" onclick="refreshConversations()">Жаңарту</button>`}
      <div class="form-row" style="margin-top:10px;">
        <div class="fg"><input class="fi" id="${searchInputId}" placeholder="Диалог іздеу" value="${escapeHtml(document.getElementById(searchInputId)?.value || "")}" oninput="renderFeedbackSection()"></div>
        <div class="fg"><select class="fs" id="${sortSelectId}" onchange="renderFeedbackSection()"><option value="new" ${sortBy === "new" ? "selected" : ""}>Жаңа</option><option value="old" ${sortBy === "old" ? "selected" : ""}>Ескі</option><option value="unread" ${sortBy === "unread" ? "selected" : ""}>Оқылмаған</option></select></div>
      </div>
      <div style="margin-top:12px;max-height:420px;overflow:auto;">
        ${filteredConversations.map((c) => {
          const unread = currentUser?.role === "teacher" ? (c.unreadForTeacher || 0) : (c.unreadForStudent || 0);
          const badge = unread > 0 ? `<span class="badge b-amber" style="margin-left:6px;">${unread}</span>` : "";
          const lastSeenAt = currentUser?.role === "teacher" ? c.lastSeenByStudentAt : c.lastSeenByTeacherAt;
          const lastSeenLabel = lastSeenAt
            ? ` · Соңғы көргені: ${new Date(lastSeenAt).toLocaleString("kk-KZ")}`
            : "";
          return `<div class="qq" style="${activeConversationId === c._id ? 'border-color:var(--accent);color:var(--accent);' : ''}" onclick="openConversation('${c._id}')"><strong>${c.subject}</strong>${badge}<br><span style="font-size:11px;color:var(--text3)">${c.studentName || ""} ${c.className ? `(${c.className})` : ""}${lastSeenLabel}</span></div>`;
        }).join("") || `<div class="empty-state">Диалог жоқ<br><button class="cpybtn" style="margin-top:10px;" onclick="${currentUser?.role === "student" ? "createConversationPrompt()" : "refreshConversations()"}">${currentUser?.role === "student" ? "Жаңа диалог ашу" : "Жаңарту"}</button></div>`}
      </div>
    </div>
    <div class="fb-form">
      <h3>Чат</h3>
      <div id="chatThread" style="max-height:360px;overflow:auto;margin-bottom:12px;">${renderChatMessagesHtml()}</div>
      <div class="fg"><textarea class="fta" id="chatInput" placeholder="Жауап жазыңыз..."></textarea></div>
      <button class="sub-btn" onclick="sendChatMessage()">Жіберу</button>
    </div>`;
}

async function submitFB() {
  // Deprecated old feedback form handler. Kept to avoid inline errors.
  await createConversationPrompt();
}

function renderChatMessagesHtml() {
  if (!chatMessages.length) return '<div class="empty-state">Хабарлама жоқ</div>';
  return chatMessages.map((m) => `
    <div class="msg ${m.senderRole === currentUser?.role ? 'user' : ''}" style="margin-bottom:8px;">
      <div class="mav ${m.senderRole === 'teacher' ? 'bav' : 'uav'}">${m.senderRole === 'teacher' ? 'М' : 'С'}</div>
      <div class="bubble ${m.senderRole === currentUser?.role ? 'user-b' : 'bot-b'}">${m.text}</div>
    </div>`).join("");
}

async function refreshConversations() {
  const c = await apiRequest('/messages/conversations');
  conversations = c.conversations || [];
  buildNav();
  if (!activeConversationId && conversations.length) activeConversationId = conversations[0]._id;
  if (activeConversationId) await loadConversationMessages(activeConversationId);
  renderFeedbackSection();
}

async function loadConversationMessages(conversationId) {
  const data = await apiRequest(`/messages/conversations/${conversationId}/messages`);
  chatMessages = data.messages || [];
  conversations = (conversations || []).map((c) => {
    if (c._id !== conversationId) return c;
    return {
      ...c,
      unreadForTeacher: currentUser?.role === "teacher" ? 0 : (c.unreadForTeacher || 0),
      unreadForStudent: currentUser?.role === "student" ? 0 : (c.unreadForStudent || 0),
    };
  });
  buildNav();
}

async function openConversation(conversationId) {
  activeConversationId = conversationId;
  await loadConversationMessages(conversationId);
  renderFeedbackSection();
}

async function createConversationPrompt() {
  openCrudModal("Жаңа диалог", [
    { key: "subject", label: "Тақырып", value: "Сабақ сұрағы" },
    { key: "text", label: "Алғашқы хабарлама", value: "", textarea: true },
  ], async (v) => {
    if (!v.subject || !v.text) return;
    await apiRequest("/messages/conversations", { method: "POST", body: JSON.stringify(v) });
    await refreshConversations();
  });
}

async function sendChatMessage() {
  if (!activeConversationId) {
    if (currentUser?.role === "student") {
      await createConversationPrompt();
    } else {
      showToast("Алдымен диалог таңдаңыз.", "error");
    }
    return;
  }
  const input = document.getElementById("chatInput");
  const text = (input?.value || "").trim();
  if (!text) return;
  await apiRequest(`/messages/conversations/${activeConversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
  if (input) input.value = "";
  await refreshConversations();
}

function openCrudModal(title, fields, onSave) {
  const overlay = document.getElementById("crudModalOverlay");
  const titleEl = document.getElementById("crudModalTitle");
  const bodyEl = document.getElementById("crudModalBody");
  const saveBtn = document.getElementById("crudModalSaveBtn");
  titleEl.textContent = title;
  bodyEl.innerHTML = fields.map((f) => `
    <div class="fg">
      <label class="fl">${f.label}</label>
      ${f.textarea
        ? `<textarea class="fta" data-field="${f.key}">${f.value || ""}</textarea>`
        : `<input class="fi" data-field="${f.key}" value="${(f.value || "").replace(/"/g, "&quot;")}">`}
    </div>`).join("");

  crudSaveHandler = async () => {
    const values = {};
    bodyEl.querySelectorAll("[data-field]").forEach((el) => { values[el.dataset.field] = el.value.trim(); });
    saveBtn.disabled = true;
    const oldText = saveBtn.textContent;
    saveBtn.textContent = "Сақталуда...";
    try {
      await onSave(values);
      closeCrudModal();
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = oldText;
    }
  };
  saveBtn.onclick = () => crudSaveHandler && crudSaveHandler();
  overlay.classList.add("open");
}

function closeCrudModal() {
  document.getElementById("crudModalOverlay").classList.remove("open");
  crudSaveHandler = null;
}

profileModule = window.createProfileModule?.({
  getCurrentUser: () => currentUser,
  setCurrentUser,
  apiRequest,
  setHeaderUser,
  showToast,
  setButtonLoading,
  fileToDataUrl,
});

async function restoreSession() {
  const token = getToken();
  if (!token) return;
  try {
    const { user } = await apiRequest('/auth/me');
    await afterLogin(user);
  } catch (_e) { clearToken(); }
}

restoreSession();
