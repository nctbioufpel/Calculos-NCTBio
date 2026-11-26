/* =========================================================
   Plaqueamento com várias densidades · diluição seriada
   Cada densidade: células/poço, volume/poço, nº de poços (+15%).
   Ordena da mais concentrada (células/mL) para a menos concentrada:
   a 1ª solução sai da solução-mãe; cada seguinte sai da anterior.
   ========================================================= */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const CORR = 1.15;
  const LEFT_MIN = 90000;
  const MIN_PIPETA = 0.01; // 10 µL

  const view = $(".view-plate");
  const fmtInt = (n) => Math.round(n).toLocaleString("pt-BR");
  const fmtDec = (n, d = 3) => n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: d });
  // volume arredondado a 1 casa, com o valor de 3 casas pequeno ao lado (referência)
  const V1 = (v) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span class="unit">mL</span> <small class="raw">(${v.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })})</small>`;
  const UNIT = (u) => ` <span class="unit">${u}</span>`;
  const plural = (n, a, b) => `${fmtInt(n)} ${Math.round(n) === 1 ? a : b}`;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function sci(n) {
    if (!isFinite(n) || n <= 0) return "—";
    const e = Math.floor(Math.log10(n));
    return `${(n / Math.pow(10, e)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × 10<sup>${e}</sup>`;
  }
  const bigOf = (v) => { const d = String(v || "").replace(/\D/g, ""); return d ? Number(d) : null; };
  const decOf = (v) => { const n = parseFloat(String(v || "").replace(",", ".")); return isFinite(n) && n > 0 ? n : null; };
  const cleanBig = (v) => { const d = v.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 12); return d ? Number(d).toLocaleString("pt-BR") : ""; };
  const cleanDec = (v) => { v = v.replace(/[^\d.,]/g, "").replace(".", ","); const p = v.split(","); return p.length > 2 ? p[0] + "," + p.slice(1).join("") : v; };
  const meas = document.createElement("canvas").getContext("2d");
  function fit(inp) {
    if (!inp || !inp.closest(".field-line")) return;
    const cs = getComputedStyle(inp);
    meas.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    inp.style.width = Math.ceil(meas.measureText(inp.value || inp.placeholder || "0").width + 6) + "px";
  }
  const LET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  let groups = [{ cells: "", wells: "", vol: "", ctrl: "" }, { cells: "", wells: "", vol: "", ctrl: "" }];

  /* ---------- modo ---------- */
  function setMode(m) {
    view.dataset.pmode = m;
    $$("[data-pmode]", view).forEach((b) => b.classList.toggle("on", b.dataset.pmode === m));
    calc();
  }
  $$("button[data-pmode]", view).forEach((b) => b.addEventListener("click", () => setMode(b.dataset.pmode)));

  /* ---------- editor de densidades ---------- */
  function render() {
    $("#dgList").innerHTML = groups.map((g, i) => `
      <div class="dg" data-i="${i}">
        <div class="dg-top">
          <span class="dg-tag">${LET[i]}</span>
          <span class="dg-name">Densidade ${LET[i]}</span>
          <span class="dg-conc" id="dgConc${i}"></span>
          ${groups.length > 1 ? `<button type="button" class="icon-btn sm del dg-del" data-dgdel="${i}" title="Remover densidade" aria-label="Remover densidade ${LET[i]}">×</button>` : ""}
        </div>
        <div class="dg-grid">
          <label class="dg-f"><span class="field-q">Células por poço</span><span class="field-line"><input class="num" data-dg="cells" inputmode="numeric" placeholder="—" value="${esc(g.cells)}" /><em class="u">células</em></span></label>
          <label class="dg-f"><span class="field-q">Volume por poço</span><span class="field-line"><input class="num" data-dg="vol" inputmode="decimal" placeholder="—" value="${esc(g.vol)}" /><em class="u">mL</em></span></label>
          <label class="dg-f"><span class="field-q">Nº de poços</span><span class="field-line"><input class="num" data-dg="wells" inputmode="numeric" placeholder="—" value="${esc(g.wells)}" /><em class="u">poços</em></span></label>
        </div>
        <small class="factor dg-fac" id="dgFac${i}"></small>
        <div class="dg-ctrl">
          <label class="dg-chk"><input type="checkbox" data-dgctrl ${g.ctrl !== "" ? "checked" : ""} /><span>Terá poços controle nesta densidade?</span></label>
          <label class="dg-f dg-ctrl-n" ${g.ctrl === "" ? "hidden" : ""}><span class="field-q">Quantos dos poços acima são controle?</span><span class="field-line"><input class="num" data-dg="ctrl" inputmode="numeric" placeholder="—" value="${esc(g.ctrl === "-" ? "" : g.ctrl)}" /><em class="u">poços</em></span></label>
        </div>
      </div>`).join("");
    $$("#dgList input").forEach(fit);
  }
  $("#btnAddDg").addEventListener("click", () => {
    if (groups.length >= 8) return;
    groups.push({ cells: "", wells: "", vol: "", ctrl: "" });
    render(); calc();
    const last = $$("#dgList .dg").pop(); if (last) $("input", last).focus();
  });
  $("#dgList").addEventListener("click", (e) => {
    const d = e.target.closest("[data-dgdel]");
    if (d) { groups.splice(+d.dataset.dgdel, 1); render(); calc(); }
  });
  $("#dgList").addEventListener("change", (e) => {
    const cb = e.target.closest("[data-dgctrl]");
    if (!cb) return;
    const i = +cb.closest(".dg").dataset.i;
    groups[i].ctrl = cb.checked ? "-" : "";      // "-" = marcado, ainda sem número
    const box = $(".dg-ctrl-n", cb.closest(".dg"));
    box.hidden = !cb.checked;
    if (cb.checked) { const inp = $("input", box); inp.value = ""; fit(inp); inp.focus(); }
    calc();
    if (window.PlateMap) window.PlateMap.update();
  });
  $("#dgList").addEventListener("input", (e) => {
    const inp = e.target.closest("[data-dg]");
    if (!inp) return;
    const k = inp.dataset.dg;
    inp.value = k === "vol" ? cleanDec(inp.value) : cleanBig(inp.value);
    groups[+inp.closest(".dg").dataset.i][k] = k === "ctrl" ? (inp.value || "-") : inp.value;
    fit(inp); calc();
  });

  /* ---------- cálculo ---------- */
  function calc() {
    if (view.dataset.pmode !== "multi") return;
    const stock = window.PlateStock ? window.PlateStock() : null;
    const resusp = decOf($("#pResusp").value);
    const Cm = stock && resusp ? stock / resusp : null; // células/mL da solução-mãe
    const msgs = [];

    // densidades válidas
    const list = groups.map((g, i) => {
      const cells = bigOf(g.cells), wells = bigOf(g.wells), vol = decOf(g.vol);
      const wc = wells ? Math.ceil(wells * CORR - 1e-9) : null;
      $("#dgFac" + i).innerHTML = wells ? `Fator de correção (+15%): ${fmtInt(wells)} × 1,15 → ${fmtInt(wc)} poços` : "";
      const C = cells && vol ? cells / vol : null;
      $("#dgConc" + i).innerHTML = C ? `${sci(C)} células/mL` : "";
      return cells && wells && vol ? { i, L: LET[i], cells, wells, wc, vol, C, Vw: wc * vol } : null;
    }).filter(Boolean).sort((a, b) => b.C - a.C);

    $("#mStock").textContent = stock ? fmtInt(stock) : "—";
    $("#mStockF").innerHTML = stock ? `Total de células no falcon (etapa anterior) · ${sci(stock)}${Cm ? ` · ${sci(Cm)} células/mL na solução-mãe` : ""}` : "Total de células contadas na etapa anterior.";

    if (!list.length) {
      $("#mNeed").textContent = "—";
      $("#dgSteps").innerHTML = `<div class="plan-row"><span>Preencha as densidades e o volume da solução-mãe para ver o preparo.</span></div>`;
      $("#mLeft").hidden = true; $("#mAlert").hidden = true;
      window.PlateLeftMulti = null; document.dispatchEvent(new Event("leftoverchange"));
      return;
    }

    // volume total de cada solução (do fim para o começo)
    for (let k = list.length - 1; k >= 0; k--) {
      const s = list[k], nx = list[k + 1];
      s.give = nx ? (nx.C * nx.T) / s.C : 0; // volume desta solução usado para preparar a próxima
      s.T = s.Vw + s.give;
    }
    list.forEach((s, k) => {
      const src = k === 0 ? Cm : list[k - 1].C;
      s.take = src ? (s.C * s.T) / src : null;           // volume da fonte
      s.medium = s.take !== null ? s.T - s.take : null;  // meio a adicionar
      s.factor = src ? src / s.C : null;
    });
    const need = list[0].C * list[0].T;
    $("#mNeed").textContent = fmtInt(need);
    $("#mNeedF").innerHTML = `${list.map((s) => `${s.L}: ${fmtInt(s.wc)} poços × ${fmtInt(s.cells)}`).join(" · ")} · ${sci(need)} (inclui a sobra de 15%)`;

    $("#dgSteps").innerHTML = list.map((s, k) => {
      const fonte = k === 0 ? "da solução-mãe" : `da Solução ${k} (${list[k - 1].L})`;
      return `
      <div class="ds">
        <div class="ds-head">
          <i class="step-ic">${k + 1}</i>
          <div><b>Solução ${k + 1} · Densidade ${s.L}</b><span>${fmtInt(s.cells)} células em ${fmtDec(s.vol)} mL por poço · ${sci(s.C)} células/mL${s.factor && k > 0 ? ` · diluição 1:${fmtDec(s.factor, 2)}` : ""}</span></div>
        </div>
        <div class="plan-row"><span>Pegue este volume ${fonte}</span><b>${s.take !== null ? V1(s.take) : "—" + UNIT("mL")}</b><small>${s.take !== null ? `${fmtDec(s.take * 1000, 1)} µL` : k === 0 ? "Informe o volume da solução-mãe." : ""}</small></div>
        <div class="plan-row"><span>Adicione este volume de meio para ter ${fmtDec(s.T)} mL de solução</span><b>${s.medium !== null ? V1(Math.max(0, s.medium)) : "—" + UNIT("mL")}</b><small>${s.take !== null ? `${fmtDec(s.T)} mL − ${fmtDec(s.take)} mL` : ""}</small></div>
        ${s.give ? `<div class="plan-row ds-first"><span><strong>Retire primeiro a alíquota para a próxima solução:</strong> separe este volume para preparar a Solução ${k + 2}</span><b>${V1(s.give)}</b><small>Homogeneíze bem antes de retirar · ${fmtInt(s.C * s.give)} células</small></div>` : ""}
        <div class="plan-row ds-use"><span>${s.give ? "Depois plaqueie" : "Plaqueie"} ${fmtDec(s.vol)} mL em cada um dos ${fmtInt(s.wells)} poços</span><b>${fmtDec(s.Vw)}${UNIT("mL")}</b><small>${fmtInt(s.wc)} poços (com +15%) × ${fmtDec(s.vol)} mL · ${fmtInt(s.wc * s.cells)} células</small></div>
      </div>`;
    }).join("");

    // avisos
    if (Cm && list[0].C > Cm) msgs.push(`<strong>Solução-mãe muito diluída:</strong> a Densidade ${list[0].L} precisa de ${sci(list[0].C)} células/mL, mas a solução-mãe tem ${sci(Cm)} células/mL. Ressuspenda o pellet em um volume menor.`);
    if (stock && need > stock) msgs.push(`<strong>Células insuficientes:</strong> você precisa de ${fmtInt(need)} células, mas a solução-mãe tem ${fmtInt(stock)}.`);
    list.forEach((s, k) => {
      if (s.take !== null && s.take > 0 && s.take < MIN_PIPETA) msgs.push(`<strong>Solução ${k + 1}:</strong> o volume a pipetar (${fmtDec(s.take * 1000, 1)} µL) é muito pequeno. Considere ressuspender em volume maior ou aumentar o volume preparado.`);
    });
    const al = $("#mAlert"); al.hidden = !msgs.length; al.innerHTML = msgs.join("<br />");

    // sobra
    const box = $("#mLeft");
    const left = stock ? stock - need : null;
    window.PlateLeftMulti = left > 0 && Cm && list[0].take !== null ? { cells: left, vol: resusp - list[0].take, conc: Cm } : null;
    document.dispatchEvent(new Event("leftoverchange"));
    if (left === null || left < 0 || !Cm) box.hidden = true;
    else {
      const good = left > LEFT_MIN;
      box.hidden = false;
      box.className = "leftover " + (good ? "good" : "bad");
      $("#mLeftTitle").textContent = good
        ? "Olha!!! Você tem células sobrando para congelar ou fazer a subcultura na garrafa novamente!"
        : "Que pena, não sobraram células o suficiente para criogenização ou subcultura";
      $("#mLeftVal").textContent = fmtInt(left);
      $("#mLeftF").innerHTML = `${fmtInt(stock)} − ${fmtInt(need)} = ${fmtInt(left)} células${left > 0 ? " · " + sci(left) : ""}${good ? "" : " · mínimo: 90.000"}`;
    }
  }

  $("#pResusp").addEventListener("input", calc);
  document.addEventListener("stockchange", calc);
  $$("[data-clear='plate']").forEach((b) => b.addEventListener("click", () => {
    groups = [{ cells: "", wells: "", vol: "", ctrl: "" }, { cells: "", wells: "", vol: "", ctrl: "" }];
    render(); calc();
  }));
  document.addEventListener("viewchange", (e) => { if (e.detail === "plate") setTimeout(() => { $$("#dgList input").forEach(fit); calc(); }, 0); });

  // usado pelo mapa da placa
  window.PlateGroups = () => groups.map((g, i) => ({ L: LET[i], cells: bigOf(g.cells), wells: bigOf(g.wells), vol: decOf(g.vol), ctrl: bigOf(g.ctrl) || 0 }));
  view.dataset.pmode = "single";
  render();
})();
