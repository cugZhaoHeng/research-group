-- 非破坏性迁移：为当前数据库补充论文发表表和测试数据

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS papers (
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

CREATE INDEX IF NOT EXISTS idx_papers_owner_id ON papers(owner_id);
CREATE INDEX IF NOT EXISTS idx_papers_publish_date ON papers(publish_date);
CREATE INDEX IF NOT EXISTS idx_papers_is_deleted ON papers(is_deleted);
CREATE INDEX IF NOT EXISTS idx_papers_journal_name ON papers(journal_name);
CREATE INDEX IF NOT EXISTS idx_papers_publisher ON papers(publisher);

INSERT INTO papers (owner_id, title, journal_name, publisher, sci_partition, cug_partition, corresponding_author, first_author, all_authors, institution_list, publish_date, is_published, download_url)
SELECT id, '面向科研团队的信息共享模型研究', 'Information Systems Frontiers', 'Springer', 'Q2', 'A', '王教授', '张三', '["张三","李四","王教授"]', '["示例大学计算机学院","东南大学软件学院"]', '2024-03-18', 1, 'https://example.com/papers/zhangsan-1' FROM users WHERE username = 'zhangsan' AND NOT EXISTS (SELECT 1 FROM papers WHERE title = '面向科研团队的信息共享模型研究');
INSERT INTO papers (owner_id, title, journal_name, publisher, sci_partition, cug_partition, corresponding_author, first_author, all_authors, institution_list, publish_date, is_published, download_url)
SELECT id, '基于知识图谱的论文成果关联分析', 'Knowledge-Based Systems', 'Elsevier', 'Q1', 'A+', '王教授', '张三', '["张三","王五","王教授"]', '["示例大学计算机学院","中山大学数据科学学院"]', '2024-08-06', 1, 'https://example.com/papers/zhangsan-2' FROM users WHERE username = 'zhangsan' AND NOT EXISTS (SELECT 1 FROM papers WHERE title = '基于知识图谱的论文成果关联分析');
INSERT INTO papers (owner_id, title, journal_name, publisher, sci_partition, cug_partition, corresponding_author, first_author, all_authors, institution_list, publish_date, is_published, download_url)
SELECT id, '科研协作场景下的成员画像构建方法', 'Expert Systems with Applications', 'Elsevier', 'Q1', 'A', '赵教授', '张三', '["张三","赵教授"]', '["示例大学计算机学院"]', '2025-01-12', 0, 'https://example.com/papers/zhangsan-3' FROM users WHERE username = 'zhangsan' AND NOT EXISTS (SELECT 1 FROM papers WHERE title = '科研协作场景下的成员画像构建方法');
INSERT INTO papers (owner_id, title, journal_name, publisher, sci_partition, cug_partition, corresponding_author, first_author, all_authors, institution_list, publish_date, is_published, download_url)
SELECT id, '融合多源数据的课题组成果检索系统', 'Journal of Informetrics', 'Elsevier', 'Q2', 'B+', '王教授', '李四', '["李四","张三","王教授"]', '["示例大学计算机学院","浙江大学信息学院"]', '2025-05-20', 1, 'https://example.com/papers/zhangsan-4' FROM users WHERE username = 'zhangsan' AND NOT EXISTS (SELECT 1 FROM papers WHERE title = '融合多源数据的课题组成果检索系统');

INSERT INTO papers (owner_id, title, journal_name, publisher, sci_partition, cug_partition, corresponding_author, first_author, all_authors, institution_list, publish_date, is_published, download_url)
SELECT id, '科研项目管理中的知识图谱构建', 'Data & Knowledge Engineering', 'Elsevier', 'Q3', 'B', '陈教授', '李四', '["李四","张三","陈教授"]', '["示例大学计算机学院","浙江大学信息学院"]', '2023-11-22', 1, 'https://example.com/papers/lisi-1' FROM users WHERE username = 'lisi' AND NOT EXISTS (SELECT 1 FROM papers WHERE title = '科研项目管理中的知识图谱构建');
INSERT INTO papers (owner_id, title, journal_name, publisher, sci_partition, cug_partition, corresponding_author, first_author, all_authors, institution_list, publish_date, is_published, download_url)
SELECT id, '面向团队协同的学术活动推荐方法', 'Applied Intelligence', 'Springer', 'Q2', 'A', '陈教授', '李四', '["李四","王五","陈教授"]', '["示例大学计算机学院"]', '2024-04-09', 1, 'https://example.com/papers/lisi-2' FROM users WHERE username = 'lisi' AND NOT EXISTS (SELECT 1 FROM papers WHERE title = '面向团队协同的学术活动推荐方法');
INSERT INTO papers (owner_id, title, journal_name, publisher, sci_partition, cug_partition, corresponding_author, first_author, all_authors, institution_list, publish_date, is_published, download_url)
SELECT id, '组会纪要自动摘要与主题追踪', 'IEEE Access', 'IEEE', 'Q2', 'B+', '王教授', '李四', '["李四","王教授"]', '["示例大学计算机学院"]', '2024-10-15', 1, 'https://example.com/papers/lisi-3' FROM users WHERE username = 'lisi' AND NOT EXISTS (SELECT 1 FROM papers WHERE title = '组会纪要自动摘要与主题追踪');
INSERT INTO papers (owner_id, title, journal_name, publisher, sci_partition, cug_partition, corresponding_author, first_author, all_authors, institution_list, publish_date, is_published, download_url)
SELECT id, '科研成果信息抽取的弱监督学习方法', 'Pattern Recognition Letters', 'Elsevier', 'Q2', 'B+', '陈教授', '张三', '["张三","李四","陈教授"]', '["示例大学计算机学院","浙江大学信息学院"]', '2025-03-28', 0, 'https://example.com/papers/lisi-4' FROM users WHERE username = 'lisi' AND NOT EXISTS (SELECT 1 FROM papers WHERE title = '科研成果信息抽取的弱监督学习方法');

INSERT INTO papers (owner_id, title, journal_name, publisher, sci_partition, cug_partition, corresponding_author, first_author, all_authors, institution_list, publish_date, is_published, download_url)
SELECT id, '科研平台用户行为日志分析', 'Journal of Systems and Software', 'Elsevier', 'Q1', 'A', '刘教授', '王五', '["王五","刘教授"]', '["示例大学计算机学院","华南理工大学软件学院"]', '2022-09-30', 1, 'https://example.com/papers/wangwu-1' FROM users WHERE username = 'wangwu' AND NOT EXISTS (SELECT 1 FROM papers WHERE title = '科研平台用户行为日志分析');
INSERT INTO papers (owner_id, title, journal_name, publisher, sci_partition, cug_partition, corresponding_author, first_author, all_authors, institution_list, publish_date, is_published, download_url)
SELECT id, '团队信息管理系统的权限模型设计', 'Software: Practice and Experience', 'Wiley', 'Q3', 'B', '刘教授', '王五', '["王五","李四","刘教授"]', '["示例大学计算机学院"]', '2023-06-17', 1, 'https://example.com/papers/wangwu-2' FROM users WHERE username = 'wangwu' AND NOT EXISTS (SELECT 1 FROM papers WHERE title = '团队信息管理系统的权限模型设计');
INSERT INTO papers (owner_id, title, journal_name, publisher, sci_partition, cug_partition, corresponding_author, first_author, all_authors, institution_list, publish_date, is_published, download_url)
SELECT id, '面向高校科研组织的轻量级数据治理', 'Scientometrics', 'Springer', 'Q2', 'A', '王教授', '王五', '["王五","张三","王教授"]', '["示例大学计算机学院","中山大学数据科学学院"]', '2024-01-25', 1, 'https://example.com/papers/wangwu-3' FROM users WHERE username = 'wangwu' AND NOT EXISTS (SELECT 1 FROM papers WHERE title = '面向高校科研组织的轻量级数据治理');
INSERT INTO papers (owner_id, title, journal_name, publisher, sci_partition, cug_partition, corresponding_author, first_author, all_authors, institution_list, publish_date, is_published, download_url)
SELECT id, '基于SQLite的科研信息系统快速原型实现', 'Computer Standards & Interfaces', 'Elsevier', 'Q2', 'B+', '刘教授', '李四', '["李四","王五","刘教授"]', '["示例大学计算机学院","华南理工大学软件学院"]', '2025-02-11', 0, 'https://example.com/papers/wangwu-4' FROM users WHERE username = 'wangwu' AND NOT EXISTS (SELECT 1 FROM papers WHERE title = '基于SQLite的科研信息系统快速原型实现');
