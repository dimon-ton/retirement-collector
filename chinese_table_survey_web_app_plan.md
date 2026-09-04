# Web App Plan: แบบสำรวจโต๊ะจีน ศูนย์เครือข่ายที่ 9 ทุ่งใหญ่

## 1. Project Overview

**Project name:** แบบสำรวจโต๊ะจีน (ศูนย์เครือข่ายที่ 9 ทุ่งใหญ่)

**Event:** งานมุทิตาจิตอำเภอเกษตรวิสัย

**Event date:** วันศุกร์ที่ 25 กันยายน 2569

**Table price:** 2,200 บาท / 8 คนต่อโต๊ะ

The system is designed to collect Chinese banquet table reservations from schools in Network Center 9, record payment information, collect bank-transfer slips, and allow administrators to verify payment status.

---

## 2. Technology Stack

### Frontend
- HTML
- CSS
- JavaScript
- Hosted on **GitHub Pages**

### Backend
- **Google Apps Script**
- Deployed as a **Google Apps Script Web App**
- Used as the API layer between the frontend and Google services

### Database
- **Google Sheets**

### Slip Storage
- **Google Drive**

### Admin Authentication
- Server-side authentication using **Google Apps Script**
- Admin password must never be stored or validated in frontend JavaScript
- Authentication should return a temporary session token for subsequent admin requests

### Deployment

```text
Frontend
GitHub Pages

Backend / API
Google Apps Script Web App

Database
Google Sheets

Payment Slip Storage
Google Drive
```

---

## 3. System Architecture

```text
User Browser
    ↓
GitHub Pages
HTML + CSS + JavaScript
    ↓
fetch()
    ↓
Google Apps Script Web App
    ├── Google Sheets
    │   ├── Schools
    │   └── Responses
    │
    └── Google Drive
        └── Payment Slips
```

The frontend is responsible only for displaying the user interface and sending requests to the backend.

All sensitive operations such as payment validation, admin authentication, data writes, and Drive access must be handled by Google Apps Script.

---

## 4. Main Pages

The application should provide three main views.

### 4.1 Survey Page

Used by schools to submit table reservation and payment information.

Required inputs:

- ชื่อโรงเรียน
- จำนวนโต๊ะ
- ชื่อผู้กรอก
- เบอร์โทร
- วิธีชำระเงิน
  - เงินสด
  - โอนเงิน
- สลิปโอนเงิน — required only when payment method is bank transfer

The system must automatically calculate:

```text
ยอดที่ต้องชำระ = จำนวนโต๊ะ × 2,200 บาท
```

Do not include a separate participant-count input.

---

### 4.2 Public Payment Status Page

Used to show the payment status of each school.

Public information may include:

- ชื่อโรงเรียน
- จำนวนโต๊ะ
- ยอดเงิน
- วิธีชำระเงิน
- สถานะการชำระเงิน

Do **not** expose:

- เบอร์โทรศัพท์
- ชื่อผู้กรอก หากไม่จำเป็น
- Payment slip URLs
- Google Drive file IDs
- Admin-only information

Recommended statuses:

```text
PENDING
PAID
UNPAID
```

Display labels:

```text
⏳ รอตรวจสอบ
✅ ชำระแล้ว
❌ ยังไม่ชำระ
```

---

### 4.3 Admin Dashboard

Admin features:

- Admin login
- View all school submissions
- View contact name and phone number
- View payment slips
- Confirm payment
- Change payment status
- Edit submission data if needed
- Search schools
- Filter by payment status
- View schools that have not submitted
- View total number of tables
- View total expected amount
- View total confirmed payment
- View outstanding amount

---

## 5. School Dropdown

The school name input should be a **dropdown**, not free text.

Recommended initial school master list for Network Center 9:

1. โรงเรียนหนองพระบางตลาดม่วง
2. โรงเรียนบ้านเขวาหรดี
3. โรงเรียนชีโนวาทธำรง
4. โรงเรียนบ้านเขวาตะคลอง
5. โรงเรียนบ้านหนองอ่างดอกรัก
6. โรงเรียนบ้านโพนหิน
7. โรงเรียนบ้านโพนแท่น
8. โรงเรียนบ้านนกเหาะ
9. โรงเรียนบ้านหนองสระหงส์
10. โรงเรียนทุ่งกุลาประชารัฐ
11. โรงเรียนบ้านหนองไผ่ลุ่ม
12. โรงเรียนวัดแจ่มอารมณ์
13. โรงเรียนบ้านโพนเงินโพนทอง

The frontend should load this list from the backend rather than hardcoding it permanently in HTML.

The school master list should be maintained in Google Sheets.

---

## 6. Survey Form Design

Recommended field order:

