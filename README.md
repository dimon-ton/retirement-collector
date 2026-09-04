# ระบบสำรวจโต๊ะจีน — ศูนย์เครือข่ายที่ 9

เว็บแอปแบบ mobile-first สำหรับสำรองโต๊ะ ติดตามสถานะ และตรวจสอบการชำระเงิน ออกแบบให้เปิดจาก LINE/Facebook และโฮสต์บน GitHub Pages ได้

## ทดลองใช้งาน

เปิด `index.html` ผ่าน local server เช่น VS Code Live Server หรือ:

```powershell
python -m http.server 8080
```

จากนั้นเปิด `http://localhost:8080` ตัวแอปเริ่มต้นใน Demo Mode และบันทึกข้อมูลไว้ใน `localStorage` รหัสผ่านหน้าผู้ดูแลสำหรับเดโมคือ `admin2569`

## เชื่อมต่อ Google Apps Script

1. สร้าง Google Sheet และโฟลเดอร์ Drive สำหรับเก็บสลิป (ตั้งเป็น private)
2. สร้าง Apps Script project แล้วคัดลอก [Code.gs](apps-script/Code.gs)
3. ใน Project Settings > Script properties เพิ่ม `SPREADSHEET_ID` และ `SLIP_FOLDER_ID`
4. ใน Apps Script editor รัน `setupProject()` หนึ่งครั้ง
5. ตั้งรหัสผ่านด้วยการรันฟังก์ชันชั่วคราว `setAdminPassword('รหัสผ่านที่ปลอดภัย')` อย่างน้อย 8 ตัวอักษร
6. Deploy > New deployment > Web app, Execute as Me และกำหนดผู้มีสิทธิ์เข้าถึงตามการใช้งาน
7. นำ URL ที่ลงท้ายด้วย `/exec` ใส่ใน [config.js](js/config.js) ที่ `API_URL` และเปลี่ยน `DEMO_MODE` เป็น `false`
8. Deploy ไฟล์ frontend ทั้งหมดบน GitHub Pages และทดสอบ submit/login/status อีกครั้ง

จำนวนเงินจะถูกคำนวณซ้ำที่ฝั่งเซิร์ฟเวอร์ สลิปไม่ถูกเปิดเป็นสาธารณะ และ API ผู้ดูแลทุกตัวต้องใช้ session token อายุ 6 ชั่วโมง
