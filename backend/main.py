import os
import shutil
import uuid
import json
from datetime import datetime,timedelta
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image
from google import genai
from google.genai import types
from database import engine, get_db, SessionLocal
import models
from sqlalchemy.orm import Session
from fastapi import Depends,status,Query
from pydantic import BaseModel
models.Base.metadata.create_all(bind=engine)
import os
from dotenv import load_dotenv
from typing import Literal
import io
import pandas as pd
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from fastapi.responses import StreamingResponse
from typing import Optional
import math
import re

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
class StaffCreateRequest(BaseModel):
    phone: str
    full_name: str
    password: str
    role: Literal["guard", "teacher"]
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

# API đăng ký tài khoản mới cho học sinh (Không dùng nữa)
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
        role="student"
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

# API đăng nhập hệ thống bằng số điện thoại và mật khẩu (Không dùng nữa)
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

# Hàm gửi ảnh và mô tả sang mô hình AI Gemini để phân tích sự cố và đề xuất xử lý
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")   
def analyze_image_with_gemini(image_path: str, selected_category: str = "", user_description: str = ""):
    claimed_issue = user_description if selected_category == "Khác" else selected_category
    prompt = f"""
    Bạn là AI giám sát môi trường học đường AI GreenMap.
    Nhiệm vụ: Phân tích ảnh hiện trường và đối chiếu với nội dung học sinh báo cáo.

    Thông tin học sinh báo cáo:
    - Loại lựa chọn: '{selected_category}'
    - Nội dung học sinh mô tả/khẳng định: '{claimed_issue}'

    QUY TẮC ĐỐI CHIẾU VÀ LỌC (BẮT BUỘC):
    1. Kiểm tra ảnh có khuôn mặt người rõ nét, ảnh chụp người, hoặc ảnh nhạy cảm/không liên quan không.
       -> Nếu có mặt người: has_face = true, is_valid = false.
    2. Xác định vấn đề thực tế nhìn thấy trong ảnh (detected_group):
       Chọn 1 trong: 'Rác thải' | 'Rò rỉ nước' | 'Lãng phí điện' | 'Thiếu cây xanh' | 'Vệ sinh' | 'Khu vực nóng' | 'Cơ sở vật chất khác' | 'Không có vấn đề'.
    3. ĐỐI CHIẾU ĐỒNG NHẤT (is_match):
       - So sánh nội dung thực tế trong ảnh với nội dung học sinh khẳng định ('{claimed_issue}').
       - NẾU ẢNH LÀ RÁC nhưng học sinh chọn/mô tả là điện, nước, v.v... -> is_match = false.
       - NẾU ẢNH VÀ NỘI DUNG MÔ TẢ KHÔNG LIÊN QUAN ĐẾN NHAU HOẶC MÂU THUẪN -> is_match = false.
       - CHỈ KHI ảnh và nội dung mô tả phản ánh cùng một sự việc -> is_match = true.
    4. Chấm điểm EcoScore:
       - 1 (Nhẹ), 2 (Cần theo dõi), 3 (Khẩn cấp/Điểm nóng).

    Trả về DUY NHẤT định dạng JSON:
    {{
      "is_valid": true/false,
      "is_match": true/false,
      "has_face": false,
      "detected_group": "Nhóm thực tế nhìn thấy trong ảnh",
      "issue_detail": "Tên ngắn gọn của sự cố thực tế",
      "ecoscore": 1, 2 hoặc 3,
      "ai_suggestion": "Đề xuất hướng xử lý ngắn gọn",
      "reject_reason": "Giải thích ngắn nếu is_valid = false hoặc is_match = false"
    }}
    """
    try:
        img = Image.open(image_path)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[prompt, img],
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Lỗi gọi Gemini: {e}")
        return {
            "is_valid": True,
            "is_match": True,
            "has_face": False,
            "detected_group": selected_category or "Không xác định",
            "issue_group": selected_category or "Chưa xác định",
            "issue_detail": user_description or "Lỗi phân tích AI",
            "ecoscore": 1,
            "ai_suggestion": "Cần nhân viên kiểm tra"
        }

# Lấy danh sách toàn bộ các báo cáo sự cố để hiển thị lên bản đồ và bảng điều khiển
@app.get("/api/reports")
def get_reports(db: Session = Depends(get_db)):
    return db.query(models.Report).order_by(models.Report.created_at.desc()).all()

# Cập nhật trạng thái của một báo cáo (pending: Chờ xử lý, resolved: Đã xong, rejected: Từ chối)
class StatusUpdateRequest(BaseModel):
    status: str
@app.patch("/api/reports/{report_id}/status")
def update_report_status(
    report_id: str, 
    payload: StatusUpdateRequest, 
    db: Session = Depends(get_db)
):
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Không tìm thấy báo cáo.")
    
    if payload.status not in ["resolved", "rejected", "pending"]:
        raise HTTPException(status_code=400, detail="Trạng thái không hợp lệ.")

    report.status = payload.status
    db.commit()
    db.refresh(report)

    return {"message": "Cập nhật thành công!", "data": report}

