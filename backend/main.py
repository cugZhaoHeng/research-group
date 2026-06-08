from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
import csv
import hashlib
import hmac
import io
import json
from pathlib import Path
import re
import secrets
import shutil
from typing import Annotated
import zipfile
import xml.etree.ElementTree as ET

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from sqlalchemy import Column, Integer, String, Text, create_engine, or_, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker


BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BASE_DIR / "research_group.db"
FILES_DIR = BASE_DIR / "files"
TRAVEL_STANDARD_FILE_NAME = "差旅住宿费标准明细表.xlsx"
TRAVEL_STANDARD_FILE = FILES_DIR / TRAVEL_STANDARD_FILE_NAME
UPLOAD_DIR = BASE_DIR / "uploads" / "papers"
AVATAR_DIR = BASE_DIR / "uploads" / "avatars"
DEFAULT_AVATAR_FILE_NAME = "default_avatar.jpg"
DEFAULT_AVATAR_URL = f"uploads/avatars/{DEFAULT_AVATAR_FILE_NAME}"
DATABASE_URL = f"sqlite:///{DATABASE_PATH.as_posix()}"
SECRET_KEY = "please-change-this-secret-key-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24
PASSWORD_ITERATIONS = 120000
RESOURCE_TYPES = [
    "成果分享",
    "知识笔记",
    "推荐文章",
    "转载文章",
    "资料分享",
    "数据集",
    "代码仓库",
    "工具推荐",
    "模板范例",
    "课程笔记",
    "会议材料",
    "经验总结",
    "问题求助",
]


engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    ensure_user_profile_columns()
    ensure_single_admin_user()
    
    # Initialize dictionary entry for activity image directory
    db = SessionLocal()
    try:
        dict_entry = db.query(Dictionary).filter(Dictionary.key == "activity_image_dir").first()
        if not dict_entry:
            dict_entry = Dictionary(
                key="activity_image_dir",
                value="uploads/activities",
                description="活动图片保存路径",
            )
            db.add(dict_entry)
            db.commit()
            
        activity_dir = BASE_DIR / dict_entry.value
        activity_dir.mkdir(parents=True, exist_ok=True)
    finally:
        db.close()
        
    yield


app = FastAPI(title="Research Group Information System", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    telephone = Column(String, nullable=True)
    province = Column(String, nullable=True)
    city = Column(String, nullable=True)
    birthday = Column(String, nullable=True)
    enrollment_year = Column(Integer, nullable=True)
    is_graduated = Column(Integer, default=0, nullable=False)
    graduation_year = Column(Integer, nullable=True)
    avatar_url = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    undergraduate_school = Column(String, nullable=True)
    master_school = Column(String, nullable=True)
    doctoral_school = Column(String, nullable=True)
    skill_petroleum_engineering = Column(Integer, default=50, nullable=False)
    skill_mathematics = Column(Integer, default=50, nullable=False)
    skill_ai_tools = Column(Integer, default=50, nullable=False)
    skill_coding = Column(Integer, default=50, nullable=False)
    skill_presentation = Column(Integer, default=50, nullable=False)
    skill_organization = Column(Integer, default=50, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Integer, default=0, nullable=False)
    is_active = Column(Integer, default=1, nullable=False)
    created_at = Column(String, default=lambda: now_text(), nullable=False)


class Paper(Base):
    __tablename__ = "papers"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, nullable=False, index=True)
    title = Column(String, nullable=False)
    journal_name = Column(String, nullable=False)
    publisher = Column(String, nullable=True)
    language = Column(String, default="英文", nullable=False)
    publication_category = Column(String, default="SCI", nullable=False)
    publication_subtype = Column(String, nullable=True)
    sci_partition = Column(String, nullable=True)
    cug_partition = Column(String, nullable=True)
    corresponding_author = Column(String, nullable=True)
    first_author = Column(String, nullable=True)
    all_authors = Column(Text, default="[]", nullable=False)
    institution_list = Column(Text, default="[]", nullable=False)
    publish_date = Column(String, nullable=True)
    is_published = Column(Integer, default=0, nullable=False)
    download_url = Column(String, nullable=True)
    uploaded_file_path = Column(String, nullable=True)
    uploaded_file_name = Column(String, nullable=True)
    is_deleted = Column(Integer, default=0, nullable=False)
    created_at = Column(String, default=lambda: now_text(), nullable=False)
    updated_at = Column(String, default=lambda: now_text(), nullable=False)


class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, nullable=False, index=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    tags = Column(Text, default="[]", nullable=False)
    images = Column(Text, default="[]", nullable=False)
    publish_date = Column(String, nullable=False)
    is_deleted = Column(Integer, default=0, nullable=False)
    created_at = Column(String, default=lambda: now_text(), nullable=False)
    updated_at = Column(String, default=lambda: now_text(), nullable=False)


class GroupMeeting(Base):
    __tablename__ = "group_meetings"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, nullable=False, index=True)
    meeting_date = Column(String, nullable=False, index=True)
    speaker = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    attendees = Column(Text, default="[]", nullable=False)
    documents = Column(Text, default="[]", nullable=False)
    photos = Column(Text, default="[]", nullable=False)
    is_deleted = Column(Integer, default=0, nullable=False)
    created_at = Column(String, default=lambda: now_text(), nullable=False)
    updated_at = Column(String, default=lambda: now_text(), nullable=False)


class ResourcePost(Base):
    __tablename__ = "resource_posts"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, nullable=False, index=True)
    title = Column(String, nullable=False, index=True)
    resource_type = Column(String, nullable=False, index=True)
    tags = Column(Text, default="[]", nullable=False)
    content = Column(Text, nullable=False)
    is_deleted = Column(Integer, default=0, nullable=False)
    created_at = Column(String, default=lambda: now_text(), nullable=False)
    updated_at = Column(String, default=lambda: now_text(), nullable=False)


class ResourceComment(Base):
    __tablename__ = "resource_comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, nullable=False, index=True)
    owner_id = Column(Integer, nullable=False, index=True)
    content = Column(Text, nullable=False)
    is_deleted = Column(Integer, default=0, nullable=False)
    created_at = Column(String, default=lambda: now_text(), nullable=False)
    updated_at = Column(String, default=lambda: now_text(), nullable=False)


class Dictionary(Base):
    __tablename__ = "dictionary"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(String, nullable=False)
    description = Column(String, nullable=True)


class ApiLog(Base):
    __tablename__ = "api_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    user_name = Column(String, nullable=True)
    username = Column(String, nullable=True)
    request_time = Column(String, default=lambda: now_text(), nullable=False)
    ip_address = Column(String, nullable=True)
    method = Column(String, nullable=False)
    path = Column(String, nullable=False)
    query_string = Column(Text, nullable=True)
    status_code = Column(Integer, nullable=True)
    user_agent = Column(Text, nullable=True)


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=128)
    full_name: str = Field(min_length=1, max_length=100)
    telephone: str | None = Field(default=None, max_length=30)
    province: str | None = Field(default=None, max_length=50)
    city: str | None = Field(default=None, max_length=50)
    birthday: str | None = Field(default=None, max_length=20)
    enrollment_year: int | None = None
    is_graduated: int = 0
    graduation_year: int | None = None
    avatar_url: str | None = Field(default=None, max_length=500)
    bio: str | None = None
    undergraduate_school: str | None = Field(default=None, max_length=100)
    master_school: str | None = Field(default=None, max_length=100)
    doctoral_school: str | None = Field(default=None, max_length=100)


class UserLogin(BaseModel):
    username: str
    password: str


class UserProfileUpdate(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    telephone: str | None = Field(default=None, max_length=30)
    province: str | None = Field(default=None, max_length=50)
    city: str | None = Field(default=None, max_length=50)
    birthday: str | None = Field(default=None, max_length=20)
    enrollment_year: int | None = None
    is_graduated: int = 0
    graduation_year: int | None = None
    bio: str | None = None
    undergraduate_school: str | None = Field(default=None, max_length=100)
    master_school: str | None = Field(default=None, max_length=100)
    doctoral_school: str | None = Field(default=None, max_length=100)
    skill_petroleum_engineering: int = Field(default=50, ge=0, le=100)
    skill_mathematics: int = Field(default=50, ge=0, le=100)
    skill_ai_tools: int = Field(default=50, ge=0, le=100)
    skill_coding: int = Field(default=50, ge=0, le=100)
    skill_presentation: int = Field(default=50, ge=0, le=100)
    skill_organization: int = Field(default=50, ge=0, le=100)


class AdminUserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(default="123456", min_length=6, max_length=128)
    full_name: str = Field(min_length=1, max_length=100)
    telephone: str | None = Field(default=None, max_length=30)
    province: str | None = Field(default=None, max_length=50)
    city: str | None = Field(default=None, max_length=50)
    birthday: str | None = Field(default=None, max_length=20)
    enrollment_year: int | None = None
    is_graduated: int = 0
    graduation_year: int | None = None
    bio: str | None = None
    undergraduate_school: str | None = Field(default=None, max_length=100)
    master_school: str | None = Field(default=None, max_length=100)
    doctoral_school: str | None = Field(default=None, max_length=100)
    skill_petroleum_engineering: int = Field(default=50, ge=0, le=100)
    skill_mathematics: int = Field(default=50, ge=0, le=100)
    skill_ai_tools: int = Field(default=50, ge=0, le=100)
    skill_coding: int = Field(default=50, ge=0, le=100)
    skill_presentation: int = Field(default=50, ge=0, le=100)
    skill_organization: int = Field(default=50, ge=0, le=100)


class AdminUserUpdate(UserProfileUpdate):
    pass


class PasswordUpdate(BaseModel):
    old_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)


