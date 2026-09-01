/* 月考核系統 V4｜資料一致性修正｜2026-09-01
 * 1. 新增帳號：轉任日統一使用民國 YYY/MM/DD；相容舊頁面送出的西元日期。
 * 2. 人員與組織異動：依目標門市補齊異動後營業處／區域，避免只換店號與區域卻留下舊營業處。
 *
 * 此檔為前端相容保護。Apps Script 仍應同步加入相同的後端驗證與正規化，
 * 以防舊快取或其他客戶端繞過前端。
 */
(function () {
  'use strict';

  var API_PATCH_INTERVAL_MS = 50;
  var API_PATCH_MAX_ATTEMPTS = 400;
  var STORE_CACHE_TTL_MS = 120000;
  var apiPatchAttempts = 0;
  var storeCache = null;
  var storeCacheAt = 0;
  var apiPatched = false;

  function pad2(value) {
    return String(Number(value || 0)).padStart(2, '0');
  }

  function padRocYear(value) {
    return String(Number(value || 0)).padStart(3, '0');
  }

  function normalizeRocDate(value) {
    if (value === null || value === undefined || value === '') return '';

    if (Object.prototype.toString.call(value) === '[object Date]') {
      if (isNaN(value.getTime())) throw new Error('轉任日格式不正確。');
      return padRocYear(value.getFullYear() - 1911) + '/' + pad2(value.getMonth() + 1) + '/' + pad2(value.getDate());
    }

    var text = String(value || '').trim();
    if (!text) return '';

    if (/^\d{7}$/.test(text)) {
      text = text.slice(0, 3) + '/' + text.slice(3, 5) + '/' + text.slice(5, 7);
    } else if (/^\d{8}$/.test(text)) {
      text = text.slice(0, 4) + '/' + text.slice(4, 6) + '/' + text.slice(6, 8);
    } else {
      text = text.replace(/[.\-]/g, '/').replace(/\s+/g, '');
    }

    var match = text.match(/^(\d{2,4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!match) throw new Error('轉任日請輸入民國日期，例如 115/09/01。');

    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var gregorianYear;
    var rocYear;

    if (year >= 1912) {
      gregorianYear = year;
      rocYear = year - 1911;
    } else {
      rocYear = year;
      gregorianYear = year + 1911;
    }

    if (rocYear < 1 || month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error('轉任日格式不正確。');
    }

    var check = new Date(gregorianYear, month - 1, day);
    if (check.getFullYear() !== gregorianYear || check.getMonth() !== month - 1 || check.getDate() !== day) {
      throw new Error('轉任日不是有效日期。');
    }

    return padRocYear(rocYear) + '/' + pad2(month) + '/' + pad2(day);
  }

  function showInputError(input, message) {
    if (!input) return;
    input.setCustomValidity(String(message || ''));
    if (message && typeof input.reportValidity === 'function') input.reportValidity();
  }

  function enhanceTransferDateInput(input) {
    if (!input || input.dataset.rocDateEnhanced === '1') return;
    input.dataset.rocDateEnhanced = '1';

    var originalValue = String(input.value || '').trim();
    try {
      input.type = 'text';
    } catch (ignore) {}
    input.inputMode = 'numeric';
    input.maxLength = 10;
    input.placeholder = '例如 115/09/01';
    input.autocomplete = 'off';

    if (originalValue) {
      try { input.value = normalizeRocDate(originalValue); } catch (ignore2) {}
    }

    input.addEventListener('input', function () {
      showInputError(input, '');
    });

    input.addEventListener('blur', function () {
      var value = String(input.value || '').trim();
      if (!value) {
        showInputError(input, '');
        return;
      }
      try {
        input.value = normalizeRocDate(value);
        showInputError(input, '');
      } catch (error) {
        showInputError(input, error && error.message ? error.message : '轉任日格式不正確。');
      }
    });
  }

  function scanTransferDateInput() {
    enhanceTransferDateInput(document.getElementById('accountCreateTransferDate'));
  }

  function clonePayload(payload) {
    if (!payload || typeof payload !== 'object') return {};
    var result = {};
    Object.keys(payload).forEach(function (key) { result[key] = payload[key]; });
    return result;
  }

  function getStoreCode(store) {
    return String(store && (store.storeCode || store.code) || '').trim();
  }

  function buildStoreMap(data) {
    var stores = data && Array.isArray(data.stores) ? data.stores : [];
    var map = {};
    stores.forEach(function (store) {
      var code = getStoreCode(store);
      if (code) map[code] = store;
    });
    return map;
  }

  async function getStoreReferenceMap(originalApi, sessionToken) {
    var now = Date.now();
    if (storeCache && now - storeCacheAt < STORE_CACHE_TTL_MS) return storeCache;

    var response = await originalApi.request('organizationReferenceOptions', {}, sessionToken || '');
    var data = response && response.data ? response.data : {};
    storeCache = buildStoreMap(data);
    storeCacheAt = now;
    return storeCache;
  }

  function storeDepartment(store) {
    return String(store && (store.department || store.businessDepartment || store.unitDepartment) || '').trim();
  }

  function storeArea(store) {
    return String(store && (store.area || store.region) || '').trim();
  }

  async function enrichOrganizationPayload(originalApi, payload, sessionToken) {
    var nextPayload = clonePayload(payload);
    var items = Array.isArray(payload && payload.items) ? payload.items : [];
    if (!items.length) return nextPayload;

    var needStoreReference = items.some(function (item) {
      return Boolean(String(item && item.nextStoreCode || '').trim());
    });
    if (!needStoreReference) {
      nextPayload.items = items.map(clonePayload);
      return nextPayload;
    }

    var storeMap = await getStoreReferenceMap(originalApi, sessionToken);
    nextPayload.items = items.map(function (item) {
      var nextItem = clonePayload(item);
      var code = String(nextItem.nextStoreCode || '').trim();
      if (!code) return nextItem;

      var store = storeMap[code];
      if (!store) return nextItem;

      var department = storeDepartment(store);
      var area = storeArea(store);
      if (department) nextItem.nextDepartment = department;
      if (area) nextItem.nextArea = area;
      if (store.storeName) nextItem.nextStoreName = String(store.storeName);
      if (store.unitCode) nextItem.nextUnitCode = String(store.unitCode);
      return nextItem;
    });
    return nextPayload;
  }

  function makeFrontendApiError(originalApi, code, message) {
    if (originalApi && typeof originalApi.ApiError === 'function') return new originalApi.ApiError(code, message);
    var error = new Error(message);
    error.code = code;
    return error;
  }

  function installApiPatch() {
    if (apiPatched) return true;
    var originalApi = window.V3ApiClient;
    if (!originalApi || typeof originalApi.request !== 'function') return false;
    if (originalApi.__dataConsistencyPatched === true) {
      apiPatched = true;
      return true;
    }

    var patchedApi = {};
    Object.keys(originalApi).forEach(function (key) { patchedApi[key] = originalApi[key]; });

    patchedApi.request = async function (action, payload, sessionToken, requestId) {
      var actionName = String(action || '');
      var nextPayload = payload;

      if (actionName === 'accountCreate') {
        nextPayload = clonePayload(payload);
        try {
          nextPayload.transferDate = normalizeRocDate(nextPayload.transferDate);
        } catch (error) {
          throw makeFrontendApiError(originalApi, 'INVALID_TRANSFER_DATE', error && error.message ? error.message : '轉任日格式不正確。');
        }
      } else if (actionName === 'organizationChangePreview' || actionName === 'organizationChangeSave') {
        nextPayload = await enrichOrganizationPayload(originalApi, payload || {}, sessionToken || '');
      } else if (actionName === 'organizationSaveStore') {
        storeCache = null;
        storeCacheAt = 0;
      }

      var response = await originalApi.request(actionName, nextPayload, sessionToken, requestId);
      if (actionName === 'organizationChangeSave' || actionName === 'organizationSaveStore') {
        storeCache = null;
        storeCacheAt = 0;
      }
      return response;
    };

    patchedApi.__dataConsistencyPatched = true;
    window.V3ApiClient = Object.freeze(patchedApi);
    apiPatched = true;
    return true;
  }

  function waitForApiClient() {
    if (installApiPatch()) return;
    apiPatchAttempts += 1;
    if (apiPatchAttempts >= API_PATCH_MAX_ATTEMPTS) return;
    window.setTimeout(waitForApiClient, API_PATCH_INTERVAL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanTransferDateInput);
  } else {
    scanTransferDateInput();
  }

  if (window.MutationObserver) {
    new MutationObserver(function () { scanTransferDateInput(); }).observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  waitForApiClient();
})();
