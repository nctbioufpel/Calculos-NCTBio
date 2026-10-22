/* =========================================================
   Acesso: modo EDIÇÃO (com senha) ou VISUALIZAÇÃO (Enter sem senha).
   Observação: num site estático a senha protege contra alterações
   acidentais, mas não é uma segurança forte. A senha não fica escrita
   no código; guardamos apenas um "resumo" (hash) dela.
   ========================================================= */
(function () {
  "use strict";

  const HASH = "219wu800052";           // hash de "nctbio:" + senha
  const KEY = "nctbio.modo";
  const KEY_PASS = "nctbio.senha";
  let pass = "";
  try { pass = sessionStorage.getItem(KEY_PASS) || ""; } catch (e) { /* ignora */ }
  const cyrb53 = (str, seed = 7) => {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  };

  const app = document.querySelector(".app");
  const box = document.getElementById("login");
  const input = document.getElementById("loginPass");
  const msg = document.getElementById("loginMsg");
  const pill = document.getElementById("modePill");
  const listeners = [];

  function read() {
    try { return sessionStorage.getItem(KEY); } catch (e) { return null; }
  }
  function write(m) {
    try { sessionStorage.setItem(KEY, m); } catch (e) { /* ignora */ }
  }

  function setMode(m) {
    app.dataset.mode = m;
    if (m !== "edit") { pass = ""; try { sessionStorage.removeItem(KEY_PASS); } catch (e) { /* ignora */ } }
    write(m);
    pill.innerHTML = m === "edit"
      ? `<i></i>MODO EDIÇÃO <span>· sair</span>`
      : `<i></i>MODO VISUALIZAÇÃO <span>· entrar com senha</span>`;
    listeners.forEach((fn) => fn(m));
  }

  function open() {
    box.hidden = false;
    input.value = "";
    msg.textContent = "";
    box.querySelector(".login-card").classList.remove("shake");
    setTimeout(() => input.focus(), 50);
  }
  function close() { box.hidden = true; }

  document.getElementById("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) { setMode("view"); close(); return; }
    if (cyrb53("nctbio:" + v) === HASH) {
      pass = v;
      try { sessionStorage.setItem(KEY_PASS, v); } catch (err) { /* ignora */ }
      setMode("edit"); close(); return;
    }
    msg.textContent = "Senha incorreta. Tente de novo, ou apague e pressione Enter para apenas visualizar.";
    const card = box.querySelector(".login-card");
    card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
    input.select();
  });
  input.addEventListener("input", () => (input.value = input.value.replace(/\D/g, "").slice(0, 12)));

  pill.addEventListener("click", () => {
    if (app.dataset.mode === "edit") { setMode("view"); }
    open();
  });

  window.Auth = {
    canEdit: () => app.dataset.mode === "edit",
    password: () => pass,
    onChange: (fn) => listeners.push(fn),
    ask: open,
  };

  const saved = read();
  if (saved === "edit" && pass) setMode("edit");
  else if (saved === "view") setMode("view");
  else { setMode("view"); open(); }
})();