# Xóa toàn bộ dữ liệu báo cáo trong cơ sở dữ liệu
@app.delete("/api/reports/reset-all")
def reset_database(db: Session = Depends(get_db)):
    db.query(models.Report).delete()
    db.commit()
    return {"message": "Đã xóa sạch toàn bộ dữ liệu báo cáo!"}

# Tạo tài khoản nhân sự nội bộ mới
@app.post("/api/auth/create-staff", status_code=status.HTTP_201_CREATED)
def create_staff_account(payload: StaffCreateRequest, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.phone == payload.phone).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Số điện thoại này đã được đăng ký tài khoản."
        )

    new_staff = models.User(
        id=str(uuid.uuid4()),
        phone=payload.phone.strip(),
        full_name=payload.full_name.strip(),
        password=payload.password,  # Lưu ý: Nên dùng passlib/bcrypt hash nếu dự án có sẵn
        role=payload.role
    )

    db.add(new_staff)
    db.commit()
    db.refresh(new_staff)

    return {
        "message": f"Tạo tài khoản {payload.role} thành công",
        "user": {
            "id": new_staff.id,
            "phone": new_staff.phone,
            "full_name": new_staff.full_name,
            "role": new_staff.role
        }
    }

def get_now_vn():
    return datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).replace(tzinfo=None)

# Xuất file excel
@app.get("/api/reports/export-excel")
def export_reports_excel(
    period: Literal["week", "month", "all"] = Query(
        "week", 
        description="Lọc theo khoảng thời gian: 'week' (7 ngày qua), 'month' (30 ngày qua), hoặc 'all'"
    ),
    db: Session = Depends(get_db)
):
    now = get_now_vn()
    query = db.query(models.Report)

    if period == "week":
        start_date = now - timedelta(days=7)
        query = query.filter(models.Report.created_at >= start_date)
    elif period == "month":
        start_date = now - timedelta(days=30)
        query = query.filter(models.Report.created_at >= start_date)

    reports = query.order_by(models.Report.created_at.desc()).all()

    if not reports:
        raise HTTPException(
            status_code=404, 
            detail="Không có báo cáo nào trong khoảng thời gian đã chọn để xuất file."
        )

    output = io.BytesIO()

    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        if period == "month":
            class_stats = {}
            for r in reports:
                match = re.search(r"\((.*?)\)", r.reporter_name or "")
                class_name = match.group(1).strip() if match else "Khác"

                if class_name not in class_stats:
                    class_stats[class_name] = {"total": 0, "resolved": 0, "points": 0}

                class_stats[class_name]["total"] += 1
                if r.status == "resolved":
                    class_stats[class_name]["resolved"] += 1
                    class_stats[class_name]["points"] += (r.ecoscore or 1)

            ranking_data = []
            for c_name, stats in class_stats.items():
                rate = f"{round((stats['resolved'] / stats['total']) * 100, 1)}%" if stats["total"] > 0 else "0%"
                ranking_data.append({
                    "Lớp": c_name,
                    "Tổng lượt báo cáo": stats["total"],
                    "Số sự cố đã xử lý": stats["resolved"],
                    "Tổng Điểm Xanh": stats["points"],
                    "Tỷ lệ hoàn thành": rate
                })

            df = pd.DataFrame(ranking_data)
            if not df.empty:
                df = df.sort_values(by="Tổng Điểm Xanh", ascending=False).reset_index(drop=True)
                df.insert(0, "Hạng", df.index + 1)

            sheet_name = "ThiDua_30Ngay"
            df.to_excel(writer, index=False, sheet_name=sheet_name)

        else:
            data = []
            for r in reports:
                earned_points = r.ecoscore if r.status == "resolved" else 0

                status_map = {
                    "resolved": "Đã xử lý",
                    "rejected": "Không hợp lệ",
                    "pending": "Chờ xử lý"
                }
                status_vn = status_map.get(r.status, "Chờ xử lý")

                data.append({
                    "Ngày": r.created_at.strftime("%d/%m/%Y") if r.created_at else "",
                    "Giờ": r.created_at.strftime("%H:%M:%S") if r.created_at else "",
                    "Người báo cáo / Lớp": r.reporter_name or "Học sinh ẩn danh",
                    "Nhóm sự cố": r.issue_group or "Chưa phân loại",
                    "Chi tiết sự cố": r.issue_detail or "",
                    "AI phân tích": f"Mức độ {r.ecoscore}" if r.ecoscore else "Chưa đánh giá",
                    "AI gợi ý xử lý": r.ai_suggestion or "",
                    "Điểm": earned_points,
                    "Trạng thái": status_vn
                })

            df = pd.DataFrame(data)
            sheet_name = "ThongKe_7Ngay" if period == "week" else "DanhSachBaoCao"
            df.to_excel(writer, index=False, sheet_name=sheet_name)
        worksheet = writer.sheets[sheet_name]
        for col in worksheet.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = col[0].column_letter
            worksheet.column_dimensions[col_letter].width = max(max_len + 4, 14)

    output.seek(0)
    filename = f"bao_cao_{period}_{now.strftime('%Y%m%d_%H%M%S')}.xlsx"
    headers = {
        "Content-Disposition": f"attachment; filename={filename}"
    }

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )

