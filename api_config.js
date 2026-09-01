/**
 * 月考核系統｜GitHub 前端設定
 *
 * 只要修改 API_URL。
 * 請貼入 Apps Script「正式部署」且結尾為 /exec 的網址。
 * 不要使用 /dev，也不要使用 script.googleusercontent.com 的跳轉網址。
 */
window.V3_CONFIG = Object.freeze({
  APP_NAME: '月考核系統',
  APP_VERSION: '1.0.1',
  API_URL: 'https://script.google.com/macros/s/AKfycbw2Pvh2S0kOlpiNVOuF87njlMD8fUEF40WYIuE_OONKW4FOwjFBCwW6fiL18W-G8r4/exec',
  REQUEST_TIMEOUT_MS: 30000,
  SESSION_STORAGE_KEY: 'monthlyEvaluationV4Session'
});

/*
 * 資料一致性修正層（2026-09-01）
 * - 新增帳號轉任日：統一民國 YYY/MM/DD，並相容舊頁面西元日期。
 * - 組織異動：依異動後門市補齊營業處／區域／店名／單位代碼。
 *
 * 由獨立檔載入，避免直接大幅改動主程式；修正檔會等待 V3ApiClient 載入完成後再掛載。
 */
(function () {
  var script = document.createElement('script');
  script.src = 'data_consistency_hotfix.js?v=20260901-1';
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
})();
