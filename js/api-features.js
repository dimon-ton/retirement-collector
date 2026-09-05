(function () {
  const originalCall = API.call.bind(API);
  const canonicalNames = [
    "โรงเรียนหนองพระบางตลาดม่วง", "บ้านเขวาหรดี", "ชีโนวาทธำรง", "โรงเรียนบ้านเขวาตะคลอง",
    "โรงเรียนบ้านหนองอ่างดอกรัก", "โรงเรียนบ้านโพนหิน", "บ้านโพนแท่น", "บ้านนกเหาะ",
    "โรงเรียนบ้านหนองสระหงส์", "โรงเรียนทุ่งกุลาประชารัฐ", "บ้านหนองไผ่ลุ่ม", "วัดแจ่มอารมณ์",
    "โรงเรียนบ้านโพนเงินโพนทอง", "โรงเรียนบ้านโพนทัน", "บ้านดงครั่งใหญ่", "บ้านแสนสี",
    "บ้านดงครั่งน้อย", "บ้านฮ่องทราย", "บ้านไทรทอง"
  ];
  const canonicalSchools = canonicalNames.map((schoolName, index) => ({ schoolId: `SCH${String(index + 1).padStart(3, "0")}`, schoolName }));
  const schoolKey = "rc_demo_custom_schools";
  const responseKey = "rc_demo_responses";
  const customSchools = () => JSON.parse(localStorage.getItem(schoolKey) || "[]");
  const responses = () => JSON.parse(localStorage.getItem(responseKey) || "[]");
  const saveResponses = rows => localStorage.setItem(responseKey, JSON.stringify(rows));

  function customStatusRows() {
    const rows = responses();
    return customSchools().map(school => {
      const response = rows.find(row => row.schoolId === school.schoolId);
      return response || { ...school, paymentStatus: "MISSING" };
    });
  }

  API.call = async function (action, payload = {}) {
    if (action === "getSchools") {
      const result = APP_CONFIG.DEMO_MODE ? [...canonicalSchools, ...customSchools()] : await originalCall(action, payload);
      return [...result, { schoolId: "__other__", schoolName: "อื่น ๆ — เพิ่มชื่อโรงเรียน" }];
    }

    if (!APP_CONFIG.DEMO_MODE) return originalCall(action, payload);

    if (action === "submitResponse") {
      let school;
      if (String(payload.schoolId).startsWith("CUSTOM-")) {
        school = customSchools().find(item => item.schoolId === payload.schoolId);
      } else if (payload.schoolId) {
        school = canonicalSchools.find(item => item.schoolId === payload.schoolId);
      } else {
        const name = String(payload.schoolName || "").trim();
        if (!name) throw new Error("กรุณากรอกชื่อโรงเรียน");
        const allSchools = await API.call("getSchools");
        school = allSchools.find(item => item.schoolName.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
        if (!school) {
          school = { schoolId: `CUSTOM-${Date.now()}`, schoolName: name };
          localStorage.setItem(schoolKey, JSON.stringify([...customSchools(), school]));
        }
      }
      if (!school) throw new Error("ไม่พบโรงเรียนที่เลือก");
      const rows = responses();
      const index = rows.findIndex(row => row.schoolId === school.schoolId);
      const item = {
        ...payload,
        id: index >= 0 ? rows[index].id : `RESP-${String(rows.length + 1).padStart(4, "0")}`,
        schoolId: school.schoolId,
        schoolName: school.schoolName,
        amount: payload.numberOfTables * APP_CONFIG.TABLE_PRICE,
        paymentStatus: "PENDING",
        timestamp: new Date().toISOString()
      };
      if (index >= 0) rows[index] = item; else rows.push(item);
      saveResponses(rows);
      return item;
    }

    if (action === "getPublicStatus") {
      const originalRows = await originalCall(action, payload);
      const canonicalRows = canonicalSchools.map(school => {
        const row = originalRows.find(item => item.schoolId === school.schoolId);
        return row ? { ...row, schoolName: school.schoolName } : { ...school, paymentStatus: "MISSING" };
      });
      return [...canonicalRows, ...customStatusRows().map(({ slip, contactName, phone, ...row }) => row)];
    }

    if (action === "getAdminData") {
      const originalRows = await originalCall(action, payload);
      const regularRows = canonicalSchools.map(school => {
        const row = originalRows.find(item => item.schoolId === school.schoolId);
        return row ? { ...row, schoolName: school.schoolName, hasSlip: !!row.slip, slip: undefined } : { ...school, paymentStatus: "MISSING" };
      });
      const customRows = customStatusRows().map(row => ({ ...row, hasSlip: !!row.slip, slip: undefined }));
      return [...regularRows, ...customRows];
    }

    if (action === "getSlip") {
      const row = responses().find(item => item.id === payload.id);
      if (!row?.slip) throw new Error("ไม่พบสลิป");
      return { mimeType: row.slip.type, data: row.slip.data };
    }

    return originalCall(action, payload);
  };
})();