class AdminPasswordReset(BaseModel):
    new_password: str = Field(min_length=6, max_length=128)


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    telephone: str | None
    province: str | None
    city: str | None
    birthday: str | None
    enrollment_year: int | None
    is_graduated: int
    graduation_year: int | None
    avatar_url: str | None
    bio: str | None
    undergraduate_school: str | None
    master_school: str | None
    doctoral_school: str | None
    skill_petroleum_engineering: int
    skill_mathematics: int
    skill_ai_tools: int
    skill_coding: int
    skill_presentation: int
    skill_organization: int
    is_admin: int
    created_at: str

    class Config:
        from_attributes = True


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserOptionOut(BaseModel):
    id: int
    username: str
    full_name: str
    label: str
    value: str


class UserListOut(BaseModel):
    total: int
    rows: list[UserOut]


class UserExportRequest(BaseModel):
    columns: list[str] = Field(default_factory=list)


class PaperBase(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    journal_name: str = Field(min_length=1, max_length=200)
    publisher: str | None = Field(default=None, max_length=200)
    language: str = Field(default="英文", max_length=20)
    publication_category: str = Field(default="SCI", max_length=50)
    publication_subtype: str | None = Field(default=None, max_length=50)
    sci_partition: str | None = Field(default=None, max_length=50)
    cug_partition: str | None = Field(default=None, max_length=50)
    corresponding_author: str | None = Field(default=None, max_length=100)
    first_author: str | None = Field(default=None, max_length=100)
    all_authors: list[str] = Field(default_factory=list)
    institution_list: list[str] = Field(default_factory=list)
    publish_date: str | None = Field(default=None, max_length=20)
    is_published: int = 0
    download_url: str | None = Field(default=None, max_length=500)


class PaperCreate(PaperBase):
    pass


class PaperUpdate(PaperBase):
    pass


class PaperOut(PaperBase):
    id: int
    owner_id: int
    uploaded_file_path: str | None
    uploaded_file_name: str | None
    created_at: str
    updated_at: str


class PaperListOut(BaseModel):
    total: int
    rows: list[PaperOut]


class SharedPaperOut(PaperOut):
    owner_name: str


class SharedPaperListOut(BaseModel):
    total: int
    rows: list[SharedPaperOut]


class ExportRequest(BaseModel):
    ids: list[int] = Field(default_factory=list)


class ActivityBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    tags: list[str] = Field(default_factory=list)
    publish_date: str = Field(min_length=1, max_length=20)


class ActivityCreate(ActivityBase):
    pass


class ActivityUpdate(ActivityBase):
    images: list[str] = Field(default_factory=list)


class ActivityOut(ActivityBase):
    id: int
    owner_id: int
    owner_name: str
    images: list[str]
    created_at: str
    updated_at: str


class ActivityListOut(BaseModel):
    total: int
    rows: list[ActivityOut]


class GroupMeetingBase(BaseModel):
    meeting_date: str = Field(min_length=1, max_length=20)
    speaker: str = Field(min_length=1, max_length=100)
    topic: str = Field(min_length=1, max_length=300)
    attendees: list[str] = Field(default_factory=list)


class GroupMeetingCreate(GroupMeetingBase):
    pass


class GroupMeetingUpdate(GroupMeetingBase):
    documents: list[dict[str, str]] = Field(default_factory=list)
    photos: list[dict[str, str]] = Field(default_factory=list)


class GroupMeetingOut(GroupMeetingBase):
    id: int
    owner_id: int
    owner_name: str
    documents: list[dict[str, str]]
    photos: list[dict[str, str]]
    created_at: str
    updated_at: str


class GroupMeetingListOut(BaseModel):
    total: int
    rows: list[GroupMeetingOut]


class ResourcePostBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    resource_type: str = Field(min_length=1, max_length=50)
    tags: list[str] = Field(default_factory=list)
    content: str = Field(min_length=1)


class ResourcePostCreate(ResourcePostBase):
    pass


class ResourcePostUpdate(ResourcePostBase):
    pass


class ResourcePostOut(ResourcePostBase):
    id: int
    owner_id: int
    owner_name: str
    comment_count: int
    can_edit: bool
    created_at: str
    updated_at: str


class ResourcePostListOut(BaseModel):
    total: int
    rows: list[ResourcePostOut]


class ResourceCommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class ResourceCommentOut(BaseModel):
    id: int
    post_id: int
    owner_id: int
    owner_name: str
    content: str
    can_delete: bool
    created_at: str
    updated_at: str


class TravelStandardColumnOut(BaseModel):
    field: str
    title: str


class TravelStandardOut(BaseModel):
    file_name: str
    download_url: str
    total: int
    columns: list[TravelStandardColumnOut]
    rows: list[dict[str, str]]


def now_text() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def ensure_user_profile_columns() -> None:
    columns = {
        "skill_petroleum_engineering": "INTEGER NOT NULL DEFAULT 50",
        "skill_mathematics": "INTEGER NOT NULL DEFAULT 50",
        "skill_ai_tools": "INTEGER NOT NULL DEFAULT 50",
        "skill_coding": "INTEGER NOT NULL DEFAULT 50",
        "skill_presentation": "INTEGER NOT NULL DEFAULT 50",
        "skill_organization": "INTEGER NOT NULL DEFAULT 50",
        "is_admin": "INTEGER NOT NULL DEFAULT 0",
        "language": "TEXT NOT NULL DEFAULT '英文'",
        "publication_category": "TEXT NOT NULL DEFAULT 'SCI'",
        "publication_subtype": "TEXT",
    }
    with engine.begin() as conn:
        user_existing = {
            row[1]
            for row in conn.execute(text("PRAGMA table_info(users)")).fetchall()
        }
        paper_existing = {
            row[1]
            for row in conn.execute(text("PRAGMA table_info(papers)")).fetchall()
        }
        for column_name, ddl in columns.items():
            is_user_column = column_name.startswith("skill_") or column_name == "is_admin"
            target_existing = user_existing if is_user_column else paper_existing
            table_name = "users" if is_user_column else "papers"
            if column_name not in target_existing:
                conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {ddl}"))


def ensure_single_admin_user() -> None:
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                full_name="管理员",
                telephone="",
                province="",
                city="",
                birthday=None,
                enrollment_year=None,
                is_graduated=0,
                graduation_year=None,
                avatar_url=DEFAULT_AVATAR_URL,
                bio="系统管理员账号，用于后台管理和密码重置。",
                undergraduate_school="",
                master_school="",
                doctoral_school="",
                hashed_password=get_password_hash("123456"),
                is_admin=1,
                is_active=1,
                created_at=now_text(),
            )
            db.add(admin)
            db.flush()
        else:
            admin.is_admin = 1
            admin.is_active = 1
            admin.avatar_url = DEFAULT_AVATAR_URL

        db.query(User).filter(User.username != "admin", User.is_admin == 1).update({User.is_admin: 0})
        db.query(User).filter(User.avatar_url.is_(None)).update({User.avatar_url: DEFAULT_AVATAR_URL})
        db.commit()
    finally:
        db.close()


def require_admin(current_user: User) -> None:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理员权限")


def can_manage_owner(current_user: User, owner_id: int) -> bool:
    return bool(current_user.is_admin) or owner_id == current_user.id


def column_letters_to_index(letters: str) -> int:
    index = 0
    for char in letters:
        index = index * 26 + ord(char.upper()) - ord("A") + 1
    return index


def cell_ref_to_position(ref: str) -> tuple[int, int]:
    match = re.match(r"([A-Z]+)(\d+)", ref)
    if not match:
        return 1, 1
    return int(match.group(2)), column_letters_to_index(match.group(1))


