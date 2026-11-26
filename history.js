/* =========================================================
   Histórico de registros (contagem, plaqueamento, viabilidade,
   subcultura). Salvo só quando o usuário clica em
   "Salvar no histórico". Modo de teste: fica neste navegador.
   ========================================================= */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const KEY = "nctbio.historico.v1";
  const TYPES = { count: "Contagem", plate: "Contagem + plaqueamento", viab: "Viabilidade", sub: "Subcultura" };
  const GROUP = (type) => (type === "plate" ? "count" : type); // contagem e plaqueamento ficam juntos
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const fmtDate = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
  const fmtTime = (ts) => { const d = new Date(ts); return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };
  // texto visível, com expoentes (<sup>) convertidos em ⁰¹²… (ex.: 7,50 × 10⁶)
  const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  function txt(el) {
    if (!el) return "";
    const c = el.cloneNode(true);
    c.querySelectorAll("sup").forEach((s) => (s.textContent = s.textContent.split("").map((ch) => SUP[ch] || ch).join("")));
    const holder = document.createElement("div");
    holder.style.cssText = "position:absolute;left:-9999px;top:0";
    holder.appendChild(c); document.body.appendChild(holder);
    const out = c.innerText.replace(/\s+/g, " ").trim();
    holder.remove();
    return out;
  }
  const t = (sel) => txt($(sel));
  // notação científica em texto simples (ex.: 4,22 × 10⁶) para o histórico
  const SUPC2 = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  function sciTxt(n) {
    if (!isFinite(n) || n <= 0) return "";
    const e = Math.floor(Math.log10(n));
    return `${(n / Math.pow(10, e)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × 10${String(e).split("").map((c) => SUPC2[c]).join("")}`;
  }

  const v = (sel) => { const el = $(sel); return el ? el.value.trim() : ""; };
  const has = (x) => x && x !== "—" && !/^— /.test(x);
  const canEdit = () => !window.Auth || window.Auth.canEdit();

  /* ---------- armazenamento ---------- */
  // Online (Planilha Google): usa o banco sincronizado. Sem planilha: fica neste navegador.
  let mem = [];
  const loadLocal = () => { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : mem; } catch (e) { return mem; } };
  const storeLocal = (list) => { mem = list; try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* ignora */ } };
  const ONLINE = () => !!(window.Bank && window.Bank.online && window.Bank.online());
  const H = () => window.Bank.hist;
  const load = () => (ONLINE() ? H().list() : loadLocal());
  function addRec(rec) {
    if (!ONLINE()) { storeLocal([rec, ...loadLocal()]); return true; }
    if (!H().ready()) { toast("Aguarde: carregando os dados da planilha online.", true); return false; }
    if (!H().supported()) { toast("A planilha ainda não tem a aba Histórico. Atualize o código (Code.gs) e faça uma nova versão da implantação.", true); return false; }
    return H().add(rec);
  }
  function delRec(id) {
    if (!ONLINE()) { storeLocal(loadLocal().filter((x) => x.id !== id)); return true; }
    return H().del(id);
  }

  /* ---------- coleta dos dados de cada tela ---------- */
  function countPart(D) {
    const q = $$("[data-c]").map((i) => i.value || "—");
    D.push(["Contagem", null], ["Quadrantes", q.join(" · ")], ["Total contado na câmara", t("#cTotal")], ["Média", t("#cMean")],
      ["Volume no falcon", v("#cVol") ? v("#cVol") + " mL" : "—"], ["Células por mL", t("#cPerMl")], ["Total de células no falcon", t("#cTotFal")]);
  }
  const COLLECT = {
    count() {
      if (!has(t("#cTotFal"))) return { err: "Complete a contagem (quadrantes e volume do falcon) antes de salvar." };
      const D = []; countPart(D);
      return { D, S: [["Total no falcon", t("#cTotFal")], ["Células/mL", t("#cPerMl")]] };
    },
    plate() {
      const multi = $(".view-plate").dataset.pmode === "multi";
      const D = []; countPart(D);
      let S;
      if (!multi) {
        if (!has(t("#rWork"))) return { err: "Complete os dados do plaqueamento antes de salvar." };
        D.push(["Plaqueamento · uma densidade", null], ["Células por poço", v("#pCells")], ["Nº de poços", v("#pWells")], ["Fator de correção", t("#pFactor").replace(/^Fator de correção \(\+15%\):\s*/, "")],
          ["Volume por poço", v("#pWellVol") + " mL"], ["Volume da solução-mãe", v("#pResusp") + " mL"],
          ["Células necessárias", t("#rNeed")], ["Solução de trabalho", t("#rWork")], ["Alíquota da solução-mãe", t("#rAliq")], ["Meio a adicionar", t("#rMedium")]);
        if ($("#pCtrlOn") && $("#pCtrlOn").checked) D.push(["Poços controle", v("#pCtrl")]);
        if (!$("#pLeft").hidden) D.push(["Células que sobram", t("#pLeftVal")]);
        S = [["Células/poço", v("#pCells")], ["Poços", v("#pWells")], ["Solução de trabalho", t("#rWork")]];
      } else {
        if (!has(t("#mNeed"))) return { err: "Preencha as densidades antes de salvar." };
        const gs = (window.PlateGroups ? window.PlateGroups() : []).filter((g) => g.wells);
        D.push(["Plaqueamento · várias densidades", null], ["Volume da solução-mãe", v("#pResusp") + " mL"], ["Células necessárias", t("#mNeed")]);
        gs.forEach((g) => D.push([`Densidade ${g.L}`, `${(g.cells || 0).toLocaleString("pt-BR")} células · ${String(g.vol || "").replace(".", ",")} mL/poço · ${g.wells} poços${g.ctrl ? ` (${g.ctrl} controle)` : ""}`]));
        $$("#dgSteps .ds").forEach((ds) => {
          D.push([txt(ds.querySelector(".ds-head b")), null]);
          $$(".plan-row", ds).forEach((r) => D.push([txt(r.querySelector("span")), txt(r.querySelector("b"))]));
        });
        if (!$("#mLeft").hidden) D.push(["Células que sobram", t("#mLeftVal")]);
        S = [["Densidades", gs.map((g) => g.L + ": " + (g.cells || 0).toLocaleString("pt-BR")).join(" · ")], ["Células necessárias", t("#mNeed")]];
      }
      D.push(["Placa", null], ["Formato", t("#plateLabel")], ["Detalhes", t("#plateLegend") || "—"]);
      const lu = window.PlateLeftUse ? window.PlateLeftUse() : [];
      if (lu.length) D.push(["Divisão das células que sobram", null], ...lu);
      return { D, S };
    },
    viab() {
      if (!has(t("#vPct"))) return { err: "Complete a contagem de viabilidade antes de salvar." };
      const tq = $$("[data-t]").map((i) => i.value || "—"), sq = $$("[data-s]").map((i) => i.value || "—");
      const D = [["Contagem", null], ["Total por quadrante", tq.join(" · ")], ["Coradas por quadrante", sq.join(" · ")], ["Total de células", t("#tSum")], ["Soma de coradas", t("#sSum")],
        ["Viabilidade", null], ["Não-coradas", t("#vUnst")], ["Viabilidade celular", `${t("#vPct")} ${t("#vClass")}`.trim()], ["Volume no criotubo", v("#vVol") ? v("#vVol") + " mL" : "—"],
        ["Células viáveis/mL", t("#vPerMl")], ["Total de células viáveis", t("#vTotal")]];
      return { D, S: [["Viabilidade", t("#vPct")], ["Classificação", t("#vClass") || "—"], ["Viáveis/mL", t("#vPerMl")]] };
    },
    sub() {
      if (!has(t("#sTotFal"))) return { err: "Complete a contagem (quadrantes e volume do falcon) antes de salvar." };
      const q = $$("[data-sc]").map((i) => i.value || "—");
      const D = [["Contagem", null], ["Quadrantes", q.join(" · ")], ["Média", t("#sMean")], ["Volume no falcon", v("#sVol") + " mL"], ["Células por mL", t("#sPerMl")], ["Total de células no falcon", t("#sTotFal")],
        ["Distribuição", null], ["Volume da ressuspensão", v("#sRes") ? v("#sRes") + " mL" : "—"], ["Concentração", t("#sConc").replace(/^Concentração da ressuspensão:\s*/, "")]];
      let nFl = 0;
      $$("#flaskList .flask").forEach((f, i) => {
        const cells = $("[data-fcells]", f).value;
        if (!cells) return;
        nFl++;
        const size = ($(".seg .on", f) || {}).innerText || "";
        D.push([`Garrafa ${i + 1} · ${size}`, `${cells} células (${sciTxt(Number(cells.replace(/\D/g, "")))}) · meio em stand-by ${txt($(`#flStby${i}`))} · ressuspensão ${txt($(`#flAliq${i}`))}`]);
      });
      let nCr = 0;
      if ($("#cryoOn").checked) {
        D.push(["Criotubos", null], ["Preparo", t("#cryoStep")]);
        $$("#cryoList .cr-row:not(.cr-head)").forEach((r) => {
          const c = r.children; nCr++;
          const vol = c[1].querySelector("input") ? c[1].querySelector("input").value + " mL" : txt(c[1]);
          D.push([`Criotubo ${c[0].innerText}`, `${vol.replace(/\s+/g, " ")} · ${txt(c[2])} células`]);
        });
      }
      D.push(["Resumo", null], ["Células nas garrafas", t("#sumFl")], ["Células nos criotubos", t("#sumCr")], ["Ressuspensão que sobra", t("#sumLeft")]);
      return { D, S: [["Total", t("#sTotFal")], ["Garrafas", String(nFl)], ["Criotubos", String(nCr)]] };
    },
  };

  /* ---------- linhagem e pesquisador nas telas de origem ---------- */
  function fillWho() {
    const B = window.Bank;
    if (!B) return;
    const lines = B.lines().map((l) => l.nome), people = B.people().filter((p) => p.tipo !== "FORNECEDOR").map((p) => p.nome);
    $$(".who-row").forEach((row) => {
      [[".who-line", lines], [".who-person", people]].forEach(([sel, opts]) => {
        const el = $(sel, row), cur = el.value;
        el.innerHTML = `<option value="">Selecione…</option>` + opts.map((o) => `<option>${esc(o)}</option>`).join("");
        if (opts.includes(cur)) el.value = cur;
      });
    });
  }
  const who = (type) => { const row = $(`.who-row[data-who="${type === "plate" ? "count" : type}"]`); return row ? { lin: $(".who-line", row).value, pes: $(".who-person", row).value } : { lin: "", pes: "" }; };

  /* ---------- diálogo de salvar ---------- */
  const modal = $("#hsModal");
  let pending = null;
  function fillSel(sel, opts, ph) {
    sel.innerHTML = `<option value="">${ph}</option>` + opts.map((o) => `<option>${esc(o)}</option>`).join("");
  }
  let pendingType = null;
  if (window.Auth) window.Auth.onChange((m) => {
    if (m === "edit" && pendingType) { const tp = pendingType; pendingType = null; setTimeout(() => openSave(tp), 50); }
    else pendingType = null;
  });
  function openSave(type) {
    if (!canEdit()) {                       // pede a senha; após entrar, abre o salvamento sozinho
      pendingType = type;
      if (window.Auth) window.Auth.ask();
      return;
    }
    const r = COLLECT[type]();
    if (r.err) { toast(r.err, true); return; }
    pending = { type, ...r };
    $("#hsTitle").textContent = `Salvar ${TYPES[type].toLowerCase()} no histórico`;
    $("#hsSum").innerHTML = r.S.map(([k, val]) => `<span><em>${esc(k)}</em>${esc(val)}</span>`).join("");
    const B = window.Bank;
    fillSel($("#hrLine"), B ? B.lines().map((l) => l.nome) : [], "— não informar —");
    fillSel($("#hrPerson"), B ? B.people().filter((p) => p.tipo !== "FORNECEDOR").map((p) => p.nome) : [], "— não informar —");
    const w = who(type);
    $("#hrLine").value = w.lin; $("#hrPerson").value = w.pes;
    $("#hrDate").value = today(); $("#hrPass").value = ""; $("#hrObs").value = ""; $("#hsMsg").textContent = "";
    modal.hidden = false;
  }
  const closeSave = () => { modal.hidden = true; pending = null; };
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-hsave]");
    if (b) openSave(b.dataset.hsave);
    if (!modal.hidden && (e.target === modal || e.target.closest("[data-hs-close]"))) closeSave();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeSave(); });
  $("#hrPass").addEventListener("input", (e) => (e.target.value = e.target.value.replace(/\D/g, "").slice(0, 3)));
  $("#hsForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!pending) return;
    const rec = {
      id: uid(), type: pending.type, ts: new Date().toISOString(), data: $("#hrDate").value || today(),
      lin: $("#hrLine").value, pes: $("#hrPerson").value, pass: $("#hrPass").value, obs: $("#hrObs").value.trim(),
      summary: pending.S, details: pending.D,
    };
    if (!addRec(rec)) return;
    closeSave();
    render();
    toast(`${TYPES[rec.type]}: registro salvo no histórico. <a href="#hist">Ver histórico</a>`);
  });

  /* ---------- aviso rápido ---------- */
  let toastT;
  function toast(html, warn) {
    const el = $("#toast");
    el.innerHTML = html; el.className = "toast" + (warn ? " warn" : ""); el.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), warn ? 4000 : 5000);
  }

  /* ---------- tela do histórico ---------- */
  let tab = "";
  const open = new Set();
  function renderNote() {
    const note = $("#hNote");
    if (!note) return;
    if (!ONLINE()) { note.innerHTML = "Modo local: o histórico fica salvo <strong>neste navegador</strong>."; return; }
    if (!H().supported()) { note.innerHTML = '<b class="warn">A planilha ainda não tem a aba Histórico.</b> Atualize o código do Apps Script (Code.gs) e faça uma nova versão da implantação para sincronizar o histórico.'; return; }
    const local = loadLocal().filter((r) => !H().list().some((x) => x.id === r.id));
    note.innerHTML = "Registros salvos na <strong>Planilha Google</strong> do laboratório: todos os aparelhos veem o mesmo histórico." +
      (local.length && H().ready() ? `<br><button type="button" class="link-btn" id="hMigrate">Enviar ${local.length} ${local.length === 1 ? "registro salvo" : "registros salvos"} neste aparelho (modo de teste) para a planilha</button>` : "");
    const b = $("#hMigrate");
    if (b) b.addEventListener("click", () => {
      if (!canEdit()) { if (window.Auth) window.Auth.ask(); return; }
      if (!confirm(`Enviar ${local.length} registros do modo de teste para o histórico oficial?`)) return;
      if (H().addMany(local)) { storeLocal([]); render(); toast("Registros enviados para a planilha."); }
    });
  }
  function render() {
    renderNote();
    const all = load();
    $$("[data-hc]").forEach((el) => { const k = el.dataset.hc; el.textContent = all.filter((r) => !k || GROUP(r.type) === k).length; });
    const hc = $("#histHomeCount"); if (hc) hc.textContent = all.length ? `· ${all.length} ${all.length === 1 ? "registro" : "registros"}` : "";
    const q = ($("#hSearch").value || "").toLowerCase();
    const items = all.filter((r) => !tab || GROUP(r.type) === tab)
      .filter((r) => !q || [r.lin, r.pes, r.obs, TYPES[r.type], fmtDate(r.data)].join(" ").toLowerCase().includes(q))
      .sort((a, b) => (b.data + b.ts).localeCompare(a.data + a.ts));
    $("#hList").innerHTML = items.length ? items.map((r) => {
      const isOpen = open.has(r.id);
      return `
      <article class="hrec${isOpen ? " open" : ""}">
        <div class="hrec-head" data-hopen="${r.id}" role="button" tabindex="0">
          <div class="hrec-date"><b>${fmtDate(r.data)}</b><span>${fmtTime(r.ts)}</span></div>
          <div class="hrec-main">
            <div class="hrec-title"><span class="tag ht-${GROUP(r.type)}">${TYPES[r.type].toUpperCase()}</span><b>${esc(r.lin || "Linhagem não informada")}</b>${r.pass ? `<span class="hrec-pass">P${esc(r.pass)}</span>` : ""}</div>
            <div class="hrec-sum">${r.summary.map(([k, val]) => `<span><em>${esc(k)}</em> ${esc(val)}</span>`).join("")}</div>
            ${r.pes || r.obs ? `<div class="hrec-meta">${r.pes ? esc(r.pes) : ""}${r.pes && r.obs ? " · " : ""}${r.obs ? `<i>${esc(r.obs)}</i>` : ""}</div>` : ""}
          </div>
          <i class="chev${isOpen ? " up" : ""}">▾</i>
        </div>
        ${isOpen ? `
        <div class="hrec-body">
          <dl>${r.details.map(([k, val]) => (val === null ? `<dt class="sec">${esc(k)}</dt>` : `<dt>${esc(k)}</dt><dd>${esc(val || "—")}</dd>`)).join("")}</dl>
          <div class="hrec-actions"><button type="button" class="btn-danger sm" data-hdel="${r.id}"><span class="lock-ic" aria-hidden="true">🔒</span>Excluir registro</button></div>
        </div>` : ""}
      </article>`;
    }).join("") : `<p class="empty">${all.length ? "Nenhum registro encontrado." : "Nenhum registro salvo ainda. Use “Salvar no histórico” nas telas de cálculo."}</p>`;
  }
  $("#hTabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-htab]"); if (!b) return;
    tab = b.dataset.htab;
    $$("#hTabs [data-htab]").forEach((x) => x.classList.toggle("on", x === b));
    render();
  });
  $("#hSearch").addEventListener("input", render);
  $("#hList").addEventListener("click", (e) => {
    const d = e.target.closest("[data-hdel]");
    if (d) {
      if (!canEdit()) { if (window.Auth) window.Auth.ask(); return; }
      const r = load().find((x) => x.id === d.dataset.hdel);
      if (r && confirm(`Excluir o registro de ${TYPES[r.type].toLowerCase()} de ${fmtDate(r.data)}${r.lin ? " (" + r.lin + ")" : ""}? Essa ação não pode ser desfeita.`)) {
        if (delRec(r.id)) { open.delete(r.id); render(); }
      }
      return;
    }
    const h = e.target.closest("[data-hopen]");
    if (h) { const id = h.dataset.hopen; open.has(id) ? open.delete(id) : open.add(id); render(); }
  });
  $("#hList").addEventListener("keydown", (e) => {
    const h = e.target.closest("[data-hopen]");
    if (h && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); h.click(); }
  });
  $("#hExport").addEventListener("click", () => {
    const cell = (x) => `"${String(x ?? "").replace(/"/g, '""')}"`;
    const rows = [["TIPO", "DATA", "LINHAGEM", "PASSAGEM", "PESQUISADOR", "OBSERVAÇÃO", "DETALHES"]].concat(load().map((r) => [
      TYPES[r.type], fmtDate(r.data), r.lin, r.pass, r.pes, r.obs,
      r.details.map(([k, val]) => (val === null ? `[${k}]` : `${k}: ${val}`)).join(" | "),
    ]));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + rows.map((r) => r.map(cell).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    a.download = `historico-${today()}.csv`; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });
  document.addEventListener("viewchange", (e) => {
    if (e.detail === "hist" || e.detail === "home") render();
    if (["count", "viab", "sub"].includes(e.detail)) fillWho();
  });
  document.addEventListener("bankdata", () => setTimeout(render, 0));
  render();
  fillWho();
})();
