/** Google Apps Script backend for the Chinese Table Survey. */
const CONFIG = {
  eventId: 'MUTITAJIT-2569',
  tablePrice: 2200,
  maxTables: 30,
  maxFileBytes: 5 * 1024 * 1024,
  sheets: { schools: 'Schools', responses: 'Responses' },
  responseHeaders: ['id','timestamp','eventId','schoolId','schoolName','numberOfTables','amount','contactName','phone','paymentMethod','slipFileId','slipUrl','paymentStatus','verifiedBy','verifiedAt','updatedAt']
};

function doGet(e) { return route_(e.parameter.action || '', e.parameter); }
function doPost(e) {
  try { const body = JSON.parse(e.postData.contents || '{}'); return route_(body.action || '', body); }
  catch (err) { return json_({ ok: false, error: safeError_(err) }); }
}

function route_(action, p) {
  try {
    const publicRoutes = { getSchools: getSchools_, getPublicStatus: getPublicStatus_, submitResponse: submitResponse_, adminLogin: adminLogin_ };
    if (publicRoutes[action]) return json_({ ok: true, data: publicRoutes[action](p) });
    const token = String(p.token || '');
    if (!validSession_(token)) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    const adminRoutes = { getAdminData: getAdminData_, updatePaymentStatus: updatePaymentStatus_, updateResponse: updateResponse_, getSlip: getSlip_, adminLogout: adminLogout_ };
    if (!adminRoutes[action]) throw new Error('ไม่พบคำสั่งที่ร้องขอ');
    return json_({ ok: true, data: adminRoutes[action](p, token) });
  } catch (err) { return json_({ ok: false, error: safeError_(err) }); }
}

function getSchools_() { return activeSchools_().map(s => ({ schoolId: s.schoolId, schoolName: s.schoolName })); }

function getPublicStatus_() {
  const responses = rows_('Responses');
  return activeSchools_().map(s => {
    const r = responses.find(x => x.schoolId === s.schoolId && x.eventId === CONFIG.eventId);
    return r ? { schoolId:s.schoolId, schoolName:s.schoolName, numberOfTables:+r.numberOfTables, amount:+r.amount, paymentMethod:r.paymentMethod, paymentStatus:r.paymentStatus } : { schoolId:s.schoolId, schoolName:s.schoolName, paymentStatus:'MISSING' };
  });
}

function submitResponse_(p) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const school = activeSchools_().find(s => s.schoolId === String(p.schoolId || ''));
    if (!school) throw new Error('กรุณาเลือกโรงเรียนที่ถูกต้อง');
    const count = Number(p.numberOfTables);
    if (!Number.isInteger(count) || count < 1 || count > CONFIG.maxTables) throw new Error('จำนวนโต๊ะไม่ถูกต้อง');
    const contact = clean_(p.contactName, 120), phone = String(p.phone || '').replace(/\D/g, ''), method = String(p.paymentMethod || '');
    if (!contact) throw new Error('กรุณากรอกชื่อผู้ติดต่อ');
    if (!/^0\d{8,9}$/.test(phone)) throw new Error('เบอร์โทรศัพท์ไม่ถูกต้อง');
    if (!['cash','transfer'].includes(method)) throw new Error('วิธีชำระเงินไม่ถูกต้อง');
    if (method === 'transfer' && !p.slip) throw new Error('กรุณาแนบสลิปโอนเงิน');
    const sheet = sheet_('Responses'), data = sheet.getDataRange().getValues(), headers = data[0], schoolCol = headers.indexOf('schoolId'), eventCol = headers.indexOf('eventId');
    let rowIndex = -1; for (let i=1;i<data.length;i++) if(data[i][schoolCol]===school.schoolId && data[i][eventCol]===CONFIG.eventId){rowIndex=i+1;break;}
    const existing = rowIndex > 0 ? objectFrom_(headers, data[rowIndex-1]) : null;
    const id = existing ? existing.id : nextId_(), slip = p.slip ? saveSlip_(p.slip, school.schoolId, id) : { id: existing ? existing.slipFileId : '', url: existing ? existing.slipUrl : '' }, now = new Date();
    const record = { id, timestamp:existing?existing.timestamp:now, eventId:CONFIG.eventId, schoolId:school.schoolId, schoolName:school.schoolName, numberOfTables:count, amount:count*CONFIG.tablePrice, contactName:contact, phone, paymentMethod:method, slipFileId:method==='transfer'?slip.id:'', slipUrl:method==='transfer'?slip.url:'', paymentStatus:'PENDING', verifiedBy:'', verifiedAt:'', updatedAt:now };
    const values = CONFIG.responseHeaders.map(h => record[h] === undefined ? '' : record[h]);
    if (rowIndex > 0) sheet.getRange(rowIndex,1,1,values.length).setValues([values]); else sheet.appendRow(values);
    return { id, schoolName:school.schoolName, amount:record.amount };
  } finally { lock.releaseLock(); }
}

function adminLogin_(p) {
  const props = PropertiesService.getScriptProperties(), stored = props.getProperty('ADMIN_PASSWORD_HASH');
  if (!stored) throw new Error('ยังไม่ได้ตั้งค่ารหัสผ่านผู้ดูแล');
  const hash = digest_(String(p.password || ''));
  if (!constantEqual_(stored, hash)) throw new Error('รหัสผ่านไม่ถูกต้อง');
  const token = Utilities.getUuid()+Utilities.getUuid(), ttl = 21600;
  CacheService.getScriptCache().put('session_'+token, JSON.stringify({ admin:'admin', created:Date.now() }), ttl);
  return { token, expiresIn:ttl };
}
function validSession_(token){ return !!token && !!CacheService.getScriptCache().get('session_'+token); }
function adminLogout_(p,token){ CacheService.getScriptCache().remove('session_'+token); return true; }

