const API_BASE_URL = "http://localhost:8000";
const TOKEN_KEY = "research_group_token";

let currentUser = null;
let selectedPaperIds = new Set();
let authorTags = [];
let institutionTags = [];

let activityEditor = null;
let resourceEditor = null;
let activityTags = [];
let resourceTags = [];
let activityImages = [];
let newActivityImageUrls = [];
let paperGridReady = false;
let sharedPaperGridReady = false;
let activityGridReady = false;
let meetingGridReady = false;
let memberGridReady = false;
let resourceGridReady = false;
let travelStandardGridReady = false;
let adminUserGridReady = false;
let adminPaperGridReady = false;
let meetingDocuments = [];
let meetingPhotos = [];
let userOptions = [];
let resourceTypes = [];
let currentResourcePost = null;

const skillDefinitions = [
  { key: "skill_petroleum_engineering", label: "数模" },
  { key: "skill_mathematics", label: "写作" },
  { key: "skill_ai_tools", label: "AI" },
  { key: "skill_coding", label: "汇报" },
  { key: "skill_presentation", label: "外语" },
  { key: "skill_organization", label: "比赛" },
];

const userExportColumns = [
  { key: "full_name", label: "真实姓名", checked: true },
  { key: "username", label: "账号" },
  { key: "telephone", label: "电话" },
  { key: "province", label: "省份" },
  { key: "city", label: "城市" },
  { key: "birthday", label: "生日" },
  { key: "enrollment_year", label: "入学年份" },
  { key: "is_graduated", label: "是否毕业" },
  { key: "graduation_year", label: "毕业年份" },
  { key: "bio", label: "个人说明" },
  { key: "undergraduate_school", label: "本科院校" },
  { key: "master_school", label: "硕士院校" },
  { key: "doctoral_school", label: "博士院校" },
  { key: "skill_petroleum_engineering", label: "数模" },
  { key: "skill_mathematics", label: "写作" },
  { key: "skill_ai_tools", label: "AI" },
  { key: "skill_coding", label: "汇报" },
  { key: "skill_presentation", label: "外语" },
  { key: "skill_organization", label: "比赛" },
  { key: "created_at", label: "创建时间" },
];

const breadcrumbMap = {
  profile: "个人中心 / 个人信息",
  members: "个人中心 / 课题组成员",
  papers: "成果管理 / 我的论文",
  sharedPapers: "成果管理 / 其他论文",
  resources: "成果管理 / 资料共享",
  activities: "活动管理 / 课题组活动",
  meetings: "活动管理 / 组会",
  travelStandards: "出差报销 / 报销标准",
  adminUsers: "后台管理 / 用户管理",
  adminPapers: "后台管理 / 论文管理",
};

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDate(value) {
  if (!value) {
    return new Date();
  }
  const parts = value.split("-");
  if (parts.length !== 3) {
    return new Date(value);
  }
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function formatTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function configureEasyUiDefaults() {
  if (!window.jQuery || !$.fn.datebox) {
    return;
  }
  $.fn.datebox.defaults.formatter = formatDate;
  $.fn.datebox.defaults.parser = parseDate;
  if ($.fn.datetimebox) {
    $.fn.datetimebox.defaults.formatter = (value) => `${formatDate(value)} ${formatTime(value)}`;
    $.fn.datetimebox.defaults.parser = (value) => value ? new Date(value.replace(/-/g, "/")) : new Date();
  }
  if ($.fn.timespinner) {
    $.fn.timespinner.defaults.formatter = formatTime;
  }
}

configureEasyUiDefaults();

function redirectToLogin() {
  localStorage.removeItem(TOKEN_KEY);
  if (!document.body.classList.contains("page-login")) {
    window.location.href = "./login.html";
  }
}

$.ajaxSetup({
  complete(xhr) {
    if (xhr.status === 401) {
      redirectToLogin();
    }
  },
});

function formToObject(formSelector) {
  const values = {};
  $(formSelector).serializeArray().forEach((item) => {
    const value = item.value.trim();
    if (value !== "") {
      values[item.name] = value;
    }
  });

  [
    "enrollment_year",
    "graduation_year",
    "is_graduated",
    ...skillDefinitions.map((item) => item.key),
  ].forEach((key) => {
    if (values[key] !== undefined) {
      values[key] = Number(values[key]);
    }
  });

  return values;
}

function profileFormToObject() {
  const values = {};
  $("#profileForm").serializeArray().forEach((item) => {
    values[item.name] = item.value.trim();
  });

  ["enrollment_year", "graduation_year"].forEach((key) => {
    values[key] = values[key] === "" ? null : Number(values[key]);
  });
  values.is_graduated = Number(values.is_graduated || 0);
  skillDefinitions.forEach((item) => {
    const value = values[item.key];
    values[item.key] = value === "" || value === undefined ? 50 : Number(value);
  });

  return values;
}

function showError(error) {
  const detail = error?.responseJSON?.detail;
  const message = Array.isArray(detail)
    ? detail.map((item) => item.msg).join("；")
    : detail || error?.message || "请求失败，请稍后重试";
  $.messager.alert("提示", message, "error");
}

function authHeaders(extra = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token && !document.body.classList.contains("page-login")) {
    redirectToLogin();
  }
  return token ? { Authorization: `Bearer ${token}`, ...extra } : extra;
}

function urlWithAccessToken(url) {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}access_token=${encodeURIComponent(token)}`;
}

function saveSession(data) {
  localStorage.setItem(TOKEN_KEY, data.access_token);
  window.location.href = "./index.html";
}

function requestAuth(path, payload) {
  return $.ajax({
    url: `${API_BASE_URL}${path}`,
    method: "POST",
    contentType: "application/json",
    data: JSON.stringify(payload),
  });
}

function login() {
  if (!$("#loginForm").form("validate")) {
    return;
  }

  requestAuth("/api/auth/login", formToObject("#loginForm"))
    .done(saveSession)
    .fail(showError);
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  window.location.href = "./login.html";
}

function loadCurrentUser() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.href = "./login.html";
    return;
  }

  $.ajax({
    url: `${API_BASE_URL}/api/auth/me`,
    method: "GET",
    headers: authHeaders(),
  })
    .done((user) => {
      currentUser = user;
      $.when(loadUserOptions(), loadResourceTypes())
        .always(() => {
          renderProfile(user);
          updateAdminMenu();
          initHome();
        });
    })
    .fail(() => {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = "./login.html";
    });
}

function updateAdminMenu() {
  if (currentUser?.is_admin) {
    $("#adminMenuNode").removeClass("hidden");
  } else {
    $("#adminMenuNode").addClass("hidden");
  }
  if ($("#sideMenu").data("tree")) {
    $("#sideMenu").tree("expandAll");
  }
}

function loadUserOptions() {
  return $.ajax({
    url: `${API_BASE_URL}/api/users/options`,
    method: "GET",
    headers: authHeaders(),
  }).done((users) => {
    userOptions = users;
    $("#meetingSpeakerInput").combobox("loadData", userOptions);
    $("#meetingAttendeesInput").combobox("loadData", userOptions);
    $("#meetingSpeakerSearch").combobox("loadData", userOptions);
  });
}

function loadResourceTypes() {
  return $.ajax({
    url: `${API_BASE_URL}/api/resource-types`,
    method: "GET",
    headers: authHeaders(),
  }).done((types) => {
    resourceTypes = (types || []).map((item) => ({ label: item, value: item }));
    const searchOptions = [{ label: "全部", value: "" }, ...resourceTypes];
    $("#resourceTypeSearch").combobox("loadData", searchOptions);
    $("#resourceTypeInput").combobox("loadData", resourceTypes);
  });
}

function displayValue(value) {
  return value === null || value === undefined || value === "" ? "-" : value;
}

function getAvatarUrl(user) {
  if (!user?.avatar_url) {
    return "https://www.jeasyui.com/easyui/themes/icons/man.png";
  }
  if (user.avatar_url.startsWith("uploads/")) {
    return `${API_BASE_URL}/${user.avatar_url}`;
  }
  const rawUrl = user.avatar_url.startsWith("/")
    ? `${API_BASE_URL}${user.avatar_url}`
    : user.avatar_url;
  return rawUrl.includes("/api/") ? urlWithAccessToken(rawUrl) : rawUrl;
}

function renderDefinitionList(selector, rows) {
  const html = rows.map((row) => `
    <div class="resume-field">
      <dt>${row.label}</dt>
      <dd>${displayValue(row.value)}</dd>
    </div>
  `).join("");
  $(selector).html(html);
}

function skillValue(user, key) {
  const value = Number(user?.[key]);
  return Number.isFinite(value) ? value : 50;
}

function renderSkillChart(elementId, user) {
  const element = document.getElementById(elementId);
  if (!element) {
    return;
  }
  if (!window.echarts) {
    element.innerHTML = skillDefinitions.map((item) => (
      `<span class="skill-pill">${item.label}：${skillValue(user, item.key)}</span>`
    )).join("");
    return;
  }

  const chart = echarts.init(element);
  chart.setOption({
    tooltip: {},
    radar: {
      radius: "68%",
      indicator: skillDefinitions.map((item) => ({ name: item.label, max: 100 })),
      axisName: { color: "#314154", fontSize: 12 },
      splitLine: { lineStyle: { color: "#d9e2ec" } },
      splitArea: { areaStyle: { color: ["#ffffff", "#f5f8fb"] } },
    },
    series: [{
      type: "radar",
      data: [{
        value: skillDefinitions.map((item) => skillValue(user, item.key)),
        name: "能力值",
        areaStyle: { color: "rgba(40, 116, 166, 0.22)" },
        lineStyle: { color: "#2874a6", width: 2 },
        itemStyle: { color: "#2874a6" },
      }],
    }],
  });
  setTimeout(() => chart.resize(), 80);
}

function renderResume(user, prefix) {
  $(`#${prefix}Avatar`).attr("src", getAvatarUrl(user));
  $(`#${prefix}Name`).text(user.full_name || user.username);
  $(`#${prefix}Meta`).text([
    user.username ? `账号：${user.username}` : "",
    user.telephone,
    [user.province, user.city].filter(Boolean).join(""),
  ].filter(Boolean).join(" / "));
  $(`#${prefix}Bio`).text(displayValue(user.bio));

  renderDefinitionList(`#${prefix}Basic`, [
    { label: "真实姓名", value: user.full_name },
    { label: "电话", value: user.telephone },
    { label: "所在地", value: [user.province, user.city].filter(Boolean).join("") },
    { label: "生日", value: user.birthday },
    { label: "入学年份", value: user.enrollment_year },
    { label: "是否毕业", value: Number(user.is_graduated) ? "是" : "否" },
    { label: "毕业年份", value: user.graduation_year },
  ]);
  renderDefinitionList(`#${prefix}Education`, [
    { label: "本科院校", value: user.undergraduate_school },
    { label: "硕士院校", value: user.master_school },
    { label: "博士院校", value: user.doctoral_school },
    { label: "创建时间", value: user.created_at },
  ]);
  renderSkillChart(`${prefix}SkillChart`, user);
}

