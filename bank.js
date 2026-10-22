/* =========================================================
   Banco de Células — linhagens, pesquisadores, criotubos
   e botijão com canisters.
   Modo de teste: dados salvos no navegador (localStorage).
   A camada "Store" isola o armazenamento para, no futuro,
   trocar por Planilha Google / Firebase sem mexer nas telas.
   ========================================================= */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const SEED = window.SEED_BANCO;
  const KEY = "nctbio.banco.v2";
  const MOTIVOS = SEED.motivos;
  const N_CAN = SEED.canisters || 6;

  /* ================= Utilidades ================= */
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const todayISO = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };
  const fmtDate = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
  const fmtNum = (n, d = 2) => (n == null || n === "" ? "" : Number(n).toLocaleString("pt-BR", { maximumFractionDigits: d }));
  const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  function sci(n) {
    if (n == null || n === "" || !isFinite(n) || n <= 0) return "";
    const e = Math.floor(Math.log10(n));
    const m = n / Math.pow(10, e);
    return `${m.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × 10${String(e).split("").map((c) => SUP[c]).join("")}`;
  }
  function parseNum(str) {
    let s = String(str ?? "").trim().replace(/\s/g, "");
    if (!s) return null;
    if (/e/i.test(s)) return parseFloat(s.replace(",", ".").replace(/e\+?/i, "e")) || null;
    if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    else s = s.replace(",", ".");
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  }
  const plural = (n, a, b) => `${n.toLocaleString("pt-BR")} ${n === 1 ? a : b}`;
  const firstName = (nome) => {
    const p = String(nome || "").split(/\s+/);
    return p.length > 1 ? `${cap(p[0])} ${cap(p[p.length - 1])}` : cap(p[0] || "");
  };
  const cap = (w) => (w ? w.charAt(0) + w.slice(1).toLowerCase() : "");
  const ICON_EDIT = `<svg viewBox="0 0 24 24" fill="none"><path d="M4 20h4L19 9l-4-4L4 16v4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
  const ICON_DEL = `<svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  /* ================= Dados ================= */
  function fromSeed() {
    const now = new Date().toISOString();
    const tubos = [];
    SEED.lotes.forEach((l, i) => {
      const [can, lin, n, pass, dens, data, vol, pes, rem] = l;
      for (let k = 0; k < n; k++) {
        tubos.push({
          id: uid(), can, lin, pass: pass ?? "", dens: dens ?? null, data: data || "", vol: vol ?? null, pes: pes || "", obs: "",
          rem: rem ? { data: rem[0] || "", motivo: rem[1], por: rem[2] || "", ev: "planilha-" + i } : null,
          origem: "planilha",
        });
      }
    });
    return {
      versao: SEED.versao,
      linhagens: SEED.linhagens.map((x) => ({ id: uid(), criadoEm: now, ...x })),
      pesquisadores: SEED.pesquisadores.map((x) => ({ id: uid(), criadoEm: now, ...x })),
      tubos,
    };
  }

  let memory = null;
  const Store = {
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) { /* sem acesso */ }
      if (memory) return memory;
      const d = fromSeed();
      this.save(d);
      return d;
    },
    save(d) {
      memory = d;
      try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignora */ }
    },
  };

  let db = Store.load();
  const canEdit = () => !window.Auth || window.Auth.canEdit();
  function blocked() {
    if (canEdit()) return false;
    if (window.Auth) window.Auth.ask();
    return true;
  }
  const save = () => {
    if (!canEdit()) { db = Store.load(); refreshAll(); blocked(); return; } // modo visualização: nada é gravado
    Store.save(db);
    refreshAll();
  };

  const inStock = () => db.tubos.filter((t) => !t.rem);
  const sortLines = (a, b) => a.linhagem.localeCompare(b.linhagem, "pt-BR", { sensitivity: "base" });
  const sortPeople = (a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
  const lotKey = (t) => [t.can, t.lin, t.pass, t.dens, t.data, t.vol, t.pes].join("|");

  function lotsOf(tubes) {
    const map = new Map();
    tubes.forEach((t) => {
      const k = lotKey(t);
      if (!map.has(k)) map.set(k, { key: k, can: t.can, lin: t.lin, pass: t.pass, dens: t.dens, data: t.data, vol: t.vol, pes: t.pes, tubos: [] });
      map.get(k).tubos.push(t);
    });
    return [...map.values()];
  }
  const byOldest = (a, b) => {
    if (!a.data && !b.data) return (+a.pass || 0) - (+b.pass || 0);
    if (!a.data) return -1; // sem data = estoque antigo
    if (!b.data) return 1;
    return a.data.localeCompare(b.data) || (+a.pass || 0) - (+b.pass || 0);
  };
  const stockBy = (field) => {
    const m = {};
    inStock().forEach((t) => (m[t[field]] = (m[t[field]] || 0) + 1));
    return m;
  };

  /* ================= Ilustração: botijão ================= */
  function drawDewar(highlight) {
    const el = $("#dewarArt");
    if (!el) return;
    const per = stockBy("can");
    const max = Math.max(1, ...Object.values(per));
    const cx = 150, cy = 150, R = 86;
    let g = "";
    for (let i = 1; i <= N_CAN; i++) {
      const a = (-90 + (360 / N_CAN) * (i - 1)) * Math.PI / 180;
      const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      const n = per[i] || 0;
      const op = n ? 0.18 + 0.5 * (n / max) : 0;
      const hl = highlight == i;
      g += `<g class="dw-can${hl ? " hl" : ""}">
        <circle cx="${x}" cy="${y}" r="36" fill="rgba(207,230,200,${op.toFixed(2)})" stroke="rgba(225,240,220,${hl ? 1 : 0.7})" stroke-width="${hl ? 2.2 : 1.3}"/>
        <text x="${x}" y="${y - 3}" text-anchor="middle" class="dw-n">${i}</text>
        <text x="${x}" y="${y + 13}" text-anchor="middle" class="dw-c">${n} tubos</text>
      </g>`;
    }
    el.innerHTML = `<svg viewBox="0 0 300 300" aria-label="Botijão com ${N_CAN} canisters">
      <circle cx="150" cy="150" r="142" fill="rgba(255,255,255,.025)" stroke="rgba(225,240,220,.25)" stroke-width="10"/>
      <circle cx="150" cy="150" r="134" fill="none" stroke="rgba(225,240,220,.75)" stroke-width="1.5"/>
      <circle cx="150" cy="150" r="30" fill="none" stroke="rgba(225,240,220,.35)" stroke-dasharray="3 4"/>
      <text x="150" y="154" text-anchor="middle" class="dw-c">N₂</text>
      ${g}
    </svg>`;
    const tot = inStock().length;
    $("#dewarLabel").textContent = `BOTIJÃO DE N₂ LÍQUIDO · ${tot} CRIOTUBOS EM ${N_CAN} CANISTERS`;
  }

  /* ================= Menu do banco ================= */
  function renderMenu() {
    const st = inStock();
    const linesWith = new Set(st.map((t) => t.lin)).size;
    $("#bankStats").innerHTML = `
      <div><b>${st.length.toLocaleString("pt-BR")}</b><span>criotubos em estoque</span></div>
      <div><b>${linesWith}</b><span>linhagens no botijão</span></div>
      <div><b>${N_CAN}</b><span>canisters</span></div>`;
    $("#cntLines").textContent = `· ${db.linhagens.length} cadastradas`;
    $("#cntPeople").textContent = `· ${db.pesquisadores.length} cadastros`;
    $("#cntStock").textContent = `· ${st.length} em estoque`;
  }

  /* ================= Formulários genéricos ================= */
  function openForm(form, title, data, fields) {
    if (blocked()) return;
    form.reset();
    form.dataset.editing = data ? data.id : "";
    $(".lf-msg", form).textContent = "";
    $("h3", form).textContent = title;
    if (data) fields.forEach((k) => { if (form.elements[k]) form.elements[k].value = data[k] || ""; });
    form.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => form.elements[fields[0]].focus(), 250);
  }
  $$("[data-close]").forEach((b) => b.addEventListener("click", () => ($("#" + b.dataset.close).hidden = true)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") $$(".line-form").forEach((f) => (f.hidden = true));
  });
  function flash(id) {
    const card = document.querySelector(`[data-card="${id}"]`);
    if (card) { card.classList.add("flash"); card.scrollIntoView({ behavior: "smooth", block: "center" }); }
  }

  /* ================= Linhagens ================= */
  const LFIELDS = ["linhagem", "identificacao", "tipo", "origem", "meio", "suplementacao", "datasheet", "obs", "fotoUrl", "fotoCredito"];
  const LCSV = ["linhagem", "identificacao", "tipo", "origem", "meio", "suplementacao", "datasheet", "obs"];
  const LLABEL = { origem: "ORIGEM", meio: "MEIO CRESCIMENTO", suplementacao: "SUPLEMENTAÇÃO", datasheet: "DATASHEET", obs: "OBSERVAÇÕES" };
  const isIncomplete = (l) => !l.tipo || !l.origem || !l.meio || !l.suplementacao || !l.datasheet;
  const isUrl = (s) => /^https?:\/\/\S+$/i.test(String(s || "").trim());


  /* ================= Fotos das linhagens =================
     Fotos enviadas ficam no IndexedDB do navegador (cabe muito mais
     que o localStorage). Links externos ficam no próprio cadastro. */
  const Photos = (() => {
    let dbp = null;
    const cache = {};
    const open = () => new Promise((res) => {
      if (dbp) return res(dbp);
      setTimeout(() => res(dbp), 3000); // nunca trava a tela se o navegador bloquear
      try {
        const rq = indexedDB.open("nctbio-fotos", 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore("fotos");
        rq.onsuccess = () => res((dbp = rq.result));
        rq.onerror = () => res(null);
      } catch (e) { res(null); }
    });
    const tx = async (mode, fn) => {
      const d = await open();
      if (!d) return null;
      return new Promise((res) => {
        const t = d.transaction("fotos", mode);
        const r = fn(t.objectStore("fotos"));
        t.oncomplete = () => res(r && r.result);
        t.onerror = () => res(null);
      });
    };
    return {
      cache,
      async loadAll() {
        const d = await open();
        if (!d) return;
        await new Promise((res) => {
          const t = d.transaction("fotos", "readonly");
          const st = t.objectStore("fotos");
          const rq = st.openCursor();
          rq.onsuccess = () => { const c = rq.result; if (c) { cache[c.key] = c.value; c.continue(); } };
          t.oncomplete = res; t.onerror = res;
        });
      },
      async put(id, data) { if (!canEdit()) return; cache[id] = data; await tx("readwrite", (s) => s.put(data, id)); },
      async del(id) { if (!canEdit()) return; delete cache[id]; await tx("readwrite", (s) => s.delete(id)); },
      async clear() { if (!canEdit()) return; Object.keys(cache).forEach((k) => delete cache[k]); await tx("readwrite", (s) => s.clear()); },
    };
  })();
  const photoSrc = (l) => Photos.cache[l.id] || (isUrl(l.fotoUrl) ? l.fotoUrl : "");
  function photoThumb(l) {
    const src = photoSrc(l);
    return src
      ? `<button type="button" class="lc-photo" data-zoom="${l.id}" title="Ampliar foto"><img src="${esc(src)}" alt="Foto de ${esc(l.linhagem)}" loading="lazy" /><span class="zoom-ic">⤢</span></button>`
      : `<button type="button" class="lc-photo empty" data-edit-line="${l.id}" title="Adicionar foto"><span>+ foto</span></button>`;
  }

  function resizeImage(file, max = 1600, q = 0.85) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const g = c.getContext("2d");
        g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res({ data: c.toDataURL("image/jpeg", q), w: c.width, h: c.height });
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(); };
      img.src = url;
    });
  }

  // Ampliação (lightbox)
  const lb = document.createElement("div");
  lb.className = "lightbox";
  lb.hidden = true;
  lb.innerHTML = `<button type="button" class="lb-close" aria-label="Fechar">×</button><figure><img alt="" /><figcaption></figcaption></figure>`;
  document.body.appendChild(lb);
  function zoom(l) {
    const src = photoSrc(l);
    if (!src) return;
    $("img", lb).src = src;
    $("img", lb).alt = `Foto de ${l.linhagem}`;
    $("figcaption", lb).innerHTML = `<div><b>${esc(l.linhagem)}</b>${l.identificacao ? ` · ${esc(l.identificacao)}` : ""}</div>${l.fotoCredito ? `<span>${esc(l.fotoCredito)}</span>` : ""}`;
    lb.hidden = false;
    document.body.classList.add("no-scroll");
  }
  const closeZoom = () => { lb.hidden = true; document.body.classList.remove("no-scroll"); };
  lb.addEventListener("click", (e) => { if (e.target.tagName !== "IMG") closeZoom(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !lb.hidden) closeZoom(); });

  // Campo de foto no formulário
  let pendingFoto; // undefined = sem mudança, null = remover, string = nova imagem
  function setPreview(src) {
    $("#pfPreview").innerHTML = src ? `<img src="${esc(src)}" alt="" />` : `<em>sem foto</em>`;
  }
  $("#pfFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    $("#pfMsg").textContent = "Processando imagem…";
    try {
      const r = await resizeImage(file);
      pendingFoto = r.data;
      setPreview(r.data);
      $("#pfMsg").textContent = `Imagem pronta (${r.w} × ${r.h} px). Clique em “Salvar linhagem”.`;
    } catch (err) {
      $("#pfMsg").textContent = "Não foi possível ler essa imagem.";
    }
  });
  $("#pfRemove").addEventListener("click", () => {
    pendingFoto = null;
    lineForm.elements.fotoUrl.value = "";
    setPreview("");
    $("#pfMsg").textContent = "A foto será removida ao salvar.";
  });

  function renderLines() {
    const q = norm($("#lineSearch").value);
    const f = $("#lineFilter").value;
    const stock = stockBy("lin");
    const cans = {};
    inStock().forEach((t) => ((cans[t.lin] = cans[t.lin] || new Set()).add(t.can)));
    const items = db.linhagens.slice().sort(sortLines)
      .filter((l) => (f === "__inc" ? isIncomplete(l) : f === "__stock" ? stock[l.linhagem] : f ? norm(l.tipo) === norm(f) : true))
      .filter((l) => !q || LFIELDS.some((k) => norm(l[k]).includes(q)));

    const inc = db.linhagens.filter(isIncomplete).length;
    $("#linesCount").textContent = `${plural(db.linhagens.length, "linhagem", "linhagens")} · ${inc} com dados incompletos.`;

    $("#linesList").innerHTML = items.length ? items.map((l) => {
      const t = norm(l.tipo);
      const tags = [];
      if (l.tipo) tags.push(`<span class="tag ${t.startsWith("imort") ? "imo" : t.startsWith("prim") ? "pri" : ""}">${esc(l.tipo)}</span>`);
      if (isIncomplete(l)) tags.push(`<span class="tag inc">INCOMPLETO</span>`);
      const n = stock[l.linhagem] || 0;
      const row = (k) => {
        const v = l[k];
        if (!v) return `<dt>${LLABEL[k]}</dt><dd class="na">—</dd>`;
        const val = k === "datasheet" && isUrl(v) ? `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(v.replace(/^https?:\/\/(www\.)?/, ""))}</a>` : esc(v);
        return `<dt>${LLABEL[k]}</dt><dd>${val}</dd>`;
      };
      return `
        <article class="line-card" data-card="${l.id}">
          <div>
            ${photoThumb(l)}
            <div class="lc-code">${esc(l.linhagem)}</div>
            <div class="lc-id">${esc(l.identificacao)}</div>
            <div class="lc-stock ${n ? "" : "zero"}">${n ? `<b>${n}</b> ${n === 1 ? "criotubo" : "criotubos"}<br><span>canister ${[...cans[l.linhagem]].sort().join(", ")}</span>` : "sem estoque"}</div>
          </div>
          <div class="lc-body">
            ${tags.length ? `<div class="lc-tags">${tags.join("")}</div>` : ""}
            <dl>${["origem", "meio", "suplementacao", "datasheet"].map(row).join("")}${l.obs ? row("obs") : ""}</dl>
          </div>
          <div class="lc-actions">
            <button class="icon-btn" data-edit-line="${l.id}" title="Editar">${ICON_EDIT}</button>
            <button class="icon-btn del" data-del-line="${l.id}" title="Excluir">${ICON_DEL}</button>
          </div>
        </article>`;
    }).join("") : `<p class="empty">Nenhuma linhagem encontrada.</p>`;
  }

  const lineForm = $("#lineForm");
  function openLineForm(l) {
    pendingFoto = undefined;
    openForm(lineForm, l ? `Editar ${l.linhagem}` : "Nova linhagem", l, LFIELDS);
    setPreview(l ? photoSrc(l) : "");
    $("#pfMsg").textContent = "JPG ou PNG. A imagem é reduzida para até 1600 px para economizar espaço.";
  }
  $("#btnNewLine").addEventListener("click", () => openLineForm(null));
  lineForm.elements.fotoUrl.addEventListener("input", () => {
    const v = lineForm.elements.fotoUrl.value.trim();
    if (pendingFoto === undefined || pendingFoto === null) setPreview(isUrl(v) ? v : "");
  });
  lineForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = {};
    LFIELDS.forEach((k) => (data[k] = (lineForm.elements[k].value || "").trim()));
    const msg = $("#lineFormMsg");
    if (!data.linhagem) return (msg.textContent = "Informe o nome da linhagem.");
    if (data.tipo) data.tipo = data.tipo.toUpperCase();
    const editing = lineForm.dataset.editing;
    const dup = db.linhagens.find((l) => norm(l.linhagem) === norm(data.linhagem) && l.id !== editing);
    if (dup) return (msg.textContent = `Já existe uma linhagem chamada “${dup.linhagem}”.`);
    let id = editing;
    if (editing) {
      const old = db.linhagens.find((l) => l.id === editing);
      if (old.linhagem !== data.linhagem) db.tubos.forEach((t) => { if (t.lin === old.linhagem) t.lin = data.linhagem; });
      Object.assign(old, data, { atualizadoEm: new Date().toISOString() });
    } else {
      id = uid();
      db.linhagens.push({ id, criadoEm: new Date().toISOString(), ...data });
    }
    lineForm.hidden = true;
    $("#lineSearch").value = ""; $("#lineFilter").value = "";
    const foto = pendingFoto;
    pendingFoto = undefined;
    if (foto === null) Photos.del(id);
    else if (foto !== undefined) Photos.put(id, foto); // memória na hora; disco em segundo plano
    save();
    flash(id);
  });
  $("#linesList").addEventListener("click", (e) => {
    const ed = e.target.closest("[data-edit-line]"), del = e.target.closest("[data-del-line]");
    const zm = e.target.closest("[data-zoom]");
    if (zm) return zoom(db.linhagens.find((x) => x.id === zm.dataset.zoom));
    if (ed) openLineForm(db.linhagens.find((x) => x.id === ed.dataset.editLine));
    if (del) {
      const l = db.linhagens.find((x) => x.id === del.dataset.delLine);
      const used = db.tubos.filter((t) => t.lin === l.linhagem).length;
      if (used) return alert(`A linhagem “${l.linhagem}” tem ${used} criotubos registrados (em estoque ou no histórico) e não pode ser excluída.`);
      if (confirm(`Excluir a linhagem “${l.linhagem}”?`)) { db.linhagens = db.linhagens.filter((x) => x !== l); Photos.del(l.id); save(); }
    }
  });
  $("#lineSearch").addEventListener("input", renderLines);
  $("#lineFilter").addEventListener("change", renderLines);

  /* ================= Pesquisadores ================= */
  const PFIELDS = ["nome", "tipo", "vinculo", "contato", "obs"];
  function renderPeople() {
    const q = norm($("#peopleSearch").value);
    const stored = {}, storedNow = {}, taken = {};
    db.tubos.forEach((t) => {
      stored[t.pes] = (stored[t.pes] || 0) + 1;
      if (!t.rem) storedNow[t.pes] = (storedNow[t.pes] || 0) + 1;
      if (t.rem && t.rem.por) taken[t.rem.por] = (taken[t.rem.por] || 0) + 1;
    });
    const items = db.pesquisadores.slice().sort((a, b) => (a.tipo === b.tipo ? sortPeople(a, b) : a.tipo === "PESQUISADOR" ? -1 : 1))
      .filter((p) => !q || PFIELDS.some((k) => norm(p[k]).includes(q)));
    $("#peopleCount").textContent = `${plural(db.pesquisadores.length, "cadastro", "cadastros")}.`;
    $("#peopleList").innerHTML = items.length ? items.map((p) => `
      <article class="line-card person" data-card="${p.id}">
        <div>
          <div class="lc-code sm">${esc(p.nome)}</div>
          <div class="lc-tags" style="margin-top:6px"><span class="tag ${p.tipo === "FORNECEDOR" ? "imo" : "pri"}">${esc(p.tipo)}</span></div>
        </div>
        <div class="lc-body">
          <dl>
            ${p.vinculo ? `<dt>VÍNCULO</dt><dd>${esc(p.vinculo)}</dd>` : ""}
            ${p.contato ? `<dt>CONTATO</dt><dd>${esc(p.contato)}</dd>` : ""}
            <dt>ARMAZENOU</dt><dd>${plural(stored[p.nome] || 0, "criotubo", "criotubos")} · ${storedNow[p.nome] || 0} ainda no botijão</dd>
            <dt>RETIROU</dt><dd>${plural(taken[p.nome] || 0, "criotubo", "criotubos")}</dd>
            ${p.obs ? `<dt>OBSERVAÇÕES</dt><dd>${esc(p.obs)}</dd>` : ""}
          </dl>
        </div>
        <div class="lc-actions">
          <button class="icon-btn" data-edit-p="${p.id}" title="Editar">${ICON_EDIT}</button>
          <button class="icon-btn del" data-del-p="${p.id}" title="Excluir">${ICON_DEL}</button>
        </div>
      </article>`).join("") : `<p class="empty">Nenhum cadastro encontrado.</p>`;
  }
  const personForm = $("#personForm");
  $("#btnNewPerson").addEventListener("click", () => openForm(personForm, "Novo cadastro", null, PFIELDS));
  personForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = {};
    PFIELDS.forEach((k) => (data[k] = (personForm.elements[k].value || "").trim()));
    data.nome = data.nome.toUpperCase();
    const msg = $("#personFormMsg");
    if (!data.nome) return (msg.textContent = "Informe o nome.");
    const editing = personForm.dataset.editing;
    const dup = db.pesquisadores.find((p) => norm(p.nome) === norm(data.nome) && p.id !== editing);
    if (dup) return (msg.textContent = "Esse nome já está cadastrado.");
    let id = editing;
    if (editing) {
      const old = db.pesquisadores.find((p) => p.id === editing);
      if (old.nome !== data.nome) db.tubos.forEach((t) => {
        if (t.pes === old.nome) t.pes = data.nome;
        if (t.rem && t.rem.por === old.nome) t.rem.por = data.nome;
      });
      Object.assign(old, data);
    } else {
      id = uid();
      db.pesquisadores.push({ id, criadoEm: new Date().toISOString(), ...data });
    }
    personForm.hidden = true;
    $("#peopleSearch").value = "";
    save();
    flash(id);
  });
  $("#peopleList").addEventListener("click", (e) => {
    const ed = e.target.closest("[data-edit-p]"), del = e.target.closest("[data-del-p]");
    if (ed) { const p = db.pesquisadores.find((x) => x.id === ed.dataset.editP); openForm(personForm, `Editar cadastro`, p, PFIELDS); }
    if (del) {
      const p = db.pesquisadores.find((x) => x.id === del.dataset.delP);
      const used = db.tubos.filter((t) => t.pes === p.nome || (t.rem && t.rem.por === p.nome)).length;
      if (used) return alert(`${p.nome} aparece em ${used} registros de criotubos e não pode ser excluído(a).`);
      if (confirm(`Excluir ${p.nome}?`)) { db.pesquisadores = db.pesquisadores.filter((x) => x !== p); save(); }
    }
  });
  $("#peopleSearch").addEventListener("input", renderPeople);

  /* ================= Armazenar ================= */
  const storeForm = $("#storeForm");
  let stCan = null;

  function fillSelect(sel, opts, placeholder, keep = true) {
    const cur = sel.value;
    sel.innerHTML = (placeholder ? `<option value="">${esc(placeholder)}</option>` : "") +
      opts.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("");
    if (keep && opts.some((o) => o.value === cur)) sel.value = cur;
  }

  function renderStore() {
    fillSelect($("#stLine"), db.linhagens.slice().sort(sortLines).map((l) => ({ value: l.linhagem, label: l.linhagem + (l.identificacao ? ` — ${l.identificacao}` : "") })), "Selecione…");
    fillSelect($("#stPerson"), db.pesquisadores.slice().sort(sortPeople).map((p) => ({ value: p.nome, label: p.nome + (p.tipo === "FORNECEDOR" ? " (fornecedor)" : "") })), "Selecione…");
    if (!storeForm.elements.data.value) storeForm.elements.data.value = todayISO();
    const per = stockBy("can");
    const lines = {};
    inStock().forEach((t) => ((lines[t.can] = lines[t.can] || new Set()).add(t.lin)));
    $("#stCanisters").innerHTML = Array.from({ length: N_CAN }, (_, k) => k + 1).map((c) => `
      <button type="button" class="can-btn${stCan === c ? " on" : ""}" data-can="${c}">
        <b>${c}</b>
        <span>${per[c] || 0} tubos</span>
        <small>${lines[c] ? [...lines[c]].slice(0, 3).map(esc).join(", ") + (lines[c].size > 3 ? "…" : "") : "vazio"}</small>
      </button>`).join("");
    drawDewar(stCan);
  }
  $("#stCanisters").addEventListener("click", (e) => {
    const b = e.target.closest("[data-can]");
    if (!b) return;
    stCan = +b.dataset.can;
    renderStore();
  });
  // sugere o canister onde a linhagem já está guardada
  $("#stLine").addEventListener("change", () => {
    const lin = $("#stLine").value;
    const m = {};
    inStock().filter((t) => t.lin === lin).forEach((t) => (m[t.can] = (m[t.can] || 0) + 1));
    const best = Object.entries(m).sort((a, b) => b[1] - a[1])[0];
    if (best) { stCan = +best[0]; renderStore(); }
  });
  storeForm.elements.densidade.addEventListener("input", () => {
    const n = parseNum(storeForm.elements.densidade.value);
    $("#stDensHint").textContent = n ? `${n.toLocaleString("pt-BR")} células · ${sci(n)}` : "";
  });

  storeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = storeForm.elements;
    const msg = $("#storeMsg");
    msg.textContent = "";
    const qtd = parseInt(String(f.quantidade.value).replace(/\D/g, ""), 10);
    if (!f.linhagem.value) return (msg.textContent = "Selecione a linhagem.");
    if (!f.pesquisador.value) return (msg.textContent = "Selecione o pesquisador.");
    if (!stCan) return (msg.textContent = "Escolha o canister.");
    if (!qtd || qtd < 1 || qtd > 300) return (msg.textContent = "Informe a quantidade de criotubos (1 a 300).");
    const dens = parseNum(f.densidade.value);
    if (f.densidade.value.trim() && !dens) return (msg.textContent = "Densidade celular inválida.");
    const ev = "arm-" + uid();
    const base = {
      can: stCan, lin: f.linhagem.value, pass: String(f.passagem.value).replace(/\D/g, ""),
      dens, data: f.data.value || "", vol: parseNum(f.volume.value), pes: f.pesquisador.value,
      obs: f.obs.value.trim(), rem: null, origem: "app", lote: ev, criadoEm: new Date().toISOString(),
    };
    for (let i = 0; i < qtd; i++) db.tubos.push({ id: uid(), ...base });
    save();
    const done = $("#storeDone");
    done.hidden = false;
    done.innerHTML = `
      <b>${plural(qtd, "criotubo armazenado", "criotubos armazenados")}</b>
      <span>${esc(base.lin)}${base.pass ? ` · P${esc(base.pass)}` : ""} · canister ${base.can} · ${esc(firstName(base.pes))}${dens ? ` · ${sci(dens)}` : ""}</span>
      <div class="done-actions"><a href="#dewar" class="link-btn">Ver no botijão</a><button type="button" class="link-btn" data-undo-store="${ev}">Desfazer</button></div>`;
    f.quantidade.value = "1";
    f.obs.value = "";
    done.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  $("#storeDone").addEventListener("click", (e) => {
    const b = e.target.closest("[data-undo-store]");
    if (!b) return;
    db.tubos = db.tubos.filter((t) => !(t.lote === b.dataset.undoStore && !t.rem));
    $("#storeDone").hidden = true;
    save();
  });

  /* ================= Retirar ================= */
  let openLot = null;
  function lotLine(l) {
    return [
      l.pass !== "" && l.pass != null ? `P${esc(l.pass)}` : "passagem —",
      l.dens ? sci(l.dens) + " cél." : "",
      l.data ? fmtDate(l.data) : "sem data",
      l.vol ? fmtNum(l.vol) + " mL" : "",
      l.pes ? esc(firstName(l.pes)) : "",
    ].filter(Boolean).join(" · ");
  }
  function renderTake() {
    const stock = stockBy("lin");
    const lines = Object.keys(stock).sort((a, b) => a.localeCompare(b, "pt-BR"));
    fillSelect($("#tkLine"), lines.map((l) => ({ value: l, label: `${l} (${stock[l]} em estoque)` })), "Escolha a linhagem…");
    const lin = $("#tkLine").value;
    const cans = {};
    inStock().filter((t) => t.lin === lin).forEach((t) => (cans[t.can] = (cans[t.can] || 0) + 1));
    fillSelect($("#tkCan"), Object.keys(cans).map((c) => ({ value: c, label: `Canister ${c} (${cans[c]})` })), "Todos os canisters");
    const can = $("#tkCan").value;
    const list = $("#lotList");
    if (!lin) { list.innerHTML = `<p class="empty">Escolha uma linhagem para ver os lotes disponíveis.</p>`; drawDewar(); return; }
    const lots = lotsOf(inStock().filter((t) => t.lin === lin && (!can || t.can == can))).sort(byOldest);
    drawDewar(can || (Object.keys(cans).length === 1 ? Object.keys(cans)[0] : null));
    const people = db.pesquisadores.slice().sort(sortPeople).filter((p) => p.tipo !== "FORNECEDOR");
    list.innerHTML = lots.map((l) => {
      const n = l.tubos.length;
      const isOpen = openLot === l.key;
      return `
      <div class="lot${isOpen ? " open" : ""}" data-lot="${esc(l.key)}">
        <div class="lot-head">
          <span class="lot-can mono">CAN ${l.can}</span>
          <div class="lot-info"><b>${esc(l.lin)}</b><span>${lotLine(l)}</span></div>
          <span class="lot-n"><b>${n}</b> disp.</span>
          <button type="button" class="btn-clear lot-btn" data-open-lot="${esc(l.key)}">${isOpen ? "Fechar" : "Retirar"}</button>
        </div>
        ${isOpen ? `
        <form class="lot-form" data-lot-form="${esc(l.key)}">
          <label class="lf-field"><span>Quantidade (máx. ${n})</span><input name="qtd" type="number" min="1" max="${n}" value="1" required /></label>
          <label class="lf-field"><span>Data da retirada</span><input name="data" type="date" value="${todayISO()}" /></label>
          <label class="lf-field"><span>Motivo</span><select name="motivo">${MOTIVOS.map((m) => `<option>${esc(m)}</option>`).join("")}</select></label>
          <label class="lf-field"><span>Retirado por</span><select name="por"><option value="">Selecione…</option>${people.map((p) => `<option value="${esc(p.nome)}">${esc(p.nome)}</option>`).join("")}</select></label>
          <div class="lf-actions full"><button type="submit" class="btn-primary">Confirmar retirada</button><span class="lf-msg"></span></div>
        </form>` : ""}
      </div>`;
    }).join("") || `<p class="empty">Sem criotubos em estoque para essa seleção.</p>`;
  }
  $("#tkLine").addEventListener("change", () => { $("#tkCan").value = ""; openLot = null; $("#takeDone").hidden = true; renderTake(); });
  $("#tkCan").addEventListener("change", () => { openLot = null; renderTake(); });
  $("#lotList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-open-lot]");
    if (!b || blocked()) return;
    openLot = openLot === b.dataset.openLot ? null : b.dataset.openLot;
    renderTake();
  });
  $("#lotList").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    const key = form.dataset.lotForm;
    const lot = lotsOf(inStock()).find((l) => l.key === key);
    const msg = $(".lf-msg", form);
    const qtd = parseInt(form.elements.qtd.value, 10);
    const motivo = form.elements.motivo.value;
    const por = form.elements.por.value;
    if (!lot) return;
    if (!qtd || qtd < 1 || qtd > lot.tubos.length) return (msg.textContent = `Informe de 1 a ${lot.tubos.length}.`);
    if (motivo === "Uso" && !por) return (msg.textContent = "Informe quem está retirando.");
    const ev = "ret-" + uid();
    lot.tubos.slice(0, qtd).forEach((t) => (t.rem = { data: form.elements.data.value || "", motivo, por, ev, registradoEm: new Date().toISOString() }));
    openLot = null;
    save();
    const done = $("#takeDone");
    done.hidden = false;
    done.innerHTML = `
      <b>${plural(qtd, "criotubo retirado", "criotubos retirados")}</b>
      <span>${esc(lot.lin)} · canister ${lot.can} · ${esc(motivo)}${por ? ` · ${esc(firstName(por))}` : ""}</span>
      <div class="done-actions"><button type="button" class="link-btn" data-undo-ev="${ev}">Desfazer</button></div>`;
    done.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  function undoEvent(ev) {
    const ts = db.tubos.filter((t) => t.rem && t.rem.ev === ev);
    if (!ts.length) return;
    if (!confirm(`Desfazer a retirada de ${plural(ts.length, "criotubo", "criotubos")}? Eles voltarão ao estoque.`)) return;
    ts.forEach((t) => (t.rem = null));
    $("#takeDone").hidden = true;
    save();
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-undo-ev]");
    if (b) undoEvent(b.dataset.undoEv);
  });

  /* ================= Botijão: estoque e histórico ================= */
  $$(".tab").forEach((t) => t.addEventListener("click", () => {
    $$(".tab").forEach((x) => x.classList.toggle("on", x === t));
    $("#paneEstoque").hidden = t.dataset.tab !== "estoque";
    $("#paneHistorico").hidden = t.dataset.tab !== "historico";
  }));

  /* ---------- Estoque (com edição de lotes) ---------- */
  let dwLots = [];          // lotes exibidos (índice usado nos botões)
  let editLotIdx = null;    // lote em edição
  const openCans = new Set();
  const ICON_EDIT_SM = `<svg viewBox="0 0 24 24" fill="none"><path d="M4 20h4L19 9l-4-4L4 16v4z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  const densInput = (n) => (n ? n.toExponential(2).replace(".", ",").toUpperCase() : "");
  const lineOpts = (cur) => db.linhagens.slice().sort(sortLines).map((l) => `<option${l.linhagem === cur ? " selected" : ""}>${esc(l.linhagem)}</option>`).join("");
  const personOpts = (cur, blank) => (blank ? `<option value="">${blank}</option>` : "") +
    db.pesquisadores.slice().sort(sortPeople).map((p) => `<option${p.nome === cur ? " selected" : ""}>${esc(p.nome)}</option>`).join("") +
    (cur && !db.pesquisadores.some((p) => p.nome === cur) ? `<option selected>${esc(cur)}</option>` : "");

  function lotEditRow(l, i) {
    const n = l.tubos.length;
    const obs = l.tubos[0].obs || "";
    return `<tr class="edit-row"><td colspan="8">
      <form class="edit-form" data-save-lot="${i}" autocomplete="off">
        <div class="ef-title">Editar lote · ${plural(n, "criotubo", "criotubos")}</div>
        <div class="ef-grid">
          <label class="lf-field"><span>Linhagem</span><select name="lin">${lineOpts(l.lin)}</select></label>
          <label class="lf-field"><span>Canister</span><select name="can">${Array.from({ length: N_CAN }, (_, k) => `<option${k + 1 === l.can ? " selected" : ""}>${k + 1}</option>`).join("")}</select></label>
          <label class="lf-field"><span>Passagem</span><input name="pass" inputmode="numeric" value="${esc(l.pass ?? "")}" /></label>
          <label class="lf-field"><span>Dens. celular</span><input name="dens" inputmode="decimal" placeholder="Ex.: 1,36E+06" value="${esc(densInput(l.dens))}" /></label>
          <label class="lf-field"><span>Data congelamento</span><input name="data" type="date" value="${esc(l.data || "")}" /></label>
          <label class="lf-field"><span>Volume (mL)</span><input name="vol" inputmode="decimal" value="${l.vol ? fmtNum(l.vol) : ""}" /></label>
          <label class="lf-field ef-wide"><span>Pesquisador</span><select name="pes">${personOpts(l.pes, "— sem pesquisador —")}</select></label>
          <label class="lf-field ef-wide"><span>Observações</span><input name="obs" value="${esc(obs)}" /></label>
          <label class="lf-field"><span>Aplicar a quantos?</span><input name="qtd" type="number" min="1" max="${n}" value="${n}" /></label>
        </div>
        <p class="ef-hint">Para corrigir só parte do lote, diminua a quantidade: os demais criotubos continuam com os dados atuais.</p>
        <div class="lf-actions"><button type="submit" class="btn-primary">Salvar alterações</button><button type="button" class="btn-clear" data-cancel-edit>Cancelar</button><span class="lf-msg"></span></div>
      </form></td></tr>`;
  }

  function renderDewar() {
    const stock = stockBy("lin");
    fillSelect($("#dwLine"), Object.keys(stock).sort((a, b) => a.localeCompare(b, "pt-BR")).map((l) => ({ value: l, label: `${l} (${stock[l]})` })), "Todas as linhagens");
    const lin = $("#dwLine").value;
    const st = inStock().filter((t) => !lin || t.lin === lin);
    dwLots = [];
    let html = "";
    for (let c = 1; c <= N_CAN; c++) {
      const tubes = st.filter((t) => t.can === c);
      if (lin && !tubes.length) continue;
      const byLin = {};
      tubes.forEach((t) => (byLin[t.lin] = (byLin[t.lin] || 0) + 1));
      const lots = lotsOf(tubes).sort((a, b) => a.lin.localeCompare(b.lin) || byOldest(a, b));
      const rows = lots.map((l) => {
        const i = dwLots.push(l) - 1;
        const obs = l.tubos.find((t) => t.obs);
        return `<tr${editLotIdx === i ? ' class="editing"' : ""}>
          <td><b>${esc(l.lin)}</b>${obs ? ` <span class="obs-dot" title="${esc(obs.obs)}">obs</span>` : ""}</td><td>${l.pass !== "" && l.pass != null ? esc(l.pass) : "—"}</td>
          <td>${l.dens ? sci(l.dens) : "—"}</td><td>${l.data ? fmtDate(l.data) : "—"}</td>
          <td>${l.vol ? fmtNum(l.vol) + " mL" : "—"}</td><td>${l.pes ? esc(firstName(l.pes)) : "—"}</td><td class="num">${l.tubos.length}</td>
          <td class="act"><button type="button" class="icon-btn sm" data-edit-lot="${i}" title="Editar lote" aria-label="Editar lote">${ICON_EDIT_SM}</button></td></tr>
          ${editLotIdx === i ? lotEditRow(l, i) : ""}`;
      }).join("");
      const isOpen = lin || openCans.has(c);
      html += `
      <details class="can-card" data-can-card="${c}"${isOpen ? " open" : ""}>
        <summary>
          <span class="can-num">${c}</span>
          <div class="can-sum">
            <b>Canister ${c}</b>
            <div class="chips">${Object.entries(byLin).sort((a, b) => b[1] - a[1]).map(([l, n]) => `<span class="chip">${esc(l)} <b>${n}</b></span>`).join("") || `<span class="chip empty-chip">vazio</span>`}</div>
          </div>
          <span class="can-total"><b>${tubes.length}</b> tubos</span>
        </summary>
        ${lots.length ? `<div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Linhagem</th><th>Passagem</th><th>Dens. celular</th><th>Data</th><th>Vol.</th><th>Pesquisador</th><th class="num">Qtd.</th><th></th></tr></thead>
          <tbody>${rows}</tbody></table></div>` : ""}
      </details>`;
    }
    $("#canList").innerHTML = html || `<p class="empty">Nada em estoque.</p>`;
    renderHistory();
  }

  $("#canList").addEventListener("toggle", (e) => {
    const d = e.target.closest && e.target.closest("[data-can-card]");
    if (!d) return;
    const c = +d.dataset.canCard;
    d.open ? openCans.add(c) : openCans.delete(c);
  }, true);
  $("#canList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-edit-lot]");
    if (b && blocked()) return;
    if (b) {
      editLotIdx = editLotIdx === +b.dataset.editLot ? null : +b.dataset.editLot;
      renderDewar();
      const f = $(".edit-form", $("#canList"));
      if (f) f.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (e.target.closest("[data-cancel-edit]")) { editLotIdx = null; renderDewar(); }
  });
  $("#canList").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target, el = f.elements, msg = $(".lf-msg", f);
    const lot = dwLots[+f.dataset.saveLot];
    if (!lot) return;
    const n = lot.tubos.length;
    const qtd = parseInt(el.qtd.value, 10);
    if (!qtd || qtd < 1 || qtd > n) return (msg.textContent = `Informe de 1 a ${n}.`);
    const dens = parseNum(el.dens.value);
    if (el.dens.value.trim() && !dens) return (msg.textContent = "Densidade celular inválida.");
    const vol = parseNum(el.vol.value);
    if (el.vol.value.trim() && !vol) return (msg.textContent = "Volume inválido.");
    const novo = {
      lin: el.lin.value, can: +el.can.value, pass: String(el.pass.value).replace(/\D/g, ""),
      dens, data: el.data.value || "", vol, pes: el.pes.value, obs: el.obs.value.trim(),
    };
    const now = new Date().toISOString();
    lot.tubos.slice(0, qtd).forEach((t) => Object.assign(t, novo, { editadoEm: now }));
    editLotIdx = null;
    openCans.add(novo.can);
    save();
  });

  /* ---------- Histórico (com edição) ---------- */
  let hsItems = [];
  let editHistIdx = null;
  const openHist = new Set(); // linhagens abertas no histórico

  function histEditForm(g, i) {
    return `<form class="edit-form hist-edit" data-save-hist="${i}" autocomplete="off">
      <div class="ef-title">Editar retirada · ${plural(g.n, "criotubo", "criotubos")} de ${esc(g.lin)}</div>
      <div class="ef-grid">
        <label class="lf-field"><span>Data da retirada</span><input name="data" type="date" value="${esc(g.data || "")}" /></label>
        <label class="lf-field"><span>Motivo</span><select name="motivo">${MOTIVOS.map((m) => `<option${m === g.motivo ? " selected" : ""}>${esc(m)}</option>`).join("")}</select></label>
        <label class="lf-field ef-wide"><span>Retirado por</span><select name="por">${personOpts(g.por, "— não informado —")}</select></label>
        <label class="lf-field ef-wide"><span>Observação da retirada</span><input name="obs" value="${esc(g.obs || "")}" placeholder="Ex.: usado no experimento X" /></label>
      </div>
      <div class="lf-actions"><button type="submit" class="btn-primary">Salvar alterações</button><button type="button" class="btn-clear" data-cancel-hist>Cancelar</button><span class="lf-msg"></span></div>
    </form>`;
  }

  function renderHistory() {
    const removed = db.tubos.filter((t) => t.rem);
    const lines = [...new Set(removed.map((t) => t.lin))].sort();
    const who = [...new Set(removed.map((t) => t.rem.por || t.rem.motivo))].sort();
    fillSelect($("#hsLine"), lines.map((l) => ({ value: l, label: l })), "Todas as linhagens");
    fillSelect($("#hsWho"), who.map((w) => ({ value: w, label: w === "Uso" ? "Uso (sem nome)" : w })), "Todos os responsáveis / motivos");
    const fl = $("#hsLine").value, fw = $("#hsWho").value;
    // agrupa: mesma retirada (ou lotes da planilha do mesmo dia, mesma pessoa/motivo)
    const map = new Map();
    hsItems = [];
    removed.filter((t) => (!fl || t.lin === fl) && (!fw || (t.rem.por || t.rem.motivo) === fw)).forEach((t) => {
      const r = t.rem;
      const k = [t.lin, t.can, r.data, r.motivo, r.por, r.obs || "", r.ev.startsWith("planilha") ? "p" : r.ev].join("|");
      if (!map.has(k)) { const g = { lin: t.lin, can: t.can, data: r.data, motivo: r.motivo, por: r.por, obs: r.obs || "", ids: [], n: 0 }; map.set(k, g); hsItems.push(g); }
      const g = map.get(k);
      g.ids.push(t.id); g.n++;
    });
    hsItems.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
    // totais de criotubos retirados
    $("#histTotal").textContent = removed.length.toLocaleString("pt-BR");
    const shown = hsItems.reduce((s, g) => s + g.n, 0);
    const uso = hsItems.filter((g) => g.motivo === "Uso").reduce((s, g) => s + g.n, 0);
    $("#histSum").innerHTML = `<b>${plural(shown, "criotubo retirado", "criotubos retirados")}</b>` +
      (fl || fw ? ` <span>de ${removed.length.toLocaleString("pt-BR")} no total</span>` : "") +
      ` <span>· ${uso.toLocaleString("pt-BR")} para uso · ${(shown - uso).toLocaleString("pt-BR")} descartados</span>`;
    // agrupa as retiradas por linhagem
    const byLine = new Map();
    hsItems.forEach((g, i) => {
      if (!byLine.has(g.lin)) byLine.set(g.lin, []);
      byLine.get(g.lin).push(i);
    });
    const linesSorted = [...byLine.keys()].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
    $("#histList").innerHTML = linesSorted.length ? linesSorted.map((lin) => {
      const idx = byLine.get(lin);
      const gs = idx.map((i) => hsItems[i]);
      const tot = gs.reduce((s, g) => s + g.n, 0);
      const nUso = gs.filter((g) => g.motivo === "Uso").reduce((s, g) => s + g.n, 0);
      const last = gs.map((g) => g.data).filter(Boolean).sort().pop();
      const open = openHist.has(lin);
      const ident = (db.linhagens.find((l) => l.linhagem === lin) || {}).identificacao || "";
      return `
      <div class="hl${open ? " open" : ""}">
        <div class="hl-head" role="button" tabindex="0" data-expand-hist="${esc(lin)}" aria-expanded="${open}">
          <div class="hl-name"><b>${esc(lin)}</b>${ident ? `<span>${esc(ident)}</span>` : ""}</div>
          <div class="hl-stats">
            <span><b>${tot}</b> ${tot === 1 ? "retirado" : "retirados"}</span>
            <span class="hl-sub">${nUso} para uso · ${tot - nUso} ${tot - nUso === 1 ? "descarte" : "descartes"}${last ? ` · última ${fmtDate(last)}` : ""}</span>
          </div>
          <i class="chev${open ? " up" : ""}">▾</i>
        </div>
        ${open ? `<div class="hl-body">${idx.map((i) => retiradaBlock(hsItems[i], i)).join("")}</div>` : ""}
      </div>`;
    }).join("") : `<p class="empty">Nenhuma retirada registrada.</p>`;
  }

  // uma retirada dentro da linhagem: data, quem retirou e todos os dados de estoque
  function retiradaBlock(g, i) {
    const isDesc = g.motivo !== "Uso";
    const ids = new Set(g.ids);
    const lots = lotsOf(db.tubos.filter((t) => ids.has(t.id))).sort(byOldest);
    return `
      <div class="rt${editHistIdx === i ? " editing" : ""}">
        <div class="rt-head">
          <span class="rt-date mono">${g.data ? fmtDate(g.data) : "sem data"}</span>
          <div class="rt-info">
            <b>${plural(g.n, "criotubo", "criotubos")} · canister ${g.can}</b>
            <span>${isDesc ? `<span class="tag inc">${esc(g.motivo.toUpperCase())}</span>` : "Uso"}${g.por ? ` · retirado por <strong>${esc(g.por)}</strong>` : ""}</span>
            ${g.obs ? `<span class="hist-obs">${esc(g.obs)}</span>` : ""}
          </div>
          <div class="hist-actions">
            <button type="button" class="link-btn" data-edit-hist="${i}">editar</button>
            <button type="button" class="link-btn" data-undo-hist="${i}">desfazer</button>
          </div>
        </div>
        <div class="tbl-wrap"><table class="tbl rt-tbl">
          <thead><tr><th>Passagem</th><th>Dens. celular</th><th>Data armazenamento</th><th>Volume</th><th>Armazenado por</th><th class="num">Qtd.</th></tr></thead>
          <tbody>${lots.map((l) => {
            const obs = l.tubos.find((t) => t.obs);
            return `<tr>
              <td>${l.pass !== "" && l.pass != null ? "P" + esc(l.pass) : "—"}</td>
              <td>${l.dens ? `${sci(l.dens)} <small class="dim">(${Number(l.dens).toLocaleString("pt-BR")})</small>` : "—"}</td>
              <td>${l.data ? fmtDate(l.data) : "—"}</td>
              <td>${l.vol ? fmtNum(l.vol) + " mL" : "—"}</td>
              <td>${l.pes ? esc(l.pes) : "—"}</td>
              <td class="num">${l.tubos.length}</td></tr>${obs ? `<tr class="obs-row"><td colspan="6">Obs.: ${esc(obs.obs)}</td></tr>` : ""}`;
          }).join("")}</tbody></table></div>
        ${editHistIdx === i ? histEditForm(g, i) : ""}
      </div>`;
  }
  function toggleHist(el) {
    const id = el.dataset.expandHist;
    openHist.has(id) ? openHist.delete(id) : openHist.add(id);
    renderHistory();
  }
  $("#histList").addEventListener("keydown", (e) => {
    const x = e.target.closest("[data-expand-hist]");
    if (x && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggleHist(x); }
  });
  $("#histList").addEventListener("click", (e) => {
    const x = e.target.closest("[data-expand-hist]");
    if (x) return toggleHist(x);
    const ed = e.target.closest("[data-edit-hist]");
    if ((ed || e.target.closest("[data-undo-hist]")) && blocked()) return;
    if (ed) {
      editHistIdx = editHistIdx === +ed.dataset.editHist ? null : +ed.dataset.editHist;
      renderHistory();
      return;
    }
    if (e.target.closest("[data-cancel-hist]")) { editHistIdx = null; renderHistory(); return; }
    const un = e.target.closest("[data-undo-hist]");
    if (un) {
      const g = hsItems[+un.dataset.undoHist];
      if (!g || !confirm(`Desfazer esta retirada? ${plural(g.n, "criotubo voltará", "criotubos voltarão")} ao estoque.`)) return;
      db.tubos.forEach((t) => { if (g.ids.includes(t.id)) t.rem = null; });
      editHistIdx = null;
      save();
    }
  });
  $("#histList").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target, el = f.elements;
    const g = hsItems[+f.dataset.saveHist];
    if (!g) return;
    if (el.motivo.value === "Uso" && !el.por.value) return ($(".lf-msg", f).textContent = "Para “Uso”, informe quem retirou.");
    const now = new Date().toISOString();
    db.tubos.forEach((t) => {
      if (g.ids.includes(t.id) && t.rem) Object.assign(t.rem, { data: el.data.value || "", motivo: el.motivo.value, por: el.por.value, obs: el.obs.value.trim(), editadoEm: now });
    });
    editHistIdx = null;
    save();
  });
  $("#dwLine").addEventListener("change", () => { editLotIdx = null; renderDewar(); });
  $("#hsLine").addEventListener("change", () => { editHistIdx = null; if ($("#hsLine").value) openHist.add($("#hsLine").value); renderHistory(); });
  $("#hsWho").addEventListener("change", () => { editHistIdx = null; renderHistory(); });

  /* ================= Exportar / backup ================= */
  function download(name, content, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = (rows) => "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");

  $("#btnExportTubes").addEventListener("click", () => {
    const rows = [["CANISTER", "LINHAGEM", "PASSAGEM", "DENS. CELULAR", "DATA", "VOL(mL)", "PESQUISADOR", "REMOÇÃO", "DATA REMOÇÃO", "RETIRADO POR", "MOTIVO", "OBS", "OBS RETIRADA"]];
    db.tubos.slice().sort((a, b) => a.can - b.can || a.lin.localeCompare(b.lin)).forEach((t) => rows.push([
      t.can, t.lin, t.pass, t.dens ? t.dens.toExponential(2).replace(".", ",").toUpperCase() : "", fmtDate(t.data), fmtNum(t.vol), t.pes,
      t.rem ? "SIM" : "NÃO", t.rem ? fmtDate(t.rem.data) : "", t.rem ? t.rem.por : "", t.rem ? t.rem.motivo : "", t.obs, t.rem ? t.rem.obs || "" : "",
    ]));
    download(`criotubos-${todayISO()}.csv`, csv(rows), "text/csv;charset=utf-8");
  });
  $("#btnExportLines").addEventListener("click", () => {
    const H = ["LINHAGEM", "IDENTIFICAÇÃO", "TIPO", "ORIGEM", "MEIO CRESCIMENTO", "SUPLEMENTAÇÃO", "DATASHEET", "OBSERVAÇÕES"];
    download(`linhagens-${todayISO()}.csv`, csv([H, ...db.linhagens.slice().sort(sortLines).map((l) => LCSV.map((k) => l[k]))]), "text/csv;charset=utf-8");
  });
  $("#btnBackup").addEventListener("click", () => {
    const fotos = {};
    db.linhagens.forEach((l) => { if (Photos.cache[l.id]) fotos[l.id] = Photos.cache[l.id]; });
    download(`backup-banco-celulas-${todayISO()}.json`, JSON.stringify({ ...db, fotos }, null, 1), "application/json");
  });
  $("#fileRestore").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!Array.isArray(d.tubos) || !Array.isArray(d.linhagens) || !Array.isArray(d.pesquisadores)) throw new Error();
        if (!confirm(`Restaurar backup com ${d.linhagens.length} linhagens e ${d.tubos.length} criotubos? Os dados atuais serão substituídos.`)) return;
        const fotos = d.fotos || {};
        delete d.fotos;
        db = d;
        Photos.clear().then(() => Promise.all(Object.entries(fotos).map(([id, data]) => Photos.put(id, data)))).then(save);
      } catch (err) {
        alert("Arquivo de backup inválido.");
      }
      e.target.value = "";
    };
    r.readAsText(file);
  });
  $("#btnResetSeed").addEventListener("click", () => {
    if (!confirm("Recarregar os dados da planilha? Tudo o que foi registrado aqui será perdido.")) return;
    db = fromSeed();
    Photos.clear().then(save);
  });

  /* ================= Inicialização ================= */
  let currentView = "";
  function refreshAll() {
    renderMenu();
    if (currentView === "lines") renderLines();
    if (currentView === "people") renderPeople();
    if (currentView === "store") renderStore();
    if (currentView === "take") renderTake();
    if (currentView === "dewar") renderDewar();
    if (currentView !== "store" && currentView !== "take") drawDewar();
  }
  document.addEventListener("viewchange", (e) => {
    currentView = e.detail;
    $$(".line-form").forEach((f) => (f.hidden = true));
    if (currentView !== "store") $("#storeDone").hidden = true;
    if (currentView !== "take") $("#takeDone").hidden = true;
    refreshAll();
  });
  document.addEventListener("click", (e) => { if (e.target.closest("[data-login]") && window.Auth) window.Auth.ask(); });
  if (window.Auth) window.Auth.onChange(() => {
    $$(".line-form").forEach((f) => (f.hidden = true));
    editLotIdx = null; editHistIdx = null; openLot = null;
    refreshAll();
  });
  refreshAll();
  Photos.loadAll().then(refreshAll);
})();
