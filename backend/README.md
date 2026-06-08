# 后端说明

## 启动

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

SQLite 数据库文件会自动创建为 `research_group.db`。

## 接口

- 注册已关闭，账号由管理员统一维护。
- `POST /api/auth/login`：登录
- `GET /api/auth/me`：获取当前登录用户
- `GET /api/health`：健康检查