function renderProfile(user) {
  $("#topbarUser").text(user.full_name || user.username);
  $("#topbarAvatar").attr("src", getAvatarUrl(user));
  renderResume(user, "profile");
}

function showAccountMenu(event) {
  $("#accountMenu").menu("show", {
    left: event.pageX - 120,
    top: event.pageY + 18,
  });
}

function handleAccountMenuClick(item) {
  if (item.name === "profile") {
    switchView("profile");
  } else if (item.name === "editProfile") {
    openProfileDialog();
  } else if (item.name === "password") {
    openPasswordDialog();
  } else if (item.name === "avatar") {
    $("#avatarFile").trigger("click");
  } else if (item.name === "logout") {
    logout();
  }
}

function openProfileDialog() {
  if (!currentUser) {
    return;
  }
  $("#profileForm").form("clear");
  $("#profileForm").form("load", {
    ...currentUser,
    is_graduated: String(currentUser.is_graduated || 0),
  });
  $("#profileDialog").dialog("open");
}

function saveProfile() {
  if (!$("#profileForm").form("validate")) {
    return;
  }
  const payload = profileFormToObject();
  delete payload.id;
  delete payload.username;
  delete payload.avatar_url;
  delete payload.created_at;

  $.ajax({
    url: `${API_BASE_URL}/api/auth/me/profile`,
    method: "PUT",
    headers: authHeaders(),
    contentType: "application/json",
    data: JSON.stringify(payload),
  })
    .done((user) => {
      currentUser = user;
      renderProfile(user);
      $("#profileDialog").dialog("close");
      $.messager.show({ title: "提示", msg: "个人资料已保存" });
    })
    .fail(showError);
}

function openPasswordDialog() {
  $("#passwordForm").form("clear");
  $("#passwordDialog").dialog("open");
}

function savePassword() {
  if (!$("#passwordForm").form("validate")) {
    return;
  }
  const values = formToObject("#passwordForm");
  if (values.new_password !== values.confirm_password) {
    $.messager.alert("提示", "两次输入的新密码不一致", "warning");
    return;
  }
  delete values.confirm_password;
  $.ajax({
    url: `${API_BASE_URL}/api/auth/me/password`,
    method: "PUT",
    headers: authHeaders(),
    contentType: "application/json",
    data: JSON.stringify(values),
  })
    .done(() => {
      $("#passwordDialog").dialog("close");
      $.messager.show({ title: "提示", msg: "密码已修改" });
    })
    .fail(showError);
}

function uploadAvatar() {
  const input = $("#avatarFile")[0];
  const file = input.files[0];
  if (!file) {
    return;
  }
  const formData = new FormData();
  formData.append("file", file);
  $.ajax({
    url: `${API_BASE_URL}/api/auth/me/avatar`,
    method: "POST",
    headers: authHeaders(),
    data: formData,
    processData: false,
    contentType: false,
  })
    .done((user) => {
      currentUser = user;
      renderProfile(user);
      $.messager.show({ title: "提示", msg: "头像已更新" });
    })
    .fail(showError)
    .always(() => {
      input.value = "";
    });
}

function initHome() {
  $("#sideMenu").tree({
    onClick(node) {
      const view = node.attributes?.view;
      if (view) {
        switchView(view);
      }
    },
  });
  $("#sideMenu").tree("expandAll");
}

function switchView(view) {
  $(".view-panel").addClass("hidden");
  $("#breadcrumb").text(breadcrumbMap[view] || breadcrumbMap.profile);
  if (view === "papers") {
    $("#papersView").removeClass("hidden");
    ensurePaperGrid();
    $("#paperGrid").datagrid("resize");
    $("#paperGrid").datagrid("reload");
  } else if (view === "sharedPapers") {
    $("#sharedPapersView").removeClass("hidden");
    ensureSharedPaperGrid();
    $("#sharedPaperGrid").datagrid("resize");
    $("#sharedPaperGrid").datagrid("reload");
  } else if (view === "activities") {
    $("#activitiesView").removeClass("hidden");
    ensureActivityGrid();
    $("#activityGrid").datagrid("resize");
    $("#activityGrid").datagrid("reload");
  } else if (view === "meetings") {
    $("#meetingsView").removeClass("hidden");
    ensureMeetingGrid();
    $("#meetingGrid").datagrid("resize");
    $("#meetingGrid").datagrid("reload");
  } else if (view === "resources") {
    $("#resourcesView").removeClass("hidden");
    ensureResourceGrid();
    $("#resourceGrid").datagrid("resize");
    $("#resourceGrid").datagrid("reload");
  } else if (view === "travelStandards") {
    $("#travelStandardsView").removeClass("hidden");
    ensureTravelStandardGrid();
    $("#travelStandardGrid").datagrid("resize");
    loadTravelStandards();
  } else if (view === "adminUsers") {
    if (!ensureAdminAccess()) {
      return;
    }
    $("#adminUsersView").removeClass("hidden");
    ensureAdminUserGrid();
    $("#adminUserGrid").datagrid("resize");
    $("#adminUserGrid").datagrid("reload");
  } else if (view === "adminPapers") {
    if (!ensureAdminAccess()) {
      return;
    }
    $("#adminPapersView").removeClass("hidden");
    ensureAdminPaperGrid();
    $("#adminPaperGrid").datagrid("resize");
    $("#adminPaperGrid").datagrid("reload");
  } else if (view === "members") {
    $("#membersView").removeClass("hidden");
    ensureMemberGrid();
    $("#memberGrid").datagrid("resize");
    $("#memberGrid").datagrid("reload");
  } else {
    $("#profileView").removeClass("hidden");
    renderSkillChart("profileSkillChart", currentUser);
  }
}

function ensurePaperGrid() {
  if (!paperGridReady) {
    initPaperGrid();
    paperGridReady = true;
  }
}

function ensureSharedPaperGrid() {
  if (!sharedPaperGridReady) {
    initSharedPaperGrid();
    sharedPaperGridReady = true;
  }
}

function ensureMemberGrid() {
  if (!memberGridReady) {
    initMemberGrid();
    memberGridReady = true;
  }
}

function ensureResourceGrid() {
  if (!resourceGridReady) {
    initResourceGrid();
    resourceGridReady = true;
  }
}

function ensureTravelStandardGrid() {
  if (!travelStandardGridReady) {
    initTravelStandardGrid();
    travelStandardGridReady = true;
  }
}

function ensureAdminAccess() {
  if (currentUser?.is_admin) {
    return true;
  }
  $.messager.alert("提示", "需要管理员权限", "warning");
  $("#profileView").removeClass("hidden");
  $("#breadcrumb").text(breadcrumbMap.profile);
  return false;
}

function ensureAdminUserGrid() {
  if (!adminUserGridReady) {
    initAdminUserGrid();
    adminUserGridReady = true;
  }
}

function ensureAdminPaperGrid() {
  if (!adminPaperGridReady) {
    initAdminPaperGrid();
    adminPaperGridReady = true;
  }
}

function formatTravelStandardCell(value) {
  return value || "-";
}

function initTravelStandardGrid() {
  $("#travelStandardGrid").datagrid({
    fit: true,
    border: false,
    toolbar: "#travelStandardToolbar",
    rownumbers: true,
    singleSelect: true,
    nowrap: false,
    columns: [[
      { field: "empty", title: "内容", width: 160, formatter: formatTravelStandardCell },
    ]],
  });
}

function applyTravelStandardHeaderStyle(columns) {
  setTimeout(() => {
    const standardFields = columns
      .filter((column) => String(column.title || "").includes("其他"))
      .map((column) => column.field);
    $("#travelStandardGrid").closest(".datagrid").find(".datagrid-header td").removeClass("travel-standard-person-header");
    standardFields.forEach((field) => {
      $("#travelStandardGrid")
        .closest(".datagrid")
        .find(`.datagrid-header td[field='${field}']`)
        .addClass("travel-standard-person-header");
    });
  }, 0);
}

function loadTravelStandards() {
  $.ajax({
    url: `${API_BASE_URL}/api/travel/standards`,
    method: "GET",
    headers: authHeaders(),
  })
    .done((data) => {
      const columns = (data.columns || []).map((column) => ({
        field: column.field,
        title: column.title,
        width: Math.max(110, Math.min(240, String(column.title || "").length * 18 + 60)),
        sortable: true,
        formatter: formatTravelStandardCell,
      }));
      $("#travelStandardDownload").attr("href", urlWithAccessToken(`${API_BASE_URL}${data.download_url}`));
      $("#travelStandardGrid").datagrid({
        columns: [columns.length ? columns : [{ field: "empty", title: "内容", width: 160 }]],
      });
      $("#travelStandardGrid").datagrid("loadData", {
        total: data.total || 0,
        rows: data.rows || [],
      });
      applyTravelStandardHeaderStyle(columns);
    })
    .fail(showError);
}

