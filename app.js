(function () {
  "use strict";

  const app = document.querySelector(".app");
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const FACTOR = 10000;   // fator da câmara de Neubauer
  const TRYPAN = 2;       // diluição 1:1 com Azul de Trypan

  /* ---------------- Navegação ---------------- */
  function go(view) {
    if (!["home", "count", "viab", "plate", "bank", "lines", "people", "store", "take", "dewar"].includes(view)) view = "home";
    app.dataset.view = view;
    document.dispatchEvent(new CustomEvent("viewchange", { detail: view }));
    if (location.hash.slice(1) !== view) history.replaceState(null, "", "#" + view);
    window.scrollTo(0, 0);
  }
  $$("[data-go]").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));
  window.addEventListener("hashchange", () => go(location.hash.slice(1)));
  go(location.hash.slice(1) || "home");

  /* ---------------- Formatação ---------------- */
  const fmtInt = (n) => Math.round(n).toLocaleString("pt-BR");
  const fmtDec = (n, d = 2) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: d });

  function sci(n) {
    if (!isFinite(n) || n <= 0) return "—";
    const e = Math.floor(Math.log10(n));
    const m = n / Math.pow(10, e);
    return `${m.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × 10<sup>${e}</sup>`;
  }
  const plural = (n, s, p) => `${fmtInt(n)} ${n === 1 ? s : p}`;

  /* ---------------- Sanitização das entradas ---------------- */
  $$("input.int").forEach((inp) =>
    inp.addEventListener("input", () => {
      let v = inp.value.replace(/\D/g, "").slice(0, 3);
      inp.value = v;
    })
  );
  $$("input.dec").forEach((inp) =>
    inp.addEventListener("input", () => {
      let v = inp.value.replace(/[^\d.,]/g, "").replace(".", ",");
      const parts = v.split(",");
      if (parts.length > 2) v = parts[0] + "," + parts.slice(1).join("");
      inp.value = v;
    })
  );

  const intVal = (inp) => (inp.value === "" ? null : Math.min(999, parseInt(inp.value, 10)));
  const decVal = (inp) => {
    if (inp.value === "") return null;
    const n = parseFloat(inp.value.replace(",", "."));
    return isFinite(n) && n > 0 ? n : null;
  };

  /* ---------------- Contagem por quadrante ---------------- */
  const cInputs = $$("[data-c]");
  const cVol = $("#cVol");

  function calcCount() {
    const vals = cInputs.map(intVal).filter((v) => v !== null);
    const n = vals.length;
    const total = vals.reduce((a, b) => a + b, 0);
    const mean = n ? total / n : null;
    const vol = decVal(cVol);

    $("#cTotal").textContent = n ? plural(total, "célula", "células") : "—";
    $("#cQuad").textContent = plural(n, "quadrante", "quadrantes");
    $("#cMean").textContent = n ? `${fmtDec(mean, 2)} ${mean === 1 ? "célula" : "células"}` : "—";

    const perMl = mean !== null ? mean * FACTOR : null;
    $("#cPerMl").innerHTML = perMl !== null ? `${fmtInt(perMl)} <small>(${sci(perMl)})</small>` : "—";
    const tot = perMl !== null && vol ? perMl * vol : null;
    $("#cTotFal").innerHTML = tot !== null ? `${fmtInt(tot)} <small>(${sci(tot)})</small>` : "—";

    // compartilha com a tela de plaqueamento
    state.stockCells = tot && tot > 0 ? tot : null;
    if (typeof calcPlate === "function") calcPlate();
  }
  const state = { stockCells: null };
  [...cInputs, cVol].forEach((i) => i.addEventListener("input", calcCount));

  /* ---------------- Viabilidade ---------------- */
  const tInputs = $$("[data-t]");
  const sInputs = $$("[data-s]");
  const vVol = $("#vVol");

  function classify(p) {
    if (p >= 95) return "ÓTIMA";
    if (p >= 85) return "BOA";
    if (p >= 70) return "REGULAR · SINAL DE ALERTA";
    if (p >= 50) return "RUIM · ACENTUADA MORTE CELULAR";
    return "PÉSSIMA · CÉLULAS COLAPSADAS";
  }

  function calcViab() {
    const t = tInputs.map(intVal);
    const s = sInputs.map(intVal);
    const tN = t.filter((v) => v !== null).length;
    const sN = s.filter((v) => v !== null).length;
    const tSum = t.reduce((a, b) => a + (b || 0), 0);
    const sSum = s.reduce((a, b) => a + (b || 0), 0);

    $("#tQuad").textContent = plural(tN, "quadrante", "quadrantes");
    $("#sQuad").textContent = plural(sN, "quadrante", "quadrantes");
    $("#tSum").textContent = tN ? fmtInt(tSum) : "—";
    $("#sSum").textContent = sN ? fmtInt(sSum) : "—";

    const ready = tN > 0 && sN > 0 && tSum > 0;
    const unst = ready ? Math.max(0, tSum - sSum) : null;
    const pct = ready ? (unst / tSum) * 100 : null;

    $("#vUnst").textContent = unst !== null ? fmtInt(unst) : "—";
    $("#vPct").textContent = pct !== null ? `${fmtDec(pct, 1)}%` : "—";
    $("#vClass").textContent = pct !== null ? classify(pct) : "";

    const perMl = ready ? (unst / tN) * FACTOR * TRYPAN : null;
    $("#vPerMl").textContent = perMl !== null ? fmtInt(perMl) : "—";
    $("#vPerMlSci").innerHTML = perMl !== null ? sci(perMl) : "—";

    const vol = decVal(vVol);
    const total = perMl !== null && vol ? perMl * vol : null;
    $("#vTotal").textContent = total !== null ? fmtInt(total) : "—";
    $("#vTotalSci").innerHTML = total !== null ? sci(total) : "—";
    $("#vTotalHint").textContent = total !== null
      ? `${fmtInt(perMl)} células/mL × ${fmtDec(vol, 3)} mL`
      : "Informe as contagens e o volume para calcular o total.";

    const anyFilled = tN + sN > 0 || vVol.value !== "";
    const st = $(".view-viab .status");
    st.classList.toggle("busy", anyFilled);
    st.querySelector(".status-txt").textContent = anyFilled ? "EM ANDAMENTO" : "PRONTO PARA COMEÇAR";
  }
  [...tInputs, ...sInputs, vVol].forEach((i) => i.addEventListener("input", calcViab));

  /* ---------------- Plaqueamento ---------------- */
  const CORR = 1.15; // 15% a mais de poços
  const pCells = $("#pCells"), pWells = $("#pWells"), pWellVol = $("#pWellVol"), pResusp = $("#pResusp");

  // inteiros grandes com separador de milhar enquanto digita
  $$("input.big-int").forEach((inp) =>
    inp.addEventListener("input", () => {
      const d = inp.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 10);
      inp.value = d ? Number(d).toLocaleString("pt-BR") : "";
    })
  );
  const bigVal = (inp) => {
    const d = inp.value.replace(/\D/g, "");
    return d ? Number(d) : null;
  };
  const mL = (v) => `${fmtDec(v, 3)} mL`;
  const uL = (v) => `${fmtDec(v * 1000, 1)} µL`;

  function drawPlate(wells, corr) {
    let rows, cols, name;
    const n = wells || 0;
    if (n <= 6) { rows = 2; cols = 3; name = "PLACA DE 6 POÇOS"; }
    else if (n <= 12) { rows = 3; cols = 4; name = "PLACA DE 12 POÇOS"; }
    else if (n <= 24) { rows = 4; cols = 6; name = "PLACA DE 24 POÇOS"; }
    else if (n <= 48) { rows = 6; cols = 8; name = "PLACA DE 48 POÇOS"; }
    else { rows = 8; cols = 12; name = "PLACA DE 96 POÇOS"; }
    const total = rows * cols;
    const box = $("#plateWells");
    box.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    let html = "";
    for (let i = 0; i < total; i++) {
      const cls = i < n ? "well on" : i < (corr || 0) ? "well extra" : "well";
      html += `<span class="${cls}"></span>`;
    }
    box.innerHTML = html;
    $("#plateLabel").textContent = n
      ? `${name} · ${fmtInt(Math.min(n, total))} POÇOS COM CÉLULAS`
      : "PLACA DE CULTIVO";
  }

  function calcPlate() {
    const stock = state.stockCells;
    const cells = bigVal(pCells);
    const wells = bigVal(pWells);
    const wv = decVal(pWellVol);
    const rv = decVal(pResusp);

    $("#pNotice").hidden = !!stock;

    // fator de correção
    let wc = null;
    if (wells) {
      const raw = wells * CORR;
      wc = Math.ceil(raw - 1e-9);
      $("#pFactor").textContent =
        `Fator de correção (+15%): ${fmtInt(wells)} × 1,15 = ${fmtDec(raw, 2)} → ${fmtInt(wc)} poços`;
    } else {
      $("#pFactor").textContent = "Fator de correção (+15%): —";
    }
    drawPlate(wells, wc);

    // 1. células na solução-mãe
    $("#rStock").innerHTML = stock ? fmtInt(stock) : "—";
    $("#rStockF").innerHTML = stock
      ? `Total de células no falcon (etapa anterior) · ${sci(stock)}`
      : "Total de células contadas na etapa anterior.";

    // 2. células necessárias
    const need = wc && cells ? wc * cells : null;
    $("#rNeed").textContent = need ? fmtInt(need) : "—";
    $("#rNeedF").innerHTML = need
      ? `${fmtInt(wc)} poços × ${fmtInt(cells)} células · ${sci(need)}`
      : "Poços com fator de correção × células por poço.";

    // 3. alíquota da solução-mãe
    const aliq = need && stock && rv ? (need * rv) / stock : null;
    $("#rAliq").textContent = aliq !== null ? mL(aliq) : "—";
    $("#rAliqF").innerHTML = aliq !== null
      ? `${fmtInt(need)} ÷ (${fmtInt(stock)} ÷ ${fmtDec(rv, 3)} mL) = ${uL(aliq)} · concentração da solução-mãe: ${sci(stock / rv)} células/mL`
      : "Células necessárias ÷ (células da solução-mãe ÷ volume de ressuspensão).";

    // 4. volume da solução de trabalho
    const work = wc && wv ? wc * wv : null;
    $("#rWork").textContent = work !== null ? mL(work) : "—";
    $("#rWorkF").textContent = work !== null
      ? `${fmtInt(wc)} poços × ${fmtDec(wv, 3)} mL`
      : "Poços com fator de correção × volume por poço.";

    // 5. meio de cultivo para completar
    const med = work !== null && aliq !== null ? work - aliq : null;
    $("#rMedium").textContent = med !== null ? mL(Math.max(0, med)) : "—";
    $("#rMediumF").textContent = med !== null
      ? `${fmtDec(work, 3)} mL − ${fmtDec(aliq, 3)} mL`
      : "Volume da solução de trabalho − alíquota da solução-mãe.";

    // células que sobram (solução-mãe − células usadas na solução de trabalho)
    const LEFT_MIN = 90000;
    const box = $("#pLeft");
    const left = stock && need ? stock - need : null;
    if (left === null || left < 0) {
      box.hidden = true;
    } else {
      const good = left > LEFT_MIN;
      box.hidden = false;
      box.className = "leftover " + (good ? "good" : "bad");
      $("#pLeftTitle").textContent = good
        ? "Olha!!! Você tem células sobrando para congelar ou fazer a subcultura na garrafa novamente!"
        : "Que pena, não sobraram células o suficiente para criogenização ou subcultura";
      $("#pLeftVal").textContent = fmtInt(left);
      $("#pLeftF").innerHTML = `${fmtInt(stock)} − ${fmtInt(need)} = ${fmtInt(left)} células` + (left > 0 ? ` · ${sci(left)}` : "") +
        (good ? "" : ` · mínimo: ${fmtInt(LEFT_MIN)}`);
    }

    // alertas
    const msgs = [];
    if (need && stock && need > stock)
      msgs.push(`<strong>Células insuficientes:</strong> você precisa de ${fmtInt(need)} células, mas a solução-mãe tem ${fmtInt(stock)}. Reduza o número de poços ou de células por poço.`);
    if (med !== null && med < 0)
      msgs.push(`<strong>Atenção:</strong> a alíquota da solução-mãe (${mL(aliq)}) é maior que o volume total da solução de trabalho (${mL(work)}). Ressuspenda o pellet em um volume menor ou aumente o volume por poço.`);
    if (aliq !== null && rv && aliq > rv && !(need > stock))
      msgs.push(`<strong>Atenção:</strong> a alíquota é maior que o volume de ressuspensão.`);
    const al = $("#pAlert");
    al.hidden = msgs.length === 0;
    al.innerHTML = msgs.join("<br />");
  }
  [pCells, pWells, pWellVol, pResusp].forEach((i) => i.addEventListener("input", calcPlate));

  /* ---------------- Limpar ---------------- */
  $$("[data-clear]").forEach((b) =>
    b.addEventListener("click", () => {
      const scope = { count: ".view-count", viab: ".view-viab", plate: ".view-plate" }[b.dataset.clear];
      $$(scope + " input").forEach((i) => (i.value = ""));
      calcCount();
      calcViab();
      calcPlate();
      const first = document.querySelector(scope + " input");
      if (first) first.focus();
    })
  );

  /* Enter avança para o próximo campo (útil em bancada) */
  $$("input.num").forEach((inp) =>
    inp.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const all = $$(".view:not([style*='none']) input.num").filter((i) => i.offsetParent);
      const idx = all.indexOf(inp);
      if (idx > -1 && all[idx + 1]) all[idx + 1].focus();
      else inp.blur();
    })
  );

  calcCount();
  calcViab();
  calcPlate();
})();
