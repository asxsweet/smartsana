let currentUser = null;
let videos = [];
let students = [];
let conversations = [];
let activeConversationId = null;
let chatMessages = [];
let siteConfig = { sensors: [], codes: [], quickQuestions: [] };
let aiHistory = { q: [] };
let crudSaveHandler = null;
const feedbackDefaults = {
  title: document.querySelector("#sec-feedback .sec-title")?.textContent || "Мұғалімге жазу",
  sub: document.querySelector("#sec-feedback .sec-sub")?.textContent || "",
  grid: document.querySelector("#sec-feedback .fb-grid")?.innerHTML || "",
};

const SYS = 'Сен Arduino және IoT оқу платформасының AI көмекшісісің. Оқушылар мен мұғалімдер қазақша сұрақ қояды, сен де қазақша жауап бер.';

function switchAuthTab(t) {
  document.querySelectorAll('.auth-tab').forEach((b, i) => b.classList.toggle('active', i === (t === 'login' ? 0 : 1)));
  document.getElementById('loginForm').classList.toggle('active', t === 'login');
  document.getElementById('regForm').classList.toggle('active', t === 'reg');
}

async function doLogin() {
  try {
    const email = document.getElementById('li_email').value.trim();
    const password = document.getElementById('li_pass').value;
    const { token, user } = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    setToken(token);
    await afterLogin(user);
  } catch (_e) { document.getElementById('li_err').style.display = 'block'; }
}

async function doRegister() {
  const name = document.getElementById('rg_name').value.trim();
  const email = document.getElementById('rg_email').value.trim();
  const className = document.getElementById('rg_class').value;
  const password = document.getElementById('rg_pass').value;
  const err = document.getElementById("rg_err");
  try {
    const { token, user } = await apiRequest('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, className }) });
    setToken(token);
    err.style.display = "none";
    return afterLogin(user);
  } catch (e) {
    err.textContent = e?.status === 409 ? "Бұл email бұрыннан тіркелген. Кіруді пайдаланыңыз." : (e?.message || "Тіркелу қатесі");
    err.style.display = "block";
  }
}

async function afterLogin(user) {
  currentUser = user;
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('uName').textContent = user.name;
  document.getElementById('uAvatar').textContent = user.name[0].toUpperCase();
  document.getElementById('uBadge').textContent = user.role === 'teacher' ? 'Мұғалім' : 'Оқушы';
  buildNav();
  const qSec = document.getElementById("sec-question");
  if (qSec && user.role === "teacher") {
    qSec.remove();
  }
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
  if (currentUser.role !== "teacher") {
    items.push(['question', 'AI Сұрақ']);
  }
  items.push(['feedback', currentUser.role === 'teacher' ? 'Хабарламалар' : 'Байланыс']);
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
  const [v, cfg] = await Promise.all([apiRequest('/videos'), apiRequest('/site-config')]);
  videos = v.videos || [];
  siteConfig = cfg.config || siteConfig;
  const c = await apiRequest('/messages/conversations');
  conversations = c.conversations || [];
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
}

function renderAll() {
  renderVideos();
  renderSensors();
  renderCodes();
  if (currentUser?.role !== "teacher") {
    renderQuestions();
  }
  renderFeedbackSection();
}

function teacherActionBar(section) {
  if (currentUser?.role !== 'teacher') return '';
  return `<div style="margin-bottom:10px;font-size:12px;color:var(--accent2);display:flex;align-items:center;justify-content:space-between;"><span>Мұғалім режимі: ${section}</span><span style="color:var(--text3)">Осы бөлімде контентті тікелей басқарасыз</span></div>`;
}

function renderVideos() {
  const canEdit = currentUser?.role === 'teacher';
  const grid = document.getElementById('videoGrid');
  const cards = videos.map((v) => `<div class="vcard"><div class="vthumb" onclick="${v.url ? `window.open('${v.url}','_blank')` : 'void(0)'}"><div class="vthumb-bg"></div><div class="play-btn"><div class="play-tri"></div></div><div class="vdur">${v.dur || ''}</div></div><div class="vinfo"><div class="vnum">Сабақ ${v.num}</div><div class="vtitle">${v.title}</div><div class="vdesc">${v.desc || ''}</div><div style="display:flex;gap:8px;margin-top:10px;"><button class="cpybtn" onclick="openVideoLesson('${v._id}')">Сабақты ашу</button>${canEdit ? `<button class="cpybtn" onclick="deleteVideo('${v._id}')">Жою</button>` : ''}</div></div></div>`).join('');
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
    { key: "tasksText", label: "Тапсырмалар (әр жол: Тақырып|Нұсқау|Ұпай)", value: "1-тапсырма|Схеманы сипатта|10", textarea: true },
  ], async (values) => {
    const tasks = (values.tasksText || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [title, instruction, maxScore] = line.split("|").map((x) => (x || "").trim());
        return { title: title || "Тапсырма", instruction: instruction || "Нұсқау", maxScore: Number(maxScore || 10) };
      });
    await apiRequest('/videos', { method: 'POST', body: JSON.stringify({ ...values, tasks }) });
    await loadData();
    renderVideos();
  });
}