function downloadTravelStandards() {
  const link = document.createElement("a");
  link.href = urlWithAccessToken(`${API_BASE_URL}/api/travel/standards/download`);
  link.download = "差旅住宿费标准明细表.xlsx";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function memberQueryParams(param) {
  return {
    page: param.page || 1,
    rows: param.rows || 10,
    keyword: $("#memberKeyword").textbox("getValue"),
    exclude_self: 0,
  };
}

function formatMemberActions(_value, row) {
  return `<a href="javascript:void(0)" onclick="viewMemberProfile(${row.id})">查看资料</a>`;
}

function initMemberGrid() {
  $("#memberGrid").datagrid({
    fit: true,
    border: false,
    toolbar: "#memberToolbar",
    pagination: true,
    pageSize: 10,
    pageList: [10, 20, 50],
    rownumbers: true,
    singleSelect: true,
    loader(param, success, error) {
      $.ajax({
        url: `${API_BASE_URL}/api/users`,
        method: "GET",
        data: memberQueryParams(param),
        headers: authHeaders(),
      }).done(success).fail(error);
    },
    columns: [[
      { field: "full_name", title: "真实姓名", width: 120 },
      { field: "telephone", title: "电话", width: 130 },
      { field: "province", title: "省份", width: 90 },
      { field: "city", title: "城市", width: 90 },
      { field: "enrollment_year", title: "入学年份", width: 90 },
      { field: "is_graduated", title: "是否毕业", width: 80, formatter: formatBoolean },
      { field: "graduation_year", title: "毕业年份", width: 90 },
      { field: "actions", title: "操作", width: 100, formatter: formatMemberActions },
    ]],
    onDblClickRow(_index, row) {
      viewMemberProfile(row.id);
    },
  });
}

function searchMembers() {
  $("#memberGrid").datagrid("load", {});
}

function resetMemberSearch() {
  $("#memberKeyword").textbox("clear");
  $("#memberGrid").datagrid("load", {});
}

function adminUserQueryParams(param) {
  return {
    page: param.page || 1,
    rows: param.rows || 10,
    keyword: $("#adminUserKeyword").textbox("getValue"),
    exclude_self: 0,
  };
}

function formatAdminFlag(value) {
  return Number(value) === 1 ? "管理员" : "成员";
}

function initAdminUserGrid() {
  $("#adminUserGrid").datagrid({
    fit: true,
    border: false,
    toolbar: "#adminUserToolbar",
    pagination: true,
    pageSize: 10,
    pageList: [10, 20, 50],
    rownumbers: true,
    singleSelect: true,
    loader(param, success, error) {
      $.ajax({
        url: `${API_BASE_URL}/api/users`,
        method: "GET",
        data: adminUserQueryParams(param),
        headers: authHeaders(),
      }).done(success).fail(error);
    },
    columns: [[
      { field: "full_name", title: "姓名", width: 110 },
      { field: "username", title: "账号", width: 120 },
      { field: "is_admin", title: "角色", width: 90, formatter: formatAdminFlag },
      { field: "telephone", title: "电话", width: 130 },
      { field: "province", title: "省份", width: 90 },
      { field: "city", title: "城市", width: 90 },
      { field: "enrollment_year", title: "入学年份", width: 90 },
      { field: "created_at", title: "创建时间", width: 150 },
    ]],
  });
}

function searchAdminUsers() {
  $("#adminUserGrid").datagrid("load", {});
}

function resetAdminUserSearch() {
  $("#adminUserKeyword").textbox("clear");
  $("#adminUserGrid").datagrid("load", {});
}

function adminUserFormToObject() {
  const values = {};
  $("#adminUserForm").serializeArray().forEach((item) => {
    values[item.name] = item.value.trim();
  });
  ["enrollment_year", "graduation_year"].forEach((key) => {
    values[key] = values[key] === "" ? null : Number(values[key]);
  });
  values.is_graduated = Number(values.is_graduated || 0);
  skillDefinitions.forEach((item) => {
    const value = values[item.key];
    values[item.key] = value === "" || value === undefined ? 50 : Number(value);
  });
  [
    "telephone",
    "province",
    "city",
    "birthday",
    "bio",
    "undergraduate_school",
    "master_school",
    "doctoral_school",
  ].forEach((key) => {
    values[key] = values[key] || null;
  });
  return values;
}

function setAdminUserDialogMode(isEdit) {
  $("#adminUsername").textbox("readonly", isEdit);
  $("#adminUserPassword").passwordbox("setValue", "");
  $("#adminUserPassword").passwordbox("textbox").validatebox({
    required: !isEdit,
  });
}

function openAdminUserDialog(row = null) {
  const isEdit = Boolean(row);
  $("#adminUserForm").form("clear");
  setAdminUserDialogMode(isEdit);
  if (row) {
    $("#adminUserDialog").dialog("setTitle", "编辑用户");
    $("#adminUserForm").form("load", {
      ...row,
      is_graduated: String(row.is_graduated || 0),
      password: "",
    });
  } else {
    $("#adminUserDialog").dialog("setTitle", "创建用户");
    $("#adminUserForm").form("load", {
      password: "123456",
      is_graduated: "0",
      skill_petroleum_engineering: 50,
      skill_mathematics: 50,
      skill_ai_tools: 50,
      skill_coding: 50,
      skill_presentation: 50,
      skill_organization: 50,
    });
  }
  $("#adminUserDialog").dialog("open");
}

function editSelectedAdminUser() {
  const row = $("#adminUserGrid").datagrid("getSelected");
  if (!row) {
    $.messager.alert("提示", "请先选择一个用户", "info");
    return;
  }
  openAdminUserDialog(row);
}

function saveAdminUser() {
  if (!$("#adminUserForm").form("validate")) {
    return;
  }
  const values = adminUserFormToObject();
  const id = values.id;
  const method = id ? "PUT" : "POST";
  const url = id ? `${API_BASE_URL}/api/admin/users/${id}` : `${API_BASE_URL}/api/admin/users`;
  if (id) {
    delete values.id;
    delete values.username;
    delete values.password;
  }
  $.ajax({
    url,
    method,
    headers: authHeaders(),
    contentType: "application/json",
    data: JSON.stringify(values),
  })
    .done(() => {
      $("#adminUserDialog").dialog("close");
      $("#adminUserGrid").datagrid("reload");
      loadUserOptions();
      $.messager.show({ title: "提示", msg: "用户信息已保存" });
    })
    .fail(showError);
}

function deleteSelectedAdminUser() {
  const row = $("#adminUserGrid").datagrid("getSelected");
  if (!row) {
    $.messager.alert("提示", "请先选择一个用户", "info");
    return;
  }
  $.messager.confirm("确认删除", `确定要删除用户“${row.full_name}”吗？`, (confirmed) => {
    if (!confirmed) {
      return;
    }
    $.ajax({
      url: `${API_BASE_URL}/api/admin/users/${row.id}`,
      method: "DELETE",
      headers: authHeaders(),
    })
      .done(() => {
        $("#adminUserGrid").datagrid("reload");
        loadUserOptions();
        $.messager.show({ title: "提示", msg: "用户已删除" });
      })
      .fail(showError);
  });
}

function openAdminResetPasswordDialog() {
  const row = $("#adminUserGrid").datagrid("getSelected");
  if (!row) {
    $.messager.alert("提示", "请先选择一个用户", "info");
    return;
  }
  $("#adminResetPasswordForm").form("clear");
  $("#adminResetPasswordForm").form("load", {
    user_id: row.id,
    full_name: `${row.full_name}（${row.username}）`,
  });
  $("#adminResetPasswordDialog").dialog("open");
}

function adminResetPassword() {
  if (!$("#adminResetPasswordForm").form("validate")) {
    return;
  }
  const values = formToObject("#adminResetPasswordForm");
  if (values.new_password !== values.confirm_password) {
    $.messager.alert("提示", "两次输入的新密码不一致", "warning");
    return;
  }
  $.ajax({
    url: `${API_BASE_URL}/api/admin/users/${values.user_id}/reset-password`,
    method: "POST",
    headers: authHeaders(),
    contentType: "application/json",
    data: JSON.stringify({ new_password: values.new_password }),
  })
    .done(() => {
      $("#adminResetPasswordDialog").dialog("close");
      $.messager.show({ title: "提示", msg: "密码已重设" });
    })
    .fail(showError);
}

function adminPaperQueryParams(param) {
  return {
    page: param.page || 1,
    rows: param.rows || 10,
    keyword: $("#adminPaperKeyword").textbox("getValue"),
    author: $("#adminPaperAuthor").textbox("getValue"),
    start_date: $("#adminPaperStartDate").datebox("getValue"),
    end_date: $("#adminPaperEndDate").datebox("getValue"),
    sort: param.sort || "publish_date",
    order: param.order || "desc",
  };
}

function initAdminPaperGrid() {
  $("#adminPaperGrid").datagrid({
    fit: true,
    border: false,
    toolbar: "#adminPaperToolbar",
    pagination: true,
    pageSize: 10,
    pageList: [10, 20, 50],
    remoteSort: true,
    sortName: "publish_date",
    sortOrder: "desc",
    rownumbers: true,
    singleSelect: true,
    loader(param, success, error) {
      $.ajax({
        url: `${API_BASE_URL}/api/admin/papers`,
        method: "GET",
        data: adminPaperQueryParams(param),
        headers: authHeaders(),
      }).done(success).fail(error);
    },
    columns: [[
      { field: "title", title: "标题", width: 250 },
      { field: "owner_name", title: "所属成员", width: 100 },
      { field: "journal_name", title: "期刊名", width: 160 },
      { field: "publisher", title: "出版社", width: 110 },
      { field: "publication_category", title: "分类", width: 170, formatter: formatPaperClass },
      { field: "corresponding_author", title: "通讯作者", width: 100 },
      { field: "first_author", title: "第一作者", width: 100 },
      { field: "all_authors", title: "全部作者", width: 190, formatter: formatList },
      { field: "publish_date", title: "发表时间", width: 100, sortable: true },
      { field: "is_published", title: "是否见刊", width: 80, formatter: formatBoolean },
      { field: "download_url", title: "下载", width: 150, formatter: formatPaperActions },
    ]],
  });
}

function searchAdminPapers() {
  $("#adminPaperGrid").datagrid("load", {});
}

function resetAdminPaperSearch() {
  $("#adminPaperKeyword").textbox("clear");
  $("#adminPaperAuthor").textbox("clear");
  $("#adminPaperStartDate").datebox("clear");
  $("#adminPaperEndDate").datebox("clear");
  $("#adminPaperGrid").datagrid("load", {});
}

function getSelectedAdminPaper() {
  const row = $("#adminPaperGrid").datagrid("getSelected");
  if (!row) {
    $.messager.alert("提示", "请先选择一篇论文", "info");
    return null;
  }
  return row;
}

function editSelectedAdminPaper() {
  const row = getSelectedAdminPaper();
  if (row) {
    openPaperDialog(row);
  }
}

function deleteSelectedAdminPaper() {
  const row = getSelectedAdminPaper();
  if (!row) {
    return;
  }
  $.messager.confirm("确认删除", `确定删除《${row.title}》吗？`, (confirmed) => {
    if (!confirmed) {
      return;
    }
    $.ajax({
      url: `${API_BASE_URL}/api/papers/${row.id}`,
      method: "DELETE",
      headers: authHeaders(),
    })
      .done(() => $("#adminPaperGrid").datagrid("reload"))
      .fail(showError);
  });
}

function renderUserExportColumns() {
  const html = userExportColumns.map((column) => `
    <label class="export-column-item">
      <input type="checkbox" value="${column.key}" ${column.checked ? "checked" : ""}>
      <span>${column.label}</span>
    </label>
  `).join("");
  $("#userExportColumns").html(html);
}

function openUserExportDialog() {
  renderUserExportColumns();
  $("#userExportDialog").dialog("open");
}

function exportUsers() {
  const columns = $("#userExportColumns input:checked").map(function () {
    return this.value;
  }).get();
  if (!columns.length) {
    $.messager.alert("提示", "请至少选择一列", "warning");
    return;
  }
  fetch(`${API_BASE_URL}/api/users/export`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ columns }),
  })
    .then((response) => {
      if (response.status === 401) {
        redirectToLogin();
        throw new Error("登录已过期，请重新登录");
      }
      if (!response.ok) {
        throw new Error("导出失败");
      }
      return response.blob();
    })
    .then((blob) => {
      downloadBlob(blob, `users_${formatDate(new Date())}.xlsx`);
      $("#userExportDialog").dialog("close");
    })
    .catch((error) => $.messager.alert("提示", error.message, "error"));
}

