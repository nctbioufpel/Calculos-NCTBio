// Navegação entre ecrãs
function navigateTo(screenName) {
  document.getElementById('screen-home').classList.add('hidden');
  document.getElementById('screen-count').classList.add('hidden');
  document.getElementById('screen-viability').classList.add('hidden');
  
  document.getElementById('sidebar-hemocytometer').classList.add('hidden');
  document.getElementById('viability-info').classList.add('hidden');

  if (screenName === 'home') {
    document.getElementById('screen-home').classList.remove('hidden');
  } else if (screenName === 'count') {
    document.getElementById('screen-count').classList.remove('hidden');
    document.getElementById('sidebar-hemocytometer').classList.remove('hidden');
  } else if (screenName === 'viability') {
    document.getElementById('screen-viability').classList.remove('hidden');
    document.getElementById('sidebar-hemocytometer').classList.remove('hidden');
    document.getElementById('viability-info').classList.remove('hidden');
  }
}

// Formatação Notação Científica
function toScientificNotation(number) {
  if (isNaN(number) || number <= 0) return '—';
  return number.toExponential(2).replace('e+', ' × 10^');
}

// Lógica de Contagem por Quadrante (Tela 2)
function calculateCount() {
  const q1 = parseFloat(document.getElementById('count-q1').value) || 0;
  const q2 = parseFloat(document.getElementById('count-q2').value) || 0;
  const q3 = parseFloat(document.getElementById('count-q3').value) || 0;
  const q4 = parseFloat(document.getElementById('count-q4').value) || 0;

  let quads = 0;
  if (document.getElementById('count-q1').value !== '') quads++;
  if (document.getElementById('count-q2').value !== '') quads++;
  if (document.getElementById('count-q3').value !== '') quads++;
  if (document.getElementById('count-q4').value !== '') quads++;

  const total = q1 + q2 + q3 + q4;
  const avg = quads > 0 ? (total / quads) : 0;

  document.getElementById('res-total-count').innerText = `${total} células`;
  document.getElementById('res-quads-count').innerText = `${quads} quadrantes`;
  document.getElementById('res-avg-count').innerText = `${avg.toFixed(1)} células`;
}

function clearCountForm() {
  document.getElementById('count-q1').value = '';
  document.getElementById('count-q2').value = '';
  document.getElementById('count-q3').value = '';
  document.getElementById('count-q4').value = '';
  document.getElementById('count-volume').value = '';
  calculateCount();
}

// Lógica de Viabilidade Celular (Tela 3)
function calculateViability() {
  const t1 = parseFloat(document.getElementById('via-total-q1').value);
  const t2 = parseFloat(document.getElementById('via-total-q2').value);
  const t3 = parseFloat(document.getElementById('via-total-q3').value);
  const t4 = parseFloat(document.getElementById('via-total-q4').value);

  const s1 = parseFloat(document.getElementById('via-stained-q1').value);
  const s2 = parseFloat(document.getElementById('via-stained-q2').value);
  const s3 = parseFloat(document.getElementById('via-stained-q3').value);
  const s4 = parseFloat(document.getElementById('via-stained-q4').value);

  let quadsTotal = 0;
  let sumTotal = 0;
  [t1, t2, t3, t4].forEach(val => {
    if (!isNaN(val)) { quadsTotal++; sumTotal += val; }
  });

  let quadsStained = 0;
  let sumStained = 0;
  [s1, s2, s3, s4].forEach(val => {
    if (!isNaN(val)) { quadsStained++; sumStained += val; }
  });

  document.getElementById('via-quads-total').innerText = `${quadsTotal} quadrantes`;
  document.getElementById('via-sum-total').innerText = quadsTotal > 0 ? sumTotal : '—';

  document.getElementById('via-quads-stained').innerText = `${quadsStained} quadrantes`;
  document.getElementById('via-sum-stained').innerText = quadsStained > 0 ? sumStained : '—';

  // Cálculos Combinados
  if (quadsTotal > 0 && quadsTotal === quadsStained) {
    const nonStained = sumTotal - sumStained;
    const viabilityPct = sumTotal > 0 ? ((nonStained / sumTotal) * 100) : 0;

    document.getElementById('via-non-stained').innerText = nonStained;
    document.getElementById('via-percentage').innerText = `${viabilityPct.toFixed(1)}%`;

    // Células viáveis/mL = (Soma Não-Coradas / Quadrantes) * 10.000 * 2 (fator de diluição)
    const cellsPerMl = (nonStained / quadsTotal) * 10000 * 2;
    document.getElementById('via-cells-per-ml').innerText = cellsPerMl.toLocaleString('pt-BR');
    document.getElementById('via-sci-per-ml').innerText = `Notação científica: ${toScientificNotation(cellsPerMl)}`;

    const volume = parseFloat(document.getElementById('via-volume').value) || 0;
    if (volume > 0) {
      const totalExp = cellsPerMl * volume;
      document.getElementById('via-cells-total-exp').innerText = totalExp.toLocaleString('pt-BR');
      document.getElementById('via-sci-total-exp').innerText = `Notação científica: ${toScientificNotation(totalExp)}`;
    } else {
      document.getElementById('via-cells-total-exp').innerText = '—';
      document.getElementById('via-sci-total-exp').innerText = 'Notação científica: —';
    }
  } else {
    document.getElementById('via-non-stained').innerText = '—';
    document.getElementById('via-percentage').innerText = '—';
    document.getElementById('via-cells-per-ml').innerText = '—';
    document.getElementById('via-sci-per-ml').innerText = 'Notação científica: —';
    document.getElementById('via-cells-total-exp').innerText = '—';
    document.getElementById('via-sci-total-exp').innerText = 'Notação científica: —';
  }
}

function clearViabilityForm() {
  ['via-total-q1','via-total-q2','via-total-q3','via-total-q4',
   'via-stained-q1','via-stained-q2','via-stained-q3','via-stained-q4','via-volume'].forEach(id => {
    document.getElementById(id).value = '';
  });
  calculateViability();
}