# Đăng nhập nhanh bằng mã học sinh
class StudentLoginRequest(BaseModel):
    student_code: str
@app.post("/api/auth/student-login")
def student_login(req: StudentLoginRequest, db: Session = Depends(get_db)):
    code = req.student_code.strip()
    student = db.query(models.Student).filter(models.Student.student_code == code).first()
    
    if not student:
        raise HTTPException(
            status_code=404, 
            detail="Mã số học sinh không tồn tại trong hệ thống trường!"
        )

    return {
        "message": "Xác thực học sinh thành công!",
        "user": {
            "id": student.id,
            "student_code": student.student_code,
            "full_name": student.full_name,
            "class_name": student.class_name,
            "phone": student.phone or "",
            "role": "student"
        }
    }

# Học sinh báo cáo sự cố mới gồm ảnh, tọa độ bản đồ và gọi AI phân tích tự động
DISTANCE_THRESHOLD = 3.0
@app.post("/api/reports")
async def create_report(
    coord_x: float = Form(...),
    coord_y: float = Form(...),
    description: str = Form(""),
    issue_category: str = Form(""),  
    reporter_name: str = Form("Học sinh"),
    reporter_phone: str = Form(""),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    one_hour_ago = datetime.utcnow() - timedelta(minutes=60)
    recent_reports = db.query(models.Report).filter(
        models.Report.created_at >= one_hour_ago,
        models.Report.status != "rejected"
    ).all()

    for rep in recent_reports:
        distance = math.hypot(rep.coord_x - coord_x, rep.coord_y - coord_y)
        if distance <= DISTANCE_THRESHOLD:
            is_same_category = (
                (rep.issue_group and issue_category and issue_category in rep.issue_group) or
                (rep.issue_group == issue_category)
            )
            if is_same_category:
                raise HTTPException(
                    status_code=400,
                    detail="🤖 AI trả kết quả: BÁO CÁO TRÙNG LẶP (Khu vực này đã có bạn báo cáo sự cố tương tự trong 60 phút qua, hệ thống không ghi nhận lại)."
                )
    image_url = ""
    issue_group = issue_category or "Báo cáo từ máy tính trường"
    issue_detail = description or "Học sinh báo cáo không kèm ảnh"
    ecoscore = 2
    ai_suggestion = "Cần bảo vệ hoặc lao công đến kiểm tra trực tiếp hiện trường."

    if image and hasattr(image, "filename") and image.filename:
        file_ext = os.path.splitext(image.filename)[1] or ".jpg"
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)

        image_url = f"/uploads/{unique_filename}"
        ai_res = analyze_image_with_gemini(
            image_path=file_path, 
            selected_category=issue_category, 
            user_description=description
        )

        if ai_res.get("has_face") or not ai_res.get("is_valid", True):
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(
                status_code=400,
                detail=ai_res.get("reject_reason") or "🤖 AI trả kết quả: HÌNH ẢNH KHÔNG HỢP LỆ (Phát hiện mặt người hoặc hình ảnh không liên quan)."
            )

        if not ai_res.get("is_match", True):
            if os.path.exists(file_path):
                os.remove(file_path)
            
            detected = ai_res.get("detected_group", "Vấn đề khác")
            user_input = description if issue_category == "Khác" else issue_category
            
            reason = ai_res.get("reject_reason") or f"AI nhận diện ảnh là '{detected}' nhưng bạn lại báo cáo là '{user_input}'."
            
            raise HTTPException(
                status_code=400,
                detail=f"🤖 AI trả kết quả: HÌNH ẢNH KHÔNG HỢP LỆ ({reason} Vui lòng mô tả đúng hiện trường)."
            )

        issue_group = ai_res.get("detected_group") or ai_res.get("issue_group", issue_group)
        issue_detail = ai_res.get("issue_detail", issue_detail)
        ecoscore = ai_res.get("ecoscore", ecoscore)
        ai_suggestion = ai_res.get("ai_suggestion", ai_suggestion)

    new_report = models.Report(
        id=str(uuid.uuid4()),
        coord_x=coord_x,
        coord_y=coord_y,
        description=description,
        reporter_name=reporter_name,
        reporter_phone=reporter_phone,
        image_url=image_url,
        status="pending",
        issue_group=issue_group,
        issue_detail=issue_detail,
        ecoscore=ecoscore,
        ai_suggestion=ai_suggestion
    )

    db.add(new_report)
    db.commit()
    db.refresh(new_report)

    return {"message": "Báo cáo thành công!", "data": new_report}