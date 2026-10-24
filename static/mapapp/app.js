(() => {
  "use strict";

  const algeriaBounds = L.latLngBounds([18.8, -8.8], [37.2, 12.1]);
  const map = L.map("map", {
    zoomControl: false,
    preferCanvas: true,
    maxBounds: algeriaBounds,
    maxBoundsViscosity: 1
  }).setView([28.1, 2.6], 5);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.control.scale({ position: "bottomright", metric: true, imperial: false, maxWidth: 100 }).addTo(map);

  const results = document.getElementById("results");
  const search = document.getElementById("search");
  const mapError = document.getElementById("map-error");
  const selectionCard = document.getElementById("selection-card");
  const contextBack = document.getElementById("context-back");
  const optionsToggle = document.getElementById("list-options-toggle");
  const optionsPanel = document.getElementById("list-options");
  const languageSelect = document.getElementById("display-language");
  const sortSelect = document.getElementById("sort-order");
  const filters = [...document.querySelectorAll(".filter")];
  let wilayas = [];
  let communes = [];
  let wilayaLayer;
  let communeLayer;
  let activeWilaya = null;
  let selectedCommune = null;
  let level = "wilaya";
  let labelsEnabled = false;
  let displayLanguage = "fr";
  let sortOrder = "name";

  const normalize = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const wilayaName = feature => feature.properties[`name_${displayLanguage}`] || feature.properties.name_fr || `Wilaya ${feature.properties.code}`;
  const communeName = feature => feature.properties[`name_${displayLanguage}`] || feature.properties.name_fr || `Commune ${feature.properties.postal_code || ""}`.trim();

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function communeTooltip(feature) {
    const name = escapeHtml(communeName(feature));
    const arabic = displayLanguage === "fr" && feature.properties.name_ar
      ? `<br><span lang="ar" dir="rtl">${escapeHtml(feature.properties.name_ar)}</span>`
      : "";
    return `<strong>${name}</strong>${arabic}`;
  }

  function updateLabels() {
    if (!wilayaLayer || !communeLayer) return;
    wilayaLayer.eachLayer(layer => labelsEnabled ? layer.openTooltip() : layer.closeTooltip());
    communeLayer.eachLayer(layer => labelsEnabled ? layer.openTooltip() : layer.closeTooltip());
  }

  function initializeLayers() {
    const wilayaByCode = new Map(
      window.ALG_MAP_WILAYA_RECORDS.map(record => [Number(record.code), record])
    );

    wilayas.forEach(feature => {
      const code = Number(feature.properties.code);
      const record = wilayaByCode.get(code);
      if (!record) throw new Error(`No name record found for wilaya code ${code}.`);
      feature.properties.name_fr = record.name_fr;
      feature.properties.name_ar = record.name_ar;
      feature.properties.name_en = record.name_en;
      feature.properties.created = record.created;
      feature.properties.communes_count = record.communes_count;
      feature.properties.dairas_count = record.dairas_count;
      feature.properties.capital_commune_code = record.capital_commune_code;
    });

    const wilayaCollection = { type: "FeatureCollection", features: wilayas };
    wilayaLayer = L.geoJSON(wilayaCollection, {
      style: { color: "#7595a1", weight: 1.35, opacity: 1, fillColor: "#3d6170", fillOpacity: 0.9 },
      onEachFeature: (feature, layer) => {
        layer.feature = feature;
        layer.bindTooltip(`<strong>${escapeHtml(wilayaName(feature))}</strong>`, {
          sticky: true,
          direction: "top",
          className: "map-tooltip"
        });
        layer.on({
          mouseover: () => {
            if (activeWilaya !== feature) layer.setStyle({ color: "#a4bbc2", weight: 2.2, fillColor: "#527889", fillOpacity: 0.98 });
            layer.bringToFront();
          },
          mouseout: () => {
            if (activeWilaya !== feature) wilayaLayer.resetStyle(layer);
          },
          click: () => openWilaya(feature)
        });
      }
    }).addTo(map);

    communeLayer = L.layerGroup();
    communes.forEach(feature => {
      feature.properties.wilaya_code = Number(feature.properties.wilaya_code);
      const communePolygon = L.geoJSON(feature, {
        style: communeBaseStyle,
        onEachFeature: (commune, layer) => {
          layer.feature = commune;
          layer.bindTooltip(communeTooltip(commune), {
            sticky: true,
            direction: "top",
            className: "map-tooltip"
          });
          layer.on({
            mouseover: () => {
              if (selectedCommune !== commune) {
                layer.setStyle({ color: "#a0b7bf", weight: 1.7, fillColor: "#557b8a", fillOpacity: 0.98 });
              }
              layer.bringToFront();
            },
            mouseout: () => {
              if (selectedCommune !== commune) layer.setStyle(communeBaseStyle);
            },
            click: () => selectCommune(commune)
          });
        }
      });
      feature.layer = communePolygon.getLayers()[0];
    });

    const algeriaShapeBounds = wilayaLayer.getBounds();
    const minZoom = map.getBoundsZoom(algeriaShapeBounds, false, [24, 24]);
    map.setMinZoom(minZoom);
    map.fitBounds(algeriaShapeBounds, { padding: [24, 24], animate: false });
    map.setMaxBounds(algeriaShapeBounds.pad(0.025));
    document.getElementById("all-count").textContent = wilayas.length + communes.length;
    document.getElementById("wilaya-count").textContent = wilayas.length;
    document.getElementById("commune-count").textContent = communes.length.toLocaleString();
    renderResults();
    updateSortOptions();
  }

  function updateSortOptions() {
    const countsSort = sortSelect.querySelector('option[value="communes"]');
    const showingWilayas = !activeWilaya && level === "wilaya";
    countsSort.disabled = !showingWilayas;
    if (countsSort.disabled && sortOrder === "communes") {
      sortOrder = "name";
      sortSelect.value = sortOrder;
    }
  }

  window.addEventListener("resize", () => {
    if (!wilayaLayer) return;
    map.invalidateSize();
    const bounds = wilayaLayer.getBounds();
    map.setMinZoom(map.getBoundsZoom(bounds, false, [24, 24]));
  });

  function setActiveFilter(value) {
    level = value;
    filters.forEach(button => button.classList.toggle("active", button.dataset.level === value));
  }

  function clearSelection() {
    activeWilaya = null;
    selectedCommune = null;
    selectionCard.hidden = true;
    contextBack.hidden = true;
    if (map.hasLayer(communeLayer)) map.removeLayer(communeLayer);
    wilayaLayer.eachLayer(layer => wilayaLayer.resetStyle(layer));
  }

  function openWilaya(feature) {
    clearSelection();
    activeWilaya = feature;
    selectedCommune = null;
    contextBack.hidden = false;
    showWilayaDetails(feature);

    const boundary = findWilayaLayer(feature);
    if (boundary) {
      boundary.setStyle({ color: "#ff9a7e", weight: 2.8, fillColor: "#ef8e75", fillOpacity: 0.96 });
      boundary.bringToFront();
      map.fitBounds(boundary.getBounds(), { padding: [42, 42], maxZoom: 9 });
    }
    setActiveFilter("commune");
    refreshCommunes();
    updateSortOptions();
    renderResults();
  }

  function showWilayaDetails(feature) {
    const capital = communes.find(commune =>
      Number(commune.properties.code_commune) === Number(feature.properties.capital_commune_code)
    );
    showSelectionCard(wilayaName(feature), `Wilaya ${String(feature.properties.code).padStart(2, "0")}`, [
      ["Capital", capital ? communeName(capital) : "Not listed"],
      ["Communes", Number(feature.properties.communes_count).toLocaleString()],
      ["Dairas", Number(feature.properties.dairas_count).toLocaleString()],
      ["Established", String(feature.properties.created)]
    ]);
  }

  function findWilayaLayer(feature) {
    let found = null;
    if (wilayaLayer) wilayaLayer.eachLayer(layer => {
      if (layer.feature === feature) found = layer;
    });
    return found;
  }

  function visibleCommunes() {
    return activeWilaya
      ? communes.filter(feature => feature.properties.wilaya_code === Number(activeWilaya.properties.code))
      : communes;
  }

  function communeBaseStyle() {
    return { color: "#89a7b1", weight: 0.8, opacity: 1, fillColor: "#496d7b", fillOpacity: 0.94 };
  }

  function showSelectionCard(title, subtitle, facts) {
    selectionCard.replaceChildren();
    const heading = document.createElement("strong");
    heading.textContent = title;
    const descriptor = document.createElement("span");
    descriptor.className = "selection-subtitle";
    descriptor.textContent = subtitle;
    const grid = document.createElement("div");
    grid.className = "selection-facts";
    facts.forEach(([label, value]) => {
      const item = document.createElement("div");
      item.className = "selection-fact";
      const factLabel = document.createElement("span");
      factLabel.textContent = label;
      const factValue = document.createElement("strong");
      factValue.textContent = value;
      item.append(factLabel, factValue);
      grid.append(item);
    });
    selectionCard.append(heading, descriptor, grid);
    selectionCard.hidden = false;
  }

  function refreshCommunes() {
    if (!communeLayer) return;
    communeLayer.clearLayers();
    if (level === "wilaya") {
      if (map.hasLayer(communeLayer)) map.removeLayer(communeLayer);
      return;
    }
    visibleCommunes().forEach(feature => {
      const polygon = feature.layer;
      if (feature === selectedCommune) {
        polygon.setStyle({ color: "#ffad91", weight: 1.8, fillColor: "#e9826b", fillOpacity: 0.98 });
      } else {
        polygon.setStyle(communeBaseStyle());
      }
      communeLayer.addLayer(polygon);
    });
    if (!map.hasLayer(communeLayer)) communeLayer.addTo(map);
  }

  function selectCommune(feature) {
    selectedCommune = feature;
    refreshCommunes();
    showCommuneDetails(feature);
    renderResults();
  }

  function showCommuneDetails(feature) {
    const parent = wilayas.find(wilaya => Number(wilaya.properties.code) === feature.properties.wilaya_code);
    const facts = [
      ["Wilaya", parent ? wilayaName(parent) : `Wilaya ${feature.properties.wilaya_code}`],
      ["Daira", feature.properties.daira || "Not listed"],
      ["Commune code", feature.properties.code_commune ? String(feature.properties.code_commune) : "Not listed"],
      ["Postal code", feature.properties.postal_code || "Not listed"]
    ];
    showSelectionCard(communeName(feature), "Commune details", facts);
    if (feature.properties.name_ar) {
      const arabicName = document.createElement("span");
      arabicName.className = "selection-arabic";
      arabicName.lang = "ar";
      arabicName.dir = "rtl";
      arabicName.textContent = feature.properties.name_ar;
      selectionCard.insertBefore(arabicName, selectionCard.querySelector(".selection-facts"));
    }
  }

  function sortEntries(entries) {
    return entries.sort((a, b) => {
      if (sortOrder === "code") {
        const codeA = Number(a.feature.properties.code ?? a.feature.properties.code_commune);
        const codeB = Number(b.feature.properties.code ?? b.feature.properties.code_commune);
        return codeA - codeB;
      }
      if (sortOrder === "communes" && a.kind === "wilaya" && b.kind === "wilaya") {
        return Number(b.feature.properties.communes_count) - Number(a.feature.properties.communes_count) ||
          wilayaName(a.feature).localeCompare(wilayaName(b.feature));
      }
      const nameA = a.kind === "wilaya" ? wilayaName(a.feature) : communeName(a.feature);
      const nameB = b.kind === "wilaya" ? wilayaName(b.feature) : communeName(b.feature);
      return nameA.localeCompare(nameB, displayLanguage === "ar" ? "ar" : "fr");
    });
  }

  function visibleEntries() {
    const query = normalize(search.value);
    if (activeWilaya) {
      return sortEntries(visibleCommunes().filter(feature =>
        normalize(communeName(feature)).includes(query) ||
        normalize(feature.properties.name_fr || "").includes(query) ||
        normalize(feature.properties.name_ar || "").includes(query) ||
        normalize(feature.properties.daira || "").includes(query)
      ).map(feature => ({ feature, kind: "commune" })));
    }
    const entries = [];
    if (level !== "commune") entries.push(...wilayas.map(feature => ({ feature, kind: "wilaya" })));
    if (level !== "wilaya") entries.push(...communes.map(feature => ({ feature, kind: "commune" })));
    return sortEntries(entries.filter(({ feature, kind }) => {
      if (!query) return true;
      if (kind === "wilaya") {
        return normalize(wilayaName(feature)).includes(query) ||
          normalize(feature.properties.name_fr || "").includes(query) ||
          normalize(feature.properties.name_ar || "").includes(query);
      }
      return normalize(communeName(feature)).includes(query) ||
        normalize(feature.properties.name_fr || "").includes(query) ||
        normalize(feature.properties.name_ar || "").includes(query);
    }));
  }

  function renderResults() {
    if (!wilayas.length || !communes.length) return;
    const entries = visibleEntries();
    const shown = entries.slice(0, 250);
    document.getElementById("results-title").textContent = activeWilaya
      ? `Communes in ${wilayaName(activeWilaya)}`
      : level === "commune" ? "Communes" : level === "all" ? "Wilayas & communes" : "Wilayas";
    document.getElementById("results-count").textContent =
      entries.length > shown.length ? `${shown.length} of ${entries.length}` : `${entries.length} found`;
    results.replaceChildren();

    if (!shown.length) {
      const empty = document.createElement("div");
      empty.className = "empty-results";
      empty.textContent = "No matching places. Try another name.";
      results.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    shown.forEach(({ feature, kind }) => {
      const isWilaya = kind === "wilaya";
      const button = document.createElement("button");
      button.type = "button";
      button.className = `location-row${feature === activeWilaya || feature === selectedCommune ? " selected" : ""}`;
      button.dataset.kind = kind;

      const mark = document.createElement("span");
      mark.className = "location-mark";
      mark.textContent = isWilaya ? String(feature.properties.code).padStart(2, "0") : "C";
      const details = document.createElement("span");
      details.className = "location-details";
      const name = document.createElement("span");
      name.className = "location-name";
      name.textContent = isWilaya ? wilayaName(feature) : communeName(feature);
      name.lang = displayLanguage;
      name.dir = displayLanguage === "ar" ? "rtl" : "ltr";
      details.append(name);

      const dairaName = displayLanguage === "ar"
        ? getDairaArabic(feature)
        : feature.properties.daira;
      const secondaryText = isWilaya
        ? `${Number(feature.properties.communes_count).toLocaleString()} ${displayLanguage === "ar" ? "بلدية" : "communes"}`
        : [dairaName, displayLanguage === "fr" ? feature.properties.name_ar : null].filter(Boolean).join(" · ");
      if (secondaryText) {
        const secondary = document.createElement("span");
        secondary.className = "location-parent";
        secondary.textContent = secondaryText;
        if (feature.properties.name_ar && !isWilaya) secondary.dir = "auto";
        if (isWilaya && displayLanguage === "ar") secondary.dir = "rtl";
        details.append(secondary);
      }
      const arrow = document.createElement("span");
      arrow.className = "location-arrow";
      arrow.textContent = "›";
      button.append(mark, details, arrow);
      button.addEventListener("click", () => isWilaya ? openWilaya(feature) : selectCommune(feature));
      fragment.append(button);
    });
    results.append(fragment);
  }

  function getDairaArabic(feature) {
    if (feature.properties.daira_ar) return feature.properties.daira_ar;
    const wilaya = wilayas.find(item => Number(item.properties.code) === Number(feature.properties.wilaya_code));
    const daira = wilaya?.properties.dairas?.find(item => item.name_fr === feature.properties.daira);
    return daira?.name_ar || feature.properties.daira;
  }

  function refreshTooltips() {
    if (wilayaLayer) wilayaLayer.eachLayer(layer => {
      layer.setTooltipContent(`<strong>${escapeHtml(wilayaName(layer.feature))}</strong>`);
    });
    if (communeLayer) communeLayer.eachLayer(layer => {
      const feature = layer.feature;
      if (feature) layer.setTooltipContent(communeTooltip(feature));
    });
  }

  function refreshSelectionCard() {
    if (activeWilaya) {
      showWilayaDetails(activeWilaya);
    } else if (selectedCommune) {
      showCommuneDetails(selectedCommune);
    }
  }

  filters.forEach(button => button.addEventListener("click", () => {
    const newLevel = button.dataset.level;
    clearSelection();
    setActiveFilter(newLevel);
    refreshCommunes();
    updateSortOptions();
    if (newLevel === "wilaya") map.fitBounds(wilayaLayer.getBounds(), { padding: [20, 20] });
    renderResults();
  }));

  contextBack.addEventListener("click", () => {
    clearSelection();
    setActiveFilter("wilaya");
    updateSortOptions();
    map.fitBounds(wilayaLayer.getBounds(), { padding: [20, 20] });
    renderResults();
  });

  optionsToggle.addEventListener("click", () => {
    optionsPanel.hidden = !optionsPanel.hidden;
    optionsToggle.setAttribute("aria-expanded", String(!optionsPanel.hidden));
    if (!optionsPanel.hidden) languageSelect.focus();
  });
  languageSelect.addEventListener("change", () => {
    displayLanguage = languageSelect.value;
    renderResults();
    refreshTooltips();
    refreshSelectionCard();
  });
  sortSelect.addEventListener("change", () => {
    sortOrder = sortSelect.value;
    renderResults();
  });
  document.addEventListener("click", event => {
    if (optionsPanel.hidden || optionsPanel.contains(event.target) || optionsToggle.contains(event.target)) return;
    optionsPanel.hidden = true;
    optionsToggle.setAttribute("aria-expanded", "false");
  });
  search.addEventListener("input", renderResults);
  document.addEventListener("keydown", event => {
    if (event.key === "/" && document.activeElement !== search) {
      event.preventDefault();
      search.focus();
    }
    if (event.key === "Escape") {
      if (!optionsPanel.hidden) {
        optionsPanel.hidden = true;
        optionsToggle.setAttribute("aria-expanded", "false");
        optionsToggle.focus();
        return;
      }
      search.value = "";
      search.blur();
      renderResults();
    }
  });

  document.getElementById("fit-map").addEventListener("click", () => {
    if (activeWilaya) {
      const layer = findWilayaLayer(activeWilaya);
      if (layer) map.fitBounds(layer.getBounds(), { padding: [42, 42], maxZoom: 9 });
    } else if (wilayaLayer) {
      map.fitBounds(wilayaLayer.getBounds(), { padding: [20, 20] });
    }
  });

  document.getElementById("toggle-labels").addEventListener("click", event => {
    labelsEnabled = !labelsEnabled;
    event.currentTarget.setAttribute("aria-pressed", String(labelsEnabled));
    event.currentTarget.style.color = labelsEnabled ? "#167a55" : "";
    updateLabels();
  });

  Promise.all([
    fetch(window.ALG_MAP_DATA.wilayas).then(response => {
      if (!response.ok) throw new Error("Could not load wilaya boundaries.");
      return response.json();
    }),
    fetch(window.ALG_MAP_DATA.communes).then(response => {
      if (!response.ok) throw new Error("Could not load commune locations.");
      return response.json();
    }),
    fetch(window.ALG_MAP_DATA.wilayaRecords).then(response => {
      if (!response.ok) throw new Error("Could not load wilaya names.");
      return response.json();
    })
  ]).then(([wilayaData, communeData, recordsData]) => {
    wilayas = wilayaData.features;
    communes = communeData.features;
    window.ALG_MAP_WILAYA_RECORDS = recordsData.wilayas;
    if (wilayas.length !== 69 || communes.length !== 1541) {
      throw new Error(`Unexpected boundary data: loaded ${wilayas.length} wilayas and ${communes.length} communes.`);
    }
    initializeLayers();
    updateLabels();
  }).catch(error => {
    mapError.textContent = `${error.message} Reload the page or check your connection.`;
    mapError.hidden = false;
    results.replaceChildren();
    const message = document.createElement("div");
    message.className = "empty-results";
    message.textContent = error.message;
    results.append(message);
    document.getElementById("results-count").textContent = "Unavailable";
  });
})();
