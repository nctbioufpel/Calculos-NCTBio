/* =========================================================
   Desenho da placa no painel verde (Plaqueamento)
   - formato automático (6, 12, 24, 48, 96)
   - PBS nas bordas das placas de 24, 48 e 96 poços
   - poços preenchidos POR COLUNA (A→H, depois a próxima coluna)
   - com várias densidades, cada uma começa numa coluna nova
     e recebe uma cor própria
   ========================================================= */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const view = $(".view-plate");
  const FORMATS = { 6: [2, 3], 12: [3, 4], 24: [4, 6], 48: [6, 8], 96: [8, 12] };
  const COLORS = ["#cfe6c8", "#9cc3ec", "#f0c987", "#d5b3f0", "#8fd9d2", "#f2a7bd", "#d8e08a", "#e3e3e3"];
  const bigOf = (v) => { const d = String(v || "").replace(/\D/g, ""); return d ? Number(d) : null; };
  const fmtInt = (n) => Math.round(n).toLocaleString("pt-BR");

  function groups() {
    if (view.dataset.pmode === "multi" && window.PlateGroups) {
      return window.PlateGroups().filter((g) => g.wells).map((g, i) => ({ key: g.L, cells: g.cells, wells: g.wells, ctrl: Math.min(g.ctrl || 0, g.wells), color: COLORS[i % COLORS.length] }));
    }
    const wells = bigOf($("#pWells").value), cells = bigOf($("#pCells").value);
    const ctrl = $("#pCtrlOn") && $("#pCtrlOn").checked ? Math.min(bigOf($("#pCtrl").value) || 0, wells || 0) : 0;
    return wells ? [{ key: "", cells, wells, ctrl, color: null }] : [];
  }

  const ROWS = "ABCDEFGH";
  let pbsMode = "edge";                       // none | edge | custom
  const pbsCols = new Set([1, 12]);           // números das colunas (1–12)
  const pbsRows = new Set();                  // letras das linhas (A–H)
  const isEdge = (f, r, c) => { const [R, C] = FORMATS[f]; return r === 0 || c === 0 || r === R - 1 || c === C - 1; };
  function isPbs(f, r, c) {
    if (pbsMode === "none") return false;
    if (pbsMode === "edge") return f >= 24 && isEdge(f, r, c);
    return pbsCols.has(c + 1) || pbsRows.has(ROWS[r]);
  }
  const blankCols = new Set();
  const ctrlCols = new Set();
  const isBlank = (f, r, c) => !isPbs(f, r, c) && blankCols.has(c + 1) && !ctrlCols.has(c + 1);
  const pbs = (f) => pbsMode !== "none" && FORMATS[f] && (pbsMode === "custom" || f >= 24);

  // coloca os grupos por coluna; align = cada grupo começa em coluna nova
  // Disposição: "seq" (A A B B), "alt" (A B A B), "gap" (A A · B B)
  let layoutMode = "seq";

  // Coloca os poços por coluna. Controles e testes de cada densidade
  // ficam em colunas próprias. pack=true: preenche contínuo (sem separar colunas)
  function place(f, gs, pack) {
    const [R, C] = FORMATS[f];
    const cols = [];
    for (let c = 0; c < C; c++) {
      const col = [];
      for (let r = 0; r < R; r++) if (!isPbs(f, r, c) && !isBlank(f, r, c)) col.push(r * C + c);
      if (col.length) { col.num = c + 1; cols.push(col); }
    }
    const map = {};
    let placed = 0;
    // colunas de controle escolhidas pelo usuário
    const chosen = cols.filter((c) => ctrlCols.has(c.num));
    if (!pack && chosen.length) {
      const free = cols.filter((c) => !ctrlCols.has(c.num));
      // controles: preenchem as colunas escolhidas por coluna (A, depois B…; alternado se escolhido)
      const ctl = gs.map((g) => ({ g, n: Math.min(g.ctrl || 0, g.wells) }));
      let ci = 0, ri = 0;
      ctl.forEach((x) => {
        x.left = 0;
        if (ri > 0) { ci++; ri = 0; }                 // cada densidade começa numa coluna de controle nova
        for (let k = 0; k < x.n; k++) {
          if (ci >= chosen.length) { x.left++; continue; }   // não coube: vai para as colunas livres
          map[chosen[ci][ri]] = { g: x.g, ctl: true }; placed++;
          if (++ri >= chosen[ci].length) { ci++; ri = 0; }
        }
      });
      // testes: nas demais colunas, conforme a disposição
      const sub = gs.map((g, i) => ({ ...g, wells: g.wells - ctl[i].n + ctl[i].left, ctrl: ctl[i].left }));
      const r2 = placeIn(free, sub);
      Object.assign(map, r2.map);
      placed += r2.placed;
      return { map, placed, ok: r2.ok };
    }
    if (pack) {
      let ci = 0, ri = 0;
      for (const g of gs) for (let k = 0; k < g.wells; k++) {
        if (ci >= cols.length) return { map, placed, ok: false };
        map[cols[ci][ri]] = { g, ctl: k < (g.ctrl || 0) };
        placed++;
        if (++ri >= cols[ci].length) { ci++; ri = 0; }
      }
      return { map, placed, ok: true };
    }
    return placeIn(cols, gs);
  }

  function placeIn(cols, gs) {
    const map = {};
    let placed = 0;
    // blocos de coluna por densidade: primeiro os controles, depois os testes
    const H = Math.max(1, ...cols.map((c) => c.length));
    const chunks = gs.map((g) => {
      const out = [];
      const ctl = Math.min(g.ctrl || 0, g.wells), test = g.wells - ctl;
      for (let n = ctl; n > 0; n -= H) out.push({ g, ctl: true, n: Math.min(H, n) });
      for (let n = test; n > 0; n -= H) out.push({ g, ctl: false, n: Math.min(H, n) });
      return out;
    });
    const seqCols = [];   // lista de blocos (ou null = coluna vazia)
    if (layoutMode === "alt") {
      const idx = chunks.map(() => 0);
      let left = chunks.reduce((s, c) => s + c.length, 0);
      while (left > 0) chunks.forEach((c, i) => { if (idx[i] < c.length) { seqCols.push(c[idx[i]++]); left--; } });
    } else {
      chunks.forEach((c, i) => { if (i > 0 && layoutMode === "gap" && c.length) seqCols.push(null); seqCols.push(...c); });
    }
    let ci = 0;
    for (const blk of seqCols) {
      if (ci >= cols.length) return { map, placed, ok: false };
      if (blk) for (let k = 0; k < blk.n && k < cols[ci].length; k++) { map[cols[ci][k]] = { g: blk.g, ctl: blk.ctl }; placed++; }
      ci++;
    }
    return { map, placed, ok: true };
  }

  function render() {
    const box = $("#plateWells");
    if (!box) return;
    const gs = groups();
    const total = gs.reduce((s, g) => s + g.wells, 0);
    const multi = gs.length > 1;

    const sel = $("#pfFormat") ? $("#pfFormat").value : "auto";
    let f = 96, res = null;
    if (sel !== "auto") {
      f = +sel;
      res = place(f, gs, false);
      if (!res.ok) { const t = place(f, gs, true); if (t.placed > res.placed) res = t; }
    } else {
      for (const cand of [6, 12, 24, 48, 96]) {
        const t = place(cand, gs, false);
        if (t.ok) { f = cand; res = t; break; }
      }
      if (!res) { res = place(96, gs, false); if (!res.ok) res = place(96, gs, true); }
    }
    renderChips(f);
    const lay = $(".pc-layout"); if (lay) lay.hidden = !multi;
    const hasCtl = gs.some((g) => g.ctrl); const pcc = $(".pc-ctrl"); if (pcc) pcc.hidden = !hasCtl;

    const [R, C] = FORMATS[f];
    // grade com identificação de colunas (1–12) e linhas (A–H) e legenda dentro dos poços
    box.style.gridTemplateColumns = `14px repeat(${C}, 1fr)`;
    box.className = "plate-wells f" + f;
    const abbr = (c, g) => {
      const n = (colNames[c + 1] || "").trim();
      if (n) { const d = n.match(/\d+/); return d ? d[0] : n.slice(0, 2); }
      return multi && g ? g.key : "";
    };
    let html = `<span></span>` + Array.from({ length: C }, (_, c) => `<span class="pl-lab">${c + 1}</span>`).join("");
    for (let i = 0; i < R * C; i++) {
      const r = Math.floor(i / C), c = i % C;
      if (c === 0) html += `<span class="pl-lab">${"ABCDEFGH"[r]}</span>`;
      const m = res.map[i], g = m && m.g;
      if (m) html += `<span class="well on${m.ctl ? " ctl" : ""}"${g.color ? ` style="--c:${g.color}"` : ""}>${m.ctl ? "CC" : abbr(c, g)}</span>`;
      else if (isPbs(f, r, c)) html += `<span class="well pbs"></span>`;
      else if (isBlank(f, r, c)) html += `<span class="well blank">B</span>`;
      else html += `<span class="well"></span>`;
    }
    box.innerHTML = html;

    // mapa poço a poço (salvo no histórico) + nomes das amostras por coluna
    const wells = [];
    const testCols = new Map();   // nº da coluna -> densidade
    for (let i = 0; i < R * C; i++) {
      const r = Math.floor(i / C), c = i % C, id = "ABCDEFGH"[r] + (c + 1);
      const m = res.map[i];
      if (m && m.ctl) wells.push({ id, t: "ctl", g: m.g.key || "" });
      else if (m) { wells.push({ id, t: "cell", g: m.g.key || "", c: c + 1 }); if (!testCols.has(c + 1)) testCols.set(c + 1, m.g.key || ""); }
      else if (isPbs(f, r, c)) wells.push({ id, t: "pbs" });
      else if (isBlank(f, r, c)) wells.push({ id, t: "blank" });
      else wells.push({ id, t: "empty" });
    }
    lastMap = { f, R, C, wells, multi };
    renderNames(testCols, multi);

    const missing = total - res.placed;
    $("#plateLabel").textContent = total
      ? `PLACA DE ${f} POÇOS · ${fmtInt(res.placed)} COM CÉLULAS${missing > 0 ? ` · ${fmtInt(missing)} NÃO COUBERAM` : ""}`
      : "PLACA DE CULTIVO";
    const leg = $("#plateLegend");
    if (leg) leg.innerHTML = !total ? "" :
      (multi ? gs.map((g) => `<span><i style="background:${g.color}"></i>${g.key}${g.cells ? ` · ${fmtInt(g.cells)}` : ""} · ${g.wells} POÇOS</span>`).join("") : "") +
      (pbsTxt(f) ? `<span><i class="lg-pbs"></i>${pbsTxt(f)}</span>` : "") +
      (gs.some((g) => g.ctrl) ? `<span><i class="lg-ctl"></i>CONTROLE · ${gs.reduce((a, g) => a + (g.ctrl || 0), 0)} POÇOS</span>` : "") +
      (blankTxt(f) ? `<span><i class="lg-blank"></i>${blankTxt(f)}</span>` : "");
    const note = $("#pfNote");
    if (note) note.innerHTML = missing > 0
      ? `<b class="warn">${fmtInt(missing)} poços não couberam na placa de ${f} poços.</b> Escolha uma placa maior ou reduza o PBS/Blank.`
      : pbsMode === "edge" && f < 24 ? "Placas de 6 e 12 poços não recebem PBS nas bordas." : "O desenho da placa ao lado mostra a distribuição dos poços.";
  }

  function blankTxt(f) {
    const C = FORMATS[f][1];
    const cs = [...blankCols].filter((c) => c <= C).sort((a, b) => a - b);
    return cs.length ? `BLANK: COL. ${cs.join(", ")}` : "";
  }
  function pbsTxt(f) {
    if (pbsMode === "none") return "";
    if (pbsMode === "edge") return f >= 24 ? "PBS NAS BORDAS" : "";
    const [R, C] = FORMATS[f];
    const cs = [...pbsCols].filter((c) => c <= C).sort((a, b) => a - b);
    const rs = [...pbsRows].filter((r) => ROWS.indexOf(r) < R).sort();
    const parts = [];
    if (cs.length) parts.push(`COL. ${cs.join(", ")}`);
    if (rs.length) parts.push(`LIN. ${rs.join(", ")}`);
    return parts.length ? `PBS: ${parts.join(" · ")}` : "";
  }
  function renderChips(f) {
    const cc = $("#pfCtrlCols");
    if (cc) cc.innerHTML = Array.from({ length: FORMATS[f][1] }, (_, i) => `<button type="button" class="${ctrlCols.has(i + 1) ? "on" : ""}" data-ccol="${i + 1}">${i + 1}</button>`).join("");
    const bb = $("#pfBlank");
    if (bb) bb.innerHTML = Array.from({ length: FORMATS[f][1] }, (_, i) => `<button type="button" class="${blankCols.has(i + 1) ? "on" : ""}" data-bcol="${i + 1}">${i + 1}</button>`).join("");
    const box = $("#pfCustom");
    if (!box) return;
    box.hidden = pbsMode !== "custom";
    if (box.hidden) return;
    const [R, C] = FORMATS[f];
    $("#pfCols").innerHTML = Array.from({ length: C }, (_, i) => `<button type="button" class="${pbsCols.has(i + 1) ? "on" : ""}" data-pcol="${i + 1}">${i + 1}</button>`).join("");
    $("#pfRows").innerHTML = Array.from({ length: R }, (_, i) => `<button type="button" class="${pbsRows.has(ROWS[i]) ? "on" : ""}" data-prow="${ROWS[i]}">${ROWS[i]}</button>`).join("");
  }
  document.querySelectorAll("#pfPbsMode [data-pbs]").forEach((b) => b.addEventListener("click", () => {
    pbsMode = b.dataset.pbs;
    document.querySelectorAll("#pfPbsMode [data-pbs]").forEach((x) => x.classList.toggle("on", x === b));
    render();
  }));
  const cfg = $(".pcfg");
  if (cfg) cfg.addEventListener("click", (e) => {
    const c = e.target.closest("[data-pcol]"), r = e.target.closest("[data-prow]"), bk = e.target.closest("[data-bcol]");
    const cq = e.target.closest("[data-ccol]");
    if (cq) { const n = +cq.dataset.ccol; if (ctrlCols.has(n)) ctrlCols.delete(n); else { ctrlCols.add(n); blankCols.delete(n); } render(); }
    if (bk) { const n = +bk.dataset.bcol; ctrlCols.delete(n); blankCols.has(n) ? blankCols.delete(n) : blankCols.add(n); render(); }
    if (c) { const n = +c.dataset.pcol; pbsCols.has(n) ? pbsCols.delete(n) : pbsCols.add(n); render(); }
    if (r) { const l = r.dataset.prow; pbsRows.has(l) ? pbsRows.delete(l) : pbsRows.add(l); render(); }
  });
  if ($("#pfFormat")) $("#pfFormat").addEventListener("change", render);
  document.querySelectorAll("#pfLayout [data-lay]").forEach((b) => b.addEventListener("click", () => {
    layoutMode = b.dataset.lay;
    document.querySelectorAll("#pfLayout [data-lay]").forEach((x) => x.classList.toggle("on", x === b));
    render();
  }));
  if ($("#pCtrlOn")) $("#pCtrlOn").addEventListener("change", () => {
    $("#pCtrlBox").hidden = !$("#pCtrlOn").checked;
    if ($("#pCtrlOn").checked) $("#pCtrl").focus();
    render();
  });

  // "Limpar campos" também volta a placa ao padrão
  /* ---------- nomes das amostras (por coluna) ---------- */
  let lastMap = null;
  const colNames = {};          // nº da coluna -> "Amostra 1"
  let namesSig = "";
  function renderNames(testCols, multi) {
    const box = $("#pfNames");
    if (!box) return;
    const sig = [...testCols].map(([c, g]) => c + g).join(",");
    $(".pc-names").hidden = !testCols.size;
    if (sig === namesSig) return;   // não redesenha enquanto digita
    namesSig = sig;
    box.innerHTML = [...testCols].map(([c, g]) => `
      <label class="nm-item"><span class="nm-col">Col. ${c}${multi && g ? ` · ${g}` : ""}</span>
        <input data-ncol="${c}" placeholder="Ex.: Amostra 1" value="${(colNames[c] || "").replace(/"/g, "&quot;")}" /></label>`).join("");
  }
  function autoNames() {
    if (!lastMap) return;
    const cols = [...new Set(lastMap.wells.filter((w) => w.t === "cell").map((w) => w.c))].sort((a, b) => a - b);
    // numera Amostra 1, 2, 3… e recomeça a cada densidade (ou a cada bloco separado por controle/blank)
    let n = 0, prevG = null, prevC = null;
    cols.forEach((c) => {
      const g = lastMap.wells.find((w) => w.c === c).g;
      const gap = prevC !== null && lastMap.wells.some((w) => { const wc = +w.id.slice(1); return wc > prevC && wc < c && (w.t === "ctl" || w.t === "blank"); });
      if (g !== prevG || gap) n = 0;
      colNames[c] = `Amostra ${++n}`;
      prevG = g; prevC = c;
    });
    namesSig = ""; render();
  }
  document.addEventListener("input", (e) => { const i = e.target.closest && e.target.closest("[data-ncol]"); if (i) { colNames[+i.dataset.ncol] = i.value; render(); } });
  document.addEventListener("click", (e) => {
    if (e.target.closest("#pfAutoNames")) autoNames();
    if (e.target.closest("#pfClearNames")) { Object.keys(colNames).forEach((k) => delete colNames[k]); namesSig = ""; render(); }
  });
  // usado pelo histórico: mapa completo da placa
  window.PlateMapData = () => {
    if (!lastMap || !lastMap.wells.some((w) => w.t === "cell" || w.t === "ctl")) return null;
    return { f: lastMap.f, R: lastMap.R, C: lastMap.C, wells: lastMap.wells.map((w) => (w.t === "cell" ? { ...w, s: (colNames[w.c] || "").trim() } : w)) };
  };

  function resetPlate() {
    Object.keys(colNames).forEach((k) => delete colNames[k]); namesSig = "";
    if ($("#pfFormat")) $("#pfFormat").value = "auto";
    pbsMode = "edge";
    pbsCols.clear(); pbsCols.add(1); pbsCols.add(12);
    pbsRows.clear(); blankCols.clear(); ctrlCols.clear();
    layoutMode = "seq";
    document.querySelectorAll("#pfPbsMode [data-pbs]").forEach((x) => x.classList.toggle("on", x.dataset.pbs === "edge"));
    document.querySelectorAll("#pfLayout [data-lay]").forEach((x) => x.classList.toggle("on", x.dataset.lay === "seq"));
    if ($("#pCtrlOn")) { $("#pCtrlOn").checked = false; $("#pCtrlBox").hidden = true; }
    render();
  }
  document.querySelectorAll("[data-clear='plate']").forEach((b) => b.addEventListener("click", () => setTimeout(resetPlate, 0)));

  const later = () => setTimeout(render, 0);
  view.addEventListener("input", later);
  view.addEventListener("click", (e) => { if (e.target.closest("[data-pmode], #btnAddDg, [data-dgdel], [data-clear='plate']")) later(); });
  document.addEventListener("viewchange", (e) => { if (e.detail === "plate") later(); });

  window.PlateMap = { update: render };
  render();
})();
