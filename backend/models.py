import uuid
from datetime import datetime
from zoneinfo import ZoneInfo
from sqlalchemy import Column, String, Float, Integer, DateTime
from database import Base

def get_vietnam_time():
    return datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).replace(tzinfo=None)

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    phone = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    password = Column(String, nullable=False)
    role = Column(String, default="student")
    created_at = Column(DateTime, default=get_vietnam_time)

class Report(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    coord_x = Column(Float, nullable=False)
    coord_y = Column(Float, nullable=False)
    description = Column(String, default="")
    image_url = Column(String, nullable=False)
    created_at = Column(DateTime, default=get_vietnam_time)
    status = Column(String, default="pending")
    issue_group = Column(String, nullable=True)
    issue_detail = Column(String, nullable=True)
    ecoscore = Column(Integer, nullable=True)
    ai_suggestion = Column(String, nullable=True)
    reporter_name = Column(String, nullable=True)
    reporter_phone = Column(String, nullable=True)