async function deleteVideo(id) {
  if (!confirm('Жою керек пе?')) return;
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
      ${submission ? `<div class="note-box">Соңғы статус: ${submission.status}. Ұпай: ${submission.score || 0}. ${submission.feedback || ''}</div>` : ""}
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
    alert("Әр файл көлемі 8MB-тан аспауы керек.");
    return;
  }
  if (totalSize > 20 * 1024 * 1024) {
    alert("Файлдардың жалпы көлемі 20MB-тан аспауы керек.");
    return;
  }
  const files = await Promise.all(rawFiles.map(async (file) => ({
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size || 0,
    dataUrl: await fileToDataUrl(file),
  })));
  if (!answers.length && !files.length) {
    alert("Кемінде мәтін жауабын немесе файл жүктеңіз.");
    return;
  }
  await apiRequest(`/videos/${videoId}/submissions`, { method: "POST", body: JSON.stringify({ answers, files }) });
  alert("Тапсырма сәтті жіберілді.");
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
  const list = data.submissions || [];
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
            <span class="badge ${s.status === "graded" ? "b-green" : "b-amber"}">${s.status === "graded" ? `Бағаланған (${s.score || 0})` : "Бағаны күтіп тұр"}</span>
          </div>
          ${(s.answers || []).map((a, i) => `<div class="msg-text">${i + 1}) ${a.answerText}</div>`).join("")}
          ${(s.files || []).length ? `<div class="msg-text">Файлдар: ${(s.files || []).map((f) => `<a href="${f.url || f.dataUrl}" download="${escapeHtml(f.name)}" target="_blank" rel="noopener">${escapeHtml(f.name)}</a>`).join(" · ")}</div>` : ""}
          <div style="margin-top:10px;">
            <button class="cpybtn" onclick="openVideoLesson('${s.videoId?._id}')">Сабаққа өту</button>
          </div>
        </div>
      `).join("") || '<div class="empty-state">Жіберілген тапсырмалар жоқ</div>'}
    </div>
  `;
}

