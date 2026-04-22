(function () {
  function createProfileModule(deps) {
    const {
      getCurrentUser,
      setCurrentUser,
      apiRequest,
      setHeaderUser,
      showToast,
      setButtonLoading,
      fileToDataUrl,
    } = deps;

    function renderProfileSection() {
      const currentUser = getCurrentUser();
      if (!currentUser) return;
      const secSubEl = document.querySelector("#sec-profile .sec-sub");
      if (secSubEl) {
        secSubEl.textContent = currentUser.role === "teacher"
          ? "Мұғалімнің жеке ақпараты, био және байланыс деректері"
          : "Студенттің жеке ақпараты, био және байланыс деректері";
      }
      const nameEl = document.getElementById("pf_name");
      const emailEl = document.getElementById("pf_email");
      const roleEl = document.getElementById("pf_role");
      const classEl = document.getElementById("pf_class");
      const classWrapEl = document.getElementById("pf_class_wrap");
      const phoneEl = document.getElementById("pf_phone");
      const locationEl = document.getElementById("pf_location");
      const bioEl = document.getElementById("pf_bio");
      const avatarPreviewEl = document.getElementById("pf_avatar_preview");
      if (!nameEl || !emailEl || !roleEl || !classEl || !classWrapEl || !phoneEl || !locationEl || !bioEl || !avatarPreviewEl) return;
      nameEl.value = currentUser.name || "";
      emailEl.value = currentUser.email || "";
      roleEl.value = currentUser.role === "teacher" ? "Мұғалім" : "Оқушы";
      classEl.value = currentUser.className || "";
      classEl.disabled = currentUser.role === "teacher";
      classWrapEl.style.display = currentUser.role === "teacher" ? "none" : "block";
      phoneEl.value = currentUser.phone || "";
      locationEl.value = currentUser.location || "";
      bioEl.value = currentUser.bio || "";
      if (currentUser.avatarUrl) {
        avatarPreviewEl.src = currentUser.avatarUrl;
        avatarPreviewEl.style.display = "block";
      } else {
        avatarPreviewEl.removeAttribute("src");
        avatarPreviewEl.style.display = "none";
      }
    }

    async function saveProfile(buttonEl) {
      const currentUser = getCurrentUser();
      if (!currentUser) return;
      const release = setButtonLoading(buttonEl, "Сақталуда...");
      try {
        const avatarFile = document.getElementById("pf_avatar_file")?.files?.[0];
        let avatarUrl = currentUser.avatarUrl || "";
        if (avatarFile) {
          avatarUrl = await fileToDataUrl(avatarFile);
        }
        const payload = {
          name: document.getElementById("pf_name")?.value.trim() || "",
          className: document.getElementById("pf_class")?.value.trim() || "",
          phone: document.getElementById("pf_phone")?.value.trim() || "",
          location: document.getElementById("pf_location")?.value.trim() || "",
          bio: document.getElementById("pf_bio")?.value.trim() || "",
          avatarUrl,
        };
        const { user } = await apiRequest("/auth/profile", {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setCurrentUser(user);
        setHeaderUser(user);
        showToast("Профиль сәтті сақталды.", "success");
        renderProfileSection();
      } catch (e) {
        showToast(e?.message || "Профильді сақтау сәтсіз аяқталды.", "error");
      } finally {
        release();
      }
    }

    async function previewAvatarFile() {
      const file = document.getElementById("pf_avatar_file")?.files?.[0];
      const previewEl = document.getElementById("pf_avatar_preview");
      const currentUser = getCurrentUser();
      if (!previewEl) return;
      if (!file) {
        if (currentUser?.avatarUrl) {
          previewEl.src = currentUser.avatarUrl;
          previewEl.style.display = "block";
        } else {
          previewEl.style.display = "none";
        }
        return;
      }
      try {
        const dataUrl = await fileToDataUrl(file);
        previewEl.src = dataUrl;
        previewEl.style.display = "block";
      } catch (_e) {
        showToast("Аватар preview жүктелмеді.", "error");
      }
    }

    async function changePassword(buttonEl) {
      const currentPassword = document.getElementById("pf_current_pass")?.value || "";
      const newPassword = document.getElementById("pf_new_pass")?.value || "";
      if (!currentPassword || !newPassword) {
        showToast("Екі пароль өрісін де толтырыңыз.", "error");
        return;
      }
      const release = setButtonLoading(buttonEl, "Жаңартылуда...");
      try {
        await apiRequest("/auth/password", {
          method: "PATCH",
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const curEl = document.getElementById("pf_current_pass");
        const newEl = document.getElementById("pf_new_pass");
        if (curEl) curEl.value = "";
        if (newEl) newEl.value = "";
        showToast("Құпиясөз сәтті жаңартылды.", "success");
      } catch (e) {
        showToast(e?.message || "Құпиясөз жаңарту қатесі.", "error");
      } finally {
        release();
      }
    }

    return {
      renderProfileSection,
      saveProfile,
      previewAvatarFile,
      changePassword,
    };
  }

  window.createProfileModule = createProfileModule;
})();
