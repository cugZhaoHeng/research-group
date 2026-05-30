const API_BASE_URL = "http://localhost:8000";
const TOKEN_KEY = "research_group_token";

let currentUser = null;
let selectedPaperIds = new Set();
let authorTags = [];
let institutionTags = [];

function formToObject(formSelector) {
  const values = {};
  $(formSelector).serializeArray().forEach((item) => {
    const value = item.value.trim();
    if (value !== "") {
      values[item.name] = value;
    }
  });

  ["enrollment_year", "graduation_year", "is_graduated"].forEach((key) => {
    if (values[key] !== undefined) {
      values[key] = Number(values[key]);
    }
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
  return token ? { Authorization: `Bearer ${token}`, ...extra } : extra;
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

function registerUser() {
  if (!$("#registerForm").form("validate")) {
    return;
  }

  requestAuth("/api/auth/register", formToObject("#registerForm"))
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
      renderProfile(user);
      initHome();
    })
    .fail(() => {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = "./login.html";
    });
}

function displayValue(value) {
  return value === null || value === undefined || value === "" ? "未填写" : value;
}

function renderProfile(user) {
  $("#topbarUser").text(`${user.full_name || user.username} · ${user.email}`);
  $("#profileName").text(user.full_name || user.username);
  $("#profileUsername").text(`用户名：${user.username}`);
  $("#profileBio").text(user.bio || "暂未填写个人说明");

  if (user.avatar_url) {
    const avatarUrl = user.avatar_url.startsWith("/")
      ? `${API_BASE_URL}${user.avatar_url}`
      : user.avatar_url;
    $("#avatar").attr("src", avatarUrl);
  }

  $("#profileGrid").propertygrid({
    width: "100%",
    data: {
      total: 15,
      rows: [
        { name: "用户 ID", value: user.id },
        { name: "真实姓名", value: displayValue(user.full_name) },
        { name: "电话", value: displayValue(user.telephone) },
        { name: "邮箱", value: displayValue(user.email) },
        { name: "省份", value: displayValue(user.province) },
        { name: "城市", value: displayValue(user.city) },
        { name: "生日", value: displayValue(user.birthday) },
        { name: "入学年份", value: displayValue(user.enrollment_year) },
        { name: "是否毕业", value: user.is_graduated ? "是" : "否" },
        { name: "毕业年份", value: displayValue(user.graduation_year) },
        { name: "头像地址", value: displayValue(user.avatar_url) },
        { name: "本科院校", value: displayValue(user.undergraduate_school) },
        { name: "硕士院校", value: displayValue(user.master_school) },
        { name: "博士院校", value: displayValue(user.doctoral_school) },
        { name: "创建时间", value: displayValue(user.created_at) },
      ],
    },
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
  initPaperGrid();
}

function switchView(view) {
  $(".view-panel").addClass("hidden");
  if (view === "papers") {
    $("#papersView").removeClass("hidden");
    $("#paperGrid").datagrid("resize");
    $("#paperGrid").datagrid("reload");
  } else {
    $("#profileView").removeClass("hidden");
  }
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

function paperQueryParams(param) {
  return {
    page: param.page || 1,
    rows: param.rows || 10,
    keyword: $("#paperKeyword").textbox("getValue"),
    start_date: $("#paperStartDate").datebox("getValue"),
    end_date: $("#paperEndDate").datebox("getValue"),
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
      { field: "sci_partition", title: "SCI分区", width: 80 },
      { field: "cug_partition", title: "地大分区", width: 80 },
      { field: "corresponding_author", title: "通讯作者", width: 100 },
      { field: "first_author", title: "第一作者", width: 100 },
      { field: "all_authors", title: "全部作者", width: 190, formatter: formatList },
      { field: "institution_list", title: "机构列表", width: 220, formatter: formatList },
      { field: "publish_date", title: "发表时间", width: 100 },
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
  if (!tags.includes(value)) {
    tags.push(value);
  }
  $(inputSelector).textbox("clear");
  renderTags(containerSelector, tags, removeFunctionName);
}

function addAuthorTag() {
  addTag("#authorInput", authorTags, "#authorTags", "removeAuthorTag");
}

function addInstitutionTag() {
  addTag("#institutionInput", institutionTags, "#institutionTags", "removeInstitutionTag");
}

function removeAuthorTag(index) {
  authorTags.splice(index, 1);
  renderTags("#authorTags", authorTags, "removeAuthorTag");
}

function removeInstitutionTag(index) {
  institutionTags.splice(index, 1);
  renderTags("#institutionTags", institutionTags, "removeInstitutionTag");
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
    $("#paperForm").form("load", { is_published: "0" });
    $("#paperDialog").dialog("setTitle", "新增论文");
  }
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

  const id = $("input[name='id']").val();
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
  $("#paperGrid").datagrid("reload");
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

$(function () {
  if (document.body.classList.contains("page-home")) {
    loadCurrentUser();
  }

  if (document.body.classList.contains("page-login") && localStorage.getItem(TOKEN_KEY)) {
    window.location.href = "./index.html";
  }
});
