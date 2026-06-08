-- 课题组信息管理系统统一初始化脚本
-- 执行示例：
--   D:\software\sqlite\sqlite3.exe backend\research_group.db ".read backend\init.sql"
--
-- 说明：
--   1. 保留/创建表结构。
--   2. 清空所有已有业务数据。
--   3. 仅插入一个管理员和指定课题组成员。
--
-- 默认账号：
--   admin / 123456
--   其他成员账号为姓名拼音，密码均为 123456

PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS resource_comments;
DROP TABLE IF EXISTS resource_posts;
DROP TABLE IF EXISTS group_meetings;
DROP TABLE IF EXISTS activities;
DROP TABLE IF EXISTS api_logs;
DROP TABLE IF EXISTS papers;
DROP TABLE IF EXISTS dictionary;
DROP TABLE IF EXISTS users;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    telephone TEXT,
    province TEXT,
    city TEXT,
    birthday TEXT,
    enrollment_year INTEGER,
    is_graduated INTEGER NOT NULL DEFAULT 0 CHECK (is_graduated IN (0, 1)),
    graduation_year INTEGER,
    avatar_url TEXT,
    bio TEXT,
    undergraduate_school TEXT,
    master_school TEXT,
    doctoral_school TEXT,
    skill_petroleum_engineering INTEGER NOT NULL DEFAULT 50,
    skill_mathematics INTEGER NOT NULL DEFAULT 50,
    skill_ai_tools INTEGER NOT NULL DEFAULT 50,
    skill_coding INTEGER NOT NULL DEFAULT 50,
    skill_presentation INTEGER NOT NULL DEFAULT 50,
    skill_organization INTEGER NOT NULL DEFAULT 50,
    hashed_password TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_full_name ON users(full_name);
CREATE INDEX IF NOT EXISTS idx_users_enrollment_year ON users(enrollment_year);
CREATE INDEX IF NOT EXISTS idx_users_is_graduated ON users(is_graduated);

