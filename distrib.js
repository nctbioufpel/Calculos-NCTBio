/* =========================================================
   Distribuição das células que sobram no Plaqueamento
   (mesmos quadros da Subcultura: garrafas e criotubos).
   Fonte: solução-mãe que restou após retirar a alíquota.
   ========================================================= */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const view = $(".view-plate");
  const wrap = $("#leftUse"), body = $("#luBody");
  if (!wrap) return;
  const SIZES = { P: { nome: "pequena", vol: 6 }, M: { nome: "média", vol: 10 }, G: { nome: "grande", vol: 20 } };
  const DEF_VOL = "1,5";

  const fmtInt = (n) => Math.round(n).toLocaleString("pt-BR");
  const fmtDec = (n, d = 3) => n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: d });
  const UNIT = (u) => ` <span class="unit">${u}</span>`;
  const V1 = (v) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span class="unit">mL</span> <small class="raw">(${v.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })})</small>`;
  const plural = (n, a, b) => `${fmtInt(n)} ${Math.round(n) === 1 ? a : b}`;
  function sci(n) {
    if (!isFinite(n) || n <= 0) return "—";
    const e = Math.floor(Math.log10(n));
    return `${(n / Math.pow(10, e)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × 10<sup>${e}</sup>`;
  }
  // notação científica em texto simples (ex.: 4,22 × 10⁶) para o histórico
  const SUPC = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  function sciTxt(n) {
    if (!isFinite(n) || n <= 0) return "";
    const e = Math.floor(Math.log10(n));
    return `${(n / Math.pow(10, e)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × 10${String(e).split("").map((c) => SUPC[c]).join("")}`;
  }
  const decOf = (s) => { const n = parseFloat(String(s || "").replace(",", ".")); return isFinite(n) && n > 0 ? n : null; };
  const bigOf = (s) => { const d = String(s || "").replace(/\D/g, ""); return d ? Number(d) : null; };
  const cleanDec = (v) => { v = v.replace(/[^\d.,]/g, "").replace(".", ","); const p = v.split(","); return p.length > 2 ? p[0] + "," + p.slice(1).join("") : v; };
  const cleanBig = (v) => { const d = v.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 12); return d ? Number(d).toLocaleString("pt-BR") : ""; };
  const meas = document.createElement("canvas").getContext("2d");
  function fit(inp) {
    if (!inp || !inp.closest(".field-line")) return;
    const cs = getComputedStyle(inp);
    meas.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    inp.style.width = Math.ceil(meas.measureText(inp.value || inp.placeholder || "0").width + 6) + "px";
  }

  let mode = "no";
  let flasks = [{ size: "M", cells: "" }];
  let cryoOn = false, cryoN = "", cryoMode = "equal", cryoVol = DEF_VOL, cryoVols = [];
  let lastRows = [];
  let cryoPlan = [];
  const sf = { lin: "", pes: "", pass: "", can: "", date: "", obs: "" }; // formulário de armazenar
  let doneHtml = "";
  const escH = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

  const source = () => (view.dataset.pmode === "multi" ? window.PlateLeftMulti : window.PlateLeft);

  /* ---------- montagem ---------- */
  function build() {
    const n = Math.min(50, parseInt(cryoN, 10) || 0);
    while (cryoVols.length < n) cryoVols.push(DEF_VOL);
    cryoVols.length = n;
    body.innerHTML = `
      <div class="sub-block">
        <div class="sb-head"><span class="sb-title">Garrafas para subcultura</span><small>Pequena 6 mL · Média 10 mL · Grande 20 mL de meio</small></div>
        ${flasks.map((f, i) => `
        <div class="flask" data-i="${i}">
          <div class="fl-top">
            <span class="fl-name">Garrafa ${i + 1}</span>
            <div class="seg sm">${Object.keys(SIZES).map((k) => `<button type="button" class="${f.size === k ? "on" : ""}" data-fsize="${k}">${SIZES[k].nome[0].toUpperCase() + SIZES[k].nome.slice(1)} · ${SIZES[k].vol} mL</button>`).join("")}</div>
            ${flasks.length > 1 ? `<button type="button" class="icon-btn sm del fl-del" data-fdel="${i}" aria-label="Remover garrafa ${i + 1}">×</button>` : ""}
          </div>
          <label class="fl-field"><span class="field-q">Quantas células você quer nesta garrafa?</span>
            <span class="field-line"><input class="num" data-fcells="${i}" inputmode="numeric" placeholder="—" value="${f.cells}" /><em class="u">células</em></span></label>
          <div class="fl-res">
            <div><span>Deixe na garrafa <b class="fl-size">${SIZES[f.size].nome}</b> este volume de meio em stand-by</span><b data-stby="${i}">—${UNIT("mL")}</b></div>
            <div><span>Depois adicione este volume da solução-mãe que sobrou</span><b data-aliq="${i}">—${UNIT("mL")}</b></div>
          </div>
        </div>`).join("")}
        <button type="button" class="btn-clear sb-add" data-addfl>
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          Adicionar garrafa
        </button>
      </div>
      <div class="sub-block">
        <label class="sb-toggle"><input type="checkbox" data-cryoon ${cryoOn ? "checked" : ""} /><span><b>Congelar o restante em criotubos</b><small>As garrafas têm prioridade; os criotubos recebem o que sobrar.</small></span></label>
        ${cryoOn ? `
        <div class="lu-cryo">
          <div class="cryo-step" data-step></div>
          <div class="cryo-cfg">
            <label class="field sm"><span class="field-q">Quantos criotubos?</span><span class="field-line"><input class="num" data-crn inputmode="numeric" placeholder="—" value="${cryoN}" /><em class="u">criotubos</em></span></label>
            <div class="seg"><button type="button" class="${cryoMode === "equal" ? "on" : ""}" data-cmode="equal">Volumes iguais</button><button type="button" class="${cryoMode === "custom" ? "on" : ""}" data-cmode="custom">Volumes diferentes</button></div>
          </div>
          ${cryoMode === "equal" ? `<label class="field sm"><span class="field-q">Volume de meio de congelamento por criotubo</span><span class="field-line"><input class="num" data-crvol inputmode="decimal" placeholder="—" value="${cryoVol}" /><em class="u">mL</em></span></label>` : ""}
          ${n ? `<div class="cr-table">
            <div class="cr-row cr-head mono"><span>Criotubo</span><span>Meio de congelamento</span><span>Células / criotubo</span></div>
            ${Array.from({ length: n }, (_, i) => `<div class="cr-row"><span class="cr-n">${i + 1}</span>${cryoMode === "custom"
              ? `<span class="field-line cr-in"><input class="num" data-cvol="${i}" inputmode="decimal" placeholder="—" value="${cryoVols[i]}" /><em class="u">mL</em></span>`
              : `<b data-crv="${i}">—${UNIT("mL")}</b>`}<b data-crc="${i}">—</b></div>`).join("")}
          </div>` : ""}
          ${storeHtml()}
        </div>` : ""}
      </div>
      <div class="plan plan-prep lu-sum">
        <div class="prep-head mono">RESUMO DA DIVISÃO DO EXCEDENTE</div>
        <div class="plan-row"><span>Células nas garrafas</span><b data-sfl>—</b><small data-sflf></small></div>
        <div class="plan-row"><span>Células nos criotubos</span><b data-scr>—</b><small data-scrf></small></div>
        <div class="plan-row"><span>Solução-mãe que ainda sobra</span><b data-sleft>—${UNIT("mL")}</b><small data-sleftf></small></div>
      </div>
      <div class="alert" data-alert hidden></div>`;
    $$("input.num", body).forEach(fit);
    calc();
  }

  /* ---------- armazenar no banco (mesmo da Subcultura) ---------- */
  function storeHtml() {
    const B = window.Bank;
    if (!B) return "";
    if (!sf.date) sf.date = today();
    const whoRow = document.querySelector('.who-row[data-who="count"]');
    if (whoRow && !sf.lin) sf.lin = whoRow.querySelector(".who-line").value;
    if (whoRow && !sf.pes) sf.pes = whoRow.querySelector(".who-person").value;
    const opt = (v, t, cur) => `<option value="${escH(v)}"${v === cur ? " selected" : ""}>${escH(t)}</option>`;
    const lc = B.linesByCan();
    return `
      <div class="store-cryo">
        <div class="sc-head"><b>Armazenar estes criotubos no Banco de Células</b><small>Densidade e volume já vêm do cálculo acima.</small></div>
        <div class="lf-grid">
          <label class="lf-field"><span>Linhagem *</span><select data-sf="lin"><option value="">Selecione…</option>${B.lines().map((l) => opt(l.nome, l.nome + (l.ident ? " — " + l.ident : ""), sf.lin)).join("")}</select></label>
          <label class="lf-field"><span>Pesquisador *</span><select data-sf="pes"><option value="">Selecione…</option>${B.people().map((p) => opt(p.nome, p.nome + (p.tipo === "FORNECEDOR" ? " (fornecedor)" : ""), sf.pes)).join("")}</select></label>
          <label class="lf-field"><span>Passagem</span><input data-sf="pass" inputmode="numeric" placeholder="Ex.: 6" value="${escH(sf.pass)}" /></label>
          <label class="lf-field"><span>Canister *</span><select data-sf="can"><option value="">Selecione…</option>${[1, 2, 3, 4, 5, 6].map((c) => opt(String(c), `Canister ${c} — ${lc[c] && lc[c].length ? lc[c].join(", ") : "vazio"}`, sf.can)).join("")}</select></label>
          <label class="lf-field"><span>Data do congelamento</span><input data-sf="date" type="date" value="${escH(sf.date)}" /></label>
          <label class="lf-field"><span>Observações</span><input data-sf="obs" placeholder="Opcional" value="${escH(sf.obs)}" /></label>
        </div>
        <div class="lf-actions"><button type="button" class="btn-primary" data-store>Armazenar no botijão</button><span class="lf-msg" data-smsg></span></div>
        <div class="done" data-sdone ${doneHtml ? "" : "hidden"}>${doneHtml}</div>
        <div class="locked-note sc-lock">
          <svg viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.5"/></svg>
          <div><b>Modo visualização</b><span>Para armazenar no banco, entre com a senha de usuário.</span></div>
          <button type="button" class="btn-primary" data-login>Entrar com senha</button>
        </div>
      </div>`;
  }
  function store() {
    const msg = $("[data-smsg]", body);
    msg.textContent = "";
    const B = window.Bank;
    if (!B) return;
    if (!B.canEdit()) { B.ask(); return; }
    if (!cryoPlan.length) return (msg.textContent = "Complete o cálculo dos criotubos primeiro.");
    if (!sf.lin) return (msg.textContent = "Selecione a linhagem.");
    if (!sf.pes) return (msg.textContent = "Selecione o pesquisador.");
    if (!sf.can) return (msg.textContent = "Escolha o canister.");
    const resumo = cryoPlan.map((p, i) => `  ${i + 1}) ${fmtDec(p.vol)} mL · ${fmtInt(p.cells)} células`).join("\n");
    if (!confirm(`Armazenar ${plural(cryoPlan.length, "criotubo", "criotubos")} de ${sf.lin}${sf.pass ? " P" + sf.pass : ""} no canister ${sf.can}?\n\n${resumo}`)) return;
    const round = (x) => Number(x.toPrecision(3));
    const ev = B.addTubes(cryoPlan.map((p) => ({ can: +sf.can, lin: sf.lin, pass: sf.pass, dens: round(p.cells), data: sf.date || "", vol: p.vol, pes: sf.pes, obs: sf.obs })));
    if (!ev) return;
    doneHtml = `<b>${plural(cryoPlan.length, "criotubo armazenado", "criotubos armazenados")}</b>
      <span>${escH(sf.lin)}${sf.pass ? " · P" + escH(sf.pass) : ""} · canister ${sf.can} · ${escH(sf.pes)}</span>
      <div class="done-actions"><a href="#dewar" class="link-btn">Ver no botijão</a><button type="button" class="link-btn" data-sundo="${ev}">Desfazer</button></div>`;
    build();
  }

  /* ---------- cálculo ---------- */
  function calc() {
    const src = source();
    if (!src || mode !== "yes") return;
    const { cells: total, vol: res, conc } = src;
    const msgs = [];
    let flCells = 0, flVol = 0, nFl = 0;
    lastRows = [];
    flasks.forEach((f, i) => {
      const c = bigOf(f.cells), sz = SIZES[f.size];
      const st = $(`[data-stby="${i}"]`, body), al = $(`[data-aliq="${i}"]`, body);
      if (c) {
        const a = c / conc;
        flCells += c; flVol += a; nFl++;
        al.innerHTML = V1(a); st.innerHTML = V1(Math.max(0, sz.vol - a));
        lastRows.push([`Garrafa ${i + 1} · ${sz.nome} ${sz.vol} mL`, `${fmtInt(c)} células (${sciTxt(c)}) · meio ${fmtDec(Math.max(0, sz.vol - a), 1)} mL · solução-mãe ${fmtDec(a, 3)} mL`]);
        if (a > sz.vol) msgs.push(`<strong>Garrafa ${i + 1}:</strong> a alíquota (${fmtDec(a)} mL) passa do volume da garrafa ${sz.nome}.`);
      } else { al.innerHTML = "—" + UNIT("mL"); st.innerHTML = "—" + UNIT("mL"); }
    });
    if (flCells > total) msgs.push(`<strong>Células insuficientes:</strong> as garrafas pedem ${fmtInt(flCells)} células, mas sobram ${fmtInt(total)}.`);
    const remCells = total - flCells, remVol = res - flVol;

    let crCells = 0, crMed = 0, nCr = 0;
    cryoPlan = [];
    if (cryoOn) {
      const n = Math.min(50, parseInt(cryoN, 10) || 0);
      const vols = Array.from({ length: n }, (_, i) => (cryoMode === "equal" ? decOf(cryoVol) : decOf(cryoVols[i])) || 0);
      const sumV = vols.reduce((a, b) => a + b, 0);
      const ok = n && remCells > 0 && remVol > 0 && sumV;
      vols.forEach((v, i) => {
        const c = ok ? remCells * v / sumV : 0;
        const ev = $(`[data-crv="${i}"]`, body); if (ev) ev.innerHTML = (v ? fmtDec(v) : "—") + UNIT("mL");
        const ec = $(`[data-crc="${i}"]`, body); if (ec) ec.innerHTML = c ? `${fmtInt(c)} <small>(${sci(c)})</small>` : "—";
        if (c) { nCr++; cryoPlan.push({ vol: v, cells: c }); lastRows.push([`Criotubo ${i + 1}`, `${fmtDec(v)} mL · ${fmtInt(c)} células (${sciTxt(c)})`]); }
      });
      if (ok) { crCells = remCells; crMed = sumV; }
      const step = $("[data-step]", body);
      if (step) step.innerHTML = ok
        ? `Transfira o restante da solução-mãe (<b>${fmtDec(remVol)} mL</b> · ${fmtInt(remCells)} células) para um falcon, centrifugue e ressuspenda o pellet em <b>${fmtDec(sumV)} mL</b> de meio de congelamento.`
        : "Transfira o restante da solução-mãe para um falcon, centrifugue e ressuspenda o pellet em meio de congelamento.";
      if (n && remCells <= 0) msgs.push("<strong>Criotubos:</strong> não sobram células para congelar depois das garrafas.");
      const sb = $("[data-store]", body); if (sb) sb.disabled = !cryoPlan.length;
    }

    $("[data-sfl]", body).textContent = nFl ? fmtInt(flCells) : "—";
    $("[data-sflf]", body).innerHTML = nFl ? `${plural(nFl, "garrafa", "garrafas")} · ${fmtDec(flVol)} mL da solução-mãe` : "Informe as células desejadas em cada garrafa.";
    $("[data-scr]", body).textContent = crCells ? fmtInt(crCells) : "—";
    $("[data-scrf]", body).innerHTML = crCells ? `${plural(nCr, "criotubo", "criotubos")} · ${fmtDec(crMed)} mL de meio de congelamento` : cryoOn ? "Informe o número de criotubos e o volume." : "Congelamento não selecionado.";
    const left = crCells ? 0 : Math.max(0, remVol);
    $("[data-sleft]", body).innerHTML = fmtDec(left) + UNIT("mL");
    $("[data-sleftf]", body).innerHTML = left > 1e-9 ? `≈ ${fmtInt(left * conc)} células não distribuídas` : "Todo o excedente foi distribuído.";
    const al = $("[data-alert]", body); al.hidden = !msgs.length; al.innerHTML = msgs.join("<br />");
  }

  /* ---------- visibilidade ---------- */
  function refresh() {
    const src = source();
    wrap.hidden = !src;
    if (!src) return;
    $("#luSrc").innerHTML = `Sobram <b>${fmtInt(src.cells)}</b> células em <b>${fmtDec(src.vol)} mL</b> de solução-mãe · ${sci(src.conc)} células/mL`;
    body.hidden = mode !== "yes";
    calc();
  }

  /* ---------- eventos ---------- */
  $$("#luMode [data-lu]").forEach((b) => b.addEventListener("click", () => {
    mode = b.dataset.lu;
    $$("#luMode [data-lu]").forEach((x) => x.classList.toggle("on", x === b));
    body.hidden = mode !== "yes";
    if (mode === "yes") build();
  }));
  body.addEventListener("click", (e) => {
    const sz = e.target.closest("[data-fsize]"), del = e.target.closest("[data-fdel]"), cm = e.target.closest("[data-cmode]");
    if (sz) { flasks[+sz.closest(".flask").dataset.i].size = sz.dataset.fsize; build(); }
    else if (del) { flasks.splice(+del.dataset.fdel, 1); build(); }
    else if (e.target.closest("[data-addfl]")) { flasks.push({ size: "M", cells: "" }); build(); const l = $$("[data-fcells]", body).pop(); if (l) l.focus(); }
    else if (cm) { cryoMode = cm.dataset.cmode; build(); }
    else if (e.target.closest("[data-store]")) store();
    else if (e.target.closest("[data-sundo]")) {
      if (!confirm("Desfazer este armazenamento? Os criotubos serão removidos do banco.")) return;
      window.Bank.undo(e.target.closest("[data-sundo]").dataset.sundo);
      doneHtml = ""; build();
    }
  });
  body.addEventListener("change", (e) => {
    if (e.target.matches("select[data-sf], input[data-sf][type=date]")) { sf[e.target.dataset.sf] = e.target.value; return; }
    if (e.target.matches("[data-cryoon]")) { cryoOn = e.target.checked; if (cryoOn && !cryoN) cryoN = "1"; build(); }
  });
  body.addEventListener("input", (e) => {
    const t = e.target;
    if (t.matches("input[data-sf]")) { if (t.dataset.sf === "pass") t.value = t.value.replace(/\D/g, "").slice(0, 3); sf[t.dataset.sf] = t.value; return; }
    if (t.matches("[data-fcells]")) { t.value = cleanBig(t.value); flasks[+t.dataset.fcells].cells = t.value; }
    else if (t.matches("[data-crn]")) { t.value = t.value.replace(/\D/g, "").slice(0, 2); cryoN = t.value; const pos = t.value; build(); const el = $("[data-crn]", body); if (el) { el.focus(); el.setSelectionRange(pos.length, pos.length); } return; }
    else if (t.matches("[data-crvol]")) { t.value = cleanDec(t.value); cryoVol = t.value; }
    else if (t.matches("[data-cvol]")) { t.value = cleanDec(t.value); cryoVols[+t.dataset.cvol] = t.value; }
    else return;
    fit(t); calc();
  });
  document.addEventListener("leftoverchange", () => setTimeout(refresh, 0));
  view.addEventListener("click", (e) => { if (e.target.closest("[data-pmode]")) setTimeout(refresh, 0); });
  $$("[data-clear='plate']").forEach((b) => b.addEventListener("click", () => {
    Object.keys(sf).forEach((k) => (sf[k] = "")); doneHtml = "";
    mode = "no"; flasks = [{ size: "M", cells: "" }]; cryoOn = false; cryoN = ""; cryoMode = "equal"; cryoVol = DEF_VOL; cryoVols = [];
    $$("#luMode [data-lu]").forEach((x) => x.classList.toggle("on", x.dataset.lu === "no"));
    body.hidden = true; body.innerHTML = "";
    setTimeout(refresh, 0);
  }));

  // usado pelo histórico
  window.PlateLeftUse = () => (mode === "yes" && source() ? lastRows : []);
  refresh();
})();
