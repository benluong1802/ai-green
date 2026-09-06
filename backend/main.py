import os
import shutil
import uuid
import json
from datetime import datetime
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image
from google import genai
from google.genai import types
from database import engine, get_db, SessionLocal
import models
from sqlalchemy.orm import Session
from fastapi import Depends
from pydantic import BaseModel
models.Base.metadata.create_all(bind=engine)
import os
from dotenv import load_dotenv

load_dotenv()
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
client = genai.Client(api_key=GEMINI_API_KEY)

app = FastAPI(title="AI GreenMap API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
models.Base.metadata.create_all(bind=engine)
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

reports_db = []
class StudentRegisterRequest(BaseModel):
    phone: str
    full_name: str
    password: str

class LoginRequest(BaseModel):
    phone: str
    password: str
@app.on_event("startup")
def create_initial_guard_account():
    db = SessionLocal()
    try:
        guard_phone = "0989710205"
        admin_user = db.query(models.User).filter(models.User.phone == guard_phone).first()
        if not admin_user:
            guard = models.User(
                id=str(uuid.uuid4()),
                phone=guard_phone,
                full_name="Bảo vệ trực ban",
                password="admin123",
                role="guard"
            )
            db.add(guard)
            db.commit()
    except Exception as e:
        print(f"Lỗi khi kiểm tra tài khoản khởi tạo: {e}")
        db.rollback()
    finally:
        db.close()
@app.post("/api/auth/register-student")
def register_student(req: StudentRegisterRequest, db: Session = Depends(get_db)):
    if not req.phone or len(req.phone) < 10:
        raise HTTPException(status_code=400, detail="Số điện thoại không hợp lệ!")
    
    existing = db.query(models.User).filter(models.User.phone == req.phone).first()
    if existing:
        raise HTTPException(status_code=400, detail="Số điện thoại này đã được đăng ký tài khoản!")

    new_student = models.User(
        id=str(uuid.uuid4()),
        phone=req.phone,
        full_name=req.full_name,
        password=req.password,
        role="student" # Khóa cứng role student, không thể tự nâng cấp
    )
    db.add(new_student)
    db.commit()
    db.refresh(new_student)

    return {
        "message": "Đăng ký thành công!",
        "user": {
            "id": new_student.id,
            "phone": new_student.phone,
            "full_name": new_student.full_name,
            "role": new_student.role
        }
    }
@app.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.phone == req.phone,
        models.User.password == req.password
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail="Số điện thoại hoặc mật khẩu không chính xác!")

    return {
        "message": "Đăng nhập thành công!",
        "user": {
            "id": user.id,
            "phone": user.phone,
            "full_name": user.full_name,
            "role": user.role
        }
    }        
def analyze_image_with_gemini(image_path: str, user_description: str = ""):
    """Gửi ảnh sang Gemini để phân loại và chấm điểm EcoScore"""
    prompt = f"""
    Bạn là AI giám sát môi trường học đường cho dự án AI GreenMap.
    Nhiệm vụ: Hãy quan sát bức ảnh hiện trường (kèm mô tả của học sinh nếu có: '{user_description}').
    
    Phân loại và chấm điểm EcoScore theo đúng quy tắc sau:
    - ecoscore = 1 (Mức thấp): Vấn đề nhỏ, vài mẩu rác vụn, 1-2 chai nhựa đơn lẻ, bóng đèn bật quên tắt, có thể tự dọn dễ dàng.
    - ecoscore = 2 (Cần theo dõi): Vòi nước bị rò rỉ, góc bồn cây thiếu cây xanh/héo úa, rác tích tụ thành từng cụm nhỏ.
    - ecoscore = 3 (Khẩn cấp/Ưu tiên cao): Thùng rác tràn đổ ra ngoài, bãi rác to/chất đống vương vãi, khu vực ngập úng hoặc mất vệ sinh nghiêm trọng.

    Hãy phân tích và trả về DUY NHẤT một chuỗi JSON hợp lệ:
    {{
      "issue_group": "Chọn chính xác 1 trong 4 giá trị: Rác thải | Vệ sinh | Cơ sở vật chất | Không gian xanh",
      "issue_detail": "Tên ngắn gọn của vấn đề (ví dụ: 1 chai nhựa, Vòi nước rò rỉ, Thùng rác tràn...)",
      "ecoscore": 1 hoặc 2 hoặc 3,
      "ai_suggestion": "Gợi ý ngắn gọn 1 hành động ngắn gọn để xử lý"
    }}
    """
    try:
        img = Image.open(image_path)
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[prompt, img],
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Lỗi gọi Gemini: {e}")
        return {
            "issue_group": "Chưa xác định",
            "issue_detail": "Lỗi phân tích AI",
            "ecoscore": 1,
            "ai_suggestion": "Cần nhân viên kiểm tra"
        }
@app.post("/api/reports")
async def create_report(
    coord_x: float = Form(...),
    coord_y: float = Form(...),
    description: str = Form(""),
    reporter_name: str = Form("Học sinh ẩn danh"),
    reporter_phone: str = Form(""),
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Tệp phải là hình ảnh.")

    file_ext = os.path.splitext(image.filename)[1] or ".jpg"
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)

    # GỌI GEMINI PHÂN TÍCH ẢNH TỰ ĐỘNG
    ai_result = analyze_image_with_gemini(file_path, description)

    # 2. Khởi tạo đối tượng SQLAlchemy Model thay vì dict thường
    new_report = models.Report(
        id=str(uuid.uuid4()),
        coord_x=coord_x,
        coord_y=coord_y,
        description=description,
        reporter_name=reporter_name,
        reporter_phone=reporter_phone,
        image_url=f"/uploads/{unique_filename}",
        status="pending",
        issue_group=ai_result.get("issue_group"),
        issue_detail=ai_result.get("issue_detail"),
        ecoscore=ai_result.get("ecoscore"),
        ai_suggestion=ai_result.get("ai_suggestion")
    )

    # 3. Lưu trực tiếp vào PostgreSQL
    db.add(new_report)
    db.commit()
    db.refresh(new_report)

    print(f"[+] Báo cáo mới đã xử lý AI: {new_report.issue_group} - Điểm: {new_report.ecoscore}")

    return {
        "message": "Báo cáo thành công!",
        "data": new_report
    }

@app.get("/api/reports")
def get_reports(db: Session = Depends(get_db)):
    return db.query(models.Report).order_by(models.Report.created_at.desc()).all()

@app.patch("/api/reports/{report_id}/status")
def update_report_status(report_id: str, db: Session = Depends(get_db)):
    # 4. Cập nhật trạng thái trực tiếp trong PostgreSQL
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Không tìm thấy báo cáo.")
    
    report.status = "resolved" if report.status == "pending" else "pending"
    db.commit()
    db.refresh(report)

    return {"message": "Cập nhật thành công!", "data": report}
@app.delete("/api/reports/reset-all")
def reset_database(db: Session = Depends(get_db)):
    # Xóa toàn bộ dữ liệu trong bảng reports
    db.query(models.Report).delete()
    db.commit()
    return {"message": "Đã xóa sạch toàn bộ dữ liệu báo cáo!"}