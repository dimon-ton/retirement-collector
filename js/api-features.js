(function () {
  const originalCall = API.call.bind(API);
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
      const result = [...await originalCall(action, payload), ...(APP_CONFIG.DEMO_MODE ? customSchools() : [])];
      return [...result, { schoolId: "__other__", schoolName: "อื่น ๆ — เพิ่มชื่อโรงเรียน" }];
    }

    if (!APP_CONFIG.DEMO_MODE) return originalCall(action, payload);

    if (action === "submitResponse" && (!payload.schoolId || String(payload.schoolId).startsWith("CUSTOM-"))) {
      let school;
      if (payload.schoolId) {
        school = customSchools().find(item => item.schoolId === payload.schoolId);
      } else {
        const name = String(payload.schoolName || "").trim();
        if (!name) throw new Error("กรุณากรอกชื่อโรงเรียน");
        const allSchools = await API.call("getSchools");
        school = allSchools.find(item => item.schoolName.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
        if (school && !String(school.schoolId).startsWith("CUSTOM-")) {
          return originalCall(action, { ...payload, schoolId: school.schoolId });
        }
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
      return [...await originalCall(action, payload), ...customStatusRows().map(({ slip, contactName, phone, ...row }) => row)];
    }

    if (action === "getAdminData") {
      const regularRows = (await originalCall(action, payload)).map(row => ({ ...row, hasSlip: !!row.slip, slip: undefined }));
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
