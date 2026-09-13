// --- almacenamiento local ---
const STORAGE_RATE = "domi_rate_per_km";
const STORAGE_ENTRIES = "domi_entries";

function getRate() {
  return parseFloat(localStorage.getItem(STORAGE_RATE) || "0");
}
function setRate(v) {
  localStorage.setItem(STORAGE_RATE, String(v));
}
function getEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_ENTRIES) || "[]");
  } catch (e) {
    return [];
  }
}
function setEntries(list) {
  localStorage.setItem(STORAGE_ENTRIES, JSON.stringify(list));
}

// --- utilidades ---
function money(n) {
  const v = Math.round(n || 0);
  return "$" + v.toLocaleString("es-CO");
}
function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
function startOfWeek(dateStr) {
  // semana de lunes a domingo
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0=domingo
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1800);
}
function formatDateLabel(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "short" });
}

// --- render ---
function renderRate() {
  document.getElementById("rateDisplay").textContent = money(getRate()) + " / km";
}

function computeEntry(e) {
  const cost = e.km * e.rate;
  const profit = e.pay - cost;
  return { cost, profit };
}

// --- filtro de fechas del resumen/historial ---
let filterFrom = todayISO();
let filterTo = todayISO();

function renderStats() {
  const entries = getEntries();
  const from = filterFrom || "0000-01-01";
  const to = filterTo || "9999-12-31";

  let gross = 0, cost = 0, profit = 0, countDomicilio = 0, countCarrera = 0;

  entries.forEach((e) => {
    if (e.date >= from && e.date <= to) {
      const c = computeEntry(e);
      gross += e.pay;
      cost += c.cost;
      profit += c.profit;
      if ((e.type || "domicilio") === "carrera") countCarrera++;
      else countDomicilio++;
    }
  });

  document.getElementById("sumGross").textContent = money(gross);
  document.getElementById("sumCost").textContent = money(cost);
  document.getElementById("sumProfit").textContent = money(profit);
  document.getElementById("sumCount").textContent = countDomicilio + countCarrera;
  document.getElementById("sumCountBreakdown").textContent =
    countDomicilio + countCarrera > 0 ? `📦 ${countDomicilio} · 🧍 ${countCarrera}` : "";
}

function updateRangeLabel() {
  const label = filterFrom === filterTo
    ? (filterFrom === todayISO() ? "Resumen de hoy" : `Resumen del ${formatDateLabel(filterFrom)}`)
    : `Resumen del ${formatDateLabel(filterFrom)} al ${formatDateLabel(filterTo)}`;
  document.getElementById("rangeLabel").textContent = label;
  document.getElementById("historyRangeLabel").textContent =
    filterFrom === filterTo && filterFrom === todayISO() ? "" : `(${label.replace("Resumen ", "")})`;
}

function renderHistory() {
  const from = filterFrom || "0000-01-01";
  const to = filterTo || "9999-12-31";
  const entries = getEntries()
    .filter((e) => e.date >= from && e.date <= to)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1) || (b.id - a.id));
  const container = document.getElementById("history");
  container.innerHTML = "";

  if (entries.length === 0) {
    container.innerHTML = '<div class="empty">No hay domicilios registrados en este rango.</div>';
    return;
  }

  const byDate = {};
  entries.forEach((e) => {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  });

  Object.keys(byDate)
    .sort((a, b) => (a < b ? 1 : -1))
    .forEach((date) => {
      const dayEntries = byDate[date];
      let dayProfit = 0;
      dayEntries.forEach((e) => (dayProfit += computeEntry(e).profit));

      const details = document.createElement("details");
      details.className = "day-group";
      details.open = date === todayISO();

      const summary = document.createElement("summary");
      summary.innerHTML = `<span>${formatDateLabel(date)}</span><span class="amt">${money(dayProfit)}</span>`;
      details.appendChild(summary);

      const table = document.createElement("table");
      table.innerHTML = `
        <thead>
          <tr><th>Tipo</th><th>Km</th><th>Te pagaron</th><th>Gasolina</th><th>Ganancia</th><th></th></tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector("tbody");
      dayEntries.forEach((e) => {
        const { cost, profit } = computeEntry(e);
        const type = e.type || "domicilio";
        const typeLabel = type === "carrera" ? "Carrera" : "Domicilio";
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><span class="tag ${type}">${typeLabel}</span></td>
          <td class="num">${e.km}</td>
          <td class="num">${money(e.pay)}</td>
          <td class="num">${money(cost)}</td>
          <td class="num profit-cell">${money(profit)}</td>
          <td class="num"><button class="del" data-id="${e.id}">✕</button></td>
        `;
        tbody.appendChild(tr);
      });
      details.appendChild(table);
      container.appendChild(details);
    });

  container.querySelectorAll(".del").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-id"));
      const remaining = getEntries().filter((e) => e.id !== id);
      setEntries(remaining);
      renderAll();
      showToast("Domicilio eliminado");
    });
  });
}

function renderAll() {
  renderRate();
  updateRangeLabel();
  renderStats();
  renderHistory();
}