function viewMemberProfile(userId) {
  $.ajax({
    url: `${API_BASE_URL}/api/users/${userId}`,
    method: "GET",
    headers: authHeaders(),
  })
    .done((user) => {
      renderResume(user, "member");
      $("#memberProfileDialog").dialog("setTitle", `${user.full_name || user.username} 的资料`);
      $("#memberProfileDialog").dialog("open");
      setTimeout(() => renderSkillChart("memberSkillChart", user), 120);
    })
    .fail(showError);
}

function formatList(value) {
  return Array.isArray(value) ? value.join("；") : displayValue(value);
}

function formatBoolean(value) {
  return Number(value) ? "是" : "否";
}

function formatPaperActions(_value, row) {
  const fileButton = row.uploaded_file_path
    ? `<a href="javascript:void(0)" onclick="downloadUploadedFile(${row.id})">下载文件</a>`
    : "无文件";
  const urlButton = row.download_url
    ? `<a href="${row.download_url}" target="_blank" rel="noreferrer">打开地址</a>`
    : "无地址";
  return `${urlButton} ｜ ${fileButton}`;
}

function formatPaperClass(_value, row) {
  const parts = [row.language, row.publication_category, row.publication_subtype].filter(Boolean);
  if (row.publication_category === "SCI") {
    parts.push(row.sci_partition, row.cug_partition);
  }
  return parts.filter(Boolean).join(" / ") || "-";
}

function paperQueryParams(param) {
  return {
    page: param.page || 1,
    rows: param.rows || 10,
    keyword: $("#paperKeyword").textbox("getValue"),
    start_date: $("#paperStartDate").datebox("getValue"),
    end_date: $("#paperEndDate").datebox("getValue"),
    sort: param.sort || "publish_date",
    order: param.order || "desc",
  };
}

function initPaperGrid() {
  $("#paperGrid").datagrid({
    fit: true,
    border: false,
    toolbar: "#paperToolbar",
    pagination: true,
    pageSize: 10,
    pageList: [10, 20, 50],
    remoteSort: true,
    sortName: "publish_date",
    sortOrder: "desc",
    rownumbers: true,
    idField: "id",
    singleSelect: false,
    checkOnSelect: true,
    selectOnCheck: true,
    loader(param, success, error) {
      $.ajax({
        url: `${API_BASE_URL}/api/papers`,
        method: "GET",
        data: paperQueryParams(param),
        headers: authHeaders(),
      }).done(success).fail(error);
    },
    columns: [[
      { field: "ck", checkbox: true },
      { field: "title", title: "标题", width: 260 },
      { field: "journal_name", title: "期刊名", width: 170 },
      { field: "publisher", title: "出版社", width: 120 },
      { field: "publication_category", title: "分类", width: 170, formatter: formatPaperClass },
      { field: "sci_partition", title: "SCI分区", width: 80 },
      { field: "cug_partition", title: "地大分区", width: 80 },
      { field: "corresponding_author", title: "通讯作者", width: 100 },
      { field: "first_author", title: "第一作者", width: 100 },
      { field: "all_authors", title: "全部作者", width: 190, formatter: formatList },
      { field: "institution_list", title: "机构列表", width: 220, formatter: formatList },
      { field: "publish_date", title: "发表时间", width: 100, sortable: true },
      { field: "is_published", title: "是否见刊", width: 80, formatter: formatBoolean },
      { field: "download_url", title: "下载", width: 150, formatter: formatPaperActions },
    ]],
    onLoadSuccess(data) {
      const grid = $("#paperGrid");
      data.rows.forEach((row, index) => {
        if (selectedPaperIds.has(row.id)) {
          grid.datagrid("checkRow", index);
        }
      });
      updateSelectedCount();
    },
    onCheck(_index, row) {
      selectedPaperIds.add(row.id);
      updateSelectedCount();
    },
    onUncheck(_index, row) {
      selectedPaperIds.delete(row.id);
      updateSelectedCount();
    },
    onCheckAll(rows) {
      rows.forEach((row) => selectedPaperIds.add(row.id));
      updateSelectedCount();
    },
    onUncheckAll(rows) {
      rows.forEach((row) => selectedPaperIds.delete(row.id));
      updateSelectedCount();
    },
  });
}

function sharedPaperQueryParams(param) {
  return {
    page: param.page || 1,
    rows: param.rows || 10,
    keyword: $("#sharedPaperKeyword").textbox("getValue"),
    author: $("#sharedPaperAuthor").textbox("getValue"),
    start_date: $("#sharedPaperStartDate").datebox("getValue"),
    end_date: $("#sharedPaperEndDate").datebox("getValue"),
    sort: param.sort || "publish_date",
    order: param.order || "desc",
  };
}

function initSharedPaperGrid() {
  $("#sharedPaperGrid").datagrid({
    fit: true,
    border: false,
    toolbar: "#sharedPaperToolbar",
    pagination: true,
    pageSize: 10,
    pageList: [10, 20, 50],
    remoteSort: true,
    sortName: "publish_date",
    sortOrder: "desc",
    rownumbers: true,
    singleSelect: true,
    loader(param, success, error) {
      $.ajax({
        url: `${API_BASE_URL}/api/papers/shared`,
        method: "GET",
        data: sharedPaperQueryParams(param),
        headers: authHeaders(),
      }).done(success).fail(error);
    },
    columns: [[
      { field: "title", title: "标题", width: 250 },
      { field: "owner_name", title: "所属成员", width: 100 },
      { field: "journal_name", title: "期刊名", width: 160 },
      { field: "publisher", title: "出版社", width: 110 },
      { field: "publication_category", title: "分类", width: 170, formatter: formatPaperClass },
      { field: "sci_partition", title: "SCI分区", width: 80 },
      { field: "cug_partition", title: "地大分区", width: 80 },
      { field: "corresponding_author", title: "通讯作者", width: 100 },
      { field: "first_author", title: "第一作者", width: 100 },
      { field: "all_authors", title: "全部作者", width: 190, formatter: formatList },
      { field: "institution_list", title: "机构列表", width: 220, formatter: formatList },
      { field: "publish_date", title: "发表时间", width: 100, sortable: true },
      { field: "is_published", title: "是否见刊", width: 80, formatter: formatBoolean },
      { field: "download_url", title: "下载", width: 150, formatter: formatPaperActions },
    ]],
  });
}

function searchSharedPapers() {
  $("#sharedPaperGrid").datagrid("load", {});
}

function resetSharedPaperSearch() {
  $("#sharedPaperKeyword").textbox("clear");
  $("#sharedPaperAuthor").textbox("clear");
  $("#sharedPaperStartDate").datebox("clear");
  $("#sharedPaperEndDate").datebox("clear");
  $("#sharedPaperGrid").datagrid("load", {});
}

function updateSelectedCount() {
  $("#selectedCount").text(`已勾选 ${selectedPaperIds.size} 篇`);
}

function searchPapers() {
  $("#paperGrid").datagrid("load", {});
}

function resetPaperSearch() {
  $("#paperKeyword").textbox("clear");
  $("#paperStartDate").datebox("clear");
  $("#paperEndDate").datebox("clear");
  $("#paperGrid").datagrid("load", {});
}

function renderTags(containerSelector, tags, removeFunctionName) {
  const html = tags.map((tag, index) => (
    `<span class="tag-item">${tag}<button type="button" onclick="${removeFunctionName}(${index})">×</button></span>`
  )).join("");
  $(containerSelector).html(html || '<span class="tag-empty">暂无</span>');
}

function addTag(inputSelector, tags, containerSelector, removeFunctionName) {
  const value = $(inputSelector).textbox("getValue").trim();
  if (!value) {
    return;
  }
  appendUniqueTags(tags, [value]);
  $(inputSelector).textbox("clear");
  renderTags(containerSelector, tags, removeFunctionName);
}

function appendUniqueTags(tags, values) {
  values.forEach((value) => {
    const tag = value.trim().replace(/\s+/g, " ");
    if (tag && !tags.includes(tag)) {
      tags.push(tag);
    }
  });
}

function cleanAuthorName(value) {
  return value
    .replace(/\([^)]*\)/g, "")
    .replace(/\b\d+\b/g, "")
    .replace(/[,*;，；]/g, " ")
    .replace(/\band\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAuthors(rawText) {
  const compact = rawText
    .replace(/\r/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
  if (!compact) {
    return [];
  }

  const normalized = compact
    .replace(/\s+and\s+/gi, ", ")
    .replace(/[,，]\s*$/g, "");
  return normalized
    .split(/[,，;；]+/)
    .map(cleanAuthorName)
    .filter((name) => name && /[A-Za-z\u4e00-\u9fa5]/.test(name));
}

function cleanInstitution(value) {
  return value
    .replace(/^[\s,;；.。]+|[\s,;；.。]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseInstitutions(rawText) {
  const withoutEmails = rawText
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\s*\([^)]*\)\s*;?/gi, " ")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\s*/gi, " ");
  const normalized = withoutEmails
    .replace(/\r/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return [];
  }

  const matches = [...normalized.matchAll(/(?:^|\s)(\d+)\s+(.+?)(?=\s+\d+\s+|$)/g)];
  const entries = matches.length
    ? matches.map((match) => match[2])
    : normalized.split(/[;；]+/);

  return entries
    .map((entry) => entry.replace(/\([^)]*\)/g, " "))
    .map(cleanInstitution)
    .filter((institution) => institution && /[A-Za-z\u4e00-\u9fa5]/.test(institution));
}

function addAuthorTag() {
  const value = $("#authorInput").textbox("getValue").trim();
  if (!value) {
    return;
  }
  appendUniqueTags(authorTags, parseAuthors(value));
  $("#authorInput").textbox("clear");
  renderTags("#authorTags", authorTags, "removeAuthorTag");
}

function addInstitutionTag() {
  const value = $("#institutionInput").textbox("getValue").trim();
  if (!value) {
    return;
  }
  appendUniqueTags(institutionTags, parseInstitutions(value));
  $("#institutionInput").textbox("clear");
  renderTags("#institutionTags", institutionTags, "removeInstitutionTag");
}

