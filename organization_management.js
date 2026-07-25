/* 月考核系統 V4｜組織異動管理中心｜版本 1.0.5-mobile-nav */
(function () {
  'use strict';

  var state = {
    data: null,
    filters: { area: '', storeCode: '', keyword: '', page: 1, pageSize: 20 },
    employee: null,
    employeePreview: null,
    store: null,
    storePreview: null,
    employeeRequestId: '',
    storeRequestId: '',
    initialized: false
  };

  function html(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function byId(id) { return document.getElementById(id); }

  function option(value, label, selected, disabled) {
    return '<option value="' + html(value) + '"' + (selected ? ' selected' : '') + (disabled ? ' disabled' : '') + '>' + html(label) + '</option>';
  }

  function setHidden(element, hidden) { if (element) element.hidden = Boolean(hidden); }

  function setButtonBusy(button, busy, busyText) {
    if (!button) return;
    if (!button.dataset.originalLabel) button.dataset.originalLabel = button.textContent;
    button.disabled = Boolean(busy);
    button.textContent = busy ? (busyText || '處理中…') : button.dataset.originalLabel;
  }

  function showMessage(type, message) {
    var box = byId('organizationManagementMessage');
    if (!box) return;
    box.hidden = false;
    box.className = 'form-message organization-message organization-message--' + (type || 'info');
    box.textContent = String(message || '');
  }

  function clearMessage() {
    var box = byId('organizationManagementMessage');
    if (box) { box.hidden = true; box.textContent = ''; }
  }

  function showActionMessage(type, message) {
    showMessage(type, message);
    var box = byId('organizationManagementMessage');
    if (!box) return;
    window.setTimeout(function () {
      try { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (ignore) {}
    }, 30);
  }

  function injectWorkspace() {
    if (byId('organizationManagementPage')) return true;
    var workspace = byId('systemManagementWorkspace');
    var pages = byId('systemManagementPages');
    var nav = byId('systemManagementNav');
    var select = byId('systemManagementPageSelect');
    if (!workspace || !pages || !nav || !select) return false;

    var maintenanceGroup = Array.prototype.slice.call(nav.querySelectorAll('.system-management-nav-group'))
      .filter(function (item) { return item.textContent.trim() === '系統維護'; })[0];
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'system-management-nav-button';
    button.setAttribute('data-system-page', 'organization');
    button.innerHTML = '<strong>人員與組織</strong><span>調店、換區、主管與店長配置</span>';
    // 系統維護固定以「帳號與登入」為第一項；「人員與組織」排列在其後。
    var accountsButton = nav.querySelector('[data-system-page="accounts"]');
    if (accountsButton && accountsButton.nextSibling) nav.insertBefore(button, accountsButton.nextSibling);
    else if (accountsButton) nav.appendChild(button);
    else if (maintenanceGroup && maintenanceGroup.nextSibling) nav.insertBefore(button, maintenanceGroup.nextSibling);
    else nav.appendChild(button);

    var maintenanceOptions = Array.prototype.slice.call(select.querySelectorAll('optgroup'))
      .filter(function (item) { return item.label === '系統維護'; })[0];
    var selectOption = document.createElement('option');
    selectOption.value = 'organization';
    selectOption.textContent = '人員與組織';
    if (maintenanceOptions) {
      var accountsOption = maintenanceOptions.querySelector('option[value="accounts"]');
      if (accountsOption && accountsOption.nextSibling) maintenanceOptions.insertBefore(selectOption, accountsOption.nextSibling);
      else maintenanceOptions.appendChild(selectOption);
    } else select.appendChild(selectOption);

    var page = document.createElement('section');
    page.id = 'organizationManagementPage';
    page.className = 'system-management-page';
    page.setAttribute('data-system-page-panel', 'organization');
    page.hidden = true;
    page.innerHTML = buildPageHtml();
    pages.appendChild(page);

    var homeGrid = workspace.querySelector('.system-home-grid');
    if (homeGrid) {
      var card = document.createElement('article');
      card.className = 'system-home-card';
      card.innerHTML = '<div><h4>人員與組織</h4><p>由前台完成人員調店、門市換轄區、區主管與多店長配置。</p>' +
        '<small>既有考核單與歷史資料不自動改寫；異動前先預覽影響</small></div>' +
        '<button class="secondary-button" type="button" data-system-page-target="organization">進入管理</button>';
      var accountsCardButton = homeGrid.querySelector('[data-system-page-target="accounts"]');
      var accountsCard = accountsCardButton && accountsCardButton.closest ? accountsCardButton.closest('.system-home-card') : null;
      if (accountsCard && accountsCard.nextSibling) homeGrid.insertBefore(card, accountsCard.nextSibling);
      else homeGrid.appendChild(card);
    }
    return true;
  }

  function buildPageHtml() {
    return '' +
      '<div class="system-page-heading organization-page-heading"><div>' +
        '<p class="step-label">前台主檔維護｜1.0</p><h3>人員與組織異動管理中心</h3>' +
        '<p>教育中心可在此維護員工主檔與門市主檔。店號選定後，店名、區域、部門與單位代碼由系統帶入；既有考核單不會自動改寫。</p>' +
      '</div><button id="organizationRefreshButton" class="secondary-button secondary-button--small" type="button">重新整理</button></div>' +
      '<div id="organizationManagementMessage" class="form-message" role="status" aria-live="polite" hidden></div>' +
      '<section class="card organization-search-card"><div class="organization-search-grid">' +
        '<label class="field-group"><span>轄區</span><select id="organizationAreaFilter"><option value="">全部轄區</option></select></label>' +
        '<label class="field-group"><span>門市</span><select id="organizationStoreFilter"><option value="">全部門市</option></select></label>' +
        '<label class="field-group organization-search-keyword"><span>人員／店號／名稱</span><input id="organizationKeyword" type="search" maxlength="80" placeholder="輸入工號、姓名、店號或店名"></label>' +
        '<button id="organizationSearchButton" class="primary-button" type="button">查詢</button>' +
      '</div><p class="section-help">不會自動載入全公司名單。請選擇轄區、門市或輸入關鍵字後查詢。</p></section>' +
      '<section id="organizationSummary" class="organization-summary-grid" hidden></section>' +
      '<section id="organizationAnomalySection" class="card organization-result-section" hidden><div class="organization-section-heading"><div><h4>例外與待確認</h4><p>雙店長或暫無店長只提示，不直接阻擋，由教育中心決定。</p></div></div><div id="organizationAnomalyList"></div></section>' +
      '<section id="organizationStoreSection" class="card organization-result-section" hidden><div class="organization-section-heading"><div><h4>門市與主管</h4><p>可維護門市區域、區主管、主責簽核店長及其他店長配置。</p></div></div><div id="organizationStoreList"></div></section>' +
      '<section id="organizationEmployeeSection" class="card organization-result-section" hidden><div class="organization-section-heading"><div><h4>人員資料</h4><p>可修改人員角色、調店、生效日、考核資格與業務欄位；技術欄位仍由系統管理。</p></div></div><div id="organizationEmployeeList"></div>' +
        '<div id="organizationPagination" class="account-management-pagination" hidden><button id="organizationPreviousButton" class="secondary-button secondary-button--small" type="button">上一頁</button><strong id="organizationPageText"></strong><button id="organizationNextButton" class="secondary-button secondary-button--small" type="button">下一頁</button></div>' +
      '</section>' +
      '<section id="organizationEmployeeEditor" class="card organization-editor" hidden></section>' +
      '<section id="organizationStoreEditor" class="card organization-editor" hidden></section>';
  }

  function showOrganizationPage(load) {
    var panels = document.querySelectorAll('[data-system-page-panel]');
    Array.prototype.forEach.call(panels, function (panel) {
      panel.hidden = panel.getAttribute('data-system-page-panel') !== 'organization';
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-system-page]'), function (button) {
      var active = button.getAttribute('data-system-page') === 'organization';
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    var select = byId('systemManagementPageSelect');
    if (select) select.value = 'organization';
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search + '#system/organization');
    }
    if (load && !state.initialized) loadCenter({ quiet: true, requireSearch: false });
  }

  window.V4OrganizationManagement = window.V4OrganizationManagement || {};
  window.V4OrganizationManagement.show = function (load) {
    showOrganizationPage(load !== false);
  };

  function hideOrganizationPageWhenOtherSelected(target) {
    if (target === 'organization') return;
    var page = byId('organizationManagementPage');
    if (page) page.hidden = true;
    Array.prototype.forEach.call(document.querySelectorAll('[data-system-page="organization"]'), function (button) {
      button.classList.remove('is-active');
      button.setAttribute('aria-current', 'false');
    });
  }

  function bindNavigation() {
    document.addEventListener('click', function (event) {
      var button = event.target.closest('[data-system-page="organization"], [data-system-page-target="organization"]');
      if (button) {
        event.preventDefault();
        showOrganizationPage(true);
        return;
      }
      var other = event.target.closest('[data-system-page], [data-system-page-target]');
      if (other) hideOrganizationPageWhenOtherSelected(other.getAttribute('data-system-page') || other.getAttribute('data-system-page-target'));
    });
    var select = byId('systemManagementPageSelect');
    if (select) select.addEventListener('change', function () {
      if (select.value === 'organization') showOrganizationPage(true);
      else hideOrganizationPageWhenOtherSelected(select.value);
    });
  }

  function bindPageEvents() {
    byId('organizationSearchButton').addEventListener('click', function () {
      state.filters.area = byId('organizationAreaFilter').value;
      state.filters.storeCode = byId('organizationStoreFilter').value;
      state.filters.keyword = byId('organizationKeyword').value.trim();
      state.filters.page = 1;
      loadCenter({ requireSearch: true });
    });
    byId('organizationRefreshButton').addEventListener('click', function () { loadCenter({ requireSearch: false }); });
    byId('organizationAreaFilter').addEventListener('change', function () {
      state.filters.area = this.value;
      updateStoreFilterOptions();
    });
    byId('organizationPreviousButton').addEventListener('click', function () {
      if (state.filters.page > 1) { state.filters.page -= 1; loadCenter({ requireSearch: false }); }
    });
    byId('organizationNextButton').addEventListener('click', function () {
      var pagination = state.data && state.data.pagination || {};
      if (state.filters.page < Number(pagination.totalPages || 1)) { state.filters.page += 1; loadCenter({ requireSearch: false }); }
    });
    byId('organizationStoreList').addEventListener('click', function (event) {
      var button = event.target.closest('[data-edit-store]');
      if (button) openStoreEditor(button.getAttribute('data-edit-store'));
    });
    byId('organizationEmployeeList').addEventListener('click', function (event) {
      var button = event.target.closest('[data-edit-employee]');
      if (button) openEmployeeEditor(button.getAttribute('data-edit-employee'));
    });
  }

  async function loadCenter(options) {
    var settings = options || {};
    var searchButton = byId('organizationSearchButton');
    var refreshButton = byId('organizationRefreshButton');
    var succeeded = false;
    if (settings.requireSearch && !state.filters.area && !state.filters.storeCode && !state.filters.keyword) {
      showMessage('info', '請至少選擇一個轄區、門市，或輸入工號／姓名／店號後再查詢。');
      return false;
    }
    clearMessage();
    setButtonBusy(searchButton, true, '查詢中…');
    if (refreshButton) refreshButton.disabled = true;
    try {
      var result = await window.V3WorkflowService.organizationManagementCenter(state.filters);
      state.data = result.data || {};
      state.initialized = true;
      state.filters.page = Number(state.data.pagination && state.data.pagination.page || 1);
      renderFilters();
      renderCenter();
      succeeded = true;
      if (!settings.quiet && !state.data.searchRequired) showMessage('success', '資料已更新。');
      if (state.data.searchRequired) showMessage('info', '請設定查詢條件；系統不會自動載入全公司名單。');
    } catch (error) {
      showMessage('error', error && error.message || '組織資料讀取失敗。');
    } finally {
      setButtonBusy(searchButton, false);
      if (refreshButton) refreshButton.disabled = false;
    }
    return succeeded;
  }

  function sortOrganizationStoresUi(stores) {
    return (stores || []).sort(function (a, b) {
      return String(a && a.storeCode || '').localeCompare(String(b && b.storeCode || ''), 'zh-Hant', { numeric: true, sensitivity: 'base' });
    });
  }

  function sortOrganizationAreasUi(areas) {
    return (areas || []).sort(function (a, b) {
      var keyA = organizationAreaSortKeyUi(a);
      var keyB = organizationAreaSortKeyUi(b);
      if (keyA.group !== keyB.group) return keyA.group - keyB.group;
      if (keyA.number !== keyB.number) return keyA.number - keyB.number;
      return String(a || '').localeCompare(String(b || ''), 'zh-Hant', { numeric: true });
    });
  }

  function organizationAreaSortKeyUi(value) {
    var text = String(value || '').trim();
    var prefixOrder = { '營': 10, '京': 20, '馥': 30 };
    var match = text.match(/^(營|京|馥)([零〇一二三四五六七八九十百0-9]+)(區|處)?$/);
    if (!match) return { group: 900, number: 9999 };
    return { group: prefixOrder[match[1]] || 900, number: parseChineseNumberUi(match[2]) };
  }

  function parseChineseNumberUi(value) {
    var text = String(value || '').trim();
    if (/^\d+$/.test(text)) return Number(text);
    var digits = { '零': 0, '〇': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
    if (text.indexOf('百') !== -1) {
      var hundred = text.split('百');
      return (digits[hundred[0]] || 1) * 100 + parseChineseNumberUi(hundred[1] || '零');
    }
    if (text.indexOf('十') !== -1) {
      var ten = text.split('十');
      return (ten[0] ? (digits[ten[0]] || 0) : 1) * 10 + (ten[1] ? (digits[ten[1]] || 0) : 0);
    }
    return Object.prototype.hasOwnProperty.call(digits, text) ? digits[text] : 9999;
  }

  function renderFilters() {
    var data = state.data || {};
    var area = byId('organizationAreaFilter');
    var currentArea = state.filters.area;
    var sortedAreas = sortOrganizationAreasUi((data.options && data.options.areas || []).slice());
    area.innerHTML = option('', '全部轄區', !currentArea) + sortedAreas.map(function (item) {
      return option(item, item, item === currentArea);
    }).join('');
    byId('organizationKeyword').value = state.filters.keyword || '';
    updateStoreFilterOptions();
  }

  function updateStoreFilterOptions() {
    var data = state.data || {};
    var area = byId('organizationAreaFilter') ? byId('organizationAreaFilter').value : state.filters.area;
    var select = byId('organizationStoreFilter');
    var current = state.filters.storeCode;
    var stores = sortOrganizationStoresUi((data.options && data.options.stores || []).filter(function (store) { return !area || store.area === area; }));
    select.innerHTML = option('', '全部門市', !current) + stores.map(function (store) {
      return option(store.storeCode, store.storeCode + '｜' + store.storeName, store.storeCode === current);
    }).join('');
    if (current && !stores.some(function (store) { return store.storeCode === current; })) {
      state.filters.storeCode = '';
      select.value = '';
    }
  }

  function renderCenter() {
    var data = state.data || {};
    if (data.searchRequired) {
      ['organizationSummary','organizationAnomalySection','organizationStoreSection','organizationEmployeeSection'].forEach(function (id) { setHidden(byId(id), true); });
      return;
    }
    renderSummary(data.summary || {});
    renderAnomalies(data.anomalies || []);
    renderStores(data.stores || []);
    renderEmployees(data.employees || [], data.pagination || {});
  }

  function renderSummary(summary) {
    var container = byId('organizationSummary');
    container.innerHTML = [
      ['符合門市', summary.matchedStoreCount || 0], ['符合人員', summary.matchedEmployeeCount || 0],
      ['進行中考核', summary.activeEvaluationCount || 0], ['例外／待確認', summary.anomalyCount || 0]
    ].map(function (item) { return '<article class="organization-summary-card"><strong>' + html(item[1]) + '</strong><span>' + html(item[0]) + '</span></article>'; }).join('');
    container.hidden = false;
  }

  function renderAnomalies(items) {
    var section = byId('organizationAnomalySection');
    var list = byId('organizationAnomalyList');
    section.hidden = false;
    if (!items.length) { list.innerHTML = '<p class="empty-state">目前篩選範圍沒有偵測到組織例外。</p>'; return; }
    list.innerHTML = '<div class="organization-anomaly-list">' + items.map(function (item) {
      return '<article class="organization-anomaly organization-anomaly--' + html(item.level) + '"><strong>' + html(item.target) + '</strong><span>' + html(item.message) + '</span></article>';
    }).join('') + '</div>';
  }

  function renderStores(stores) {
    var section = byId('organizationStoreSection');
    var list = byId('organizationStoreList');
    section.hidden = false;
    if (!stores.length) { list.innerHTML = '<p class="empty-state">查無符合門市。</p>'; return; }
    list.innerHTML = '<div class="organization-card-list">' + stores.map(function (store) {
      var warnings = (store.warnings || []).map(function (item) { return '<span class="organization-chip organization-chip--warning">' + html(item.message) + '</span>'; }).join('');
      var managerText = (store.managers || []).length
        ? store.managers.map(function (manager) { return manager.employeeName + '（' + manager.configType + (manager.isDefaultSigner ? '／預設簽核' : '') + '）'; }).join('、')
        : '目前無在職店長';
      return '<article class="organization-item-card"><div class="organization-item-main"><div><p class="step-label">' + html(store.storeCode) + '｜' + html(store.area) + '</p><h5>' + html(store.storeName) + '</h5>' +
        '<p>區主管：' + html(store.areaSupervisorName || '未指定') + '　｜　在職人數：' + html(store.employeeCount) + '　｜　進行中考核：' + html(store.activeEvaluationCount) + '</p>' +
        '<p>店長配置：' + html(managerText) + '</p><div class="organization-chip-row">' + warnings + '</div></div>' +
        '<button class="secondary-button secondary-button--small" type="button" data-edit-store="' + html(store.storeCode) + '">維護門市</button></div></article>';
    }).join('') + '</div>';
  }

  function renderEmployees(employees, pagination) {
    var section = byId('organizationEmployeeSection');
    var list = byId('organizationEmployeeList');
    section.hidden = false;
    if (!employees.length) list.innerHTML = '<p class="empty-state">查無符合人員。</p>';
    else list.innerHTML = '<div class="organization-card-list">' + employees.map(function (employee) {
      var mismatch = (employee.mismatchMessages || []).map(function (item) { return '<span class="organization-chip organization-chip--warning">' + html(item) + '</span>'; }).join('');
      return '<article class="organization-item-card"><div class="organization-item-main"><div><p class="step-label">' + html(employee.employeeId) + '｜' + html(employee.role) + '</p><h5>' + html(employee.employeeName) + '</h5>' +
        '<p>' + html(employee.storeCode || '無店號') + ' ' + html(employee.storeName || '') + '　｜　' + html(employee.area || '未設定區域') + '　｜　' + html(employee.employmentStatus) + '</p>' +
        '<p>考核：' + html(employee.needsEvaluation) + '　｜　預設考核表：' + html(evaluationVersionLabel(employee.defaultEvaluationVersion)) + '　｜　進行中相關案件：' + html(employee.activeEvaluationCount) + '</p>' +
        '<div class="organization-chip-row">' + mismatch + '</div></div>' +
        '<button class="secondary-button secondary-button--small" type="button" data-edit-employee="' + html(employee.employeeId) + '">維護人員</button></div></article>';
    }).join('') + '</div>';
    var paginationBox = byId('organizationPagination');
    var totalPages = Number(pagination.totalPages || 1);
    paginationBox.hidden = Number(pagination.total || 0) <= Number(pagination.pageSize || 20);
    byId('organizationPageText').textContent = '第 ' + Number(pagination.page || 1) + '／' + totalPages + ' 頁，共 ' + Number(pagination.total || 0) + ' 人';
    byId('organizationPreviousButton').disabled = Number(pagination.page || 1) <= 1;
    byId('organizationNextButton').disabled = Number(pagination.page || 1) >= totalPages;
  }

  function findEmployee(employeeId) {
    return (state.data && state.data.employees || []).filter(function (item) { return item.employeeId === employeeId; })[0] || null;
  }

  function findStore(storeCode) {
    return (state.data && state.data.stores || []).filter(function (item) { return item.storeCode === storeCode; })[0] || null;
  }

  function openEmployeeEditor(employeeId) {
    var employee = findEmployee(employeeId);
    if (!employee) { showMessage('error', '找不到人員資料，請重新查詢。'); return; }
    state.employee = employee;
    state.employeePreview = null;
    state.employeeRequestId = '';
    var data = state.data || {};
    var roles = data.options && data.options.roles || [];
    var stores = sortOrganizationStoresUi((data.options && data.options.stores || []).slice());
    var accountOptions = [option('啟用','啟用', employee.accountStatus === '啟用'), option('停用','停用', employee.accountStatus === '停用')];
    if (employee.accountStatus === '鎖定') accountOptions.push(option('鎖定','鎖定（請至帳號與登入頁解鎖）', true, true));
    var editor = byId('organizationEmployeeEditor');
    editor.innerHTML = '<div class="organization-section-heading"><div><p class="step-label">員工主檔｜' + html(employee.employeeId) + '</p><h4>維護 ' + html(employee.employeeName) + '</h4><p>工號與系統安全欄位不在此修改。調店後會同步未鎖定月考核計畫，但不改寫既有考核單。</p></div><button id="organizationEmployeeClose" class="secondary-button secondary-button--small" type="button">關閉</button></div>' +
      '<div class="organization-editor-grid">' +
        fieldInput('organizationEmployeeName','姓名',employee.employeeName,'text') +
        fieldSelect('organizationEmployeeRole','系統角色',roles.map(function (r) { return option(r,r,r===employee.role); }).join('')) +
        fieldSelect('organizationEmployeeStore','店號／店別',option('','不隸屬門市',!employee.storeCode)+stores.map(function (s) { return option(s.storeCode,s.storeCode+'｜'+s.storeName,s.storeCode===employee.storeCode); }).join('')) +
        fieldInput('organizationEmployeeDepartment','部門',employee.department,'text',true) +
        fieldInput('organizationEmployeeArea','區域',employee.area,'text',true) +
        fieldInput('organizationEmployeeUnitCode','單位代碼',employee.unitCode,'text',true) +
        fieldInput('organizationEmployeeTransferDate','轉任生效日',employee.transferDate,'date') +
        fieldSelect('organizationEmployeeNeedsEvaluation','是否需要考核',option('是','是',employee.needsEvaluation==='是')+option('否','否',employee.needsEvaluation!=='是')) +
        fieldSelect('organizationEmployeeEmployment','在職狀態',(data.options.employmentStatuses||[]).map(function (v) { return option(v,v,v===employee.employmentStatus); }).join('')) +
        fieldSelect('organizationEmployeeAccountStatus','帳號狀態',accountOptions.join('')) +
        fieldInput('organizationEmployeeEmail','通知 Email',employee.notificationEmail,'email') +
        fieldSelect('organizationEmployeeVersion','預設考核表',option('A','一般月考核表',employee.defaultEvaluationVersion==='A')+option('B','店副理進階月考核表',employee.defaultEvaluationVersion==='B')) +
      '</div>' +
      '<label class="field-group"><span>備註</span><textarea id="organizationEmployeeNote" rows="3" maxlength="500">' + html(employee.note) + '</textarea></label>' +
      '<label class="field-group"><span>異動原因（選填）</span><textarea id="organizationEmployeeReason" rows="3" maxlength="300" placeholder="未填時，系統會依異動前後差異自動產生稽核說明"></textarea></label>' +
      '<div class="organization-editor-actions"><button id="organizationEmployeePreviewButton" class="primary-button" type="button">預覽影響</button></div>' +
      '<div id="organizationEmployeePreview" class="organization-preview" hidden></div>';
    editor.hidden = false;
    byId('organizationStoreEditor').hidden = true;
    bindEmployeeEditor();
    if (employee.accountStatus === '鎖定') {
      byId('organizationEmployeeAccountStatus').disabled = true;
      byId('organizationEmployeeAccountStatus').title = '鎖定帳號請至「帳號與登入」頁使用解鎖功能。';
    }
    syncEmployeeDerivedFields();
    syncEmployeeEvaluationVersion();
    editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function fieldInput(id, label, value, type, readonly) {
    return '<label class="field-group"><span>' + html(label) + '</span><input id="' + html(id) + '" type="' + html(type || 'text') + '" value="' + html(value) + '"' + (readonly ? ' readonly' : '') + '></label>';
  }

  function fieldSelect(id, label, optionsHtml) {
    return '<label class="field-group"><span>' + html(label) + '</span><select id="' + html(id) + '">' + optionsHtml + '</select></label>';
  }

  function bindEmployeeEditor() {
    var editor = byId('organizationEmployeeEditor');
    byId('organizationEmployeeClose').addEventListener('click', function () { editor.hidden = true; });
    byId('organizationEmployeeStore').addEventListener('change', syncEmployeeDerivedFields);
    byId('organizationEmployeeRole').addEventListener('change', syncEmployeeEvaluationVersion);
    byId('organizationEmployeePreviewButton').addEventListener('click', previewEmployee);
    ['input', 'change'].forEach(function (eventName) {
      editor.addEventListener(eventName, function (event) {
        if (event.target.closest('#organizationEmployeePreview')) return;
        state.employeePreview = null;
        state.employeeRequestId = '';
        var preview = byId('organizationEmployeePreview');
        if (preview) preview.hidden = true;
      });
    });
  }

  function syncEmployeeDerivedFields() {
    var code = byId('organizationEmployeeStore').value;
    var store = (state.data && state.data.options && state.data.options.stores || []).filter(function (item) { return item.storeCode === code; })[0] || null;
    if (store) {
      byId('organizationEmployeeArea').value = store.area || '';
      if (store.department && store.department !== '營業處') byId('organizationEmployeeDepartment').value = store.department;
      byId('organizationEmployeeUnitCode').value = store.storeCode || '';
      byId('organizationEmployeeDepartment').readOnly = true;
      byId('organizationEmployeeArea').readOnly = true;
      byId('organizationEmployeeUnitCode').readOnly = true;
    } else {
      byId('organizationEmployeeDepartment').readOnly = false;
      byId('organizationEmployeeArea').readOnly = false;
      byId('organizationEmployeeUnitCode').value = '';
    }
  }

  function evaluationVersionLabel(value) {
    return String(value || '').toUpperCase() === 'B' ? '店副理進階月考核表' : '一般月考核表';
  }

  function syncEmployeeEvaluationVersion() {
    var role = byId('organizationEmployeeRole').value;
    var select = byId('organizationEmployeeVersion');
    var isManager = role === '門市店主管';
    if (isManager) select.value = 'B';
    select.disabled = isManager;
    select.title = isManager ? '門市店主管作為受評人時固定使用店副理進階月考核表。' : '';
  }

  function employeePayload() {
    var employee = state.employee;
    return {
      employeeId: employee.employeeId,
      employeeName: byId('organizationEmployeeName').value.trim(),
      role: byId('organizationEmployeeRole').value,
      storeCode: byId('organizationEmployeeStore').value,
      department: byId('organizationEmployeeDepartment').value.trim(),
      area: byId('organizationEmployeeArea').value.trim(),
      transferDate: byId('organizationEmployeeTransferDate').value,
      needsEvaluation: byId('organizationEmployeeNeedsEvaluation').value,
      employmentStatus: byId('organizationEmployeeEmployment').value,
      accountStatus: byId('organizationEmployeeAccountStatus').value,
      notificationEmail: byId('organizationEmployeeEmail').value.trim(),
      defaultEvaluationVersion: byId('organizationEmployeeVersion').value,
      note: byId('organizationEmployeeNote').value.trim(),
      reason: byId('organizationEmployeeReason').value.trim(),
      expectedFingerprint: employee.fingerprint
    };
  }

  async function previewEmployee() {
    var button = byId('organizationEmployeePreviewButton');
    setButtonBusy(button, true, '預覽中…');
    clearMessage();
    try {
      var result = await window.V3WorkflowService.organizationEmployeePreview(employeePayload());
      state.employeePreview = result.data || {};
      state.employeeRequestId = window.V3ApiClient.createRequestId();
      renderEmployeePreview();
    } catch (error) { showMessage('error', error && error.message || '人員異動預覽失敗。'); }
    finally { setButtonBusy(button, false); }
  }

  function renderEmployeePreview() {
    var preview = state.employeePreview || {};
    var target = byId('organizationEmployeePreview');
    target.hidden = false;
    target.innerHTML = previewHtml(preview) +
      '<label class="confirm-row"><input id="organizationEmployeeConfirm" type="checkbox"><span>我已確認異動前後資料、進行中考核與鎖定計畫不會被自動改寫，確定執行。</span></label>' +
      '<div class="organization-editor-actions"><button id="organizationEmployeeExecute" class="primary-button" type="button" disabled>正式更新人員資料</button></div>';
    byId('organizationEmployeeConfirm').addEventListener('change', function () { byId('organizationEmployeeExecute').disabled = !this.checked; });
    byId('organizationEmployeeExecute').addEventListener('click', executeEmployee);
  }

  async function executeEmployee() {
    var payload = employeePayload();
    payload.confirmed = true;
    payload.expectedFingerprint = state.employeePreview.expectedFingerprint;
    var button = byId('organizationEmployeeExecute');
    setButtonBusy(button, true, '更新中…');
    try {
      var requestId = state.employeeRequestId || window.V3ApiClient.createRequestId();
      state.employeeRequestId = requestId;
      var result = await window.V3WorkflowService.organizationEmployeeUpdate(payload, requestId);
      var message = result.data && result.data.message || '人員資料已更新。';
      byId('organizationEmployeeEditor').hidden = true;
      var refreshed = await loadCenter({ requireSearch: false, quiet: true });
      showActionMessage(refreshed ? 'success' : 'warning', message + (refreshed ? '' : '；正式資料已寫入，但清單重新整理失敗，請按「重新整理」。'));
    } catch (error) {
      showActionMessage('error', error && error.message || '人員資料更新失敗。');
    } finally { setButtonBusy(button, false); }
  }

  function openStoreEditor(storeCode) {
    var store = findStore(storeCode);
    if (!store) { showMessage('error', '找不到門市資料，請重新查詢。'); return; }
    state.store = store;
    state.storePreview = null;
    state.storeRequestId = '';
    var data = state.data || {};
    var areas = sortOrganizationAreasUi((data.options && data.options.areas || []).slice());
    var supervisors = (data.areaSupervisors || []).slice();
    if (store.areaSupervisorId && !supervisors.some(function (item) { return item.employeeId === store.areaSupervisorId; })) {
      supervisors.push({ employeeId: store.areaSupervisorId, employeeName: store.areaSupervisorName, area: store.area });
    }
    var managers = store.managers || [];
    var editor = byId('organizationStoreEditor');
    editor.innerHTML = '<div class="organization-section-heading"><div><p class="step-label">門市主檔｜' + html(store.storeCode) + '</p><h4>維護 ' + html(store.storeName) + '</h4>' +
      '<p>同店可有多位店長，也可暫無主責店長；門市主檔只保存一位預設簽核店長，其他配置另行留存。</p></div><button id="organizationStoreClose" class="secondary-button secondary-button--small" type="button">關閉</button></div>' +
      '<div class="organization-editor-grid">' +
        fieldInput('organizationStoreCode','店號',store.storeCode,'text',true) +
        fieldInput('organizationStoreName','店名',store.storeName,'text') +
        fieldSelect('organizationStoreArea','區域',option('','未設定',!store.area)+areas.map(function (v) { return option(v,v,v===store.area); }).join('')) +
        fieldInput('organizationStoreDepartment','部門',store.department,'text') +
        fieldSelect('organizationAreaSupervisor','區主管',option('','暫不指定',!store.areaSupervisorId)+supervisors.map(function (item) { return option(item.employeeId,item.employeeId+'｜'+item.employeeName,item.employeeId===store.areaSupervisorId); }).join('')) +
        fieldSelect('organizationPrimaryManager','主責簽核店長',option('','暫不指定',!store.primaryManagerId)+managers.map(function (item) { return option(item.employeeId,item.employeeId+'｜'+item.employeeName,item.employeeId===store.primaryManagerId); }).join('')) +
        fieldSelect('organizationStoreEnabled','是否啟用',option('是','是',store.enabled==='是')+option('否','否',store.enabled!=='是')) +
        fieldInput('organizationStoreEffectiveDate','異動生效日','', 'date') +
      '</div>' +
      '<label class="field-group"><span>門市備註</span><textarea id="organizationStoreNote" rows="3" maxlength="500">' + html(store.note) + '</textarea></label>' +
      '<section class="organization-manager-config"><h5>店長配置（雙店長／掛名／代理皆可）</h5><div id="organizationManagerRows">' + managerRowsHtml(managers, data.options.managerTypes || []) + '</div></section>' +
      '<label class="field-group"><span>異動原因（選填）</span><textarea id="organizationStoreReason" rows="3" maxlength="300" placeholder="未填時，系統會依異動前後差異自動產生稽核說明"></textarea></label>' +
      '<div class="organization-editor-actions"><button id="organizationStorePreviewButton" class="primary-button" type="button">預覽影響</button></div>' +
      '<div id="organizationStorePreview" class="organization-preview" hidden></div>';
    editor.hidden = false;
    byId('organizationEmployeeEditor').hidden = true;
    bindStoreEditor();
    editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function managerRowsHtml(managers, managerTypes) {
    if (!managers.length) return '<p class="empty-state">目前此門市沒有在職店長。可先透過人員維護將店長調入，再回來設定。</p>';
    return '<div class="organization-manager-table">' + managers.map(function (manager) {
      return '<div class="organization-manager-row" data-manager-id="' + html(manager.employeeId) + '"><strong>' + html(manager.employeeId + '｜' + manager.employeeName) + '</strong>' +
        '<select data-manager-type>' + managerTypes.map(function (type) { return option(type,type,type===manager.configType); }).join('') + '</select>' +
        '<input data-manager-start type="date" value="' + html(manager.effectiveDate || '') + '" aria-label="生效日">' +
        '<input data-manager-end type="date" value="' + html(manager.endDate || '') + '" aria-label="結束日"></div>';
    }).join('') + '</div>';
  }

  function bindStoreEditor() {
    var editor = byId('organizationStoreEditor');
    byId('organizationStoreClose').addEventListener('click', function () { editor.hidden = true; });
    byId('organizationPrimaryManager').addEventListener('change', function () {
      var primary = this.value;
      Array.prototype.forEach.call(document.querySelectorAll('#organizationManagerRows [data-manager-id]'), function (row) {
        var select = row.querySelector('[data-manager-type]');
        if (row.getAttribute('data-manager-id') === primary) select.value = '主責';
        else if (select.value === '主責') select.value = '共同管理';
      });
    });
    byId('organizationStorePreviewButton').addEventListener('click', previewStore);
    ['input', 'change'].forEach(function (eventName) {
      editor.addEventListener(eventName, function (event) {
        if (event.target.closest('#organizationStorePreview')) return;
        state.storePreview = null;
        state.storeRequestId = '';
        var preview = byId('organizationStorePreview');
        if (preview) preview.hidden = true;
      });
    });
  }

  function storePayload() {
    var store = state.store;
    var primary = byId('organizationPrimaryManager').value;
    var configs = Array.prototype.slice.call(document.querySelectorAll('#organizationManagerRows [data-manager-id]')).map(function (row) {
      var employeeId = row.getAttribute('data-manager-id');
      return {
        employeeId: employeeId,
        configType: employeeId === primary ? '主責' : row.querySelector('[data-manager-type]').value,
        isDefaultSigner: employeeId === primary,
        effectiveDate: row.querySelector('[data-manager-start]').value,
        endDate: row.querySelector('[data-manager-end]').value
      };
    });
    return {
      storeCode: store.storeCode,
      storeName: byId('organizationStoreName').value.trim(),
      area: byId('organizationStoreArea').value,
      department: byId('organizationStoreDepartment').value.trim(),
      areaSupervisorId: byId('organizationAreaSupervisor').value,
      primaryManagerId: primary,
      enabled: byId('organizationStoreEnabled').value,
      effectiveDate: byId('organizationStoreEffectiveDate').value,
      note: byId('organizationStoreNote').value.trim(),
      reason: byId('organizationStoreReason').value.trim(),
      managerConfigs: configs,
      expectedFingerprint: store.fingerprint
    };
  }

  async function previewStore() {
    var button = byId('organizationStorePreviewButton');
    setButtonBusy(button, true, '預覽中…');
    clearMessage();
    try {
      var result = await window.V3WorkflowService.organizationStorePreview(storePayload());
      state.storePreview = result.data || {};
      state.storeRequestId = window.V3ApiClient.createRequestId();
      renderStorePreview();
    } catch (error) { showMessage('error', error && error.message || '門市異動預覽失敗。'); }
    finally { setButtonBusy(button, false); }
  }

  function renderStorePreview() {
    var preview = state.storePreview || {};
    var target = byId('organizationStorePreview');
    target.hidden = false;
    target.innerHTML = previewHtml(preview) +
      '<label class="confirm-row"><input id="organizationStoreConfirm" type="checkbox"><span>我已確認門市、人員、未鎖定計畫與店長配置的影響；既有考核單不會自動改寫，確定執行。</span></label>' +
      '<div class="organization-editor-actions"><button id="organizationStoreExecute" class="primary-button" type="button" disabled>正式更新門市與所屬人員</button></div>';
    byId('organizationStoreConfirm').addEventListener('change', function () { byId('organizationStoreExecute').disabled = !this.checked; });
    byId('organizationStoreExecute').addEventListener('click', executeStore);
  }

  async function executeStore() {
    var payload = storePayload();
    payload.confirmed = true;
    payload.expectedFingerprint = state.storePreview.expectedFingerprint;
    var button = byId('organizationStoreExecute');
    setButtonBusy(button, true, '更新中…');
    try {
      var requestId = state.storeRequestId || window.V3ApiClient.createRequestId();
      state.storeRequestId = requestId;
      var result = await window.V3WorkflowService.organizationStoreUpdate(payload, requestId);
      var message = result.data && result.data.message || '門市資料已更新。';
      byId('organizationStoreEditor').hidden = true;
      var refreshed = await loadCenter({ requireSearch: false, quiet: true });
      showActionMessage(refreshed ? 'success' : 'warning', message + (refreshed ? '' : '；正式資料已寫入，但清單重新整理失敗，請按「重新整理」。'));
    } catch (error) {
      showActionMessage('error', error && error.message || '門市資料更新失敗。');
    } finally { setButtonBusy(button, false); }
  }

  function previewHtml(preview) {
    var changes = preview.changes || [];
    var warnings = preview.warnings || [];
    var impact = preview.impact || {};
    return '<div class="organization-preview-grid"><section><h5>異動內容</h5>' +
      (changes.length ? '<ul>' + changes.map(function (item) { return '<li><strong>' + html(item.label) + '</strong>：' + html(item.before || '（空白）') + ' → ' + html(item.after || '（空白）') + '</li>'; }).join('') + '</ul>' : '<p>主檔欄位沒有變更。</p>') +
      (preview.managerConfigurationChanged ? '<p><strong>店長配置：</strong>將依畫面設定更新。</p>' : '') + '</section>' +
      '<section><h5>影響範圍</h5><ul>' + Object.keys(impact).filter(function (key) { return key !== 'existingEvaluationsAutoChanged'; }).map(function (key) {
        var labels = { activeEvaluationCount:'進行中考核', subjectEvaluationCount:'受評人案件', assignedEvaluationCount:'承辦案件', unlockedPlanCount:'未鎖定計畫', lockedPlanCount:'已鎖定計畫', employeeCount:'所屬人員', activeEmployeeCount:'在職人員' };
        return '<li>' + html(labels[key] || key) + '：' + html(impact[key]) + '</li>';
      }).join('') + '<li>既有考核單自動改寫：否</li></ul></section></div>' +
      (warnings.length ? '<div class="organization-warning-box"><h5>例外警示（不一定阻擋）</h5><ul>' + warnings.map(function (item) { return '<li>' + html(item.message) + '</li>'; }).join('') + '</ul></div>' : '');
  }

  function init() {
    if (!window.V3WorkflowService || !window.V3ApiClient) return;
    if (!injectWorkspace()) {
      window.setTimeout(init, 150);
      return;
    }
    bindNavigation();
    bindPageEvents();
    if (String(window.location.hash || '') === '#system/organization') showOrganizationPage(true);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
