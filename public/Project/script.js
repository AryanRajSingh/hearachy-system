// ================================
// PROJECT DASHBOARD SCRIPT
// ================================

// LocalStorage initialization
let projects = JSON.parse(localStorage.getItem("projects")) || [];
let domainsData = [];

// Element references
const container = document.getElementById("projects-container");
const modal = document.getElementById("modal");
const projectName = document.getElementById("project-name");
const projectDomain = document.getElementById("project-domain");
const projectIndustry = document.getElementById("project-industry");
const startDate = document.getElementById("start-date");
const endDate = document.getElementById("end-date");
const modalTitle = document.getElementById("modal-title");
const isRunning = document.getElementById("is-running");
const dateWarning = document.getElementById("date-warning");
const themeToggle = document.getElementById("toggle-theme");
const searchInput = document.getElementById("search-projects");
const filterDomain = document.getElementById("filter-domain");
const filterStatus = document.getElementById("filter-status"); // New status filter
const totalProjectsElem = document.getElementById("total-projects");
const runningProjectsElem = document.getElementById("running-projects");
const completedProjectsElem = document.getElementById("completed-projects");
const chartCanvas = document.getElementById("project-chart");

let editIndex = null;
let projectChart = null;

// ================================
// DATE RESTRICTIONS
// ================================
const today = new Date().toISOString().split("T")[0];
startDate.setAttribute("max", today);
endDate.setAttribute("max", today);

// ================================
// LOAD DOMAINS FROM BACKEND
// ================================
async function loadDomains() {
  try {
    const res = await fetch("https://hearachy-system.onrender.com/api/domains");
    const data = await res.json();

    if (!Array.isArray(data)) throw new Error("Invalid domains data");
    domainsData = data;
    populateDomainDropdown();
    populateFilterDropdown();
  } catch (err) {
    console.error("❌ Error loading domains:", err);
    alert("Failed to load domains. Please check your backend connection.");
  }
}

// ================================
// POPULATE DOMAIN & INDUSTRY DROPDOWNS
// ================================
function populateDomainDropdown() {
  projectDomain.innerHTML = '<option value="">Select Domain</option>';
  domainsData.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d.name;
    opt.textContent = d.name;
    projectDomain.appendChild(opt);
  });
}

function populateFilterDropdown() {
  filterDomain.innerHTML = '<option value="">All Domains</option>';
  domainsData.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d.name;
    opt.textContent = d.name;
    filterDomain.appendChild(opt);
  });
}

// Populate industries on domain change
projectDomain.addEventListener("change", (e) => {
  const selectedDomain = domainsData.find((d) => d.name === e.target.value);
  projectIndustry.innerHTML = '<option value="">Select Industry</option>';

  if (selectedDomain && Array.isArray(selectedDomain.industries)) {
    selectedDomain.industries.forEach((ind) => {
      const opt = document.createElement("option");
      opt.value = ind.name;
      opt.textContent = ind.name;
      projectIndustry.appendChild(opt);
    });
  }
});

// ================================
// VALIDATE DATES
// ================================
function validateDates(start, end, running) {
  if (start > today) return false;
  if (!running && !end) return false;
  if (end && end > today) return false;
  if (end && start > end) return false;
  return true;
}

// ================================
// LOCAL STORAGE HELPERS
// ================================
function saveToLocalStorage() {
  localStorage.setItem("projects", JSON.stringify(projects));
}