function removeAuthorTag(index) {
  authorTags.splice(index, 1);
  renderTags("#authorTags", authorTags, "removeAuthorTag");
}

function removeInstitutionTag(index) {
  institutionTags.splice(index, 1);
  renderTags("#institutionTags", institutionTags, "removeInstitutionTag");
}

const paperCategoryOptions = {
  "英文": [
    { value: "SCI", text: "SCI" },
    { value: "会议", text: "会议" },
  ],
  "中文": [
    { value: "核心期刊", text: "核心期刊" },
    { value: "普通期刊", text: "普通期刊" },
    { value: "会议", text: "会议" },
  ],
};

const paperSubtypeOptions = {
  "核心期刊": [
    { value: "南大核心", text: "南大核心" },
    { value: "北大核心", text: "北大核心" },
    { value: "科技核心", text: "科技核心" },
  ],
  "会议": [
    { value: "国际会议", text: "国际会议" },
    { value: "国内会议", text: "国内会议" },
  ],
};

function onPaperClassificationChange() {
  const language = $("#paperLanguage").combobox("getValue") || "英文";
  let category = $("#paperCategory").combobox("getValue");
  const categories = paperCategoryOptions[language] || [];
  if (!categories.some((item) => item.value === category)) {
    category = categories[0]?.value || "";
    $("#paperCategory").combobox("loadData", categories);
    $("#paperCategory").combobox("setValue", category);
  } else {
    $("#paperCategory").combobox("loadData", categories);
  }

  const subtypes = paperSubtypeOptions[category] || [];
  $("#paperSubtype").combobox("loadData", subtypes);
  if (subtypes.length) {
    const currentSubtype = $("#paperSubtype").combobox("getValue");
    if (!subtypes.some((item) => item.value === currentSubtype)) {
      $("#paperSubtype").combobox("setValue", subtypes[0].value);
    }
  } else {
    $("#paperSubtype").combobox("clear");
  }

  const isSci = category === "SCI";
  $("#paperSciPartition").combobox(isSci ? "enable" : "disable");
  $("#paperCugPartition").combobox(isSci ? "enable" : "disable");
  if (!isSci) {
    $("#paperSciPartition").combobox("clear");
    $("#paperCugPartition").combobox("clear");
  }
}

function openPaperDialog(row = null) {
  authorTags = row?.all_authors ? [...row.all_authors] : [];
  institutionTags = row?.institution_list ? [...row.institution_list] : [];
  $("#paperForm").form("clear");
  $("#paperFile").val("");
  $("#currentFile").text(row?.uploaded_file_name ? `当前文件：${row.uploaded_file_name}` : "未上传文件");
  renderTags("#authorTags", authorTags, "removeAuthorTag");
  renderTags("#institutionTags", institutionTags, "removeInstitutionTag");

  if (row) {
    $("#paperForm").form("load", {
      id: row.id,
      title: row.title,
      journal_name: row.journal_name,
      publisher: row.publisher,
      language: row.language || "英文",
      publication_category: row.publication_category || "SCI",
      publication_subtype: row.publication_subtype,
      sci_partition: row.sci_partition,
      cug_partition: row.cug_partition,
      corresponding_author: row.corresponding_author,
      first_author: row.first_author,
      publish_date: row.publish_date,
      is_published: String(row.is_published),
      download_url: row.download_url,
    });
    $("#paperDialog").dialog("setTitle", "编辑论文");
  } else {
    $("#paperForm").form("load", { is_published: "0", language: "英文", publication_category: "SCI" });
    $("#paperDialog").dialog("setTitle", "创建论文");
  }
  onPaperClassificationChange();
  $("#paperDialog").dialog("open");
}

function getSelectedPaper() {
  const row = $("#paperGrid").datagrid("getSelected");
  if (!row) {
    $.messager.alert("提示", "请先选择一篇论文", "info");
    return null;
  }
  return row;
}

function editSelectedPaper() {
  const row = getSelectedPaper();
  if (row) {
    openPaperDialog(row);
  }
}

function buildPaperPayload() {
  const values = formToObject("#paperForm");
  return {
    title: values.title,
    journal_name: values.journal_name,
    publisher: values.publisher || null,
    language: values.language || "英文",
    publication_category: values.publication_category || "SCI",
    publication_subtype: values.publication_subtype || null,
    sci_partition: values.sci_partition || null,
    cug_partition: values.cug_partition || null,
    corresponding_author: values.corresponding_author || null,
    first_author: values.first_author || null,
    all_authors: authorTags,
    institution_list: institutionTags,
    publish_date: values.publish_date || null,
    is_published: Number(values.is_published || 0),
    download_url: values.download_url || null,
  };
}

function savePaper() {
  if (!$("#paperForm").form("validate")) {
    return;
  }

  const id = $("#paperForm input[name='id']").val();
  const method = id ? "PUT" : "POST";
  const url = id ? `${API_BASE_URL}/api/papers/${id}` : `${API_BASE_URL}/api/papers`;

  $.ajax({
    url,
    method,
    headers: authHeaders(),
    contentType: "application/json",
    data: JSON.stringify(buildPaperPayload()),
  })
    .done((paper) => uploadPaperFileIfNeeded(paper.id))
    .fail(showError);
}

function uploadPaperFileIfNeeded(paperId) {
  const file = $("#paperFile")[0].files[0];
  if (!file) {
    finishPaperSave();
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  $.ajax({
    url: `${API_BASE_URL}/api/papers/${paperId}/upload`,
    method: "POST",
    headers: authHeaders(),
    data: formData,
    processData: false,
    contentType: false,
  })
    .done(finishPaperSave)
    .fail(showError);
}

function finishPaperSave() {
  $("#paperDialog").dialog("close");
  if (!$("#adminPapersView").hasClass("hidden") && adminPaperGridReady) {
    $("#adminPaperGrid").datagrid("reload");
  }
  if (paperGridReady) {
    $("#paperGrid").datagrid("reload");
  }
  $.messager.show({ title: "提示", msg: "论文信息已保存" });
}

function deleteSelectedPaper() {
  const row = getSelectedPaper();
  if (!row) {
    return;
  }

  $.messager.confirm("确认删除", `确定删除《${row.title}》吗？`, (confirmed) => {
    if (!confirmed) {
      return;
    }
    $.ajax({
      url: `${API_BASE_URL}/api/papers/${row.id}`,
      method: "DELETE",
      headers: authHeaders(),
    })
      .done(() => {
        selectedPaperIds.delete(row.id);
        $("#paperGrid").datagrid("reload");
        updateSelectedCount();
      })
      .fail(showError);
  });
}

function exportSelectedPapers() {
  const ids = [...selectedPaperIds];
  if (!ids.length) {
    $.messager.alert("提示", "请先勾选要导出的论文", "info");
    return;
  }

  fetch(`${API_BASE_URL}/api/papers/export`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ ids }),
  })
    .then((response) => {
      if (response.status === 401) {
        redirectToLogin();
        throw new Error("登录已过期，请重新登录");
      }
      if (!response.ok) {
        throw new Error("导出失败");
      }
      return response.blob();
    })
    .then((blob) => downloadBlob(blob, `论文发表_${new Date().getTime()}.csv`))
    .catch((error) => $.messager.alert("提示", error.message, "error"));
}

function downloadUploadedFile(paperId) {
  fetch(`${API_BASE_URL}/api/papers/${paperId}/file`, {
    headers: authHeaders(),
  })
    .then((response) => {
      if (response.status === 401) {
        redirectToLogin();
        throw new Error("登录已过期，请重新登录");
      }
      if (!response.ok) {
        throw new Error("文件下载失败");
      }
      return response.blob();
    })
    .then((blob) => downloadBlob(blob, `paper_${paperId}`))
    .catch((error) => $.messager.alert("提示", error.message, "error"));
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function initResourceEditorIfNeeded() {
  if (!resourceEditor) {
    resourceEditor = new Quill("#resourceEditor", {
      theme: "snow",
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ color: [] }, { background: [] }],
          [{ list: "ordered" }, { list: "bullet" }],
          ["blockquote", "code-block"],
          ["link"],
          ["clean"],
        ],
      },
    });
  }
}

function resourceQueryParams(param) {
  return {
    page: param.page || 1,
    rows: param.rows || 10,
    keyword: $("#resourceKeyword").textbox("getValue"),
    resource_type: $("#resourceTypeSearch").combobox("getValue"),
    tag: $("#resourceTagSearch").textbox("getValue"),
    sort_order: param.order || "desc",
  };
}

function formatResourceActions(_value, row) {
  return `<a href="javascript:void(0)" onclick="viewResourceDetail(${row.id})">查看详情</a>`;
}

function initResourceGrid() {
  $("#resourceGrid").datagrid({
    fit: true,
    border: false,
    toolbar: "#resourceToolbar",
    pagination: true,
    pageSize: 10,
    pageList: [10, 20, 50],
    remoteSort: true,
    sortName: "updated_at",
    sortOrder: "desc",
    rownumbers: true,
    idField: "id",
    singleSelect: true,
    loader(param, success, error) {
      $.ajax({
        url: `${API_BASE_URL}/api/resource-posts`,
        method: "GET",
        data: resourceQueryParams(param),
        headers: authHeaders(),
      }).done(success).fail(error);
    },
    columns: [[
      { field: "title", title: "标题", width: 260 },
      { field: "resource_type", title: "类型", width: 110 },
      { field: "tags", title: "标签", width: 180, formatter: formatList },
      { field: "owner_name", title: "发布人", width: 100 },
      { field: "comment_count", title: "评论", width: 70 },
      { field: "created_at", title: "发布时间", width: 150 },
      { field: "updated_at", title: "更新时间", width: 150, sortable: true },
      { field: "action", title: "操作", width: 120, formatter: formatResourceActions },
    ]],
    onSelect(_index, row) {
      updateResourceButtons(row);
    },
    onUnselect() {
      updateResourceButtons(null);
    },
    onLoadSuccess() {
      updateResourceButtons(null);
    },
    onDblClickRow(_index, row) {
      viewResourceDetail(row.id);
    },
  });
}

function updateResourceButtons(row) {
  if (!row || !row.can_edit) {
    $("#btnEditResource").linkbutton("disable");
    $("#btnDeleteResource").linkbutton("disable");
    return;
  }
  $("#btnEditResource").linkbutton("enable");
  $("#btnDeleteResource").linkbutton("enable");
}

function searchResources() {
  $("#resourceGrid").datagrid("load", {});
}