```text
ชื่อโรงเรียน
[ เลือกโรงเรียน ▼ ]

จำนวนโต๊ะ
[-]   2   [+]

ยอดที่ต้องชำระ
4,400 บาท

ชื่อผู้กรอก
[......................]

เบอร์โทร
[......................]

วิธีชำระเงิน
[ เงินสด ]   [ โอนเงิน ]

[ Conditional payment section ]

[ ยืนยันส่งข้อมูล ]
```

The interface should be:

- Mobile-first
- Easy to use from LINE or Facebook links
- Large touch targets
- Clear Thai typography
- Minimal typing
- Responsive on phones, tablets, and desktops

---

## 7. Payment Method Logic

### 7.1 Cash

If the user selects:

```text
เงินสด
```

Then:

- Do not show bank account details
- Do not show slip upload input
- Slip is not required

---

### 7.2 Bank Transfer

If the user selects:

```text
โอนเงิน
```

Immediately show:

```text
ข้อมูลสำหรับโอนเงิน

ธนาคารกรุงไทย
ชื่อบัญชี นายอวยชัย เจนไชย

เลขบัญชี
665-3-33643-3

[ คัดลอกเลขบัญชี ]

สลิปโอนเงิน *
[ 📷 ถ่ายภาพ / เลือกรูป ]
```

The payment slip input must be required only when `paymentMethod === "transfer"`.

Example frontend logic:

```javascript
function handlePaymentMethod(method) {
  const transferSection = document.getElementById("transferSection");
  const slipInput = document.getElementById("slipInput");

  if (method === "transfer") {
    transferSection.hidden = false;
    slipInput.required = true;
  } else {
    transferSection.hidden = true;
    slipInput.required = false;
    slipInput.value = "";
  }
}
```

---

## 8. Payment Calculation

Frontend may calculate the amount for display:

```javascript
const TABLE_PRICE = 2200;
const amount = numberOfTables * TABLE_PRICE;
```

However, the backend must calculate the amount again.

Never trust the amount sent by the browser.

Recommended backend logic:

```javascript
const TABLE_PRICE = 2200;
const amount = Number(numberOfTables) * TABLE_PRICE;
```

This prevents users from modifying browser requests and submitting an incorrect amount.

---

## 9. Google Sheets Structure

Use at least two sheets.

### 9.1 `Schools`

Recommended columns:

```text
schoolId
schoolName
sortOrder
active
```

Example:

```text
SCH001 | โรงเรียนหนองพระบางตลาดม่วง | 1  | TRUE
SCH002 | โรงเรียนบ้านเขวาหรดี       | 2  | TRUE
SCH003 | โรงเรียนชีโนวาทธำรง        | 3  | TRUE
...
```

Use `schoolId` as the main identifier.

---

### 9.2 `Responses`

Recommended columns:

```text
id
timestamp
schoolId
schoolName
numberOfTables
amount
contactName
phone
paymentMethod
slipFileId
slipUrl
paymentStatus
verifiedBy
verifiedAt
updatedAt
```

Example record:

```text
RESP-0001
2026-09-04 14:30
SCH007
โรงเรียนบ้านโพนแท่น
2
4400
นายสมชาย ใจดี
0812345678
transfer
GOOGLE_DRIVE_FILE_ID
PRIVATE_ADMIN_URL
PENDING
-
-
2026-09-04 14:30
```

---

## 10. Submission Rules

Recommended validation rules:

### School
- Required
- Must exist in the `Schools` sheet
- Must be active

### Number of Tables
- Required
- Integer only
- Minimum: 1
- Maximum can be configured if needed

### Contact Name
- Required

### Phone
- Required
- Validate Thai phone-number format

### Payment Method
Allowed values only:

```text
cash
transfer
```

### Payment Slip
- Required only for transfer
- Must be an image
- Validate MIME type
- Validate file size
- Recommended accepted types:
  - image/jpeg
  - image/png
  - image/webp

---

## 11. Slip Upload Flow

Recommended flow:

```text
User selects slip image
    ↓
Frontend validates type and size
    ↓
Frontend optionally compresses image
    ↓
Send image to Apps Script
    ↓
Apps Script validates image again
    ↓
Save file to private Google Drive folder
    ↓
Return file ID
    ↓
Store file ID in Google Sheets
```

Recommended Drive folder:

```text
ChineseTableSurvey/
└── PaymentSlips/
```

Possible filename convention:

```text
2026-09-04_SCH007_RESP-0001.jpg
```

Do not make the slip folder publicly accessible.

---

## 12. Admin Authentication

Do not hardcode the admin password in the frontend.

Avoid:

```javascript
const ADMIN_PASSWORD = "123456";
```

Recommended authentication flow:

```text
Admin enters password
    ↓
GitHub Pages sends credentials to Apps Script
    ↓
Apps Script verifies password server-side
    ↓
Apps Script creates temporary session token
    ↓
Frontend stores token
    ↓
Admin API requests include token
    ↓
Apps Script validates token
```

The password hash or secret should be stored in:

```text
Apps Script PropertiesService
```

rather than directly in frontend source code.

---

## 13. Suggested API Design

Google Apps Script Web App may use an `action` parameter.

### Public API

```text
GET ?action=getSchools
GET ?action=getPublicStatus
POST action=submitResponse
POST action=uploadSlip
```

### Admin API

```text
POST action=adminLogin
POST action=adminLogout
GET  action=getAdminData
GET  action=getSlip
POST action=updatePaymentStatus
POST action=updateResponse
```

Each admin endpoint must validate the session token.

---

## 14. Public Status Dashboard

Recommended summary cards:

```text
โรงเรียนทั้งหมด
13

ตอบแบบสำรวจแล้ว
X / 13

จำนวนโต๊ะทั้งหมด
XX

ยอดรวมทั้งหมด
XX,XXX บาท

ชำระแล้ว
XX,XXX บาท

รอตรวจสอบ
XX,XXX บาท
```

Recommended school table:

| โรงเรียน | จำนวนโต๊ะ | ยอดเงิน | วิธีชำระ | สถานะ |
|---|---:|---:|---|---|
| โรงเรียนบ้านโพนแท่น | 2 | 4,400 | โอน | ✅ ชำระแล้ว |
| โรงเรียนบ้านนกเหาะ | 1 | 2,200 | เงินสด | ⏳ รอตรวจสอบ |
| โรงเรียนบ้านโพนหิน | - | - | - | ⚪ ยังไม่ส่ง |

---

## 15. Admin Dashboard Layout

Recommended desktop layout:

```text
┌───────────────┬────────────────────────────────────┐
│ Dashboard     │ ภาพรวม                             │
│               │                                    │
│ โรงเรียน       │ [13] [โต๊ะ] [ยอดรวม] [ชำระแล้ว]   │
│               │                                    │
│ รอตรวจสอบ      │ รายการโรงเรียน                     │
│               │                                    │
│ ชำระแล้ว      │ โรงเรียน | โต๊ะ | ยอด | สถานะ      │
│               │                                    │
│ ยังไม่ตอบ      │                                    │
│               │                                    │
│ ออกจากระบบ    │                                    │
└───────────────┴────────────────────────────────────┘
```

Recommended filters:

- ทั้งหมด
- รอตรวจสอบ
- ชำระแล้ว
- ยังไม่ชำระ
- ยังไม่ส่งข้อมูล

---

## 16. Payment Verification

Admin actions:

```text
[ ✓ ยืนยันชำระแล้ว ]

[ เปลี่ยนเป็นรอตรวจสอบ ]

[ ระบุว่ายังไม่ชำระ ]
```

When payment is confirmed:

```text
paymentStatus = "PAID"
verifiedBy = admin identifier
verifiedAt = current timestamp
```

The public status page should reflect this automatically.

---

## 17. One School, One Main Record

Recommended rule:

Each school should normally have **one current active survey response**.

If the same school needs to update:

- จำนวนโต๊ะ
- วิธีชำระเงิน
- สลิป
- ผู้กรอก
- เบอร์โทร

the system should update the existing response instead of creating duplicate records.

A unique rule may use:

```text
schoolId + eventId
```

Example:

```text
EVENT_2569_MUTITAJIT + SCH007
```

This keeps one record per school for this event.

---

## 18. Event Configuration

Avoid scattering event information throughout the code.

Recommended backend configuration:

```javascript
const EVENT_CONFIG = {
  eventId: "MUTITAJIT-2569",
  title: "แบบสำรวจโต๊ะจีน",
  network: "ศูนย์เครือข่ายที่ 9 ทุ่งใหญ่",
  eventName: "งานมุทิตาจิตอำเภอเกษตรวิสัย",
  eventDate: "25 กันยายน 2569",
  tablePrice: 2200,
  seatsPerTable: 8,
  bank: {
    name: "ธนาคารกรุงไทย",
    accountName: "นายอวยชัย เจนไชย",
    accountNumber: "6653336433",
    displayAccountNumber: "665-3-33643-3"
  }
};
```

---

## 19. Recommended Frontend Project Structure

```text
repository/
│
├── index.html
│
├── status.html
│
├── admin.html
│
├── css/
│   └── app.css
│
├── js/
│   ├── config.js
│   ├── api.js
│   ├── survey.js
│   ├── status.js
│   └── admin.js
│
└── assets/
    └── icons/
```

A single-page application may also be used:

```text
/
#/survey
#/status
#/admin
```

For this project, a lightweight SPA is a good option if the implementation remains simple.

---

