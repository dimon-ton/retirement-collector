(function () {
  const OTHER_SCHOOL = "__other__";
  const safe = value => String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);

  function toggleCustomSchool() {
    const custom = $("#school").value === OTHER_SCHOOL;
    $("#customSchool").hidden = !custom;
    $("#customSchool").required = custom;
    if (!custom) $("#customSchool").value = "";
  }

  async function addOtherSchoolOption() {
    const select = $("#school");
    try {
      schools = await API.call("getSchools");
      schools = schools.filter(school => school.schoolId !== OTHER_SCHOOL);
      select.innerHTML = '<option value="">เลือกโรงเรียนของท่าน</option>'
        + schools.map(school => `<option value="${safe(school.schoolId)}">${safe(school.schoolName)}</option>`).join("")
        + `<option value="${OTHER_SCHOOL}">อื่น ๆ — เพิ่มชื่อโรงเรียน</option>`;
    } catch (error) {
      if (!select.querySelector(`option[value="${OTHER_SCHOOL}"]`)) {
        select.insertAdjacentHTML("beforeend", `<option value="${OTHER_SCHOOL}">อื่น ๆ — เพิ่มชื่อโรงเรียน</option>`);
      }
    }
    select.onchange = toggleCustomSchool;
  }

  $("#surveyForm").onsubmit = event => {
    event.preventDefault();
    const selectedId = $("#school").value;
    const customName = $("#customSchool").value.trim();
    const payment = $("input[name=payment]:checked")?.value;
    const phone = $("#phone").value.replace(/\D/g, "");
    let error = "";

    if (!selectedId) error = "กรุณาเลือกโรงเรียน";
    else if (selectedId === OTHER_SCHOOL && !customName) error = "กรุณากรอกชื่อโรงเรียน";
    else if (!$("#contactName").value.trim()) error = "กรุณากรอกชื่อผู้ติดต่อ";
    else if (!/^0\d{8,9}$/.test(phone)) error = "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง";
    else if (!payment) error = "กรุณาเลือกวิธีชำระเงิน";
    else if (payment === "transfer" && !$("#slipInput").files[0]) error = "กรุณาแนบสลิปโอนเงิน";
    else if (!$("#consent").checked) error = "กรุณายืนยันความถูกต้องของข้อมูล";
    if (error) return toast(error);

    const isCustom = selectedId === OTHER_SCHOOL;
    const selected = isCustom ? null : schools.find(school => school.schoolId === selectedId);
    if (!isCustom && !selected) return toast("ไม่พบโรงเรียนที่เลือก กรุณาลองใหม่");

    const file = $("#slipInput").files[0];
    const schoolName = isCustom ? customName : selected.schoolName;
    pendingSubmission = {
      schoolId: isCustom ? "" : selected.schoolId,
      schoolName,
      numberOfTables: tableCount,
      contactName: $("#contactName").value.trim(),
      phone,
      paymentMethod: payment,
      file
    };

    $("#confirmContent").innerHTML = `
      <div class="confirm-item wide"><small>โรงเรียน</small><strong>${safe(schoolName)}</strong></div>
      <div class="confirm-item"><small>จำนวนโต๊ะ</small><strong>${tableCount} โต๊ะ (${tableCount * 8} ที่นั่ง)</strong></div>
      <div class="confirm-item"><small>ยอดที่ต้องชำระ</small><strong>${money(tableCount * APP_CONFIG.TABLE_PRICE)}</strong></div>
      <div class="confirm-item"><small>ผู้ติดต่อ</small><strong>${safe(pendingSubmission.contactName)}</strong></div>
      <div class="confirm-item"><small>เบอร์โทรศัพท์</small><strong>${phone}</strong></div>
      <div class="confirm-item wide"><small>วิธีชำระเงิน</small><strong>${payment === "transfer" ? `โอนเงิน · แนบสลิปแล้ว (${safe(file.name)})` : "เงินสด · ชำระกับผู้ประสานงาน"}</strong></div>
      ${payment === "transfer" ? `<div class="confirm-slip"><small>ตัวอย่างสลิป</small><img src="${$("#slipPreview").src}" alt="สลิปโอนเงินของ ${safe(schoolName)}"></div>` : ""}`;
    $("#confirmDialog").showModal();
  };

  $("#confirmSubmission").onclick = async () => {
    if (!pendingSubmission) return;
    const button = $("#confirmSubmission");
    const form = $("#surveyForm");
    setButtonLoading(button, true, "กำลังส่งข้อมูล…");
    try {
      const submission = pendingSubmission;
      const result = await API.call("submitResponse", {
        schoolId: submission.schoolId,
        schoolName: submission.schoolName,
        numberOfTables: submission.numberOfTables,
        contactName: submission.contactName,
        phone: submission.phone,
        paymentMethod: submission.paymentMethod,
        slip: await fileData(submission.file)
      });
      $("#confirmDialog").close();
      $("#successSchool").textContent = result.schoolName;
      $("#receiptId").textContent = result.id;
      $("#successDialog").showModal();
      form.reset();
      pendingSubmission = null;
      tableCount = 1;
      updateCount();
      $("#transferSection").hidden = true;
      $("#customSchool").hidden = true;
      $("#slipPreview").hidden = true;
      await addOtherSchoolOption();
    } catch (error) {
      toast(error.message);
    } finally {
      setButtonLoading(button, false);
    }
  };

  async function loadAdminSlip(row) {
    const container = $("#adminSlipPreview");
    if (!container) return;
    if (!row.hasSlip) {
      container.innerHTML = '<div class="slip-unavailable">ไม่มีสลิปแนบกับรายการนี้</div>';
      return;
    }
    container.innerHTML = loadingPanel("กำลังโหลดสลิป…");
    try {
      const slip = await API.call("getSlip", { token, id: row.id });
      if (!$("#detailDialog").open || $("#detailDialog").dataset.recordId !== row.id) return;
      const image = document.createElement("img");
      image.alt = `สลิปโอนเงินของ ${row.schoolName}`;
      image.src = `data:${slip.mimeType};base64,${slip.data}`;
      container.replaceChildren(image);
    } catch (error) {
      container.innerHTML = '<div class="slip-unavailable">ไม่สามารถโหลดสลิปได้</div>';
      toast(error.message);
    }
  }

  openDetail = function (id) {
    const row = adminRows.find(item => item.id === id);
    if (!row) return;
    const dialog = $("#detailDialog");
    dialog.dataset.recordId = id;
    $("#detailContent").innerHTML = `<span class="eyebrow">รายละเอียดรายการ</span><h2>${safe(row.schoolName)}</h2><div class="detail-grid"><div><small>ผู้ติดต่อ</small><b>${safe(row.contactName)}</b></div><div><small>โทรศัพท์</small><b>${safe(row.phone)}</b></div><div><small>จำนวนโต๊ะ</small><b>${row.numberOfTables} โต๊ะ</b></div><div><small>ยอดชำระ</small><b>${money(row.amount)}</b></div><div><small>วิธีชำระ</small><b>${row.paymentMethod === "transfer" ? "โอนเงิน" : "เงินสด"}</b></div><div><small>สถานะ</small><b>${labels[row.paymentStatus]}</b></div></div>${row.paymentMethod === "transfer" ? '<div class="admin-slip"><small>สลิปโอนเงิน</small><div id="adminSlipPreview"></div></div>' : ""}<div class="status-actions"><button class="paid" data-status="PAID">✓ ชำระแล้ว</button><button class="pending" data-status="PENDING">รอตรวจสอบ</button><button class="unpaid" data-status="UNPAID">ยังไม่ชำระ</button></div>`;
    $$('[data-status]').forEach(button => button.onclick = async () => {
      const buttons = $$('[data-status]');
      buttons.forEach(item => item.disabled = true);
      setButtonLoading(button, true, "กำลังบันทึก…");
      try {
        await API.call("updatePaymentStatus", { token, id, status: button.dataset.status });
        dialog.close();
        await showAdmin();
        toast("อัปเดตสถานะแล้ว");
      } catch (error) {
        toast(error.message);
        buttons.forEach(item => item.disabled = false);
        setButtonLoading(button, false);
      }
    });
    dialog.showModal();
    if (row.paymentMethod === "transfer") loadAdminSlip(row);
  };

  addOtherSchoolOption();
})();