CREATE TABLE IF NOT EXISTS papers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    journal_name TEXT NOT NULL,
    publisher TEXT,
    language TEXT NOT NULL DEFAULT '英文',
    publication_category TEXT NOT NULL DEFAULT 'SCI',
    publication_subtype TEXT,
    sci_partition TEXT,
    cug_partition TEXT,
    corresponding_author TEXT,
    first_author TEXT,
    all_authors TEXT NOT NULL DEFAULT '[]',
    institution_list TEXT NOT NULL DEFAULT '[]',
    publish_date TEXT,
    is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
    download_url TEXT,
    uploaded_file_path TEXT,
    uploaded_file_name TEXT,
    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(owner_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_papers_owner_id ON papers(owner_id);
CREATE INDEX IF NOT EXISTS idx_papers_publish_date ON papers(publish_date);
CREATE INDEX IF NOT EXISTS idx_papers_is_deleted ON papers(is_deleted);
CREATE INDEX IF NOT EXISTS idx_papers_journal_name ON papers(journal_name);
CREATE INDEX IF NOT EXISTS idx_papers_publisher ON papers(publisher);

CREATE TABLE IF NOT EXISTS dictionary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    images TEXT NOT NULL DEFAULT '[]',
    publish_date TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(owner_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_activities_owner_id ON activities(owner_id);
CREATE INDEX IF NOT EXISTS idx_activities_publish_date ON activities(publish_date);
CREATE INDEX IF NOT EXISTS idx_activities_is_deleted ON activities(is_deleted);

CREATE TABLE IF NOT EXISTS group_meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    meeting_date TEXT NOT NULL,
    speaker TEXT NOT NULL,
    topic TEXT NOT NULL,
    attendees TEXT NOT NULL DEFAULT '[]',
    documents TEXT NOT NULL DEFAULT '[]',
    photos TEXT NOT NULL DEFAULT '[]',
    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(owner_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_group_meetings_owner_id ON group_meetings(owner_id);
CREATE INDEX IF NOT EXISTS idx_group_meetings_meeting_date ON group_meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_group_meetings_is_deleted ON group_meetings(is_deleted);
CREATE INDEX IF NOT EXISTS idx_group_meetings_speaker ON group_meetings(speaker);

CREATE TABLE IF NOT EXISTS api_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_name TEXT,
    username TEXT,
    request_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    query_string TEXT,
    status_code INTEGER,
    user_agent TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_api_logs_user_id ON api_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_request_time ON api_logs(request_time);
CREATE INDEX IF NOT EXISTS idx_api_logs_path ON api_logs(path);

CREATE TABLE IF NOT EXISTS resource_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    content TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(owner_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_resource_posts_owner_id ON resource_posts(owner_id);
CREATE INDEX IF NOT EXISTS idx_resource_posts_type ON resource_posts(resource_type);
CREATE INDEX IF NOT EXISTS idx_resource_posts_updated_at ON resource_posts(updated_at);
CREATE INDEX IF NOT EXISTS idx_resource_posts_is_deleted ON resource_posts(is_deleted);

CREATE TABLE IF NOT EXISTS resource_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    owner_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(post_id) REFERENCES resource_posts(id),
    FOREIGN KEY(owner_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_resource_comments_post_id ON resource_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_resource_comments_owner_id ON resource_comments(owner_id);
CREATE INDEX IF NOT EXISTS idx_resource_comments_is_deleted ON resource_comments(is_deleted);

DELETE FROM resource_comments;
DELETE FROM resource_posts;
DELETE FROM group_meetings;
DELETE FROM activities;
DELETE FROM api_logs;
DELETE FROM papers;
DELETE FROM dictionary;
DELETE FROM users;
DELETE FROM sqlite_sequence WHERE name IN (
    'resource_comments',
    'resource_posts',
    'group_meetings',
    'activities',
    'api_logs',
    'papers',
    'dictionary',
    'users'
);

INSERT INTO dictionary (key, value, description)
VALUES ('activity_image_dir', 'uploads/activities', '活动图片保存根目录');

INSERT INTO users (
    username,
    full_name,
    telephone,
    province,
    city,
    birthday,
    enrollment_year,
    is_graduated,
    graduation_year,
    avatar_url,
    bio,
    undergraduate_school,
    master_school,
    doctoral_school,
    skill_petroleum_engineering,
    skill_mathematics,
    skill_ai_tools,
    skill_coding,
    skill_presentation,
    skill_organization,
    hashed_password,
    is_admin,
    is_active,
    created_at
) VALUES
('admin', '管理员', '', '', '', NULL, NULL, 0, NULL, 'uploads/avatars/default_avatar.jpg', '系统管理员账号，用于后台管理和密码重置。', '', '', '', 50, 50, 50, 50, 50, 50, 'pbkdf2_sha256$research_group_demo_salt$90964a622330c2ec50e2b0d6f4c78ff2f9a77e112389e1533e86736655a0d746', 1, 1, CURRENT_TIMESTAMP),
('gongbin', '龚斌', '', '', '', NULL, NULL, 0, NULL, 'uploads/avatars/default_avatar.jpg', '', '', '', '', 50, 50, 50, 50, 50, 50, 'pbkdf2_sha256$research_group_demo_salt$90964a622330c2ec50e2b0d6f4c78ff2f9a77e112389e1533e86736655a0d746', 0, 1, CURRENT_TIMESTAMP),
('wanglei', '汪垒', '', '', '', NULL, NULL, 0, NULL, 'uploads/avatars/default_avatar.jpg', '', '', '', '', 50, 50, 50, 50, 50, 50, 'pbkdf2_sha256$research_group_demo_salt$90964a622330c2ec50e2b0d6f4c78ff2f9a77e112389e1533e86736655a0d746', 0, 1, CURRENT_TIMESTAMP),
('huanghu', '黄虎', '', '', '', NULL, NULL, 0, NULL, 'uploads/avatars/default_avatar.jpg', '', '', '', '', 50, 50, 50, 50, 50, 50, 'pbkdf2_sha256$research_group_demo_salt$90964a622330c2ec50e2b0d6f4c78ff2f9a77e112389e1533e86736655a0d746', 0, 1, CURRENT_TIMESTAMP),
('yangjinghua', '杨京华', '', '', '', NULL, NULL, 0, NULL, 'uploads/avatars/default_avatar.jpg', '', '', '', '', 50, 50, 50, 50, 50, 50, 'pbkdf2_sha256$research_group_demo_salt$90964a622330c2ec50e2b0d6f4c78ff2f9a77e112389e1533e86736655a0d746', 0, 1, CURRENT_TIMESTAMP),
('liuchen', '刘琛', '', '', '', NULL, NULL, 0, NULL, 'uploads/avatars/default_avatar.jpg', '', '', '', '', 50, 50, 50, 50, 50, 50, 'pbkdf2_sha256$research_group_demo_salt$90964a622330c2ec50e2b0d6f4c78ff2f9a77e112389e1533e86736655a0d746', 0, 1, CURRENT_TIMESTAMP),
('wuhaoqiang', '吴昊镪', '', '', '', NULL, NULL, 0, NULL, 'uploads/avatars/default_avatar.jpg', '', '', '', '', 50, 50, 50, 50, 50, 50, 'pbkdf2_sha256$research_group_demo_salt$90964a622330c2ec50e2b0d6f4c78ff2f9a77e112389e1533e86736655a0d746', 0, 1, CURRENT_TIMESTAMP),
('zhangshifan', '张仕帆', '', '', '', NULL, NULL, 0, NULL, 'uploads/avatars/default_avatar.jpg', '', '', '', '', 50, 50, 50, 50, 50, 50, 'pbkdf2_sha256$research_group_demo_salt$90964a622330c2ec50e2b0d6f4c78ff2f9a77e112389e1533e86736655a0d746', 0, 1, CURRENT_TIMESTAMP),
('zhaoheng', '赵恒', '', '', '', NULL, NULL, 0, NULL, 'uploads/avatars/default_avatar.jpg', '', '', '', '', 50, 50, 50, 50, 50, 50, 'pbkdf2_sha256$research_group_demo_salt$90964a622330c2ec50e2b0d6f4c78ff2f9a77e112389e1533e86736655a0d746', 0, 1, CURRENT_TIMESTAMP),
('xiangdongliu', '向东流', '', '', '', NULL, NULL, 0, NULL, 'uploads/avatars/default_avatar.jpg', '', '', '', '', 50, 50, 50, 50, 50, 50, 'pbkdf2_sha256$research_group_demo_salt$90964a622330c2ec50e2b0d6f4c78ff2f9a77e112389e1533e86736655a0d746', 0, 1, CURRENT_TIMESTAMP),
('duanqingshan', '段青山', '', '', '', NULL, NULL, 0, NULL, 'uploads/avatars/default_avatar.jpg', '', '', '', '', 50, 50, 50, 50, 50, 50, 'pbkdf2_sha256$research_group_demo_salt$90964a622330c2ec50e2b0d6f4c78ff2f9a77e112389e1533e86736655a0d746', 0, 1, CURRENT_TIMESTAMP),
('lifan', '李帆', '', '', '', NULL, NULL, 0, NULL, 'uploads/avatars/default_avatar.jpg', '', '', '', '', 50, 50, 50, 50, 50, 50, 'pbkdf2_sha256$research_group_demo_salt$90964a622330c2ec50e2b0d6f4c78ff2f9a77e112389e1533e86736655a0d746', 0, 1, CURRENT_TIMESTAMP),
('wangyaxin', '王雅鑫', '', '', '', NULL, NULL, 0, NULL, 'uploads/avatars/default_avatar.jpg', '', '', '', '', 50, 50, 50, 50, 50, 50, 'pbkdf2_sha256$research_group_demo_salt$90964a622330c2ec50e2b0d6f4c78ff2f9a77e112389e1533e86736655a0d746', 0, 1, CURRENT_TIMESTAMP),
('zhengmingzhen', '郑明珍', '', '', '', NULL, NULL, 0, NULL, 'uploads/avatars/default_avatar.jpg', '', '', '', '', 50, 50, 50, 50, 50, 50, 'pbkdf2_sha256$research_group_demo_salt$90964a622330c2ec50e2b0d6f4c78ff2f9a77e112389e1533e86736655a0d746', 0, 1, CURRENT_TIMESTAMP),
('yanhe', '颜和', '', '', '', NULL, NULL, 0, NULL, 'uploads/avatars/default_avatar.jpg', '', '', '', '', 50, 50, 50, 50, 50, 50, 'pbkdf2_sha256$research_group_demo_salt$90964a622330c2ec50e2b0d6f4c78ff2f9a77e112389e1533e86736655a0d746', 0, 1, CURRENT_TIMESTAMP);

PRAGMA foreign_keys = ON;
