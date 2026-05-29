const API_BASE_URL = "http://localhost:8000";
const TOKEN_KEY = "research_group_token";

function formToObject(formSelector) {
  const values = {};
  $(formSelector).serializeArray().forEach((item) => {
    values[item.name] = item.value.trim();
  });
  return values;
}

function showError(error) {
  const message = error?.responseJSON?.detail || error?.message || "请求失败，请稍后重试";
  $.messager.alert("提示", message, "error");
}

function saveSession(data) {
  localStorage.setItem(TOKEN_KEY, data.access_token);
  showHome(data.user);
}

function showHome(user) {
  $("#welcomeTitle").text(`欢迎，${user.full_name || user.username}`);
  $("#welcomeMeta").text(`${user.email} · 用户 ID：${user.id}`);
  $("#homeDialog").dialog("open");
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
  $("#homeDialog").dialog("close");
}

function loadCurrentUser() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    return;
  }

  $.ajax({
    url: `${API_BASE_URL}/api/auth/me`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .done(showHome)
    .fail(() => localStorage.removeItem(TOKEN_KEY));
}

$(loadCurrentUser);
