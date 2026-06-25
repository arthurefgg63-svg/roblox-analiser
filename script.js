(() => {
  "use strict";

  const API_BASE = window.__GIFTHUB_API_BASE__ || "/api";
  const CACHE_TTL_MS = 5 * 60 * 1000;

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

  const sampleButtons = document.querySelectorAll("[data-sample]");

  const state = {
    currentProfile: null
  };

  function normalizeUsername(value) {
    return String(value || "").trim();
  }

  function isValidUsername(value) {
    return /^[A-Za-z0-9_]{3,20}$/.test(value);
  }

  function cacheKey(username) {
    return `gifthub_cache_${username.toLowerCase()}`;
  }

  function setBusy(isBusy) {
    searchBtn.disabled = isBusy;
    input.disabled = isBusy;
    searchBtn.textContent = isBusy ? "Pesquisando..." : "Pesquisar";
  }

  function setStatus(message, type = "normal") {
    statusText.textContent = message;
    statusText.dataset.type = type;
  }

  function clearReasons() {
    while (scoreReasons.firstChild) scoreReasons.removeChild(scoreReasons.firstChild);
  }

  function setReasons(items) {
    clearReasons();
    for (const item of items) {
      const li = document.createElement("li");
      li.textContent = item;
      scoreReasons.appendChild(li);
    }
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "Data inválida";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(date);
  }

  function formatAge(dateString) {
    const created = new Date(dateString);
    if (Number.isNaN(created.getTime())) return "—";

    const diffMs = Date.now() - created.getTime();
    const days = Math.max(0, Math.floor(diffMs / 86400000));

    if (days >= 365) {
      const years = Math.floor(days / 365);
      const months = Math.floor((days % 365) / 30);
      return months > 0 ? `${years} ano(s) e ${months} mês(es)` : `${years} ano(s)`;
    }

    if (days >= 30) {
      const months = Math.floor(days / 30);
      const rest = days % 30;
      return rest > 0 ? `${months} mês(es) e ${rest} dia(s)` : `${months} mês(es)`;
    }

    return `${days} dia(s)`;
  }

  function clamp(num, min, max) {
    return Math.min(max, Math.max(min, num));
  }

  function computePublicScore(profile) {
    const reasons = [];
    let score = 0;

    const ageDays = profile.created ? Math.floor((Date.now() - new Date(profile.created).getTime()) / 86400000) : 0;

    if (ageDays >= 3650) {
      score += 35;
      reasons.push("Conta antiga: forte sinal de consistência pública.");
    } else if (ageDays >= 1095) {
      score += 28;
      reasons.push("Conta com bom tempo de criação.");
    } else if (ageDays >= 365) {
      score += 18;
      reasons.push("Conta com mais de 1 ano.");
    } else if (ageDays >= 90) {
      score += 10;
      reasons.push("Conta recente, mas já com histórico público.");
    } else {
      score += 4;
      reasons.push("Conta muito recente.");
    }

    if (profile.displayName && profile.name && profile.displayName !== profile.name) {
      score += 8;
      reasons.push("Display name personalizado.");
    } else {
      score += 3;
      reasons.push("Perfil com nome simples ou sem destaque adicional.");
    }

    if (profile.description && profile.description.trim().length > 0) {
      score += 10;
      reasons.push("Perfil público preenchido com descrição.");
    } else {
      reasons.push("Sem descrição pública visível.");
    }

    if (profile.avatarUrl) {
      score += 8;
      reasons.push("Avatar público disponível.");
    }

    if (profile.isBanned === true) {
      score -= 30;
      reasons.push("Conta marcada como indisponível ou banida.");
    }

    score = clamp(score, 0, 100);

    let label = "Neutra";
    let description = "Sinal público moderado.";

    if (score >= 85) {
      label = "Excelente";
      description = "Perfil forte em sinais públicos.";
    } else if (score >= 65) {
      label = "Boa";
      description = "Perfil público bem preenchido.";
    } else if (score >= 40) {
      label = "Média";
      description = "Perfil com sinais públicos comuns.";
    } else {
      label = "Baixa";
      description = "Poucos sinais públicos visíveis.";
    }

    return { score, label, description, reasons };
  }

  function renderProfile(profile) {
    state.currentProfile = profile;

    emptyState.classList.add("hidden");
    profileView.classList.remove("hidden");

    displayName.textContent = profile.displayName || profile.name || "Sem nome";
    usernameLine.textContent = profile.displayName && profile.name
      ? `@${profile.name}`
      : profile.name
        ? `@${profile.name}`
        : "Usuário não identificado";

    userIdValue.textContent = profile.id ? String(profile.id) : "—";
    createdValue.textContent = profile.created ? formatDate(profile.created) : "—";
    accountAgeValue.textContent = profile.created ? formatAge(profile.created) : "—";
    banStatusValue.textContent = profile.isBanned ? "Indisponível" : "Ativa";

    if (profile.avatarUrl) {
      avatarImg.src = profile.avatarUrl;
      avatarImg.alt = `Avatar de ${profile.displayName || profile.name || "usuário Roblox"}`;
      avatarImg.onerror = () => {
        avatarImg.removeAttribute("src");
        avatarImg.alt = "Avatar indisponível";
      };
    } else {
      avatarImg.removeAttribute("src");
      avatarImg.alt = "Avatar indisponível";
    }

    if (profile.robloxUrl) {
      openProfileBtn.href = profile.robloxUrl;
      openProfileBtn.style.pointerEvents = "auto";
      openProfileBtn.style.opacity = "1";
    } else {
      openProfileBtn.href = "#";
      openProfileBtn.style.pointerEvents = "none";
      openProfileBtn.style.opacity = "0.6";
    }

    const { score, label, description, reasons } = computePublicScore(profile);

    scoreValue.textContent = String(score);
    scoreLabel.textContent = label;
    scoreDescription.textContent = description;
    scoreBarFill.style.width = `${score}%`;

    const ring = document.querySelector(".score-ring");
    ring.style.background = `conic-gradient(from 0deg, #22d3ee ${score}%, rgba(255,255,255,0.08) ${score}% 100%)`;

    setReasons(reasons.length ? reasons : ["Sem observações públicas."]);
    setStatus("Resultado carregado com sucesso", "success");
  }

  function setError(message) {
    setStatus(message, "error");
    emptyState.classList.remove("hidden");
    profileView.classList.add("hidden");

    scoreValue.textContent = "0";
    scoreLabel.textContent = "Sem análise";
    scoreDescription.textContent = "Tente novamente com outro usuário.";
    scoreBarFill.style.width = "0%";
    clearReasons();
    setReasons([message]);
  }

  function getCache(username) {
    try {
      const raw = localStorage.getItem(cacheKey(username));
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.savedAt || !parsed.payload) return null;

      if (Date.now() - parsed.savedAt > CACHE_TTL_MS) {
        localStorage.removeItem(cacheKey(username));
        return null;
      }

      return parsed.payload;
    } catch {
      return null;
    }
  }

  function saveCache(username, payload) {
    try {
      localStorage.setItem(
        cacheKey(username),
        JSON.stringify({
          savedAt: Date.now(),
          payload
        })
      );
    } catch {
      // Falha silenciosa: cache local não é crítico.
    }
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
          ...(options.headers || {})
        }
      });
      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  async function lookup(username) {
    const cached = getCache(username);
    if (cached) {
      setStatus("Carregado do cache local", "success");
      renderProfile(cached);
      return;
    }

    setBusy(true);
    setStatus("Consultando dados públicos...", "loading");

    try {
      const response = await fetchWithTimeout(
        `${API_BASE}/lookup?username=${encodeURIComponent(username)}`
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(errorText || "Falha na consulta.");
      }

      const data = await response.json();

      if (!data || !data.user) {
        throw new Error("Resposta inválida da API.");
      }

      const profile = {
        id: data.user.id,
        name: data.user.name,
        displayName: data.user.displayName || data.user.name,
        created: data.user.created,
        description: data.user.description || "",
        isBanned: Boolean(data.user.isBanned),
        avatarUrl: data.avatar?.url || "",
        robloxUrl: data.user.robloxUrl || `https://www.roblox.com/users/${data.user.id}/profile`
      };

      saveCache(username, profile);
      renderProfile(profile);
    } catch (error) {
      console.error(error);
      setError("Não foi possível consultar agora. Verifique a API e tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = normalizeUsername(input.value);

    if (!isValidUsername(username)) {
      setError("Username inválido. Use 3 a 20 caracteres: letras, números e underline.");
      input.focus();
      return;
    }

    await lookup(username);
  });

  sampleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const sample = button.dataset.sample || "";
      input.value = sample;
      input.focus();
    });
  });

  copyBtn.addEventListener("click", async () => {
    const profile = state.currentProfile;
    if (!profile) return;

    const text = profile.name || profile.displayName || "";
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setStatus("Nome copiado para a área de transferência", "success");
    } catch {
      setStatus("Não foi possível copiar no momento", "error");
    }
  });

  input.addEventListener("input", () => {
    const cleaned = input.value.replace(/[^A-Za-z0-9_]/g, "");
    if (cleaned !== input.value) {
      input.value = cleaned;
    }
  });

  setStatus("Aguardando pesquisa", "normal");
})();