function renderStudentsManage() {
  const listEl = document.getElementById("studentsManageList");
  const progressEl = document.getElementById("studentProgressPanel");
  if (!listEl || !progressEl || currentUser?.role !== "teacher") return;

  listEl.innerHTML = students.length
    ? students.map((s) => `
      <div class="qq">
        <strong>${s.name}</strong><br>
        <span style="font-size:11px;color:var(--text3)">${s.email} ${s.className ? `· ${s.className}` : ""}</span>
        <div style="margin-top:8px;display:flex;gap:8px;">
          <button class="cpybtn" onclick="openStudentProgress('${s.id}')">Прогресс</button>
          <button class="cpybtn" onclick="deleteStudent('${s.id}')" style="color:var(--red);border-color:rgba(252,129,129,.3);">Жою</button>
        </div>
      </div>`).join("")
    : '<div class="empty-state">Студент жоқ</div>';
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
  if (!confirm("Студентті жоясыз ба?")) return;
  await apiRequest(`/users/${studentId}`, { method: "DELETE" });
  await loadData();
  renderStudentsManage();
  const panel = document.getElementById("studentProgressPanel");
  if (panel) panel.innerHTML = "Студентті таңдаңыз";
}

function renderSensors() {
  const holder = document.getElementById('sensorTabs');
  const tabs = siteConfig.sensors.map((s, i) => `<button class="stab${i === 0 ? ' active' : ''}" onclick="setSensor(${i},this)">${s.ico} ${s.lbl}${currentUser?.role === 'teacher' ? ` ✕` : ''}</button>`).join('');
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
  document.getElementById('pinBody').innerHTML = (s.pins || []).map((p) => `<tr><td><span class="pb ${p[2] || 'pd'}">${p[0] || ''}</span></td><td>${p[1] || ''}</td><td>${p[3] || ''}</td></tr>`).join('');
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
  const overlay = document.getElementById("crudModalOverlay");
  const titleEl = document.getElementById("crudModalTitle");
  const bodyEl = document.getElementById("crudModalBody");
  const saveBtn = document.getElementById("crudModalSaveBtn");
  titleEl.textContent = "Жаңа датчик қосу";
  bodyEl.innerHTML = `
    <div class="fg"><label class="fl">Қысқа атауы (мыс: DHT11)</label><input class="fi" id="sensor_lbl"></div>
    <div class="fg"><label class="fl">Толық атауы</label><input class="fi" id="sensor_name"></div>
    <div class="fg"><label class="fl">Иконка (fallback)</label><input class="fi" id="sensor_ico" value="⚙️"></div>
    <div class="fg"><label class="fl">Сипаттама</label><input class="fi" id="sensor_desc" value="Сипаттама"></div>
    <div class="fg"><label class="fl">Ескерту</label><input class="fi" id="sensor_note" value="Ескерту"></div>
    <div class="fg">
      <label class="fl">Датчик суреті (jpg, jpeg, png, webp, gif, svg)</label>
      <input class="fi" id="sensor_image_file" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.svg,image/jpeg,image/png,image/webp,image/gif,image/svg+xml">
      <div style="font-size:11px;color:var(--text3);margin-top:6px;">Сурет жүктесеңіз, иконка орнына сол көрсетіледі.</div>
    </div>
  `;

  crudSaveHandler = async () => {
    const lbl = document.getElementById("sensor_lbl")?.value.trim();
    const name = document.getElementById("sensor_name")?.value.trim();
    const ico = document.getElementById("sensor_ico")?.value.trim() || "⚙️";
    const desc = document.getElementById("sensor_desc")?.value.trim() || "Сипаттама";
    const note = document.getElementById("sensor_note")?.value.trim() || "Ескерту";
    const fileEl = document.getElementById("sensor_image_file");
    const file = fileEl?.files?.[0];
    let image = "";
    if (file) {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
      const isAllowed = allowedTypes.includes(file.type) || /\.(jpe?g|png|webp|gif|svg)$/i.test(file.name);
      if (!isAllowed) {
        alert("Қолдау бар форматтар: jpg, jpeg, png, webp, gif, svg");
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
  };
  saveBtn.onclick = () => crudSaveHandler && crudSaveHandler();
  overlay.classList.add("open");
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Файл оқылмады"));
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderCodes() {
  const list = document.getElementById('codeList');
  list.innerHTML = teacherActionBar('Код үлгілері') + (siteConfig.codes || []).map((c, i) => `
    <div class="citem"><div class="chead"><div class="ctitle">${c.title}</div><div class="cmeta">${c.meta}</div></div>
    <div class="code-body" style="display:block;"><pre>${c.code}</pre><div class="cactions">
      <button class="cpybtn" onclick="copyC(this)">Кодты көшіру</button>
      ${currentUser?.role === 'teacher' ? `<button class="cpybtn" onclick="deleteCode(${i})">Жою</button>` : ''}
    </div></div></div>`).join('')
    + (currentUser?.role === 'teacher' ? `<button class="add-btn" onclick="addCodePrompt()">+ Код қосу</button>` : '');
}

async function addCodePrompt() {
  openCrudModal("Жаңа код үлгісі", [
    { key: "title", label: "Тақырыбы", value: "" },
    { key: "meta", label: "Meta", value: "Мұғалім қосты" },
    { key: "code", label: "Код", value: "void setup(){}\nvoid loop(){}", textarea: true },
  ], async (v) => {
    siteConfig.codes.push({ title: v.title, meta: v.meta, code: (v.code || '').replace(/</g, '&lt;') });
    await apiRequest('/site-config', { method: 'PUT', body: JSON.stringify(siteConfig) });
    renderCodes();
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
  if (cards[0]) cards[0].innerHTML = `<h4>Жылдам сұрақтар</h4>${quick.map((q) => `<div class="qq" onclick="setQ('${q.prompt.replace(/'/g, "\\'")}')">${q.label}</div>`).join('')}${currentUser?.role === 'teacher' ? '<button class="cpybtn" onclick="addQuickQuestionPrompt()">+ Қосу</button>' : ''}`;
  if (cards[1]) cards[1].innerHTML = `<h4>Қате шешу</h4>${err.map((q) => `<div class="qq" onclick="setQ('${q.prompt.replace(/'/g, "\\'")}')">${q.label}</div>`).join('')}${currentUser?.role === 'teacher' ? '<button class="cpybtn" onclick="addErrorQuestionPrompt()">+ Қосу</button>' : ''}`;
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
  grid.innerHTML = `
    <div class="fb-form">
      <h3>${currentUser?.role === "teacher" ? "Диалогтар" : "Диалогтарым"}</h3>
      ${currentUser?.role === "student" ? `<button class="cpybtn" onclick="createConversationPrompt()">+ Жаңа диалог</button>` : `<button class="cpybtn" onclick="refreshConversations()">Жаңарту</button>`}
      <div style="margin-top:12px;max-height:420px;overflow:auto;">
        ${conversations.map((c) => `<div class="qq" style="${activeConversationId === c._id ? 'border-color:var(--accent);color:var(--accent);' : ''}" onclick="openConversation('${c._id}')"><strong>${c.subject}</strong><br><span style="font-size:11px;color:var(--text3)">${c.studentName || ""} ${c.className ? `(${c.className})` : ""}</span></div>`).join("") || '<div class="empty-state">Диалог жоқ</div>'}
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
  if (!activeConversationId && conversations.length) activeConversationId = conversations[0]._id;
  if (activeConversationId) await loadConversationMessages(activeConversationId);
  renderFeedbackSection();
}

async function loadConversationMessages(conversationId) {
  const data = await apiRequest(`/messages/conversations/${conversationId}/messages`);
  chatMessages = data.messages || [];
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
      alert("Алдымен диалог таңдаңыз.");
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
    await onSave(values);
    closeCrudModal();
  };
  saveBtn.onclick = () => crudSaveHandler && crudSaveHandler();
  overlay.classList.add("open");
}

function closeCrudModal() {
  document.getElementById("crudModalOverlay").classList.remove("open");
  crudSaveHandler = null;
}

async function restoreSession() {
  const token = getToken();
  if (!token) return;
  try {
    const { user } = await apiRequest('/auth/me');
    await afterLogin(user);
  } catch (_e) { clearToken(); }
}

restoreSession();
