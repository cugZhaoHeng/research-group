-- 课题组信息管理系统初始化脚本
-- 执行示例：
--   D:\software\sqlite\sqlite3.exe backend\research_group.db ".read backend\init.sql"
--
-- 测试账号：
--   zhangsan / 123456
--   lisi     / 123456
--   wangwu   / 123456

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS papers;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    telephone TEXT,
    email TEXT NOT NULL UNIQUE,
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
    hashed_password TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_full_name ON users(full_name);
CREATE INDEX idx_users_enrollment_year ON users(enrollment_year);
CREATE INDEX idx_users_is_graduated ON users(is_graduated);

CREATE TABLE papers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    journal_name TEXT NOT NULL,
    publisher TEXT,
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

CREATE INDEX idx_papers_owner_id ON papers(owner_id);
CREATE INDEX idx_papers_publish_date ON papers(publish_date);
CREATE INDEX idx_papers_is_deleted ON papers(is_deleted);
CREATE INDEX idx_papers_journal_name ON papers(journal_name);
CREATE INDEX idx_papers_publisher ON papers(publisher);

INSERT INTO users (
    username,
    full_name,
    telephone,
    email,
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
    hashed_password,
    is_active,
    created_at
) VALUES
(
    'zhangsan',
    '张三',
    '13800000001',
    'zhangsan@example.com',
    '江苏省',
    '南京市',
    '1998-03-12',
    2022,
    0,
    NULL,
    '/uploads/avatars/zhangsan.png',
    '课题组博士生，研究方向为人工智能与数据挖掘。',
    '南京大学',
    '东南大学',
    '示例大学',
    'pbkdf2_sha256$research_group_demo_salt$90964a622330c2ec50e2b0d6f4c78ff2f9a77e112389e1533e86736655a0d746',
    1,
    CURRENT_TIMESTAMP
),
(
    'lisi',
    '李四',
    '13800000002',
    'lisi@example.com',
    '浙江省',
    '杭州市',
    '1997-07-20',
    2021,
    0,
    NULL,
    '/uploads/avatars/lisi.png',
    '课题组硕士生，关注科研项目管理与知识图谱。',
    '浙江大学',
    '示例大学',
    NULL,
    'pbkdf2_sha256$research_group_demo_salt$90964a622330c2ec50e2b0d6f4c78ff2f9a77e112389e1533e86736655a0d746',
    1,
    CURRENT_TIMESTAMP
),
(
    'wangwu',
    '王五',
    '13800000003',
    'wangwu@example.com',
    '广东省',
    '广州市',
    '1996-11-05',
    2019,
    1,
    2025,
    '/uploads/avatars/wangwu.png',
    '课题组毕业成员，目前从事科研平台研发工作。',
    '中山大学',
    '华南理工大学',
    '示例大学',
    'pbkdf2_sha256$research_group_demo_salt$90964a622330c2ec50e2b0d6f4c78ff2f9a77e112389e1533e86736655a0d746',
    1,
    CURRENT_TIMESTAMP
);

INSERT INTO papers (
    owner_id,
    title,
    journal_name,
    publisher,
    sci_partition,
    cug_partition,
    corresponding_author,
    first_author,
    all_authors,
    institution_list,
    publish_date,
    is_published,
    download_url,
    uploaded_file_path,
    uploaded_file_name,
    is_deleted,
    created_at,
    updated_at
) VALUES
(1, '面向科研团队的信息共享模型研究', 'Information Systems Frontiers', 'Springer', 'Q2', 'A', '王教授', '张三', '["张三","李四","王教授"]', '["示例大学计算机学院","东南大学软件学院"]', '2024-03-18', 1, 'https://example.com/papers/zhangsan-1', NULL, NULL, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(1, '基于知识图谱的论文成果关联分析', 'Knowledge-Based Systems', 'Elsevier', 'Q1', 'A+', '王教授', '张三', '["张三","王五","王教授"]', '["示例大学计算机学院","中山大学数据科学学院"]', '2024-08-06', 1, 'https://example.com/papers/zhangsan-2', NULL, NULL, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(1, '科研协作场景下的成员画像构建方法', 'Expert Systems with Applications', 'Elsevier', 'Q1', 'A', '赵教授', '张三', '["张三","赵教授"]', '["示例大学计算机学院"]', '2025-01-12', 0, 'https://example.com/papers/zhangsan-3', NULL, NULL, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(1, '融合多源数据的课题组成果检索系统', 'Journal of Informetrics', 'Elsevier', 'Q2', 'B+', '王教授', '李四', '["李四","张三","王教授"]', '["示例大学计算机学院","浙江大学信息学院"]', '2025-05-20', 1, 'https://example.com/papers/zhangsan-4', NULL, NULL, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, '科研项目管理中的知识图谱构建', 'Data & Knowledge Engineering', 'Elsevier', 'Q3', 'B', '陈教授', '李四', '["李四","张三","陈教授"]', '["示例大学计算机学院","浙江大学信息学院"]', '2023-11-22', 1, 'https://example.com/papers/lisi-1', NULL, NULL, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, '面向团队协同的学术活动推荐方法', 'Applied Intelligence', 'Springer', 'Q2', 'A', '陈教授', '李四', '["李四","王五","陈教授"]', '["示例大学计算机学院"]', '2024-04-09', 1, 'https://example.com/papers/lisi-2', NULL, NULL, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, '组会纪要自动摘要与主题追踪', 'IEEE Access', 'IEEE', 'Q2', 'B+', '王教授', '李四', '["李四","王教授"]', '["示例大学计算机学院"]', '2024-10-15', 1, 'https://example.com/papers/lisi-3', NULL, NULL, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, '科研成果信息抽取的弱监督学习方法', 'Pattern Recognition Letters', 'Elsevier', 'Q2', 'B+', '陈教授', '张三', '["张三","李四","陈教授"]', '["示例大学计算机学院","浙江大学信息学院"]', '2025-03-28', 0, 'https://example.com/papers/lisi-4', NULL, NULL, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, '科研平台用户行为日志分析', 'Journal of Systems and Software', 'Elsevier', 'Q1', 'A', '刘教授', '王五', '["王五","刘教授"]', '["示例大学计算机学院","华南理工大学软件学院"]', '2022-09-30', 1, 'https://example.com/papers/wangwu-1', NULL, NULL, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, '团队信息管理系统的权限模型设计', 'Software: Practice and Experience', 'Wiley', 'Q3', 'B', '刘教授', '王五', '["王五","李四","刘教授"]', '["示例大学计算机学院"]', '2023-06-17', 1, 'https://example.com/papers/wangwu-2', NULL, NULL, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, '面向高校科研组织的轻量级数据治理', 'Scientometrics', 'Springer', 'Q2', 'A', '王教授', '王五', '["王五","张三","王教授"]', '["示例大学计算机学院","中山大学数据科学学院"]', '2024-01-25', 1, 'https://example.com/papers/wangwu-3', NULL, NULL, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, '基于SQLite的科研信息系统快速原型实现', 'Computer Standards & Interfaces', 'Elsevier', 'Q2', 'B+', '刘教授', '李四', '["李四","王五","刘教授"]', '["示例大学计算机学院","华南理工大学软件学院"]', '2025-02-11', 0, 'https://example.com/papers/wangwu-4', NULL, NULL, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