function resetResourceSearch() {
  $("#resourceKeyword").textbox("clear");
  $("#resourceTypeSearch").combobox("setValue", "");
  $("#resourceTagSearch").textbox("clear");
  $("#resourceGrid").datagrid("load", {});
}

function renderResourceTags() {
  const html = resourceTags.map((tag, index) => (
    `<span class="tag-item">${tag}<button type="button" class="resource-remove-btn" onclick="removeResourceTag(${index})">×</button></span>`
  )).join("");
  $("#resourceTags").html(html || '<span class="tag-empty">暂无标签</span>');
}

function addResourceTag() {
  const value = $("#resourceTagInput").textbox("getValue").trim();
  if (!value) {
    return;
  }
  if (!resourceTags.includes(value)) {
    resourceTags.push(value);
  }
  $("#resourceTagInput").textbox("clear");
  renderResourceTags();
}

function removeResourceTag(index) {
  resourceTags.splice(index, 1);
  renderResourceTags();
}

function openResourceDialog(row = null, readOnly = false) {
  initResourceEditorIfNeeded();
  currentResourcePost = row;
  resourceTags = row?.tags ? [...row.tags] : [];

  $("#resourceForm").form("clear");
  renderResourceTags();
  $("#resourceMeta").text("");
  $("#resourceCommentInput").textbox("clear");

  if (row) {
    $("#resourceForm").form("load", {
      id: row.id,
      title: row.title,
      resource_type: row.resource_type,
    });
    $("#resourceMeta").text(`发布人：${row.owner_name} / 发布时间：${row.created_at} / 更新时间：${row.updated_at}`);
    resourceEditor.root.innerHTML = row.content;
    $("#resourceDialog").dialog("setTitle", readOnly ? "查看资料" : "编辑资料");
    $("#resourceCommentsSection").removeClass("hidden");
    loadResourceComments(row.id);
  } else {
    $("#resourceTypeInput").combobox("setValue", resourceTypes[0]?.value || "");
    resourceEditor.root.innerHTML = "";
    $("#resourceDialog").dialog("setTitle", "创建资料");
    $("#resourceCommentsSection").addClass("hidden");
  }

  if (readOnly) {
    $("#resourceForm .easyui-textbox").textbox("readonly", true);
    $("#resourceCommentInput").textbox("readonly", false);
    $("#resourceTypeInput").combobox("readonly", true);
    $("#resourceTagInputRow").addClass("hidden");
    $(".resource-remove-btn").addClass("hidden");
    resourceEditor.disable();
    $("#btnSaveResource").addClass("hidden");
  } else {
    $("#resourceForm .easyui-textbox").textbox("readonly", false);
    $("#resourceTypeInput").combobox("readonly", false);
    $("#resourceTagInputRow").removeClass("hidden");
    resourceEditor.enable();
    $("#btnSaveResource").removeClass("hidden");
  }

  $("#resourceDialog").dialog("open");
}

function viewResourceDetail(id) {
  $.ajax({
    url: `${API_BASE_URL}/api/resource-posts/${id}`,
    method: "GET",
    headers: authHeaders(),
  })
    .done((post) => openResourceDialog(post, true))
    .fail(showError);
}

function getSelectedResource() {
  const row = $("#resourceGrid").datagrid("getSelected");
  if (!row) {
    $.messager.alert("提示", "请先选择一条资料", "info");
    return null;
  }
  return row;
}

function editSelectedResource() {
  const row = getSelectedResource();
  if (!row) {
    return;
  }
  if (!row.can_edit) {
    $.messager.alert("错误", "您没有修改该资料的权限", "error");
    return;
  }
  $.ajax({
    url: `${API_BASE_URL}/api/resource-posts/${row.id}`,
    method: "GET",
    headers: authHeaders(),
  })
    .done((post) => openResourceDialog(post, false))
    .fail(showError);
}

function saveResource() {
  if (!$("#resourceForm").form("validate")) {
    return;
  }
  const content = resourceEditor.root.innerHTML.trim();
  const textContent = resourceEditor.getText().trim();
  if (!textContent) {
    $.messager.alert("提示", "请输入资料内容", "warning");
    return;
  }

  const id = $("#resourceForm input[name='id']").val();
  const values = formToObject("#resourceForm");
  const payload = {
    title: values.title,
    resource_type: values.resource_type,
    tags: resourceTags,
    content,
  };
  const method = id ? "PUT" : "POST";
  const url = id ? `${API_BASE_URL}/api/resource-posts/${id}` : `${API_BASE_URL}/api/resource-posts`;

  $.ajax({
    url,
    method,
    headers: authHeaders(),
    contentType: "application/json",
    data: JSON.stringify(payload),
  })
    .done((post) => {
      currentResourcePost = post;
      $("#resourceDialog").dialog("close");
      $("#resourceGrid").datagrid("reload");
      updateResourceButtons(null);
      $.messager.show({ title: "提示", msg: "资料已保存" });
    })
    .fail(showError);
}

function deleteSelectedResource() {
  const row = getSelectedResource();
  if (!row) {
    return;
  }
  if (!row.can_edit) {
    $.messager.alert("错误", "您没有删除该资料的权限", "error");
    return;
  }
  $.messager.confirm("确认删除", `确定要删除资料《${row.title}》吗？`, (confirmed) => {
    if (!confirmed) {
      return;
    }
    $.ajax({
      url: `${API_BASE_URL}/api/resource-posts/${row.id}`,
      method: "DELETE",
      headers: authHeaders(),
    })
      .done(() => {
        $("#resourceGrid").datagrid("reload");
        updateResourceButtons(null);
        $.messager.show({ title: "提示", msg: "资料已删除" });
      })
      .fail(showError);
  });
}

function loadResourceComments(postId) {
  $.ajax({
    url: `${API_BASE_URL}/api/resource-posts/${postId}/comments`,
    method: "GET",
    headers: authHeaders(),
  })
    .done(renderResourceComments)
    .fail(showError);
}

function renderResourceComments(comments) {
  if (!comments || comments.length === 0) {
    $("#resourceComments").html('<span class="tag-empty">暂无评论</span>');
    return;
  }
  const html = comments.map((comment) => `
    <div class="comment-item">
      <div class="comment-head">
        <strong>${comment.owner_name}</strong>
        <span>${comment.created_at}</span>
        ${comment.can_delete ? `<a href="javascript:void(0)" onclick="deleteResourceComment(${comment.id})">删除</a>` : ""}
      </div>
      <div class="comment-content">${escapeHtml(comment.content).replace(/\n/g, "<br>")}</div>
    </div>
  `).join("");
  $("#resourceComments").html(html);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function submitResourceComment() {
  if (!currentResourcePost?.id) {
    return;
  }
  const content = $("#resourceCommentInput").textbox("getValue").trim();
  if (!content) {
    $.messager.alert("提示", "请输入评论内容", "warning");
    return;
  }
  $.ajax({
    url: `${API_BASE_URL}/api/resource-posts/${currentResourcePost.id}/comments`,
    method: "POST",
    headers: authHeaders(),
    contentType: "application/json",
    data: JSON.stringify({ content }),
  })
    .done(() => {
      $("#resourceCommentInput").textbox("clear");
      loadResourceComments(currentResourcePost.id);
      $("#resourceGrid").datagrid("reload");
    })
    .fail(showError);
}

function deleteResourceComment(commentId) {
  $.messager.confirm("确认删除", "确定要删除这条评论吗？", (confirmed) => {
    if (!confirmed) {
      return;
    }
    $.ajax({
      url: `${API_BASE_URL}/api/resource-comments/${commentId}`,
      method: "DELETE",
      headers: authHeaders(),
    })
      .done(() => {
        loadResourceComments(currentResourcePost.id);
        $("#resourceGrid").datagrid("reload");
      })
      .fail(showError);
  });
}

function initQuillIfNeeded() {
  if (!activityEditor) {
    activityEditor = new Quill('#activityEditor', {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ 'header': [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'color': [] }, { 'background': [] }],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          ['clean']
        ]
      }
    });
  }
}

function activityQueryParams(param) {
  return {
    page: param.page || 1,
    rows: param.rows || 10,
    keyword: $("#activityKeyword").textbox("getValue"),
    publisher: $("#activityPublisher").textbox("getValue"),
    start_date: $("#activityStartDate").datebox("getValue"),
    end_date: $("#activityEndDate").datebox("getValue"),
    sort_order: param.order || "desc",
  };
}

function initActivityGrid() {
  $("#activityGrid").datagrid({
    fit: true,
    border: false,
    toolbar: "#activityToolbar",
    pagination: true,
    pageSize: 10,
    pageList: [10, 20, 50],
    remoteSort: true,
    sortName: "publish_date",
    sortOrder: "desc",
    rownumbers: true,
    idField: "id",
    singleSelect: true,
    loader(param, success, error) {
      $.ajax({
        url: `${API_BASE_URL}/api/activities`,
        method: "GET",
        data: activityQueryParams(param),
        headers: authHeaders(),
      }).done(success).fail(error);
    },
    columns: [[
      { field: "title", title: "活动名称", width: 260 },
      { field: "owner_name", title: "发布人", width: 100 },
      { field: "tags", title: "主题标签", width: 180, formatter: formatList },
      { field: "publish_date", title: "发布时间", width: 100, sortable: true },
      { field: "images", title: "照片数量", width: 80, formatter: (val) => val ? val.length : 0 },
      { 
        field: "action", 
        title: "操作", 
        width: 120, 
        formatter: function(_val, row) {
          return `<a href="javascript:void(0)" onclick="viewActivityDetail(${row.id})">查看详情</a>`;
        }
      }
    ]],
    onSelect(index, row) {
      updateActivityButtons(row);
    },
    onUnselect(index, row) {
      updateActivityButtons(null);
    },
    onLoadSuccess() {
      updateActivityButtons(null);
    }
  });
}

function ensureActivityGrid() {
  if (!activityGridReady) {
    initActivityGrid();
    activityGridReady = true;
  }
}

function updateActivityButtons(row) {
  if (!row) {
    $("#btnEditActivity").linkbutton("disable");
    $("#btnDeleteActivity").linkbutton("disable");
    return;
  }
  
  if (row.owner_id === currentUser.id || currentUser?.is_admin) {
    $("#btnEditActivity").linkbutton("enable");
    $("#btnDeleteActivity").linkbutton("enable");
  } else {
    $("#btnEditActivity").linkbutton("disable");
    $("#btnDeleteActivity").linkbutton("disable");
  }
}

function viewActivityDetail(id) {
  $.ajax({
    url: `${API_BASE_URL}/api/activities/${id}`,
    method: "GET",
    headers: authHeaders(),
  })
    .done((activity) => openActivityDialog(activity, true))
    .fail(showError);
}