function getAdminData_(){
  const rs=rows_('Responses'); return activeSchools_().map(s=>{const r=rs.find(x=>x.schoolId===s.schoolId&&x.eventId===CONFIG.eventId);return r?Object.assign({},r,{numberOfTables:+r.numberOfTables,amount:+r.amount,slipUrl:undefined,slipFileId:undefined}):{schoolId:s.schoolId,schoolName:s.schoolName,paymentStatus:'MISSING'};});
}
function updatePaymentStatus_(p){
  if(!['PENDING','PAID','UNPAID'].includes(String(p.status)))throw new Error('สถานะไม่ถูกต้อง');
  const sheet=sheet_('Responses'),data=sheet.getDataRange().getValues(),h=data[0],idCol=h.indexOf('id'),statusCol=h.indexOf('paymentStatus');
  for(let i=1;i<data.length;i++)if(data[i][idCol]===p.id){sheet.getRange(i+1,statusCol+1).setValue(p.status);sheet.getRange(i+1,h.indexOf('verifiedBy')+1).setValue('admin');sheet.getRange(i+1,h.indexOf('verifiedAt')+1).setValue(new Date());sheet.getRange(i+1,h.indexOf('updatedAt')+1).setValue(new Date());return true;}throw new Error('ไม่พบรายการ');
}
function updateResponse_(p){ throw new Error('โปรดใช้แบบฟอร์มการแก้ไขข้อมูลเวอร์ชันถัดไป'); }
function getSlip_(p){ const r=rows_('Responses').find(x=>x.id===p.id);if(!r||!r.slipFileId)throw new Error('ไม่พบสลิป');const f=DriveApp.getFileById(r.slipFileId);return{mimeType:f.getMimeType(),data:Utilities.base64Encode(f.getBlob().getBytes())}; }

function saveSlip_(slip,schoolId,id){
  const allowed=['image/jpeg','image/png','image/webp']; if(!slip||!allowed.includes(slip.type))throw new Error('ชนิดไฟล์สลิปไม่ถูกต้อง');
  const bytes=Utilities.base64Decode(slip.data||''); if(bytes.length>CONFIG.maxFileBytes)throw new Error('ไฟล์สลิปมีขนาดเกิน 5 MB');
  const folderId=PropertiesService.getScriptProperties().getProperty('SLIP_FOLDER_ID');if(!folderId)throw new Error('ยังไม่ได้ตั้งค่าโฟลเดอร์สลิป');
  const ext=slip.type.split('/')[1].replace('jpeg','jpg'),name=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd')+'_'+schoolId+'_'+id+'.'+ext;
  const file=DriveApp.getFolderById(folderId).createFile(Utilities.newBlob(bytes,slip.type,name));return{id:file.getId(),url:file.getUrl()};
}
function activeSchools_(){return rows_('Schools').filter(x=>String(x.active).toUpperCase()==='TRUE'||x.active===true).sort((a,b)=>+a.sortOrder-+b.sortOrder);}
function rows_(name){const values=sheet_(name).getDataRange().getValues();if(values.length<2)return[];return values.slice(1).map(r=>objectFrom_(values[0],r));}
function objectFrom_(h,r){return h.reduce((o,k,i)=>(o[k]=r[i],o),{});}
function sheet_(name){const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');if(!id)throw new Error('ยังไม่ได้ตั้งค่า Spreadsheet ID');const s=SpreadsheetApp.openById(id).getSheetByName(name);if(!s)throw new Error('ไม่พบชีต '+name);return s;}
function nextId_(){return 'RESP-'+Utilities.formatString('%04d',sheet_('Responses').getLastRow());}
function clean_(v,max){return String(v||'').trim().replace(/[<>]/g,'').slice(0,max);}
function digest_(v){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,v).map(b=>(b+256)%256).map(b=>('0'+b.toString(16)).slice(-2)).join('');}
function constantEqual_(a,b){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;}
function safeError_(e){return e&&e.message?e.message:'เกิดข้อผิดพลาด กรุณาลองใหม่';}
function json_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}

/** Run once after setting SPREADSHEET_ID. Creates headers and initial schools. */
function setupProject(){
  const ss=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));
  const names=['โรงเรียนหนองพระบางตลาดม่วง','โรงเรียนบ้านเขวาหรดี','โรงเรียนชิโนวาทธำรง','โรงเรียนบ้านเขวาตะคลอง','โรงเรียนบ้านหนองอ่างดอกรัก','โรงเรียนบ้านโพนหิน','โรงเรียนบ้านโพนแท่น','โรงเรียนบ้านนกเหาะ','โรงเรียนบ้านหนองสระหงส์','โรงเรียนทุ่งกุลาประชารัฐ','โรงเรียนบ้านหนองไผ่ลุ่ม','โรงเรียนวัดแจ่มอารมณ์','โรงเรียนบ้านโพนเงินโพนทอง'];
  let s=ss.getSheetByName('Schools')||ss.insertSheet('Schools');s.clear();s.getRange(1,1,1,4).setValues([['schoolId','schoolName','sortOrder','active']]);s.getRange(2,1,names.length,4).setValues(names.map((n,i)=>['SCH'+Utilities.formatString('%03d',i+1),n,i+1,true]));s.setFrozenRows(1);
  let r=ss.getSheetByName('Responses')||ss.insertSheet('Responses');r.clear();r.getRange(1,1,1,CONFIG.responseHeaders.length).setValues([CONFIG.responseHeaders]);r.setFrozenRows(1);
}

/** Run manually once with your desired password, then remove the literal from execution history if desired. */
function setAdminPassword(password){if(!password||password.length<8)throw new Error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD_HASH',digest_(password));}