def read_xlsx_first_sheet_rows(path: Path) -> list[list[str]]:
    ns = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    with zipfile.ZipFile(path) as workbook:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in workbook.namelist():
            shared_root = ET.fromstring(workbook.read("xl/sharedStrings.xml"))
            for item in shared_root.findall(f"{ns}si"):
                shared_strings.append("".join(text.text or "" for text in item.iter(f"{ns}t")))

        sheet_path = "xl/worksheets/sheet1.xml"
        if sheet_path not in workbook.namelist():
            sheet_candidates = sorted(
                name
                for name in workbook.namelist()
                if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")
            )
            if not sheet_candidates:
                return []
            sheet_path = sheet_candidates[0]

        sheet_root = ET.fromstring(workbook.read(sheet_path))
        row_values: dict[int, dict[int, str]] = {}
        for row in sheet_root.findall(f".//{ns}row"):
            row_number = int(row.attrib.get("r", len(row_values) + 1))
            values: dict[int, str] = {}
            for cell in row.findall(f"{ns}c"):
                ref = cell.attrib.get("r", "")
                letters_match = re.match(r"[A-Z]+", ref)
                column_index = column_letters_to_index(letters_match.group(0)) if letters_match else len(values) + 1
                cell_type = cell.attrib.get("t")
                text_value = ""

                if cell_type == "inlineStr":
                    text_value = "".join(text.text or "" for text in cell.iter(f"{ns}t"))
                else:
                    value_node = cell.find(f"{ns}v")
                    if value_node is not None and value_node.text is not None:
                        raw_value = value_node.text
                        if cell_type == "s":
                            try:
                                text_value = shared_strings[int(raw_value)]
                            except (IndexError, ValueError):
                                text_value = raw_value
                        else:
                            text_value = raw_value

                values[column_index] = text_value.strip()

            if values:
                row_values[row_number] = values

        merge_cells = sheet_root.find(f"{ns}mergeCells")
        if merge_cells is not None:
            for merge_cell in merge_cells.findall(f"{ns}mergeCell"):
                ref = merge_cell.attrib.get("ref", "")
                if ":" not in ref:
                    continue
                start_ref, end_ref = ref.split(":", 1)
                start_row, start_col = cell_ref_to_position(start_ref)
                end_row, end_col = cell_ref_to_position(end_ref)
                merged_value = row_values.get(start_row, {}).get(start_col, "")
                if not merged_value:
                    continue
                for row_number in range(start_row, end_row + 1):
                    row_values.setdefault(row_number, {})
                    for column_index in range(start_col, end_col + 1):
                        if not row_values[row_number].get(column_index):
                            row_values[row_number][column_index] = merged_value

        parsed_rows: list[list[str]] = []
        for row_number in sorted(row_values):
            values = row_values[row_number]
            last_column = max(values)
            parsed_rows.append([values.get(index, "") for index in range(1, last_column + 1)])

    return parsed_rows


def normalize_travel_standard_rows(rows: list[list[str]]) -> tuple[list[TravelStandardColumnOut], list[dict[str, str]]]:
    cleaned_rows: list[list[str]] = []
    for row in rows:
        trimmed = list(row)
        while trimmed and trimmed[-1] == "":
            trimmed.pop()
        if any(cell != "" for cell in trimmed):
            cleaned_rows.append(trimmed)

    if not cleaned_rows:
        return [], []

    header_index = 0
    for index, row in enumerate(cleaned_rows):
        if row and row[0] == "序号":
            header_index = index
            break
        if sum(1 for cell in row if cell) >= 2:
            header_index = index

    data_start_index = header_index + 1
    for index in range(header_index + 1, len(cleaned_rows)):
        first_cell = cleaned_rows[index][0] if cleaned_rows[index] else ""
        if first_cell.isdigit():
            data_start_index = index
            break

    header_rows = cleaned_rows[header_index:data_start_index]
    max_columns = max(len(row) for row in cleaned_rows[header_index:])
    columns: list[TravelStandardColumnOut] = []
    used_titles: dict[str, int] = {}
    for index in range(max_columns):
        title_parts: list[str] = []
        for header_row in header_rows:
            value = header_row[index] if index < len(header_row) else ""
            value = " ".join(value.split())
            if value and value not in title_parts:
                title_parts.append(value)
        title = "-".join(title_parts) if title_parts else f"列{index + 1}"
        count = used_titles.get(title, 0)
        used_titles[title] = count + 1
        if count == 1:
            title = f"{title}-明细"
        elif count > 1:
            title = f"{title}-明细{count}"
        columns.append(TravelStandardColumnOut(field=f"col_{index}", title=title))

    data_rows: list[dict[str, str]] = []
    for row in cleaned_rows[data_start_index:]:
        record = {
            column.field: row[index] if index < len(row) else ""
            for index, column in enumerate(columns)
        }
        if any(value != "" for value in record.values()):
            data_rows.append(record)

    return columns, data_rows


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


DbSession = Annotated[Session, Depends(get_db)]


def get_password_hash(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PASSWORD_ITERATIONS,
    ).hex()
    return f"pbkdf2_sha256${salt}${digest}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        algorithm, salt, digest = hashed_password.split("$", 2)
    except ValueError:
        return False

    if algorithm != "pbkdf2_sha256":
        return False

    candidate = hashlib.pbkdf2_hmac(
        "sha256",
        plain_password.encode("utf-8"),
        salt.encode("utf-8"),
        PASSWORD_ITERATIONS,
    ).hex()
    return hmac.compare_digest(candidate, digest)


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def list_to_json(values: list[str]) -> str:
    cleaned = [item.strip() for item in values if item and item.strip()]
    return json.dumps(cleaned, ensure_ascii=False)


def json_to_list(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def file_items_to_json(values: list[dict[str, str]]) -> str:
    cleaned = []
    for item in values:
        stored_name = item.get("stored_name")
        original_name = item.get("original_name")
        if stored_name and original_name:
            cleaned.append({
                "stored_name": Path(stored_name).name,
                "original_name": Path(original_name).name,
            })
    return json.dumps(cleaned, ensure_ascii=False)


def json_to_file_items(value: str | None) -> list[dict[str, str]]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    cleaned = []
    for item in parsed:
        if isinstance(item, dict) and item.get("stored_name") and item.get("original_name"):
            cleaned.append({
                "stored_name": item["stored_name"],
                "original_name": item["original_name"],
            })
        elif isinstance(item, str):
            cleaned.append({"stored_name": item, "original_name": item})
    return cleaned


USER_EXPORT_COLUMNS = {
    "full_name": ("真实姓名", lambda user: user.full_name),
    "username": ("账号", lambda user: user.username),
    "telephone": ("电话", lambda user: user.telephone),
    "province": ("省份", lambda user: user.province),
    "city": ("城市", lambda user: user.city),
    "birthday": ("生日", lambda user: user.birthday),
    "enrollment_year": ("入学年份", lambda user: user.enrollment_year),
    "is_graduated": ("是否毕业", lambda user: "是" if user.is_graduated else "否"),
    "graduation_year": ("毕业年份", lambda user: user.graduation_year),
    "bio": ("个人说明", lambda user: user.bio),
    "undergraduate_school": ("本科院校", lambda user: user.undergraduate_school),
    "master_school": ("硕士院校", lambda user: user.master_school),
    "doctoral_school": ("博士院校", lambda user: user.doctoral_school),
    "skill_petroleum_engineering": ("数模", lambda user: user.skill_petroleum_engineering),
    "skill_mathematics": ("写作", lambda user: user.skill_mathematics),
    "skill_ai_tools": ("AI", lambda user: user.skill_ai_tools),
    "skill_coding": ("汇报", lambda user: user.skill_coding),
    "skill_presentation": ("外语", lambda user: user.skill_presentation),
    "skill_organization": ("比赛", lambda user: user.skill_organization),
    "created_at": ("创建时间", lambda user: user.created_at),
}


def excel_cell_ref(row: int, col: int) -> str:
    letters = ""
    while col:
        col, remainder = divmod(col - 1, 26)
        letters = chr(65 + remainder) + letters
    return f"{letters}{row}"


def xml_escape(value: object) -> str:
    text_value = "" if value is None else str(value)
    return (
        text_value
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def build_xlsx(headers: list[str], rows: list[list[object]]) -> bytes:
    sheet_rows = []
    all_rows = [headers, *rows]
    for row_index, row in enumerate(all_rows, start=1):
        cells = []
        for col_index, value in enumerate(row, start=1):
            ref = excel_cell_ref(row_index, col_index)
            cells.append(f'<c r="{ref}" t="inlineStr"><is><t>{xml_escape(value)}</t></is></c>')
        sheet_rows.append(f'<row r="{row_index}">{"".join(cells)}</row>')

    worksheet = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetData>{"".join(sheet_rows)}</sheetData>'
        '</worksheet>'
    )
    workbook = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets><sheet name="课题组成员" sheetId="1" r:id="rId1"/></sheets></workbook>'
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '</Types>'
    )
    root_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        '</Relationships>'
    )
    workbook_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        '</Relationships>'
    )
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", root_rels)
        archive.writestr("xl/workbook.xml", workbook)
        archive.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
        archive.writestr("xl/worksheets/sheet1.xml", worksheet)
    return output.getvalue()