// ================================
// UPDATE SIDEBAR STATS & CHART
// ================================
function updateSidebarStats() {
  const total = projects.length;
  const runningCount = projects.filter(p => p.running).length;
  const completedCount = total - runningCount;

  totalProjectsElem.textContent = total;
  if (runningProjectsElem) runningProjectsElem.textContent = runningCount;
  if (completedProjectsElem) completedProjectsElem.textContent = completedCount;

  const data = {
    labels: ['Running', 'Completed'],
    datasets: [{
      data: [runningCount, completedCount],
      backgroundColor: ['#36d399', '#f87171'],
      hoverOffset: 10
    }]
  };

  if (projectChart) {
    projectChart.data = data;
    projectChart.update();
  } else {
    projectChart = new Chart(chartCanvas, {
      type: 'doughnut',
      data: data,
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: document.body.classList.contains('light') ? '#111' : '#fff' }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.label}: ${context.raw} projects`;
              }
            }
          }
        }
      }
    });
  }
}

// ================================
// RENDER PROJECTS TO DASHBOARD
// ================================
function renderProjects() {
  container.innerHTML = "";

  let filteredProjects = [...projects];

  // Apply search filter
  const searchTerm = searchInput?.value.trim().toLowerCase();
  if (searchTerm) {
    filteredProjects = filteredProjects.filter(p => p.name.toLowerCase().includes(searchTerm));
  }

  // Apply domain filter
  const selectedDomain = filterDomain?.value;
  if (selectedDomain) {
    filteredProjects = filteredProjects.filter(p => p.domain === selectedDomain);
  }

  // Apply status filter
  const selectedStatus = filterStatus?.value;
  if (selectedStatus) {
    filteredProjects = filteredProjects.filter(p => {
      if (selectedStatus === 'running') return p.running;
      if (selectedStatus === 'completed') return !p.running;
      return true;
    });
  }

  if (filteredProjects.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.style.textAlign = "center";
    emptyState.style.marginTop = "3rem";
    emptyState.innerHTML = `
      <h2 style="opacity: 0.6;">No Projects Found</h2>
      <p style="opacity: 0.5;">Click <strong>"Add Project"</strong> to get started!</p>
    `;
    container.appendChild(emptyState);
    updateSidebarStats();
    return;
  }

  const domains = [...new Set(filteredProjects.map(p => p.domain))];

  domains.forEach(d => {
    const section = document.createElement("div");
    section.className = "domain-section";

    const header = document.createElement("div");
    header.className = "domain-header";
    header.innerHTML = `<span>${d}</span><span class="arrow">▼</span>`;
    section.appendChild(header);

    const projDiv = document.createElement("div");
    projDiv.className = "domain-projects";

    filteredProjects.filter(p => p.domain === d).forEach(p => {
      const card = document.createElement("div");
      card.className = "project-card";

      const status = p.running
        ? '<span style="color:lime;">🟢 Running</span>'
        : '<span style="color:red;">🔴 Completed</span>';

      card.innerHTML = `
        <h3>${p.name}</h3>
        <div class="project-details">
          <span><strong>Industry:</strong> ${p.industry}</span>
          <span><strong>Timeline:</strong> ${p.start} → ${p.end || "Ongoing"}</span>
          <span><strong>Status:</strong> ${status}</span>
        </div>
      `;

      // Edit Button
      const actions = document.createElement("div");
      actions.className = "project-actions";
      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.onclick = () => openModal("edit", projects.indexOf(p));
      actions.appendChild(editBtn);
      card.appendChild(actions);

      // Delete Button
      const delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.textContent = "×";
      delBtn.title = "Delete project";
      delBtn.onclick = () => {
        if (confirm(`Are you sure you want to delete "${p.name}"?`)) {
          projects.splice(projects.indexOf(p), 1);
          saveToLocalStorage();
          renderProjects();
        }
      };
      card.appendChild(delBtn);

      projDiv.appendChild(card);
    });

    header.onclick = () => {
      projDiv.classList.toggle("hidden");
      header.querySelector(".arrow").textContent = projDiv.classList.contains("hidden") ? "▶" : "▼";
    };

    section.appendChild(projDiv);
    container.appendChild(section);
  });

  updateSidebarStats();
}

// ================================
// MODAL MANAGEMENT
// ================================
function openModal(mode, index = null) {
  modal.classList.remove("hidden");
  dateWarning.classList.add("hidden");

  if (mode === "add") {
    modalTitle.textContent = "Add Project";
    projectName.value = "";
    projectDomain.value = "";
    projectIndustry.innerHTML = '<option value="">Select Industry</option>';
    startDate.value = "";
    endDate.value = "";
    isRunning.checked = false;
    editIndex = null;
  } else if (mode === "edit") {
    modalTitle.textContent = "Edit Project";
    const p = projects[index];
    projectName.value = p.name;
    projectDomain.value = p.domain;
    projectDomain.dispatchEvent(new Event("change"));
    projectIndustry.value = p.industry;
    startDate.value = p.start;
    endDate.value = p.end || "";
    isRunning.checked = p.running;
    editIndex = index;
  }
}

function closeModal() {
  modal.classList.add("hidden");
  editIndex = null;
}

// ================================
// ADD / EDIT PROJECT LOGIC
// ================================
document.getElementById("add-project").addEventListener("click", () => openModal("add"));
document.getElementById("cancel").addEventListener("click", closeModal);

document.getElementById("save-project").addEventListener("click", () => {
  const name = projectName.value.trim();
  const domain = projectDomain.value;
  const industry = projectIndustry.value;
  const start = startDate.value;
  const end = isRunning.checked ? null : endDate.value;
  const running = isRunning.checked;

  // Validation
  if (!name || !domain || !industry || !start || (!running && !end)) {
    alert("⚠️ Please fill all fields before saving.");
    return;
  }

  if (!validateDates(start, end, running)) {
    alert("⚠️ Invalid dates! Ensure start ≤ end and no future dates.");
    return;
  }

  const projectData = { name, domain, industry, start, end, running };

  if (editIndex !== null) {
    projects[editIndex] = projectData;
  } else {
    projects.push(projectData);
  }

  saveToLocalStorage();
  renderProjects();
  closeModal();
});

// ================================
// THEME TOGGLE WITH ICON PERSISTENCE
// ================================
function updateThemeIcon() {
  themeToggle.innerHTML = document.body.classList.contains("light") ? '<i class="ri-sun-line"></i>' : '<i class="ri-moon-line"></i>';
}

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("light");
  localStorage.setItem("theme", document.body.classList.contains("light") ? "light" : "dark");
  updateThemeIcon();
});

// Apply saved theme on load
(function restoreTheme() {
  const saved = localStorage.getItem("theme");
  if (saved === "light") document.body.classList.add("light");
  updateThemeIcon();
})();

// ================================
// SEARCH & FILTER EVENT LISTENERS
// ================================
searchInput.addEventListener("input", renderProjects);
filterDomain.addEventListener("change", renderProjects);
filterStatus.addEventListener("change", renderProjects); // Status filter

// ================================
// INITIALIZATION
// ================================
loadDomains();
renderProjects();

console.log("✅ Dashboard loaded successfully.");