function searchActivities() {
  $("#activityGrid").datagrid("load", {});
}

function resetActivitySearch() {
  $("#activityKeyword").textbox("clear");
  $("#activityPublisher").textbox("clear");
  $("#activityStartDate").datebox("clear");
  $("#activityEndDate").datebox("clear");
  $("#activityGrid").datagrid("load", {});
}

function renderActivityTags() {
  const html = activityTags.map((tag, index) => (
    `<span class="tag-item">${tag}<button type="button" class="remove-btn" onclick="removeActivityTag(${index})">×</button></span>`
  )).join("");
  $("#activityTags").html(html || '<span class="tag-empty">暂无标签</span>');
}

function addActivityTag() {
  const val = $("#activityTagInput").textbox("getValue").trim();
  if (!val) return;
  if (!activityTags.includes(val)) {
    activityTags.push(val);
  }
  $("#activityTagInput").textbox("clear");
  renderActivityTags();
}

function removeActivityTag(index) {
  activityTags.splice(index, 1);
  renderActivityTags();
}

function openActivityDialog(row = null, readOnly = false) {
  initQuillIfNeeded();
  activityTags = row?.tags ? [...row.tags] : [];
  activityImages = row?.images ? [...row.images] : [];
  
  $("#activityForm").form("clear");
  $("#activityImageFiles").val("");
  clearNewActivityImagePreview();
  
  renderActivityTags();
  renderActivityImages(readOnly);
  
  if (row) {
    $("#activityForm").form("load", {
      id: row.id,
      title: row.title,
      publish_date: row.publish_date,
    });
    activityEditor.root.innerHTML = row.content;
    $("#activityDialog").dialog("setTitle", readOnly ? "查看活动" : "编辑活动");
  } else {
    $("#activityForm").form("load", {
      publish_date: new Date().toISOString().substring(0, 10)
    });
    activityEditor.root.innerHTML = "";
    $("#activityDialog").dialog("setTitle", "创建活动");
  }
  
  if (readOnly) {
    $("#activityForm .easyui-textbox").textbox("readonly", true);
    $("#activityForm .easyui-datebox").datebox("readonly", true);
    $("#tagInputRow").addClass("hidden");
    $(".remove-btn").addClass("hidden");
    activityEditor.disable();
    $("#uploadPhotoRow").addClass("hidden");
    $("#newActivityImagePreviewSection").addClass("hidden");
    $("#btnSaveActivity").addClass("hidden");
  } else {
    $("#activityForm .easyui-textbox").textbox("readonly", false);
    $("#activityForm .easyui-datebox").datebox("readonly", false);
    $("#tagInputRow").removeClass("hidden");
    activityEditor.enable();
    $("#uploadPhotoRow").removeClass("hidden");
    $("#newActivityImagePreviewSection").removeClass("hidden");
    $("#btnSaveActivity").removeClass("hidden");
  }
  
  $("#activityDialog").dialog("open");
}

function getSelectedActivity() {
  const row = $("#activityGrid").datagrid("getSelected");
  if (!row) {
    $.messager.alert("提示", "请先选择一个活动", "info");
    return null;
  }
  return row;
}

function editSelectedActivity() {
  const row = getSelectedActivity();
  if (row) {
    if (row.owner_id !== currentUser.id && !currentUser?.is_admin) {
      $.messager.alert("错误", "您没有修改该活动的权限", "error");
      return;
    }
    openActivityDialog(row, false);
  }
}

function renderActivityImages(readOnly) {
  const container = $("#activityImagesContainer");
  container.empty();
  
  if (activityImages.length === 0) {
    container.html('<span class="tag-empty">暂无照片</span>');
    return;
  }
  
  activityImages.forEach((imgName, index) => {
    const imgUrl = urlWithAccessToken(`${API_BASE_URL}/api/activities/images/${imgName}`);
    const wrapper = $('<div class="activity-image-wrapper"></div>');
    const img = $(`<img src="${imgUrl}" alt="活动照片" onerror="this.onerror=null;this.src='https://www.jeasyui.com/easyui/themes/icons/image.png'">`);
    
    img.css("cursor", "pointer").on("click", () => {
      window.open(imgUrl, "_blank");
    });
    
    wrapper.append(img);
    
    if (!readOnly) {
      const removeBtn = $('<button type="button" class="activity-image-remove">×</button>');
      removeBtn.on("click", () => {
        activityImages.splice(index, 1);
        renderActivityImages(readOnly);
      });
      wrapper.append(removeBtn);
    }
    
    container.append(wrapper);
  });
}

function previewNewImages() {
  const files = $("#activityImageFiles")[0].files;
  const totalCount = activityImages.length + files.length;
  if (totalCount > 5) {
    $.messager.alert("提示", `最多只能关联5张图片，当前已选/已有图片总数：${totalCount}，请重新选择。`, "warning");
    $("#activityImageFiles").val("");
    return;
  }
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > 5 * 1024 * 1024) {
      $.messager.alert("提示", `图片 ${file.name} 大小超过5MB，请重新选择。`, "warning");
      $("#activityImageFiles").val("");
      return;
    }
  }
  renderNewActivityImagePreview(files);
}

function clearNewActivityImagePreview() {
  newActivityImageUrls.forEach((url) => window.URL.revokeObjectURL(url));
  newActivityImageUrls = [];
  $("#newActivityImagesContainer").html('<span class="tag-empty">暂无待上传照片</span>');
}

function renderNewActivityImagePreview(files) {
  clearNewActivityImagePreview();
  const container = $("#newActivityImagesContainer");
  container.empty();

  if (!files || files.length === 0) {
    container.html('<span class="tag-empty">暂无待上传照片</span>');
    return;
  }

  Array.from(files).forEach((file) => {
    const imageUrl = window.URL.createObjectURL(file);
    newActivityImageUrls.push(imageUrl);
    const wrapper = $('<div class="activity-image-wrapper pending"></div>');
    const img = $(`<img src="${imageUrl}" alt="待上传照片">`);
    const caption = $('<span class="activity-image-caption">待上传</span>');
    wrapper.append(img);
    wrapper.append(caption);
    container.append(wrapper);
  });
}

function saveActivity() {
  if (!$("#activityForm").form("validate")) {
    return;
  }
  
  const content = activityEditor.root.innerHTML.trim();
  const textContent = activityEditor.getText().trim();
  if (!textContent) {
    $.messager.alert("提示", "请输入活动内容", "warning");
    return;
  }
  
  const id = $("#activityForm input[name='id']").val();
  const method = id ? "PUT" : "POST";
  const url = id ? `${API_BASE_URL}/api/activities/${id}` : `${API_BASE_URL}/api/activities`;
  
  const values = formToObject("#activityForm");
  const payload = {
    title: values.title,
    content: content,
    tags: activityTags,
    publish_date: values.publish_date
  };
  
  if (id) {
    payload.images = activityImages;
  }
  
  $.ajax({
    url,
    method,
    headers: authHeaders(),
    contentType: "application/json",
    data: JSON.stringify(payload)
  })
  .done((activity) => {
    uploadActivityImagesIfNeeded(activity.id);
  })
  .fail(showError);
}

function uploadActivityImagesIfNeeded(activityId) {
  const files = $("#activityImageFiles")[0].files;
  if (files.length === 0) {
    finishActivitySave();
    return;
  }
  
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append("files", files[i]);
  }
  
  $.ajax({
    url: `${API_BASE_URL}/api/activities/${activityId}/upload`,
    method: "POST",
    headers: authHeaders(),
    data: formData,
    processData: false,
    contentType: false
  })
  .done(finishActivitySave)
  .fail(showError);
}

function finishActivitySave() {
  $("#activityDialog").dialog("close");
  clearNewActivityImagePreview();
  $("#activityGrid").datagrid("reload");
  updateActivityButtons(null);
  $.messager.show({ title: "提示", msg: "活动已成功保存" });
}

function deleteSelectedActivity() {
  const row = getSelectedActivity();
  if (!row) return;
  
  if (row.owner_id !== currentUser.id && !currentUser?.is_admin) {
    $.messager.alert("错误", "您没有删除该活动的权限", "error");
    return;
  }
  
  $.messager.confirm("确认删除", `确定要删除活动《${row.title}》吗？`, (confirmed) => {
    if (!confirmed) return;
    
    $.ajax({
      url: `${API_BASE_URL}/api/activities/${row.id}`,
      method: "DELETE",
      headers: authHeaders()
    })
    .done(() => {
      $("#activityGrid").datagrid("reload");
      updateActivityButtons(null);
      $.messager.show({ title: "提示", msg: "活动已成功删除" });
    })
    .fail(showError);
  });
}

function meetingQueryParams(param) {
  return {
    page: param.page || 1,
    rows: param.rows || 10,
    keyword: $("#meetingKeyword").textbox("getValue"),
    speaker: $("#meetingSpeakerSearch").combobox("getValues").join(","),
    start_date: $("#meetingStartDate").datebox("getValue"),
    end_date: $("#meetingEndDate").datebox("getValue"),
    sort_order: param.order || "desc",
  };
}

function initMeetingGrid() {
  $("#meetingGrid").datagrid({
    fit: true,
    border: false,
    toolbar: "#meetingToolbar",
    pagination: true,
    pageSize: 10,
    pageList: [10, 20, 50],
    remoteSort: true,
    sortName: "meeting_date",
    sortOrder: "desc",
    rownumbers: true,
    idField: "id",
    singleSelect: true,
    loader(param, success, error) {
      $.ajax({
        url: `${API_BASE_URL}/api/group-meetings`,
        method: "GET",
        data: meetingQueryParams(param),
        headers: authHeaders(),
      }).done(success).fail(error);
    },
    columns: [[
      { field: "meeting_date", title: "组会时间", width: 110, sortable: true },
      { field: "speaker", title: "主讲人", width: 100 },
      { field: "topic", title: "分享题目", width: 280 },
      { field: "attendees", title: "参会人员", width: 220, formatter: formatList },
      { field: "owner_name", title: "发布人", width: 100 },
      { field: "documents", title: "文档数", width: 80, formatter: (value) => value ? value.length : 0 },
      { field: "photos", title: "照片数", width: 80, formatter: (value) => value ? value.length : 0 },
      {
        field: "action",
        title: "操作",
        width: 120,
        formatter(_value, row) {
          return `<a href="javascript:void(0)" onclick="viewMeetingDetail(${row.id})">查看详情</a>`;
        },
      },
    ]],
    onSelect(_index, row) {
      updateMeetingButtons(row);
    },
    onUnselect() {
      updateMeetingButtons(null);
    },
    onLoadSuccess() {
      updateMeetingButtons(null);
    },
  });
}