def paper_to_out(paper: Paper) -> PaperOut:
    return PaperOut(
        id=paper.id,
        owner_id=paper.owner_id,
        title=paper.title,
        journal_name=paper.journal_name,
        publisher=paper.publisher,
        language=paper.language,
        publication_category=paper.publication_category,
        publication_subtype=paper.publication_subtype,
        sci_partition=paper.sci_partition,
        cug_partition=paper.cug_partition,
        corresponding_author=paper.corresponding_author,
        first_author=paper.first_author,
        all_authors=json_to_list(paper.all_authors),
        institution_list=json_to_list(paper.institution_list),
        publish_date=paper.publish_date,
        is_published=paper.is_published,
        download_url=paper.download_url,
        uploaded_file_path=paper.uploaded_file_path,
        uploaded_file_name=paper.uploaded_file_name,
        created_at=paper.created_at,
        updated_at=paper.updated_at,
    )


def shared_paper_to_out(paper: Paper, db: Session) -> SharedPaperOut:
    user = db.query(User).filter(User.id == paper.owner_id).first()
    base = paper_to_out(paper).model_dump()
    return SharedPaperOut(
        **base,
        owner_name=user.full_name if user else "未知用户",
    )


def activity_to_out(activity: Activity, db: Session) -> ActivityOut:
    user = db.query(User).filter(User.id == activity.owner_id).first()
    owner_name = user.full_name if user else "未知用户"
    return ActivityOut(
        id=activity.id,
        owner_id=activity.owner_id,
        owner_name=owner_name,
        title=activity.title,
        content=activity.content,
        tags=json_to_list(activity.tags),
        images=json_to_list(activity.images),
        publish_date=activity.publish_date,
        created_at=activity.created_at,
        updated_at=activity.updated_at,
    )


def group_meeting_to_out(meeting: GroupMeeting, db: Session) -> GroupMeetingOut:
    user = db.query(User).filter(User.id == meeting.owner_id).first()
    return GroupMeetingOut(
        id=meeting.id,
        owner_id=meeting.owner_id,
        owner_name=user.full_name if user else "未知用户",
        meeting_date=meeting.meeting_date,
        speaker=meeting.speaker,
        topic=meeting.topic,
        attendees=json_to_list(meeting.attendees),
        documents=json_to_file_items(meeting.documents),
        photos=json_to_file_items(meeting.photos),
        created_at=meeting.created_at,
        updated_at=meeting.updated_at,
    )


