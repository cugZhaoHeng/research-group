from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
import csv
import hashlib
import hmac
import io
import json
from pathlib import Path
import secrets
import shutil
from typing import Annotated

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import Column, Integer, String, Text, create_engine, or_
from sqlalchemy.orm import Session, declarative_base, sessionmaker


BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BASE_DIR / "research_group.db"
UPLOAD_DIR = BASE_DIR / "uploads" / "papers"
DATABASE_URL = f"sqlite:///{DATABASE_PATH.as_posix()}"
SECRET_KEY = "please-change-this-secret-key-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24
PASSWORD_ITERATIONS = 120000


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
    Base.metadata.create_all(bind=engine)
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
    email = Column(String, unique=True, index=True, nullable=False)
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
    hashed_password = Column(String, nullable=False)
    is_active = Column(Integer, default=1, nullable=False)
    created_at = Column(String, default=lambda: now_text(), nullable=False)


class Paper(Base):
    __tablename__ = "papers"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, nullable=False, index=True)
    title = Column(String, nullable=False)
    journal_name = Column(String, nullable=False)
    publisher = Column(String, nullable=True)
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


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=128)
    full_name: str = Field(min_length=1, max_length=100)
    telephone: str | None = Field(default=None, max_length=30)
    email: EmailStr
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


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    telephone: str | None
    email: EmailStr
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
    created_at: str

    class Config:
        from_attributes = True


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class PaperBase(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    journal_name: str = Field(min_length=1, max_length=200)
    publisher: str | None = Field(default=None, max_length=200)
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


class ExportRequest(BaseModel):
    ids: list[int] = Field(default_factory=list)


def now_text() -> str:
    return datetime.now().isoformat(timespec="seconds")


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


def paper_to_out(paper: Paper) -> PaperOut:
    return PaperOut(
        id=paper.id,
        owner_id=paper.owner_id,
        title=paper.title,
        journal_name=paper.journal_name,
        publisher=paper.publisher,
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


def apply_paper_payload(paper: Paper, payload: PaperCreate | PaperUpdate) -> None:
    paper.title = payload.title
    paper.journal_name = payload.journal_name
    paper.publisher = payload.publisher
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


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


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


@app.post("/api/auth/register", response_model=TokenOut)
def register(payload: UserCreate, db: DbSession) -> TokenOut:
    if get_user_by_username(db, payload.username):
        raise HTTPException(status_code=400, detail="用户名已存在")
    if get_user_by_email(db, payload.email):
        raise HTTPException(status_code=400, detail="邮箱已被注册")

    user = User(
        username=payload.username,
        full_name=payload.full_name,
        telephone=payload.telephone,
        email=payload.email,
        province=payload.province,
        city=payload.city,
        birthday=payload.birthday,
        enrollment_year=payload.enrollment_year,
        is_graduated=payload.is_graduated,
        graduation_year=payload.graduation_year,
        avatar_url=payload.avatar_url,
        bio=payload.bio,
        undergraduate_school=payload.undergraduate_school,
        master_school=payload.master_school,
        doctoral_school=payload.doctoral_school,
        hashed_password=get_password_hash(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return TokenOut(access_token=create_access_token(user.username), user=user)


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


@app.get("/api/papers", response_model=PaperListOut)
def list_papers(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(default=1, ge=1),
    rows: int = Query(default=10, ge=1, le=100),
    keyword: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
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
    papers = (
        query.order_by(Paper.publish_date.desc(), Paper.id.desc())
        .offset((page - 1) * rows)
        .limit(rows)
        .all()
    )
    return PaperListOut(total=total, rows=[paper_to_out(paper) for paper in papers])


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
        Paper.owner_id == current_user.id,
        Paper.is_deleted == 0,
    ).first()
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")

    apply_paper_payload(paper, payload)
    db.commit()
    db.refresh(paper)
    return paper_to_out(paper)


@app.delete("/api/papers/{paper_id}")
def delete_paper(paper_id: int, current_user: CurrentUser, db: DbSession) -> dict[str, str]:
    paper = db.query(Paper).filter(
        Paper.id == paper_id,
        Paper.owner_id == current_user.id,
        Paper.is_deleted == 0,
    ).first()
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")

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
        Paper.owner_id == current_user.id,
        Paper.is_deleted == 0,
    ).first()
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")

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
        Paper.owner_id == current_user.id,
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