function ensureMeetingGrid() {
  if (!meetingGridReady) {
    initMeetingGrid();
    meetingGridReady = true;
  }
}

function updateMeetingButtons(row) {
  if (!row) {
    $("#btnEditMeeting").linkbutton("disable");
    $("#btnDeleteMeeting").linkbutton("disable");
    return;
  }

  if (row.owner_id === currentUser.id || currentUser?.is_admin) {
    $("#btnEditMeeting").linkbutton("enable");
    $("#btnDeleteMeeting").linkbutton("enable");
  } else {
    $("#btnEditMeeting").linkbutton("disable");
    $("#btnDeleteMeeting").linkbutton("disable");
  }
}

function searchMeetings() {
  $("#meetingGrid").datagrid("load", {});
}

function resetMeetingSearch() {
  $("#meetingKeyword").textbox("clear");
  $("#meetingSpeakerSearch").combobox("clear");
  $("#meetingStartDate").datebox("clear");
  $("#meetingEndDate").datebox("clear");
  $("#meetingGrid").datagrid("load", {});
}

function renderMeetingDocuments(readOnly) {
  const container = $("#meetingDocumentsContainer");
  container.empty();
  if (!meetingDocuments.length) {
    container.html('<span class="tag-empty">暂无文档</span>');
    return;
  }

  meetingDocuments.forEach((item, index) => {
    const row = $('<div class="meeting-file-item"></div>');
    const link = $(`<a href="javascript:void(0)">${item.original_name}</a>`);
    link.on("click", () => downloadMeetingFile("documents", item));
    row.append(link);
    if (!readOnly) {
      const removeBtn = $('<button type="button">删除</button>');
      removeBtn.on("click", () => {
        meetingDocuments.splice(index, 1);
        renderMeetingDocuments(readOnly);
      });
      row.append(removeBtn);
    }
    container.append(row);
  });
}

function renderMeetingPhotos(readOnly) {
  const container = $("#meetingPhotosContainer");
  container.empty();
  if (!meetingPhotos.length) {
    container.html('<span class="tag-empty">暂无照片</span>');
    return;
  }

  meetingPhotos.forEach((item, index) => {
    const imgUrl = getMeetingFileUrl("photos", item);
    const wrapper = $('<div class="activity-image-wrapper"></div>');
    const img = $(`<img src="${imgUrl}" alt="${item.original_name}" onerror="this.onerror=null;this.src='https://www.jeasyui.com/easyui/themes/icons/image.png'">`);
    img.css("cursor", "pointer").on("click", () => window.open(imgUrl, "_blank"));
    wrapper.append(img);

    if (!readOnly) {
      const removeBtn = $('<button type="button" class="activity-image-remove">×</button>');
      removeBtn.on("click", () => {
        meetingPhotos.splice(index, 1);
        renderMeetingPhotos(readOnly);
      });
      wrapper.append(removeBtn);
    }
    container.append(wrapper);
  });
}

function getMeetingFileUrl(kind, item) {
  const meetingId = $("#meetingForm input[name='id']").val();
  return urlWithAccessToken(`${API_BASE_URL}/api/group-meetings/${meetingId}/files/${kind}/${encodeURIComponent(item.stored_name)}`);
}

function downloadMeetingFile(kind, item) {
  fetch(getMeetingFileUrl(kind, item), {
    headers: authHeaders(),
  })
    .then((response) => {
      if (response.status === 401) {
        redirectToLogin();
        throw new Error("登录已过期，请重新登录");
      }
      if (!response.ok) {
        throw new Error("文件下载失败");
      }
      return response.blob();
    })
    .then((blob) => downloadBlob(blob, item.original_name))
    .catch((error) => $.messager.alert("提示", error.message, "error"));
}

function openMeetingDialog(row = null, readOnly = false) {
  meetingDocuments = row?.documents ? [...row.documents] : [];
  meetingPhotos = row?.photos ? [...row.photos] : [];

  $("#meetingForm").form("clear");
  $("#meetingDocumentFiles").val("");
  $("#meetingPhotoFiles").val("");
  renderMeetingDocuments(readOnly);
  renderMeetingPhotos(readOnly);

  if (row) {
    const speakerValue = findUserValue(row.speaker);
    const attendeeValues = row.attendees.map(findUserValue);
    $("#meetingForm").form("load", {
      id: row.id,
      meeting_date: row.meeting_date,
      topic: row.topic,
    });
    $("#meetingSpeakerInput").combobox("setValue", speakerValue);
    $("#meetingAttendeesInput").combobox("setValues", attendeeValues);
    $("#meetingDialog").dialog("setTitle", readOnly ? "查看组会" : "编辑组会");
  } else {
    $("#meetingForm").form("load", {
      meeting_date: formatDate(new Date()),
    });
    $("#meetingSpeakerInput").combobox("clear");
    $("#meetingAttendeesInput").combobox("clear");
    $("#meetingDialog").dialog("setTitle", "创建组会");
  }

  if (readOnly) {
    $("#meetingForm .easyui-textbox").textbox("readonly", true);
    $("#meetingForm .easyui-datebox").datebox("readonly", true);
    $("#meetingSpeakerInput").combobox("readonly", true);
    $("#meetingAttendeesInput").combobox("readonly", true);
    $("#meetingDocumentUploadRow").addClass("hidden");
    $("#meetingPhotoUploadRow").addClass("hidden");
    $("#btnSaveMeeting").addClass("hidden");
  } else {
    $("#meetingForm .easyui-textbox").textbox("readonly", false);
    $("#meetingForm .easyui-datebox").datebox("readonly", false);
    $("#meetingSpeakerInput").combobox("readonly", false);
    $("#meetingAttendeesInput").combobox("readonly", false);
    $("#meetingDocumentUploadRow").removeClass("hidden");
    $("#meetingPhotoUploadRow").removeClass("hidden");
    $("#btnSaveMeeting").removeClass("hidden");
  }

  $("#meetingDialog").dialog("open");
}

function findUserValue(name) {
  const option = userOptions.find((user) => user.value === name || user.full_name === name || user.username === name);
  return option ? option.value : name;
}

function viewMeetingDetail(id) {
  $.ajax({
    url: `${API_BASE_URL}/api/group-meetings/${id}`,
    method: "GET",
    headers: authHeaders(),
  })
    .done((meeting) => openMeetingDialog(meeting, true))
    .fail(showError);
}

function getSelectedMeeting() {
  const row = $("#meetingGrid").datagrid("getSelected");
  if (!row) {
    $.messager.alert("提示", "请先选择一条组会记录", "info");
    return null;
  }
  return row;
}

function editSelectedMeeting() {
  const row = getSelectedMeeting();
  if (!row) {
    return;
  }
  if (row.owner_id !== currentUser.id && !currentUser?.is_admin) {
    $.messager.alert("错误", "您没有修改该组会的权限", "error");
    return;
  }
  $.ajax({
    url: `${API_BASE_URL}/api/group-meetings/${row.id}`,
    method: "GET",
    headers: authHeaders(),
  })
    .done((meeting) => openMeetingDialog(meeting, false))
    .fail(showError);
}

function buildMeetingPayload() {
  const values = formToObject("#meetingForm");
  const payload = {
    meeting_date: values.meeting_date,
    speaker: $("#meetingSpeakerInput").combobox("getValue"),
    topic: values.topic,
    attendees: $("#meetingAttendeesInput").combobox("getValues"),
  };
  const id = $("#meetingForm input[name='id']").val();
  if (id) {
    payload.documents = meetingDocuments;
    payload.photos = meetingPhotos;
  }
  return payload;
}

function saveMeeting() {
  if (!$("#meetingForm").form("validate")) {
    return;
  }

  const id = $("#meetingForm input[name='id']").val();
  const method = id ? "PUT" : "POST";
  const url = id ? `${API_BASE_URL}/api/group-meetings/${id}` : `${API_BASE_URL}/api/group-meetings`;

  $.ajax({
    url,
    method,
    headers: authHeaders(),
    contentType: "application/json",
    data: JSON.stringify(buildMeetingPayload()),
  })
    .done((meeting) => uploadMeetingFilesIfNeeded(meeting.id))
    .fail(showError);
}

function uploadMeetingFilesIfNeeded(meetingId) {
  const documentFiles = $("#meetingDocumentFiles")[0].files;
  const photoFiles = $("#meetingPhotoFiles")[0].files;
  const tasks = [];

  if (documentFiles.length) {
    const formData = new FormData();
    Array.from(documentFiles).forEach((file) => formData.append("files", file));
    tasks.push($.ajax({
      url: `${API_BASE_URL}/api/group-meetings/${meetingId}/documents`,
      method: "POST",
      headers: authHeaders(),
      data: formData,
      processData: false,
      contentType: false,
    }));
  }

  if (photoFiles.length) {
    const formData = new FormData();
    Array.from(photoFiles).forEach((file) => formData.append("files", file));
    tasks.push($.ajax({
      url: `${API_BASE_URL}/api/group-meetings/${meetingId}/photos`,
      method: "POST",
      headers: authHeaders(),
      data: formData,
      processData: false,
      contentType: false,
    }));
  }

  if (!tasks.length) {
    finishMeetingSave();
    return;
  }

  $.when(...tasks)
    .done(finishMeetingSave)
    .fail(showError);
}

function finishMeetingSave() {
  $("#meetingDialog").dialog("close");
  $("#meetingGrid").datagrid("reload");
  updateMeetingButtons(null);
  $.messager.show({ title: "提示", msg: "组会记录已保存" });
}

function deleteSelectedMeeting() {
  const row = getSelectedMeeting();
  if (!row) {
    return;
  }
  if (row.owner_id !== currentUser.id && !currentUser?.is_admin) {
    $.messager.alert("错误", "您没有删除该组会的权限", "error");
    return;
  }

  $.messager.confirm("确认删除", `确定要删除组会《${row.topic}》吗？`, (confirmed) => {
    if (!confirmed) {
      return;
    }
    $.ajax({
      url: `${API_BASE_URL}/api/group-meetings/${row.id}`,
      method: "DELETE",
      headers: authHeaders(),
    })
      .done(() => {
        $("#meetingGrid").datagrid("reload");
        updateMeetingButtons(null);
        $.messager.show({ title: "提示", msg: "组会记录已删除" });
      })
      .fail(showError);
  });
}

$(function () {
  if (document.body.classList.contains("page-home")) {
    loadCurrentUser();
  }

  if (document.body.classList.contains("page-login") && localStorage.getItem(TOKEN_KEY)) {
    window.location.href = "./index.html";
  }
});
