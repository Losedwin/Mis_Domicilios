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

function renderStats() {
  const entries = getEntries();
  const today = todayISO();
  const weekStart = startOfWeek(today);

  let todayGross = 0, todayCost = 0, todayProfit = 0, weekProfit = 0;

  entries.forEach((e) => {
    const { cost, profit } = computeEntry(e);
    if (e.date === today) {
      todayGross += e.pay;
      todayCost += cost;
      todayProfit += profit;
    }
    if (e.date >= weekStart && e.date <= today) {
      weekProfit += profit;
    }
  });

  document.getElementById("todayGross").textContent = money(todayGross);
  document.getElementById("todayCost").textContent = money(todayCost);
  document.getElementById("todayProfit").textContent = money(todayProfit);
  document.getElementById("weekProfit").textContent = money(weekProfit);
}

function renderHistory() {
  const entries = getEntries().slice().sort((a, b) => (a.date < b.date ? 1 : -1) || (b.id - a.id));
  const container = document.getElementById("history");
  container.innerHTML = "";

  if (entries.length === 0) {
    container.innerHTML = '<div class="empty">Todavía no has registrado domicilios.</div>';
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

document.getElementById("clearBtn").addEventListener("click", () => {
  if (confirm("¿Seguro que quieres borrar todo el historial? Esto no se puede deshacer.")) {
    setEntries([]);
    renderAll();
    showToast("Historial borrado");
  }
});

// --- inicio ---
document.getElementById("entryDate").value = todayISO();
renderAll();

// registrar service worker para que funcione offline
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
