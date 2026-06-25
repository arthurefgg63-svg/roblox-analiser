"use strict";

(() => {
  const themeBtn = document.getElementById("themeBtn");
  const themeBtnText = document.getElementById("themeBtnText");

  const form = document.getElementById("searchForm");
  const input = document.getElementById("usernameInput");
  const searchBtn = document.getElementById("searchBtn");
  const statusText = document.getElementById("statusText");

  const emptyState = document.getElementById("emptyState");
  const profileView = document.getElementById("profileView");
  const avatarImg = document.getElementById("avatarImg");
  const displayName = document.getElementById("displayName");
  const usernameLine = document.getElementById("usernameLine");
  const userIdValue = document.getElementById("userIdValue");
  const createdValue = document.getElementById("createdValue");
  const accountAgeValue = document.getElementById("accountAgeValue");
  const banStatusValue = document.getElementById("banStatusValue");
  const openProfileBtn = document.getElementById("openProfileBtn");
  const copyBtn = document.getElementById("copyBtn");

  const scoreValue = document.getElementById("scoreValue");
  const scoreLabel = document.getElementById("scoreLabel");
  const scoreDescription = document.getElementById("scoreDescription");
  const scoreBarFill = document.getElementById("scoreBarFill");
  const scoreReasons = document.getElementById("scoreReasons");
  const scoreRing = document.querySelector(".score-ring");

  const sampleButtons = document.querySelectorAll("[data-user]");

  let currentProfile = null;
  const cacheTtl = 5 * 60 * 1000;

  function setStatus(message) {
    statusText.textContent = message;
  }

  function setBusy(isBusy) {
    searchBtn.disabled = isBusy;
    input.disabled = isBusy;
    searchBtn.textContent = isBusy ? "Pesquisando..." : "Pesquisar";
  }

  function validUsername(value) {
    return /^[A-Za-z0-9_]{3,20}$/.test(value);
  }

  function cacheKey(username) {
    return `gifthub:${username.toLowerCase()}`;
  }

  function saveCache(username, payload) {
    try {
      localStorage.setItem(cacheKey(username), JSON.stringify({
        savedAt: Date.now(),
        payload
      }));
    } catch {}
  }

  function readCache(username) {
    try {
      const raw = localStorage.getItem(cacheKey(username));
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed?.savedAt || !parsed?.payload) return null;

      if (Date.now() - parsed.savedAt > cacheTtl) {
        localStorage.removeItem(cacheKey(username));
        return null;
      }

      return parsed.payload;
    } catch {
      return null;
    }
  }

  function clearReasons() {
    while (scoreReasons.firstChild) scoreReasons.removeChild(scoreReasons.firstChild);
  }

  function pushReason(text) {
    const li = document.createElement("li");
    li.textContent = text;
    scoreReasons.appendChild(li);
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(date);
  }

  function formatAge(dateString) {
    const created = new Date(dateString);
    if (Number.isNaN(created.getTime())) return "—";

    const days = Math.max(0, Math.floor((Date.now() - created.getTime()) / 86400000));
    if (days >= 365) {
      const years = Math.floor(days / 365);
      const months = Math.floor((days % 365) / 30);
      return months > 0 ? `${years} ano(s) e ${months} mês(es)` : `${years} ano(s)`;
    }
    if (days >= 30) {
      const months = Math.floor(days / 30);
      return `${months} mês(es)`;
    }
    return `${days} dia(s)`;
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function scoreProfile(profile) {
    const reasons = [];
    let score = 0;

    const createdAt = profile.created ? new Date(profile.created).getTime() : 0;
    const ageDays = createdAt ? Math.floor((Date.now() - createdAt) / 86400000) : 0;

    if (ageDays >= 3650) {
      score += 35;
      reasons.push("Conta antiga: sinal público forte.");
    } else if (ageDays >= 1095) {
      score += 26;
      reasons.push("Conta com histórico público consistente.");
    } else if (ageDays >= 365) {
      score += 18;
      reasons.push("Conta com mais de 1 ano.");
    } else if (ageDays >= 90) {
      score += 10;
      reasons.push("Conta recente, mas já estabelecida.");
    } else {
      score += 4;
      reasons.push("Conta muito recente.");
    }

    if (profile.displayName && profile.name && profile.displayName !== profile.name) {
      score += 8;
      reasons.push("Display name personalizado.");
    }

    if (profile.description && profile.description.trim()) {
      score += 10;
      reasons.push("Perfil público com descrição.");
    } else {
      reasons.push("Sem descrição pública visível.");
    }

    if (profile.avatarUrl) {
      score += 8;
      reasons.push("Avatar público disponível.");
    }

    if (profile.isBanned) {
      score -= 30;
      reasons.push("Conta indisponível ou banida.");
    }

    score = clamp(score, 0, 100);

    let label = "Média";
    let description = "Sinais públicos comuns.";

    if (score >= 85) {
      label = "Excelente";
      description = "Perfil público forte.";
    } else if (score >= 65) {
      label = "Boa";
      description = "Perfil bem preenchido.";
    } else if (score < 40) {
      label = "Baixa";
      description = "Poucos sinais públicos.";
    }

    return { score, label, description, reasons };
  }

  function renderProfile(profile) {
    currentProfile = profile;

    emptyState.classList.add("hidden");
    profileView.classList.remove("hidden");

    displayName.textContent = profile.displayName || profile.name || "Sem nome";
    usernameLine.textContent = profile.name ? `@${profile.name}` : "—";
    userIdValue.textContent = profile.id ? String(profile.id) : "—";
    createdValue.textContent = profile.created ? formatDate(profile.created) : "—";
    accountAgeValue.textContent = profile.created ? formatAge(profile.created) : "—";
    banStatusValue.textContent = profile.isBanned ? "Indisponível" : "Ativa";

    if (profile.avatarUrl) {
      avatarImg.src = profile.avatarUrl;
      avatarImg.alt = `Avatar de ${profile.displayName || profile.name || "usuário"}`;
    } else {
      avatarImg.removeAttribute("src");
      avatarImg.alt = "Avatar indisponível";
    }

    openProfileBtn.href = profile.robloxUrl || "#";
    openProfileBtn.style.pointerEvents = profile.robloxUrl ? "auto" : "none";
    openProfileBtn.style.opacity = profile.robloxUrl ? "1" : ".6";

    const { score, label, description, reasons } = scoreProfile(profile);

    scoreValue.textContent = String(score);
    scoreLabel.textContent = label;
    scoreDescription.textContent = description;
    scoreBarFill.style.width = `${score}%`;
    scoreRing.style.background = `conic-gradient(from 0deg, var(--accent) ${score}%, rgba(148, 163, 184, 0.15) ${score}% 100%)`;

    clearReasons();
    reasons.forEach(pushReason);
    if (!reasons.length) pushReason("Sem observações públicas.");

    setStatus("Resultado carregado com sucesso");
  }

  function showFriendlyError(message) {
    setStatus(message);
    emptyState.classList.remove("hidden");
    profileView.classList.add("hidden");

    scoreValue.textContent = "0";
    scoreLabel.textContent = "Sem análise";
    scoreDescription.textContent = "Tente novamente com outro usuário.";
    scoreBarFill.style.width = "0%";
    clearReasons();
    pushReason(message);
  }

  async function fetchRobloxProfile(username) {
    const lookupResponse = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usernames: [username],
        excludeBannedUsers: false
      })
    });

    if (!lookupResponse.ok) {
      throw new Error("Falha na consulta do nome de usuário.");
    }

    const lookupData = await lookupResponse.json();
    const user = lookupData?.data?.[0];
    if (!user?.id) {
      throw new Error("Usuário não encontrado.");
    }

    const detailsResponse = await fetch(`https://users.roblox.com/v1/users/${user.id}`);
    if (!detailsResponse.ok) {
      throw new Error("Falha ao carregar detalhes do perfil.");
    }

    const details = await detailsResponse.json();

    return {
      id: details.id || user.id,
      name: details.name || user.name || username,
      displayName: details.displayName || user.displayName || user.name || username,
      created: details.created || "",
      description: details.description || "",
      isBanned: Boolean(details.isBanned),
      avatarUrl: `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${encodeURIComponent(details.id || user.id)}&size=420x420&format=Png&isCircular=false`,
      robloxUrl: `https://www.roblox.com/users/${encodeURIComponent(details.id || user.id)}/profile`
    };
  }

  async function search(username) {
    const normalized = username.trim();

    if (!validUsername(normalized)) {
      showFriendlyError("Username inválido. Use 3 a 20 caracteres: letras, números e underline.");
      return;
    }

    const cached = readCache(normalized);
    if (cached) {
      renderProfile(cached);
      setStatus("Carregado do cache local");
      return;
    }

    setBusy(true);
    setStatus("Consultando dados públicos...");

    try {
      const profile = await fetchRobloxProfile(normalized);
      saveCache(normalized, profile);
      renderProfile(profile);
    } catch (error) {
      console.error(error);
      showFriendlyError("A consulta pública falhou neste navegador. A interface ficou estável; o próximo passo é ligar uma API hospedada fora do GitHub Pages.");
    } finally {
      setBusy(false);
    }
  }

  function loadTheme() {
    const saved = localStorage.getItem("gifthub-theme");
    const theme = saved === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    themeBtnText.textContent = theme === "dark" ? "Tema escuro" : "Tema claro";
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("gifthub-theme", next);
    themeBtnText.textContent = next === "dark" ? "Tema escuro" : "Tema claro";
  }

  themeBtn.addEventListener("click", toggleTheme);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    search(input.value);
  });

  sampleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      input.value = btn.dataset.user || "";
      input.focus();
    });
  });

  copyBtn.addEventListener("click", async () => {
    if (!currentProfile?.name) return;

    try {
      await navigator.clipboard.writeText(currentProfile.name);
      setStatus("Nome copiado com sucesso");
    } catch {
      setStatus("Não foi possível copiar agora");
    }
  });

  input.addEventListener("input", () => {
    const cleaned = input.value.replace(/[^A-Za-z0-9_]/g, "");
    if (cleaned !== input.value) input.value = cleaned;
  });

  loadTheme();
  setStatus("Aguardando pesquisa");
})();