## 20. Recommended Apps Script Structure

```text
Apps Script
│
├── Code.gs
├── Api.gs
├── Config.gs
├── Schools.gs
├── Responses.gs
├── Upload.gs
├── Auth.gs
└── Utils.gs
```

Responsibilities:

### `Code.gs`
- `doGet()`
- `doPost()`
- Route API requests

### `Api.gs`
- Parse actions
- Return JSON responses

### `Config.gs`
- Spreadsheet IDs
- Drive folder IDs
- Event configuration

### `Schools.gs`
- Read school master data

### `Responses.gs`
- Create and update responses
- Calculate amounts
- Return public/admin status data

### `Upload.gs`
- Validate uploads
- Save slips to Google Drive

### `Auth.gs`
- Admin login
- Session tokens
- Authorization checks

### `Utils.gs`
- Validation
- JSON helpers
- Date formatting
- Common utility functions

---

## 21. CORS and GitHub Pages Integration

Because the frontend is hosted on GitHub Pages while the API is hosted on Apps Script, integration must be tested carefully.

Frontend requests should use the deployed Apps Script Web App URL.

Example:

```javascript
const API_URL =
  "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
```

Centralize the URL in `config.js`.

Example API helper:

```javascript
async function apiRequest(action, payload = {}) {
  const response = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action,
      ...payload
    })
  });

  if (!response.ok) {
    throw new Error("API request failed");
  }

  return response.json();
}
```

The exact request style should be selected after testing Apps Script Web App behavior with GitHub Pages.

---

## 22. UI / UX Direction

Recommended visual style:

- Mobile-first
- Clean white or warm-white background
- Deep navy / indigo primary color
- Gold accent for the event identity
- Rounded cards
- Large Thai typography
- Large touch-friendly buttons
- Green for paid status
- Amber for pending status
- Red for errors/unpaid status

Avoid making the application look like a generic Google Form.

---

## 23. Recommended User Flow

```text
Open survey link
    ↓
Select school
    ↓
Choose number of tables
    ↓
System displays total amount
    ↓
Enter contact name
    ↓
Enter phone number
    ↓
Choose payment method
    ├── Cash
    │     ↓
    │   Submit
    │
    └── Transfer
          ↓
       Display bank account
          ↓
       Upload payment slip
          ↓
         Submit
    ↓
Show submission confirmation
    ↓
Admin reviews payment
    ↓
Admin confirms payment
    ↓
Public status updates
```

---

## 24. Initial Build Phases

### Phase 1 — Data Setup
- Create Google Sheet
- Create `Schools`
- Create `Responses`
- Add the 13 schools
- Create Google Drive slip folder
- Configure Apps Script properties

### Phase 2 — Backend API
- Build school API
- Build submission API
- Validate submissions
- Calculate amount server-side
- Implement slip upload
- Implement public status API

### Phase 3 — Public Frontend
- Build survey UI
- Load school dropdown
- Add table quantity selector
- Add auto-calculation
- Add payment conditional display
- Add slip preview
- Add submission confirmation

### Phase 4 — Admin Authentication
- Implement server-side password validation
- Create session token
- Protect admin endpoints

### Phase 5 — Admin Dashboard
- Summary cards
- School table
- Filters
- Slip viewer
- Payment verification
- Edit submissions

### Phase 6 — Public Status Page
- School payment status
- Summary totals
- Hide sensitive information

### Phase 7 — Testing
Test:

- Mobile
- iPad
- Desktop
- GitHub Pages
- Apps Script Web App
- Cash submission
- Transfer submission
- Large image upload
- Invalid image
- Duplicate school submission
- Admin login
- Expired session
- Payment verification
- Public status refresh

### Phase 8 — Deployment
- Publish frontend to GitHub Pages
- Deploy Apps Script Web App
- Set production API URL
- Confirm Drive permissions
- Confirm Sheet permissions
- Run end-to-end production test

---

## 25. Security Requirements

- Never store the admin password in frontend code
- Never trust calculated amounts from the browser
- Validate all inputs server-side
- Validate school IDs against the master sheet
- Validate payment methods
- Validate image MIME type and file size
- Keep payment slips private
- Do not expose Drive file IDs publicly
- Require admin token for private data
- Rate-limit or guard sensitive actions where practical
- Store secrets in Apps Script PropertiesService

---

## 26. Final Recommended Stack

```text
Frontend
HTML + CSS + JavaScript
GitHub Pages

Backend
Google Apps Script Web App

Database
Google Sheets

Slip Storage
Google Drive

Admin Authentication
Google Apps Script server-side authentication

Deployment
Frontend → GitHub Pages
Backend → Google Apps Script Web App
```

This architecture keeps the frontend simple and easy to deploy while keeping sensitive data access and business logic on the server side.