def resource_post_to_out(post: ResourcePost, db: Session, current_user: User) -> ResourcePostOut:
    user = db.query(User).filter(User.id == post.owner_id).first()
    comment_count = db.query(ResourceComment).filter(
        ResourceComment.post_id == post.id,
        ResourceComment.is_deleted == 0,
    ).count()
    return ResourcePostOut(
        id=post.id,
        owner_id=post.owner_id,
        owner_name=user.full_name if user else "未知用户",
        title=post.title,
        resource_type=post.resource_type,
        tags=json_to_list(post.tags),
        content=post.content,
        comment_count=comment_count,
        can_edit=can_manage_owner(current_user, post.owner_id),
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


def resource_comment_to_out(comment: ResourceComment, db: Session, current_user: User) -> ResourceCommentOut:
    user = db.query(User).filter(User.id == comment.owner_id).first()
    post = db.query(ResourcePost).filter(ResourcePost.id == comment.post_id).first()
    return ResourceCommentOut(
        id=comment.id,
        post_id=comment.post_id,
        owner_id=comment.owner_id,
        owner_name=user.full_name if user else "未知用户",
        content=comment.content,
        can_delete=bool(current_user.is_admin) or comment.owner_id == current_user.id or (post is not None and post.owner_id == current_user.id),
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


def apply_paper_payload(paper: Paper, payload: PaperCreate | PaperUpdate) -> None:
    paper.title = payload.title
    paper.journal_name = payload.journal_name
    paper.publisher = payload.publisher
    paper.language = payload.language
    paper.publication_category = payload.publication_category
    paper.publication_subtype = payload.publication_subtype
    paper.sci_partition = payload.sci_partition
    paper.cug_partition = payload.cug_partition
    paper.corresponding_author = payload.corresponding_author
    paper.first_author = payload.first_author
    paper.all_authors = list_to_json(payload.all_authors)
    paper.institution_list = list_to_json(payload.institution_list)
    paper.publish_date = payload.publish_date
    paper.is_published = 1 if payload.is_published else 0
    paper.download_url = payload.download_url
    paper.updated_at = now_text()


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def apply_user_profile(user: User, payload: UserProfileUpdate) -> None:
    for field, value in payload.model_dump().items():
        setattr(user, field, value)


def apply_admin_user_payload(user: User, payload: AdminUserCreate | AdminUserUpdate) -> None:
    for field, value in payload.model_dump(exclude={"username", "password"}).items():
        setattr(user, field, value)
    user.avatar_url = DEFAULT_AVATAR_URL


def get_client_ip(request: Request) -> str | None:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else None


def get_user_from_request(request: Request, db: Session) -> User | None:
    authorization = request.headers.get("authorization", "")
    prefix = "Bearer "
    token = ""
    if authorization.startswith(prefix):
        token = authorization[len(prefix):].strip()
    if not token:
        token = request.query_params.get("access_token", "").strip()
    if not token:
        return None

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

    username = payload.get("sub")
    if not username:
        return None
    return get_user_by_username(db, username)


@app.middleware("http")
async def api_access_log_middleware(request: Request, call_next):
    public_paths = {
        "/api/health",
        "/api/auth/login",
        "/api/auth/register",
    }
    requires_auth = (
        request.method != "OPTIONS"
        and request.url.path.startswith("/api/")
        and request.url.path not in public_paths
    )
    db = SessionLocal()
    user = None
    try:
        user = get_user_from_request(request, db)
        if requires_auth and user is None:
            return StreamingResponse(
                iter(['{"detail":"登录已过期，请重新登录"}']),
                status_code=status.HTTP_401_UNAUTHORIZED,
                media_type="application/json",
                headers={"WWW-Authenticate": "Bearer"},
            )
    finally:
        db.close()

    response = None
    try:
        response = await call_next(request)
        return response
    finally:
        if user is not None:
            db = SessionLocal()
            try:
                db.add(ApiLog(
                    user_id=user.id,
                    user_name=user.full_name,
                    username=user.username,
                    request_time=now_text(),
                    ip_address=get_client_ip(request),
                    method=request.method,
                    path=request.url.path,
                    query_string=request.url.query or None,
                    status_code=response.status_code if response else 500,
                    user_agent=request.headers.get("user-agent"),
                ))
                db.commit()
            except Exception:
                db.rollback()
            finally:
                db.close()


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: DbSession,
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="登录已过期，请重新登录",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    user = get_user_by_username(db, username)
    if user is None or not user.is_active:
        raise credentials_exception
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/travel/standards", response_model=TravelStandardOut)
def get_travel_standards(current_user: CurrentUser) -> TravelStandardOut:
    if not TRAVEL_STANDARD_FILE.exists():
        raise HTTPException(status_code=404, detail="报销标准文件不存在")

    columns, rows = normalize_travel_standard_rows(read_xlsx_first_sheet_rows(TRAVEL_STANDARD_FILE))
    return TravelStandardOut(
        file_name=TRAVEL_STANDARD_FILE_NAME,
        download_url="/api/travel/standards/download",
        total=len(rows),
        columns=columns,
        rows=rows,
    )


@app.get("/api/travel/standards/download")
def download_travel_standards(request: Request, db: DbSession) -> FileResponse:
    current_user = get_user_from_request(request, db)
    if current_user is None:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    if not TRAVEL_STANDARD_FILE.exists():
        raise HTTPException(status_code=404, detail="报销标准文件不存在")
    return FileResponse(
        TRAVEL_STANDARD_FILE,
        filename=TRAVEL_STANDARD_FILE_NAME,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@app.post("/api/auth/register", response_model=TokenOut)
def register(payload: UserCreate, db: DbSession) -> TokenOut:
    raise HTTPException(status_code=403, detail="系统已关闭注册，请联系管理员创建账号")


@app.post("/api/auth/login", response_model=TokenOut)
def login(payload: UserLogin, db: DbSession) -> TokenOut:
    user = get_user_by_username(db, payload.username)
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="用户已被禁用")

    return TokenOut(access_token=create_access_token(user.username), user=user)


@app.get("/api/auth/me", response_model=UserOut)
def read_me(current_user: CurrentUser) -> User:
    return current_user


@app.put("/api/auth/me/profile", response_model=UserOut)
def update_my_profile(payload: UserProfileUpdate, current_user: CurrentUser, db: DbSession) -> User:
    apply_user_profile(current_user, payload)
    db.commit()
    db.refresh(current_user)
    return current_user


@app.put("/api/auth/me/password")
def update_my_password(payload: PasswordUpdate, current_user: CurrentUser, db: DbSession) -> dict[str, str]:
    if not verify_password(payload.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="原密码不正确")
    current_user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    return {"message": "密码已修改"}


@app.post("/api/auth/me/avatar", response_model=UserOut)
async def upload_my_avatar(
    current_user: CurrentUser,
    db: DbSession,
    file: UploadFile = File(...),
) -> User:
    safe_name = Path(file.filename or "avatar").name
    extension = Path(safe_name).suffix.lower() or ".png"
    stored_name = f"user_{current_user.id}_{int(datetime.now().timestamp())}{extension}"
    target_path = AVATAR_DIR / stored_name
    with target_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    current_user.avatar_url = f"/api/users/{current_user.id}/avatar"
    db.commit()
    db.refresh(current_user)
    return current_user


@app.get("/api/users", response_model=UserListOut)
def list_users(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(default=1, ge=1),
    rows: int = Query(default=10, ge=1, le=100),
    keyword: str | None = None,
    exclude_self: int = Query(default=1, ge=0, le=1),
) -> UserListOut:
    query = db.query(User).filter(User.is_active == 1)
    if exclude_self:
        query = query.filter(User.id != current_user.id)
    if keyword:
        like_value = f"%{keyword.strip()}%"
        query = query.filter(or_(
            User.full_name.like(like_value),
            User.username.like(like_value),
            User.telephone.like(like_value),
            User.province.like(like_value),
            User.city.like(like_value),
        ))

    total = query.count()
    users = (
        query.order_by(User.enrollment_year.desc(), User.id.asc())
        .offset((page - 1) * rows)
        .limit(rows)
        .all()
    )
    return UserListOut(total=total, rows=users)


@app.post("/api/users/export")
def export_users(payload: UserExportRequest, current_user: CurrentUser, db: DbSession) -> StreamingResponse:
    selected_columns = [column for column in payload.columns if column in USER_EXPORT_COLUMNS]
    if not selected_columns:
        selected_columns = ["full_name"]

    users = db.query(User).filter(User.is_active == 1).order_by(
        User.enrollment_year.desc(),
        User.id.asc(),
    ).all()
    headers = [USER_EXPORT_COLUMNS[column][0] for column in selected_columns]
    rows = [
        [USER_EXPORT_COLUMNS[column][1](user) for column in selected_columns]
        for user in users
    ]
    content = build_xlsx(headers, rows)
    filename = f"users_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    headers_map = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(
        iter([content]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers_map,
    )


@app.get("/api/users/{user_id:int}", response_model=UserOut)
def get_user_profile(user_id: int, current_user: CurrentUser, db: DbSession) -> User:
    user = db.query(User).filter(User.id == user_id, User.is_active == 1).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


@app.post("/api/admin/users", response_model=UserOut)
def admin_create_user(
    payload: AdminUserCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> User:
    require_admin(current_user)
    if get_user_by_username(db, payload.username):
        raise HTTPException(status_code=400, detail="用户名已存在")

    user = User(
        username=payload.username,
        full_name=payload.full_name,
        hashed_password=get_password_hash(payload.password),
        avatar_url=DEFAULT_AVATAR_URL,
        is_admin=0,
        is_active=1,
        created_at=now_text(),
    )
    apply_admin_user_payload(user, payload)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.put("/api/admin/users/{user_id:int}", response_model=UserOut)
def admin_update_user(
    user_id: int,
    payload: AdminUserUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> User:
    require_admin(current_user)
    user = db.query(User).filter(User.id == user_id, User.is_active == 1).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    apply_admin_user_payload(user, payload)
    if user.username == "admin":
        user.is_admin = 1
    db.commit()
    db.refresh(user)
    return user


@app.delete("/api/admin/users/{user_id:int}")
def admin_delete_user(
    user_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> dict[str, str]:
    require_admin(current_user)
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能删除当前登录的管理员账号")
    user = db.query(User).filter(User.id == user_id, User.is_active == 1).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if user.is_admin:
        raise HTTPException(status_code=400, detail="不能删除管理员账号")
    user.is_active = 0
    db.commit()
    return {"status": "ok"}


@app.post("/api/admin/users/{user_id:int}/reset-password")
def admin_reset_user_password(
    user_id: int,
    payload: AdminPasswordReset,
    current_user: CurrentUser,
    db: DbSession,
) -> dict[str, str]:
    require_admin(current_user)
    user = db.query(User).filter(User.id == user_id, User.is_active == 1).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    return {"status": "ok"}


@app.get("/api/users/{user_id:int}/avatar")
def get_user_avatar(user_id: int, db: DbSession) -> FileResponse:
    user = db.query(User).filter(User.id == user_id, User.is_active == 1).first()
    if not user or user.avatar_url != f"/api/users/{user_id}/avatar":
        raise HTTPException(status_code=404, detail="头像不存在")

    candidates = sorted(AVATAR_DIR.glob(f"user_{user_id}_*"), reverse=True)
    if not candidates:
        raise HTTPException(status_code=404, detail="头像不存在")
    return FileResponse(candidates[0])


@app.get("/uploads/avatars/{filename}")
def get_uploaded_avatar(filename: str) -> FileResponse:
    safe_name = Path(filename).name
    target_path = AVATAR_DIR / safe_name
    if not target_path.exists():
        raise HTTPException(status_code=404, detail="头像不存在")
    return FileResponse(target_path)


@app.get("/api/users/options", response_model=list[UserOptionOut])
def list_user_options(current_user: CurrentUser, db: DbSession) -> list[UserOptionOut]:
    users = db.query(User).filter(User.is_active == 1).order_by(User.full_name.asc(), User.id.asc()).all()
    return [
        UserOptionOut(
            id=user.id,
            username=user.username,
            full_name=user.full_name,
            label=user.full_name,
            value=user.full_name,
        )
        for user in users
    ]


@app.get("/api/papers", response_model=PaperListOut)
def list_papers(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(default=1, ge=1),
    rows: int = Query(default=10, ge=1, le=100),
    keyword: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    sort: str | None = None,
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
) -> PaperListOut:
    query = db.query(Paper).filter(
        Paper.owner_id == current_user.id,
        Paper.is_deleted == 0,
    )

    if keyword:
        like_value = f"%{keyword.strip()}%"
        query = query.filter(
            or_(
                Paper.journal_name.like(like_value),
                Paper.publisher.like(like_value),
                Paper.language.like(like_value),
                Paper.publication_category.like(like_value),
                Paper.publication_subtype.like(like_value),
                Paper.corresponding_author.like(like_value),
                Paper.first_author.like(like_value),
                Paper.all_authors.like(like_value),
            )
        )
    if start_date:
        query = query.filter(Paper.publish_date >= start_date)
    if end_date:
        query = query.filter(Paper.publish_date <= end_date)

    total = query.count()
    order_fields = (
        (Paper.publish_date.asc(), Paper.id.asc())
        if sort == "publish_date" and order == "asc"
        else (Paper.publish_date.desc(), Paper.id.desc())
    )
    papers = (
        query.order_by(*order_fields)
        .offset((page - 1) * rows)
        .limit(rows)
        .all()
    )
    return PaperListOut(total=total, rows=[paper_to_out(paper) for paper in papers])


@app.get("/api/papers/shared", response_model=SharedPaperListOut)
def list_shared_papers(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(default=1, ge=1),
    rows: int = Query(default=10, ge=1, le=100),
    keyword: str | None = None,
    author: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    sort: str | None = None,
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
) -> SharedPaperListOut:
    query = db.query(Paper).filter(Paper.is_deleted == 0)

    if keyword:
        like_value = f"%{keyword.strip()}%"
        query = query.filter(or_(
            Paper.title.like(like_value),
            Paper.journal_name.like(like_value),
            Paper.publisher.like(like_value),
            Paper.language.like(like_value),
            Paper.publication_category.like(like_value),
            Paper.publication_subtype.like(like_value),
            Paper.corresponding_author.like(like_value),
            Paper.first_author.like(like_value),
            Paper.all_authors.like(like_value),
            Paper.institution_list.like(like_value),
        ))
    if author:
        author_like = f"%{author.strip()}%"
        query = query.filter(or_(
            Paper.corresponding_author.like(author_like),
            Paper.first_author.like(author_like),
            Paper.all_authors.like(author_like),
        ))
    if start_date:
        query = query.filter(Paper.publish_date >= start_date)
    if end_date:
        query = query.filter(Paper.publish_date <= end_date)

    total = query.count()
    order_fields = (
        (Paper.publish_date.asc(), Paper.id.asc())
        if sort == "publish_date" and order == "asc"
        else (Paper.publish_date.desc(), Paper.id.desc())
    )
    papers = (
        query.order_by(*order_fields)
        .offset((page - 1) * rows)
        .limit(rows)
        .all()
    )
    return SharedPaperListOut(total=total, rows=[shared_paper_to_out(paper, db) for paper in papers])


@app.get("/api/admin/papers", response_model=SharedPaperListOut)
def list_admin_papers(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(default=1, ge=1),
    rows: int = Query(default=10, ge=1, le=100),
    keyword: str | None = None,
    author: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    sort: str = Query(default="publish_date"),
    order: str = Query(default="desc"),
) -> SharedPaperListOut:
    require_admin(current_user)
    return list_shared_papers(
        current_user=current_user,
        db=db,
        page=page,
        rows=rows,
        keyword=keyword,
        author=author,
        start_date=start_date,
        end_date=end_date,
        sort=sort,
        order=order,
    )


@app.post("/api/papers", response_model=PaperOut)
def create_paper(payload: PaperCreate, current_user: CurrentUser, db: DbSession) -> PaperOut:
    paper = Paper(owner_id=current_user.id)
    apply_paper_payload(paper, payload)
    paper.created_at = now_text()
    db.add(paper)
    db.commit()
    db.refresh(paper)
    return paper_to_out(paper)


@app.put("/api/papers/{paper_id}", response_model=PaperOut)
def update_paper(
    paper_id: int,
    payload: PaperUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> PaperOut:
    paper = db.query(Paper).filter(
        Paper.id == paper_id,
        Paper.is_deleted == 0,
    ).first()
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    if not can_manage_owner(current_user, paper.owner_id):
        raise HTTPException(status_code=403, detail="您没有修改该论文的权限")

    apply_paper_payload(paper, payload)
    db.commit()
    db.refresh(paper)
    return paper_to_out(paper)


@app.delete("/api/papers/{paper_id}")
def delete_paper(paper_id: int, current_user: CurrentUser, db: DbSession) -> dict[str, str]:
    paper = db.query(Paper).filter(
        Paper.id == paper_id,
        Paper.is_deleted == 0,
    ).first()
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    if not can_manage_owner(current_user, paper.owner_id):
        raise HTTPException(status_code=403, detail="您没有删除该论文的权限")

    paper.is_deleted = 1
    paper.updated_at = now_text()
    db.commit()
    return {"status": "ok"}


@app.post("/api/papers/{paper_id}/upload", response_model=PaperOut)
def upload_paper_file(
    paper_id: int,
    current_user: CurrentUser,
    db: DbSession,
    file: UploadFile = File(...),
) -> PaperOut:
    paper = db.query(Paper).filter(
        Paper.id == paper_id,
        Paper.is_deleted == 0,
    ).first()
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    if not can_manage_owner(current_user, paper.owner_id):
        raise HTTPException(status_code=403, detail="您没有修改该论文的权限")

    safe_name = Path(file.filename or "paper_file").name
    stored_name = f"{paper_id}_{int(datetime.now().timestamp())}_{safe_name}"
    target_path = UPLOAD_DIR / stored_name
    with target_path.open("wb") as target:
        shutil.copyfileobj(file.file, target)

    paper.uploaded_file_path = f"/api/papers/{paper_id}/file"
    paper.uploaded_file_name = safe_name
    paper.updated_at = now_text()
    db.commit()
    db.refresh(paper)
    return paper_to_out(paper)


@app.get("/api/papers/{paper_id}/file")
def download_paper_file(paper_id: int, current_user: CurrentUser, db: DbSession) -> FileResponse:
    paper = db.query(Paper).filter(
        Paper.id == paper_id,
        Paper.is_deleted == 0,
    ).first()
    if not paper or not paper.uploaded_file_path:
        raise HTTPException(status_code=404, detail="文件不存在")

    candidates = sorted(UPLOAD_DIR.glob(f"{paper_id}_*"), reverse=True)
    if not candidates:
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(
        candidates[0],
        filename=paper.uploaded_file_name or candidates[0].name,
    )


@app.post("/api/papers/export")
def export_papers(payload: ExportRequest, current_user: CurrentUser, db: DbSession) -> StreamingResponse:
    if not payload.ids:
        raise HTTPException(status_code=400, detail="请先勾选要导出的论文")

    papers = db.query(Paper).filter(
        Paper.owner_id == current_user.id,
        Paper.is_deleted == 0,
        Paper.id.in_(payload.ids),
    ).order_by(Paper.publish_date.desc(), Paper.id.desc()).all()
    if not papers:
        raise HTTPException(status_code=404, detail="未找到可导出的论文")

    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output)
    writer.writerow([
        "标题",
        "期刊名",
        "出版社",
        "SCI分区",
        "地大分区",
        "通讯作者",
        "第一作者",
        "全部作者",
        "机构列表",
        "发表时间",
        "是否见刊",
        "下载地址",
        "上传文件",
    ])
    for paper in papers:
        writer.writerow([
            paper.title,
            paper.journal_name,
            paper.publisher or "",
            paper.sci_partition or "",
            paper.cug_partition or "",
            paper.corresponding_author or "",
            paper.first_author or "",
            "；".join(json_to_list(paper.all_authors)),
            "；".join(json_to_list(paper.institution_list)),
            paper.publish_date or "",
            "是" if paper.is_published else "否",
            paper.download_url or "",
            paper.uploaded_file_name or "",
        ])

    output.seek(0)
    filename = f"papers_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers=headers)


@app.get("/api/activities", response_model=ActivityListOut)
def list_activities(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(default=1, ge=1),
    rows: int = Query(default=10, ge=1, le=100),
    keyword: str | None = None,
    publisher: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
) -> ActivityListOut:
    query = db.query(Activity).filter(Activity.is_deleted == 0)

    if keyword:
        like_value = f"%{keyword.strip()}%"
        query = query.filter(
            or_(
                Activity.title.like(like_value),
                Activity.content.like(like_value),
                Activity.tags.like(like_value),
            )
        )

    if publisher:
        pub_like = f"%{publisher.strip()}%"
        matching_users = db.query(User.id).filter(
            or_(
                User.username.like(pub_like),
                User.full_name.like(pub_like)
            )
        ).all()
        user_ids = [u[0] for u in matching_users]
        query = query.filter(Activity.owner_id.in_(user_ids))

    if start_date:
        query = query.filter(Activity.publish_date >= start_date)
    if end_date:
        query = query.filter(Activity.publish_date <= end_date)

    total = query.count()
    order_fields = (
        (Activity.publish_date.asc(), Activity.id.asc())
        if sort_order == "asc"
        else (Activity.publish_date.desc(), Activity.id.desc())
    )
    activities = (
        query.order_by(*order_fields)
        .offset((page - 1) * rows)
        .limit(rows)
        .all()
    )
    return ActivityListOut(
        total=total,
        rows=[activity_to_out(a, db) for a in activities]
    )


@app.get("/api/resource-types")
def list_resource_types(current_user: CurrentUser) -> list[str]:
    return RESOURCE_TYPES


@app.get("/api/resource-posts", response_model=ResourcePostListOut)
def list_resource_posts(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(default=1, ge=1),
    rows: int = Query(default=10, ge=1, le=100),
    keyword: str | None = None,
    resource_type: str | None = None,
    tag: str | None = None,
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
) -> ResourcePostListOut:
    query = db.query(ResourcePost).filter(ResourcePost.is_deleted == 0)

    if keyword:
        like_value = f"%{keyword.strip()}%"
        query = query.filter(or_(
            ResourcePost.title.like(like_value),
            ResourcePost.content.like(like_value),
            ResourcePost.tags.like(like_value),
            ResourcePost.resource_type.like(like_value),
        ))
    if resource_type:
        query = query.filter(ResourcePost.resource_type == resource_type.strip())
    if tag:
        query = query.filter(ResourcePost.tags.like(f"%{tag.strip()}%"))

    total = query.count()
    order_fields = (
        (ResourcePost.updated_at.asc(), ResourcePost.id.asc())
        if sort_order == "asc"
        else (ResourcePost.updated_at.desc(), ResourcePost.id.desc())
    )
    posts = (
        query.order_by(*order_fields)
        .offset((page - 1) * rows)
        .limit(rows)
        .all()
    )
    return ResourcePostListOut(
        total=total,
        rows=[resource_post_to_out(post, db, current_user) for post in posts],
    )


@app.get("/api/resource-posts/{post_id}", response_model=ResourcePostOut)
def get_resource_post(post_id: int, current_user: CurrentUser, db: DbSession) -> ResourcePostOut:
    post = db.query(ResourcePost).filter(
        ResourcePost.id == post_id,
        ResourcePost.is_deleted == 0,
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="资料不存在")
    return resource_post_to_out(post, db, current_user)


@app.post("/api/resource-posts", response_model=ResourcePostOut)
def create_resource_post(
    payload: ResourcePostCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> ResourcePostOut:
    post = ResourcePost(
        owner_id=current_user.id,
        title=payload.title,
        resource_type=payload.resource_type,
        tags=list_to_json(payload.tags),
        content=payload.content,
        created_at=now_text(),
        updated_at=now_text(),
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return resource_post_to_out(post, db, current_user)


@app.put("/api/resource-posts/{post_id}", response_model=ResourcePostOut)
def update_resource_post(
    post_id: int,
    payload: ResourcePostUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> ResourcePostOut:
    post = db.query(ResourcePost).filter(
        ResourcePost.id == post_id,
        ResourcePost.is_deleted == 0,
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="资料不存在")
    if not can_manage_owner(current_user, post.owner_id):
        raise HTTPException(status_code=403, detail="您没有修改该资料的权限")

    post.title = payload.title
    post.resource_type = payload.resource_type
    post.tags = list_to_json(payload.tags)
    post.content = payload.content
    post.updated_at = now_text()
    db.commit()
    db.refresh(post)
    return resource_post_to_out(post, db, current_user)


@app.delete("/api/resource-posts/{post_id}")
def delete_resource_post(post_id: int, current_user: CurrentUser, db: DbSession) -> dict[str, str]:
    post = db.query(ResourcePost).filter(
        ResourcePost.id == post_id,
        ResourcePost.is_deleted == 0,
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="资料不存在")
    if not can_manage_owner(current_user, post.owner_id):
        raise HTTPException(status_code=403, detail="您没有删除该资料的权限")

    post.is_deleted = 1
    post.updated_at = now_text()
    db.commit()
    return {"status": "ok"}


@app.get("/api/resource-posts/{post_id}/comments", response_model=list[ResourceCommentOut])
def list_resource_comments(
    post_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> list[ResourceCommentOut]:
    post = db.query(ResourcePost).filter(
        ResourcePost.id == post_id,
        ResourcePost.is_deleted == 0,
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="资料不存在")

    comments = db.query(ResourceComment).filter(
        ResourceComment.post_id == post_id,
        ResourceComment.is_deleted == 0,
    ).order_by(ResourceComment.created_at.asc(), ResourceComment.id.asc()).all()
    return [resource_comment_to_out(comment, db, current_user) for comment in comments]


@app.post("/api/resource-posts/{post_id}/comments", response_model=ResourceCommentOut)
def create_resource_comment(
    post_id: int,
    payload: ResourceCommentCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> ResourceCommentOut:
    post = db.query(ResourcePost).filter(
        ResourcePost.id == post_id,
        ResourcePost.is_deleted == 0,
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="资料不存在")

    comment = ResourceComment(
        post_id=post_id,
        owner_id=current_user.id,
        content=payload.content,
        created_at=now_text(),
        updated_at=now_text(),
    )
    db.add(comment)
    post.updated_at = now_text()
    db.commit()
    db.refresh(comment)
    return resource_comment_to_out(comment, db, current_user)


@app.delete("/api/resource-comments/{comment_id}")
def delete_resource_comment(comment_id: int, current_user: CurrentUser, db: DbSession) -> dict[str, str]:
    comment = db.query(ResourceComment).filter(
        ResourceComment.id == comment_id,
        ResourceComment.is_deleted == 0,
    ).first()
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")

    post = db.query(ResourcePost).filter(ResourcePost.id == comment.post_id).first()
    if not current_user.is_admin and comment.owner_id != current_user.id and (not post or post.owner_id != current_user.id):
        raise HTTPException(status_code=403, detail="您没有删除该评论的权限")

    comment.is_deleted = 1
    comment.updated_at = now_text()
    db.commit()
    return {"status": "ok"}


@app.get("/api/activities/{activity_id}", response_model=ActivityOut)
def get_activity(
    activity_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> ActivityOut:
    activity = db.query(Activity).filter(
        Activity.id == activity_id,
        Activity.is_deleted == 0,
    ).first()
    if not activity:
        raise HTTPException(status_code=404, detail="活动不存在")
    return activity_to_out(activity, db)


@app.post("/api/activities", response_model=ActivityOut)
def create_activity(
    payload: ActivityCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> ActivityOut:
    activity = Activity(
        owner_id=current_user.id,
        title=payload.title,
        content=payload.content,
        tags=list_to_json(payload.tags),
        images="[]",
        publish_date=payload.publish_date,
        created_at=now_text(),
        updated_at=now_text(),
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity_to_out(activity, db)


@app.put("/api/activities/{activity_id}", response_model=ActivityOut)
def update_activity(
    activity_id: int,
    payload: ActivityUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> ActivityOut:
    activity = db.query(Activity).filter(
        Activity.id == activity_id,
        Activity.is_deleted == 0,
    ).first()
    if not activity:
        raise HTTPException(status_code=404, detail="活动不存在")

    if not can_manage_owner(current_user, activity.owner_id):
        raise HTTPException(status_code=403, detail="您没有修改该活动的权限")

    activity.title = payload.title
    activity.content = payload.content
    activity.tags = list_to_json(payload.tags)
    
    existing = json_to_list(activity.images)
    retained = [img for img in payload.images if img in existing]
    activity.images = list_to_json(retained)
    
    activity.publish_date = payload.publish_date
    activity.updated_at = now_text()

    db.commit()
    db.refresh(activity)
    return activity_to_out(activity, db)


@app.delete("/api/activities/{activity_id}")
def delete_activity(
    activity_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> dict[str, str]:
    activity = db.query(Activity).filter(
        Activity.id == activity_id,
        Activity.is_deleted == 0,
    ).first()
    if not activity:
        raise HTTPException(status_code=404, detail="活动不存在")

    if not can_manage_owner(current_user, activity.owner_id):
        raise HTTPException(status_code=403, detail="您没有删除该活动的权限")

    activity.is_deleted = 1
    activity.updated_at = now_text()
    db.commit()
    return {"status": "ok"}


@app.post("/api/activities/{activity_id}/upload", response_model=ActivityOut)
async def upload_activity_images(
    activity_id: int,
    current_user: CurrentUser,
    db: DbSession,
    files: list[UploadFile] = File(...),
) -> ActivityOut:
    activity = db.query(Activity).filter(
        Activity.id == activity_id,
        Activity.is_deleted == 0,
    ).first()
    if not activity:
        raise HTTPException(status_code=404, detail="活动不存在")

    if not can_manage_owner(current_user, activity.owner_id):
        raise HTTPException(status_code=403, detail="您没有修改该活动的权限")

    dict_entry = db.query(Dictionary).filter(Dictionary.key == "activity_image_dir").first()
    upload_subfolder = dict_entry.value if dict_entry else "uploads/activities"
    upload_dir = BASE_DIR / upload_subfolder
    upload_dir.mkdir(parents=True, exist_ok=True)

    existing_images = json_to_list(activity.images)
    if len(existing_images) + len(files) > 5:
        raise HTTPException(
            status_code=400,
            detail=f"最多只允许上传5张图片，当前已有{len(existing_images)}张，本次上传{len(files)}张"
        )

    new_image_names = []
    for file in files:
        content_type = file.content_type or ""
        if not content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"文件 {file.filename} 不是图片类型")

        content = await file.read()
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=400,
                detail=f"文件 {file.filename} 超过 5MB 限制"
            )

        safe_name = Path(file.filename or "image.png").name
        timestamp = int(datetime.now().timestamp() * 1000)
        stored_name = f"{timestamp}_{safe_name}"
        target_path = upload_dir / stored_name

        with target_path.open("wb") as target:
            target.write(content)

        new_image_names.append(stored_name)

    existing_images.extend(new_image_names)
    activity.images = list_to_json(existing_images)
    activity.updated_at = now_text()
    db.commit()
    db.refresh(activity)
    return activity_to_out(activity, db)


@app.get("/api/activities/images/{filename}")
def get_activity_image(
    filename: str,
    db: DbSession,
) -> FileResponse:
    dict_entry = db.query(Dictionary).filter(Dictionary.key == "activity_image_dir").first()
    upload_subfolder = dict_entry.value if dict_entry else "uploads/activities"
    upload_dir = BASE_DIR / upload_subfolder
    target_path = upload_dir / filename

    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(status_code=404, detail="图片不存在")

    return FileResponse(target_path)


@app.get("/api/group-meetings", response_model=GroupMeetingListOut)
def list_group_meetings(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(default=1, ge=1),
    rows: int = Query(default=10, ge=1, le=100),
    keyword: str | None = None,
    speaker: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
) -> GroupMeetingListOut:
    query = db.query(GroupMeeting).filter(GroupMeeting.is_deleted == 0)

    if keyword:
        like_value = f"%{keyword.strip()}%"
        query = query.filter(
            or_(
                GroupMeeting.topic.like(like_value),
                GroupMeeting.speaker.like(like_value),
                GroupMeeting.attendees.like(like_value),
            )
        )
    if speaker:
        speakers = [item.strip() for item in speaker.split(",") if item.strip()]
        if speakers:
            query = query.filter(or_(*[
                GroupMeeting.speaker.like(f"%{speaker_name}%")
                for speaker_name in speakers
            ]))
    if start_date:
        query = query.filter(GroupMeeting.meeting_date >= start_date)
    if end_date:
        query = query.filter(GroupMeeting.meeting_date <= end_date)

    total = query.count()
    order_fields = (
        (GroupMeeting.meeting_date.asc(), GroupMeeting.id.asc())
        if sort_order == "asc"
        else (GroupMeeting.meeting_date.desc(), GroupMeeting.id.desc())
    )
    meetings = (
        query.order_by(*order_fields)
        .offset((page - 1) * rows)
        .limit(rows)
        .all()
    )
    return GroupMeetingListOut(
        total=total,
        rows=[group_meeting_to_out(meeting, db) for meeting in meetings],
    )


@app.get("/api/group-meetings/{meeting_id}", response_model=GroupMeetingOut)
def get_group_meeting(
    meeting_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> GroupMeetingOut:
    meeting = db.query(GroupMeeting).filter(
        GroupMeeting.id == meeting_id,
        GroupMeeting.is_deleted == 0,
    ).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="组会不存在")
    return group_meeting_to_out(meeting, db)


@app.post("/api/group-meetings", response_model=GroupMeetingOut)
def create_group_meeting(
    payload: GroupMeetingCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> GroupMeetingOut:
    meeting = GroupMeeting(
        owner_id=current_user.id,
        meeting_date=payload.meeting_date,
        speaker=payload.speaker,
        topic=payload.topic,
        attendees=list_to_json(payload.attendees),
        documents="[]",
        photos="[]",
        created_at=now_text(),
        updated_at=now_text(),
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return group_meeting_to_out(meeting, db)


@app.put("/api/group-meetings/{meeting_id}", response_model=GroupMeetingOut)
def update_group_meeting(
    meeting_id: int,
    payload: GroupMeetingUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> GroupMeetingOut:
    meeting = db.query(GroupMeeting).filter(
        GroupMeeting.id == meeting_id,
        GroupMeeting.is_deleted == 0,
    ).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="组会不存在")
    if not can_manage_owner(current_user, meeting.owner_id):
        raise HTTPException(status_code=403, detail="您没有修改该组会的权限")

    existing_documents = {
        item["stored_name"] for item in json_to_file_items(meeting.documents)
    }
    existing_photos = {
        item["stored_name"] for item in json_to_file_items(meeting.photos)
    }
    retained_documents = [
        item for item in payload.documents
        if item.get("stored_name") in existing_documents
    ]
    retained_photos = [
        item for item in payload.photos
        if item.get("stored_name") in existing_photos
    ]

    meeting.meeting_date = payload.meeting_date
    meeting.speaker = payload.speaker
    meeting.topic = payload.topic
    meeting.attendees = list_to_json(payload.attendees)
    meeting.documents = file_items_to_json(retained_documents)
    meeting.photos = file_items_to_json(retained_photos)
    meeting.updated_at = now_text()
    db.commit()
    db.refresh(meeting)
    return group_meeting_to_out(meeting, db)


@app.delete("/api/group-meetings/{meeting_id}")
def delete_group_meeting(
    meeting_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> dict[str, str]:
    meeting = db.query(GroupMeeting).filter(
        GroupMeeting.id == meeting_id,
        GroupMeeting.is_deleted == 0,
    ).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="组会不存在")
    if not can_manage_owner(current_user, meeting.owner_id):
        raise HTTPException(status_code=403, detail="您没有删除该组会的权限")

    meeting.is_deleted = 1
    meeting.updated_at = now_text()
    db.commit()
    return {"status": "ok"}


def get_group_meeting_upload_dir(kind: str) -> Path:
    target_dir = BASE_DIR / "uploads" / "group_meetings" / kind
    target_dir.mkdir(parents=True, exist_ok=True)
    return target_dir


async def append_group_meeting_files(
    meeting: GroupMeeting,
    files: list[UploadFile],
    kind: str,
) -> list[dict[str, str]]:
    upload_dir = get_group_meeting_upload_dir(kind)
    new_items = []
    for file in files:
        safe_name = Path(file.filename or "meeting_file").name
        stored_name = f"{meeting.id}_{int(datetime.now().timestamp() * 1000)}_{secrets.token_hex(4)}_{safe_name}"
        target_path = upload_dir / stored_name
        with target_path.open("wb") as target:
            while chunk := await file.read(1024 * 1024):
                target.write(chunk)
        new_items.append({"stored_name": stored_name, "original_name": safe_name})
    return new_items


@app.post("/api/group-meetings/{meeting_id}/documents", response_model=GroupMeetingOut)
async def upload_group_meeting_documents(
    meeting_id: int,
    current_user: CurrentUser,
    db: DbSession,
    files: list[UploadFile] = File(...),
) -> GroupMeetingOut:
    meeting = db.query(GroupMeeting).filter(
        GroupMeeting.id == meeting_id,
        GroupMeeting.is_deleted == 0,
    ).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="组会不存在")
    if not can_manage_owner(current_user, meeting.owner_id):
        raise HTTPException(status_code=403, detail="您没有修改该组会的权限")

    items = json_to_file_items(meeting.documents)
    items.extend(await append_group_meeting_files(meeting, files, "documents"))
    meeting.documents = file_items_to_json(items)
    meeting.updated_at = now_text()
    db.commit()
    db.refresh(meeting)
    return group_meeting_to_out(meeting, db)


@app.post("/api/group-meetings/{meeting_id}/photos", response_model=GroupMeetingOut)
async def upload_group_meeting_photos(
    meeting_id: int,
    current_user: CurrentUser,
    db: DbSession,
    files: list[UploadFile] = File(...),
) -> GroupMeetingOut:
    meeting = db.query(GroupMeeting).filter(
        GroupMeeting.id == meeting_id,
        GroupMeeting.is_deleted == 0,
    ).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="组会不存在")
    if not can_manage_owner(current_user, meeting.owner_id):
        raise HTTPException(status_code=403, detail="您没有修改该组会的权限")

    items = json_to_file_items(meeting.photos)
    items.extend(await append_group_meeting_files(meeting, files, "photos"))
    meeting.photos = file_items_to_json(items)
    meeting.updated_at = now_text()
    db.commit()
    db.refresh(meeting)
    return group_meeting_to_out(meeting, db)


@app.get("/api/group-meetings/{meeting_id}/files/{kind}/{stored_name}")
def download_group_meeting_file(
    meeting_id: int,
    kind: str,
    stored_name: str,
    db: DbSession,
) -> FileResponse:
    if kind not in {"documents", "photos"}:
        raise HTTPException(status_code=400, detail="文件类型不正确")

    meeting = db.query(GroupMeeting).filter(
        GroupMeeting.id == meeting_id,
        GroupMeeting.is_deleted == 0,
    ).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="组会不存在")

    items = json_to_file_items(meeting.documents if kind == "documents" else meeting.photos)
    safe_stored_name = Path(stored_name).name
    match = next((item for item in items if item["stored_name"] == safe_stored_name), None)
    if not match:
        raise HTTPException(status_code=404, detail="文件不存在")

    target_path = get_group_meeting_upload_dir(kind) / safe_stored_name
    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(target_path, filename=match["original_name"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
