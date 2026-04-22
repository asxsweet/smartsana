(function () {
  let toastTimer = null;
  let confirmResolve = null;

  function showToast(message, type = "success", duration = 3800) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("success", "error", "show");
    toast.classList.add(type === "error" ? "error" : "success");
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    requestAnimationFrame(() => {
      toast.classList.add("show");
    });
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, duration);
  }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function askConfirm(message, title = "Растау") {
    const overlay = document.getElementById("confirmModalOverlay");
    const titleEl = document.getElementById("confirmModalTitle");
    const messageEl = document.getElementById("confirmModalMessage");
    if (!overlay || !titleEl || !messageEl) return Promise.resolve(false);
    titleEl.textContent = title;
    messageEl.textContent = message;
    overlay.classList.add("open");
    return new Promise((resolve) => {
      confirmResolve = resolve;
    });
  }

  function resolveConfirm(result) {
    const overlay = document.getElementById("confirmModalOverlay");
    if (overlay) overlay.classList.remove("open");
    if (confirmResolve) {
      confirmResolve(result);
      confirmResolve = null;
    }
  }

  function setButtonLoading(buttonEl, loadingText) {
    if (!buttonEl) return () => {};
    const prevText = buttonEl.textContent;
    buttonEl.disabled = true;
    buttonEl.textContent = loadingText;
    return () => {
      buttonEl.disabled = false;
      buttonEl.textContent = prevText;
    };
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

  window.showToast = showToast;
  window.normalizeText = normalizeText;
  window.askConfirm = askConfirm;
  window.resolveConfirm = resolveConfirm;
  window.setButtonLoading = setButtonLoading;
  window.fileToDataUrl = fileToDataUrl;
  window.escapeHtml = escapeHtml;
})();