// --- eventos ---
document.getElementById("saveRateBtn").addEventListener("click", () => {
  const input = document.getElementById("rateInput");
  const val = parseFloat(input.value);
  if (isNaN(val) || val < 0) {
    showToast("Ingresa un valor válido");
    return;
  }
  setRate(val);
  input.value = "";
  renderAll();
  showToast("Valor por km actualizado");
});

let currentType = "domicilio";

const TYPE_LABELS = {
  domicilio: { name: "Domicilio", pickup: "Km hasta el punto de recogida", drop: "Km hasta el destino" },
  carrera: { name: "Carrera", pickup: "Km hasta donde recoges al pasajero", drop: "Km hasta el destino" },
};

document.querySelectorAll(".type-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentType = btn.getAttribute("data-type");
    document.querySelectorAll(".type-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("labelKmPickup").textContent = TYPE_LABELS[currentType].pickup;
    document.getElementById("labelKmDrop").textContent = TYPE_LABELS[currentType].drop;
  });
});

document.getElementById("addEntryBtn").addEventListener("click", () => {
  const dateEl = document.getElementById("entryDate");
  const kmPickupEl = document.getElementById("entryKmPickup");
  const kmDropEl = document.getElementById("entryKmDrop");
  const payEl = document.getElementById("entryPay");

  const date = dateEl.value || todayISO();
  const kmPickup = parseFloat(kmPickupEl.value) || 0;
  const kmDrop = parseFloat(kmDropEl.value) || 0;
  const km = kmPickup + kmDrop;
  const pay = parseFloat(payEl.value);

  if (km <= 0 || isNaN(pay) || pay < 0) {
    showToast("Revisa los kilómetros y el pago");
    return;
  }

  const entries = getEntries();
  entries.push({
    id: Date.now(),
    date,
    type: currentType,
    kmPickup,
    kmDrop,
    km,
    pay,
    rate: getRate(),
  });
  setEntries(entries);

  kmPickupEl.value = "";
  kmDropEl.value = "";
  payEl.value = "";
  renderAll();
  showToast(TYPE_LABELS[currentType].name + " agregado" + (currentType === "domicilio" ? "" : "a"));
});

// --- filtros del resumen ---
function setQuickActive(range) {
  document.querySelectorAll(".qf-btn").forEach((b) => b.classList.remove("active"));
  const btn = document.querySelector(`.qf-btn[data-range="${range}"]`);
  if (btn) btn.classList.add("active");
}

document.querySelectorAll(".qf-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const range = btn.getAttribute("data-range");
    const today = todayISO();
    if (range === "today") {
      filterFrom = today;
      filterTo = today;
    } else if (range === "yesterday") {
      const d = new Date(today + "T00:00:00");
      d.setDate(d.getDate() - 1);
      const y = d.toISOString().slice(0, 10);
      filterFrom = y;
      filterTo = y;
    } else if (range === "week") {
      filterFrom = startOfWeek(today);
      filterTo = today;
    } else if (range === "all") {
      const entries = getEntries();
      filterFrom = entries.length ? entries.reduce((min, e) => (e.date < min ? e.date : min), entries[0].date) : today;
      filterTo = today;
    }
    document.getElementById("filterFrom").value = filterFrom;
    document.getElementById("filterTo").value = filterTo;
    setQuickActive(range);
    renderAll();
  });
});

document.getElementById("filterFrom").addEventListener("change", (e) => {
  filterFrom = e.target.value;
  if (filterTo < filterFrom) filterTo = filterFrom;
  document.getElementById("filterTo").value = filterTo;
  setQuickActive(null);
  renderAll();
});
document.getElementById("filterTo").addEventListener("change", (e) => {
  filterTo = e.target.value;
  if (filterFrom > filterTo) filterFrom = filterTo;
  document.getElementById("filterFrom").value = filterFrom;
  setQuickActive(null);
  renderAll();
});

// --- botón "Hoy" y aviso de fecha pasada en el formulario de registro ---
document.getElementById("todayBtn").addEventListener("click", () => {
  document.getElementById("entryDate").value = todayISO();
  document.getElementById("dateNote").style.display = "none";
});
document.getElementById("entryDate").addEventListener("change", (e) => {
  document.getElementById("dateNote").style.display = e.target.value < todayISO() ? "block" : "none";
});

document.getElementById("clearBtn").addEventListener("click", () => {
  if (confirm("¿Seguro que quieres borrar todo el historial? Esto no se puede deshacer.")) {
    setEntries([]);
    renderAll();
    showToast("Historial borrado");
  }
});

// --- inicio ---
document.getElementById("entryDate").value = todayISO();
document.getElementById("filterFrom").value = filterFrom;
document.getElementById("filterTo").value = filterTo;
renderAll();

// Mientras estamos en fase de pruebas, desactivamos el service worker:
// esto limpia cualquier versión vieja guardada en caché en el celular
// y evita que sirva código desactualizado mientras seguimos cambiando cosas.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister());
  });
}
if (window.caches) {
  caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
}

