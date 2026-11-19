/* =========================================================
   Subcultura e/ou criogenização
   Coluna 1: contagem (igual à tela de contagem)
   Coluna 2: distribuição da ressuspensão em garrafas e criotubos
   ========================================================= */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const FACTOR = 10000;
  const SIZES = {
    P: { nome: "pequena", vol: 6 },
    M: { nome: "média", vol: 10 },
    G: { nome: "grande", vol: 20 },
  };

  /* ---------- formatação ---------- */
  const fmtInt = (n) => Math.round(n).toLocaleString("pt-BR");
  const fmtDec = (n, d = 3) => n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: d });
  const UNIT = (u) => ` <span class="unit">${u}</span>`;
  function sci(n) {
    if (!isFinite(n) || n <= 0) return "—";
    const e = Math.floor(Math.log10(n));
    return `${(n / Math.pow(10, e)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × 10<sup>${e}</sup>`;
  }
  const plural = (n, a, b) => `${fmtInt(n)} ${Math.round(n) === 1 ? a : b}`;
  const intVal = (inp) => (inp.value === "" ? null : Math.min(999, parseInt(inp.value, 10)));
  const decOf = (str) => {
    if (!str) return null;
    const n = parseFloat(String(str).replace(",", "."));
    return isFinite(n) && n > 0 ? n : null;
  };
  const bigOf = (str) => {
    const d = String(str || "").replace(/\D/g, "");
    return d ? Number(d) : null;
  };
  const cleanDec = (v) => {
    v = v.replace(/[^\d.,]/g, "").replace(".", ",");
    const p = v.split(",");
    return p.length > 2 ? p[0] + "," + p.slice(1).join("") : v;
  };
  const cleanBig = (v) => {
    const d = v.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 12);
    return d ? Number(d).toLocaleString("pt-BR") : "";
  };

  // campo do tamanho do número (unidade colada nele) — mesmo efeito do app.js
  const meas = document.createElement("canvas").getContext("2d");
  function fit(inp) {
    if (!inp || !inp.closest(".field-line")) return;
    const cs = getComputedStyle(inp);
    meas.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    inp.style.width = Math.ceil(meas.measureText(inp.value || inp.placeholder || "0").width + 6) + "px";
  }

  /* ---------- estado ---------- */
  let flasks = [{ size: "M", cells: "" }];
  let cryoMode = "equal";
  let cryoVols = []; // modo "volumes diferentes": mL de meio de congelamento em cada criotubo
  const DEF_VOL = "1,5";
  let cryoPlan = []; // [{vol, cells}] calculado — usado ao armazenar

  /* ---------- garrafas ---------- */
  function renderFlasks() {
    $("#flaskList").innerHTML = flasks.map((f, i) => `
      <div class="flask" data-i="${i}">
        <div class="fl-top">
          <span class="fl-name">Garrafa ${i + 1}</span>
          <div class="seg sm">${Object.keys(SIZES).map((k) => `<button type="button" class="${f.size === k ? "on" : ""}" data-fsize="${k}">${SIZES[k].nome[0].toUpperCase() + SIZES[k].nome.slice(1)} · ${SIZES[k].vol} mL</button>`).join("")}</div>
          ${flasks.length > 1 ? `<button type="button" class="icon-btn sm del fl-del" data-fdel="${i}" title="Remover garrafa" aria-label="Remover garrafa ${i + 1}">×</button>` : ""}
        </div>
        <label class="fl-field">
          <span class="field-q">Quantas células você quer nesta garrafa?</span>
          <span class="field-line"><input class="num" data-fcells="${i}" inputmode="numeric" placeholder="—" value="${f.cells}" /><em class="u">células</em></span>
        </label>
        <div class="fl-res">
          <div><span>Deixe na garrafa <b class="fl-size">${SIZES[f.size].nome}</b> este volume de meio em stand-by</span><b id="flStby${i}">—${UNIT("mL")}</b></div>
          <div><span>Depois adicione este volume da ressuspensão celular</span><b id="flAliq${i}">—${UNIT("mL")}</b></div>
        </div>
      </div>`).join("");
    $$("#flaskList input").forEach(fit);
  }
  $("#btnAddFlask").addEventListener("click", () => {
    flasks.push({ size: "M", cells: "" });
    renderFlasks(); calc();
    const inp = $(`[data-fcells="${flasks.length - 1}"]`);
    if (inp) inp.focus();
  });
  $("#flaskList").addEventListener("click", (e) => {
    const sz = e.target.closest("[data-fsize]");
    const del = e.target.closest("[data-fdel]");
    if (sz) { flasks[+sz.closest(".flask").dataset.i].size = sz.dataset.fsize; renderFlasks(); calc(); }
    if (del) { flasks.splice(+del.dataset.fdel, 1); renderFlasks(); calc(); }
  });
  $("#flaskList").addEventListener("input", (e) => {
    const inp = e.target.closest("[data-fcells]");
    if (!inp) return;
    inp.value = cleanBig(inp.value);
    flasks[+inp.dataset.fcells].cells = inp.value;
    fit(inp); calc();
  });

  /* ---------- criotubos ---------- */
  const cryoOn = $("#cryoOn"), cryoN = $("#cryoN");
  cryoOn.addEventListener("change", () => {
    $("#cryoBox").hidden = !cryoOn.checked;
    if (cryoOn.checked && !cryoN.value) { cryoN.value = "1"; fit(cryoN); }
    renderCryo(); calc();
  });
  cryoN.addEventListener("input", () => {
    cryoN.value = cryoN.value.replace(/\D/g, "").slice(0, 2);
    fit(cryoN); renderCryo(); calc();
  });
  $$("[data-cmode]").forEach((b) => b.addEventListener("click", () => {
    cryoMode = b.dataset.cmode;
    $$("[data-cmode]").forEach((x) => x.classList.toggle("on", x === b));
    $("#cryoVolEq").hidden = cryoMode !== "equal";
    renderCryo(); calc();
  }));

  function renderCryo() {
    const n = Math.min(50, parseInt(cryoN.value, 10) || 0);
    while (cryoVols.length < n) cryoVols.push(DEF_VOL);
    cryoVols.length = n;
    $("#cryoList").innerHTML = n ? `
      <div class="cr-table">
        <div class="cr-row cr-head mono"><span>Criotubo</span><span>Meio de congelamento</span><span>Células / criotubo</span></div>
        ${Array.from({ length: n }, (_, i) => `
        <div class="cr-row">
          <span class="cr-n">${i + 1}</span>
          ${cryoMode === "custom"
            ? `<span class="field-line cr-in"><input class="num" data-cvol="${i}" inputmode="decimal" placeholder="—" value="${cryoVols[i]}" /><em class="u">mL</em></span>`
            : `<b id="crVol${i}">—${UNIT("mL")}</b>`}
          <b id="crCells${i}">—</b>
        </div>`).join("")}
      </div>
      <small class="cr-note">${cryoMode === "custom" ? "Informe o volume de meio de congelamento de cada criotubo; as células são divididas na proporção do volume." : "As células restantes são divididas igualmente entre os criotubos."}</small>` : "";
    $$("#cryoList input").forEach(fit);
    renderStoreSelects();
  }
  $("#cryoList").addEventListener("input", (e) => {
    const inp = e.target.closest("[data-cvol]");
    if (!inp) return;
    inp.value = cleanDec(inp.value);
    cryoVols[+inp.dataset.cvol] = inp.value;
    fit(inp); calc();
  });

  /* ---------- cálculo ---------- */
  const qInputs = $$("[data-sc]"), sVol = $("#sVol"), sRes = $("#sRes"), cryoVol = $("#cryoVol");
  cryoVol.addEventListener("input", () => { cryoVol.value = cleanDec(cryoVol.value); fit(cryoVol); calc(); });
  sRes.addEventListener("input", () => { sRes.value = cleanDec(sRes.value); fit(sRes); });

  function calc() {
    // coluna 1 — contagem
    const vals = qInputs.map(intVal).filter((v) => v !== null);
    const nQ = vals.length;
    const soma = vals.reduce((a, b) => a + b, 0);
    const mean = nQ ? soma / nQ : null;
    const vol = decOf(sVol.value);
    $("#sTotal").textContent = nQ ? plural(soma, "célula", "células") : "—";
    $("#sQuadC").textContent = plural(nQ, "quadrante", "quadrantes");
    $("#sMean").textContent = nQ ? `${fmtDec(mean, 2)} ${mean === 1 ? "célula" : "células"}` : "—";
    const perMl = mean !== null ? mean * FACTOR : null;
    $("#sPerMl").innerHTML = perMl !== null ? `${fmtInt(perMl)} <small>(${sci(perMl)})</small>` : "—";
    const total = perMl !== null && vol ? perMl * vol : null;
    $("#sTotFal").innerHTML = total ? `${fmtInt(total)} <small>(${sci(total)})</small>` : "—";

    // coluna 2 — distribuição
    const res = decOf(sRes.value);
    const conc = total && res ? total / res : null;
    $("#subNotice").hidden = !!total;
    $("#sConc").innerHTML = conc ? `Concentração da ressuspensão: <b>${sci(conc)}</b> células/mL` : "Concentração da ressuspensão: —";

    const msgs = [];
    let flCells = 0, flVol = 0, flCount = 0;
    flasks.forEach((f, i) => {
      const cells = bigOf(f.cells);
      const sz = SIZES[f.size];
      const stby = $("#flStby" + i), aliq = $("#flAliq" + i);
      if (!stby) return;
      if (cells && conc) {
        const a = cells / conc;
        flCells += cells; flVol += a; flCount++;
        aliq.innerHTML = fmtDec(a, 3) + UNIT("mL");
        stby.innerHTML = fmtDec(Math.max(0, sz.vol - a), 3) + UNIT("mL");
        if (a > sz.vol) msgs.push(`<strong>Garrafa ${i + 1}:</strong> a alíquota (${fmtDec(a)} mL) é maior que o volume da garrafa ${sz.nome} (${sz.vol} mL). Ressuspenda o pellet em um volume menor ou escolha uma garrafa maior.`);
      } else {
        aliq.innerHTML = "—" + UNIT("mL");
        stby.innerHTML = (cells ? "—" : fmtDec(sz.vol)) + UNIT("mL");
      }
    });

    const remCells = total !== null ? total - flCells : null;
    const remVol = res !== null ? res - flVol : null;
    if (total && flCells > total) msgs.push(`<strong>Células insuficientes:</strong> as garrafas pedem ${fmtInt(flCells)} células, mas o falcon tem ${fmtInt(total)}. Reduza a quantidade de células ou de garrafas.`);

    // criotubos: o restante vai para um falcon → centrifugação → meio de congelamento
    let crCells = 0, crMedium = 0;
    cryoPlan = [];
    const n = cryoOn.checked ? Math.min(50, parseInt(cryoN.value, 10) || 0) : 0;
    const vols = Array.from({ length: n }, (_, i) => (cryoMode === "equal" ? decOf(cryoVol.value) : decOf(cryoVols[i])) || 0);
    const sumV = vols.reduce((x, y) => x + y, 0);
    const okCr = n && conc && remCells > 0 && remVol > 0;
    for (let i = 0; i < n; i++) {
      const v = vols[i];
      const c = okCr && sumV ? remCells * v / sumV : 0;
      if (okCr && v) cryoPlan.push({ vol: v, cells: c });
      const ev = $("#crVol" + i); if (ev) ev.innerHTML = (v ? fmtDec(v) : "—") + UNIT("mL");
      const ec = $("#crCells" + i); if (ec) ec.innerHTML = c ? `${fmtInt(c)} <small>(${sci(c)})</small>` : "—";
    }
    if (okCr) { crCells = cryoPlan.reduce((x, p) => x + p.cells, 0); crMedium = sumV; }
    const step = $("#cryoStep");
    if (okCr) {
      step.innerHTML = `Transfira o restante da ressuspensão (<b>${fmtDec(remVol)} mL</b> · ${fmtInt(remCells)} células) para um falcon, centrifugue e ressuspenda o pellet em <b>${sumV ? fmtDec(sumV) : "—"} mL</b> de meio de congelamento.`;
    } else {
      step.textContent = "Transfira o restante da ressuspensão para um falcon, centrifugue e ressuspenda o pellet em meio de congelamento.";
      if (n && total && remCells !== null && remCells <= 0) msgs.push("<strong>Criotubos:</strong> não sobram células para congelar depois das garrafas.");
    }
    if (n && okCr && cryoPlan.length < n) msgs.push("<strong>Criotubos:</strong> informe o volume de meio de congelamento de todos os criotubos.");
    $("#btnStoreCryo").disabled = !cryoPlan.length;

    // resumo
    $("#sumTot").innerHTML = total ? fmtInt(total) : "—";
    $("#sumTotF").innerHTML = total ? `Total de células no falcon · ${sci(total)}${res ? ` · em ${fmtDec(res)} mL de ressuspensão` : ""}` : "Total de células no falcon.";
    $("#sumFl").innerHTML = flCount ? fmtInt(flCells) : "—";
    $("#sumFlF").innerHTML = flCount ? `${plural(flCount, "garrafa", "garrafas")} · ${fmtDec(flVol)} mL da ressuspensão` : "Informe as células desejadas em cada garrafa.";
    $("#sumCr").innerHTML = n && crCells ? fmtInt(crCells) : "—";
    $("#sumCrF").innerHTML = n && crCells ? `${plural(cryoPlan.length, "criotubo", "criotubos")} · ${fmtDec(remVol)} mL da ressuspensão → ${fmtDec(crMedium)} mL de meio de congelamento` : cryoOn.checked ? "Informe o número de criotubos e o volume." : "Congelamento não selecionado.";
    const left = res !== null && conc ? (n && crCells ? 0 : res - flVol) : null;
    $("#sumLeft").innerHTML = (left !== null ? fmtDec(Math.max(0, left)) : "—") + UNIT("mL");
    $("#sumLeftF").innerHTML = left !== null && left > 1e-9 ? `≈ ${fmtInt(left * conc)} células não distribuídas` : left !== null ? "Toda a ressuspensão foi distribuída." : "";

    const al = $("#subAlert");
    al.hidden = !msgs.length;
    al.innerHTML = msgs.join("<br />");
  }
  [...qInputs, sVol, sRes].forEach((i) => i.addEventListener("input", calc));

  /* ---------- armazenar no banco de células ---------- */
  const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  function fillSel(sel, opts, ph) {
    const cur = sel.value;
    sel.innerHTML = (ph ? `<option value="">${ph}</option>` : "") + opts.map((o) => `<option value="${o.v.replace(/"/g, "&quot;")}">${o.t}</option>`).join("");
    if (opts.some((o) => o.v === cur)) sel.value = cur;
  }
  function renderStoreSelects() {
    if (!window.Bank) return;
    const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    fillSel($("#scLine"), Bank.lines().map((l) => ({ v: l.nome, t: esc(l.nome + (l.ident ? " — " + l.ident : "")) })), "Selecione…");
    fillSel($("#scPerson"), Bank.people().map((p) => ({ v: p.nome, t: esc(p.nome + (p.tipo === "FORNECEDOR" ? " (fornecedor)" : "")) })), "Selecione…");
    const lc = Bank.linesByCan();
    fillSel($("#scCan"), [1, 2, 3, 4, 5, 6].map((c) => ({ v: String(c), t: esc(`Canister ${c} — ${lc[c] && lc[c].length ? lc[c].join(", ") : "vazio"}`) })), "Selecione…");
    if (!$("#scDate").value) $("#scDate").value = today();
  }
  $("#scPass").addEventListener("input", (e) => (e.target.value = e.target.value.replace(/\D/g, "").slice(0, 3)));
  $("#btnStoreCryo").addEventListener("click", () => {
    const msg = $("#scMsg");
    msg.textContent = "";
    if (!window.Bank) return;
    if (!cryoPlan.length) return (msg.textContent = "Complete o cálculo dos criotubos primeiro.");
    const lin = $("#scLine").value, pes = $("#scPerson").value, can = +$("#scCan").value;
    if (!lin) return (msg.textContent = "Selecione a linhagem.");
    if (!pes) return (msg.textContent = "Selecione o pesquisador.");
    if (!can) return (msg.textContent = "Escolha o canister.");
    const pass = $("#scPass").value, data = $("#scDate").value || "", obs = $("#scObs").value.trim();
    const resumo = cryoPlan.map((p, i) => `  ${i + 1}) ${fmtDec(p.vol)} mL · ${fmtInt(p.cells)} células`).join("\n");
    if (!confirm(`Armazenar ${plural(cryoPlan.length, "criotubo", "criotubos")} de ${lin}${pass ? " P" + pass : ""} no canister ${can}?\n\n${resumo}`)) return;
    const round = (x) => Number(x.toPrecision(3)); // mesma precisão da planilha (ex.: 1,36E+06)
    const ev = Bank.addTubes(cryoPlan.map((p) => ({ can, lin, pass, dens: round(p.cells), data, vol: p.vol, pes, obs })));
    if (!ev) return;
    const d = $("#scDone");
    d.hidden = false;
    d.innerHTML = `<b>${plural(cryoPlan.length, "criotubo armazenado", "criotubos armazenados")}</b>
      <span>${lin}${pass ? " · P" + pass : ""} · canister ${can} · ${pes}</span>
      <div class="done-actions"><a href="#dewar" class="link-btn">Ver no botijão</a><button type="button" class="link-btn" data-sc-undo="${ev}">Desfazer</button></div>`;
    renderStoreSelects();
  });
  $("#scDone").addEventListener("click", (e) => {
    const b = e.target.closest("[data-sc-undo]");
    if (!b || !window.Bank) return;
    if (!confirm("Desfazer este armazenamento? Os criotubos serão removidos do banco.")) return;
    Bank.undo(b.dataset.scUndo);
    $("#scDone").hidden = true;
    renderStoreSelects();
  });

  /* ---------- limpar ---------- */
  $("[data-clear-sub]").addEventListener("click", () => {
    $$(".view-sub input[type=text], .view-sub input:not([type])").forEach((i) => (i.value = ""));
    flasks = [{ size: "M", cells: "" }];
    cryoVols = [];
    cryoOn.checked = false;
    cryoVol.value = DEF_VOL;
    $("#scDone").hidden = true;
    $("#cryoBox").hidden = true;
    renderFlasks(); renderCryo(); calc();
    $$(".view-sub input.num").forEach(fit);
    qInputs[0].focus();
  });

  document.addEventListener("viewchange", (e) => { if (e.detail === "sub") setTimeout(() => { $$(".view-sub input.num").forEach(fit); renderStoreSelects(); }, 0); });

  renderFlasks();
  renderCryo();
  calc();
})();
