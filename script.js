// --- AYARLAR ---
const API_URL = 'http://localhost:5500/api';

// --- HTML ELEMENTLERİNİ SEÇME ---
const loadingIndicator = document.getElementById('loading-indicator');
const mainContent = document.getElementById('main-content');
// Formlar
const cariForm = document.getElementById('cari-form');
const employeeForm = document.getElementById('employee-form');
const paymentForm = document.getElementById('payment-form');
// Arama Formları
const paymentSearchForm = document.getElementById('payment-search-form');
const cariSearchForm = document.getElementById('cari-search-form');
// Listeler ve Tablolar
const paymentsTableBody = document.getElementById('payments-table-body');
const carilerList = document.getElementById('cariler-list');
// Seçim Kutuları
const employeeCariSelect = employeeForm.querySelector('select[name="cariId"]');
const paymentEmployeeSelect = paymentForm.querySelector('select[name="employeeId"]');
// Modal
const cariDetailModal = document.getElementById('cari-detail-modal');
const modalBody = document.getElementById('modal-body');
const modalCloseBtn = document.getElementById('modal-close-btn');

// --- OLAY DİNLEYİCİLERİ ---
document.addEventListener('DOMContentLoaded', () => {
    // Tarih alanını bugünün tarihiyle doldur
    paymentForm.querySelector('input[name="tarih"]').value = new Date().toISOString().split('T')[0];
    fetchData(); // Sayfa yüklendiğinde verileri çek
});
// Form gönderme olayları
cariForm.addEventListener('submit', handleFormSubmit);
employeeForm.addEventListener('submit', handleFormSubmit);
paymentForm.addEventListener('submit', handleFormSubmit);
// Arama olayları
paymentSearchForm.addEventListener('submit', handleSearch);
cariSearchForm.addEventListener('submit', handleSearch);
paymentSearchForm.addEventListener('reset', () => fetchDataFor('payment', null, renderPayments));
cariSearchForm.addEventListener('reset', () => fetchDataFor('cari', null, renderCariler));
// Modal kapatma olayları
modalCloseBtn.addEventListener('click', () => cariDetailModal.style.display = 'none');
cariDetailModal.addEventListener('click', (event) => {
    if (event.target === cariDetailModal) {
        cariDetailModal.style.display = 'none';
    }
});


// --- ANA FONKSİYONLAR ---
async function fetchData() {
    mainContent.style.display = 'none';
    loadingIndicator.style.display = 'block';
    try {
        const [cariler, employees, payments] = await Promise.all([
            fetchDataFor('cari', null, renderCariler),
            fetchDataFor('employee'),
            fetchDataFor('payment', null, renderPayments)
        ]);
        populateSelects(cariler, employees);
    } catch (error) {
        console.error("Ana veri çekme hatası:", error);
        alert("Sunucudan veri alınamadı. Backend'in çalıştığından emin olun.");
    } finally {
        loadingIndicator.style.display = 'none';
        mainContent.style.display = 'block';
    }
}

async function fetchDataFor(type, params = null, renderer = null) {
    let url = params ? `${API_URL}/${type}/search?${params}` : `${API_URL}/${type}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP hata! Durum: ${response.status}`);
        const data = await response.json();
        if (renderer) renderer(data);
        return data;
    } catch (error) {
        console.error(`${type} verisi çekilirken hata:`, error);
        return [];
    }
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const endpoint = form.id.replace('-form', '');

    try {
        // Ödeme formunda, çalışana göre cariId'yi otomatik bul ve ekle
        if (endpoint === 'payment') {
            const selectedEmployee = paymentEmployeeSelect.options[paymentEmployeeSelect.selectedIndex];
            const allEmployees = await fetchDataFor('employee');
            const employeeData = allEmployees.find(emp => emp.employeeId == selectedEmployee.value);
            if (employeeData) {
                data.cariId = employeeData.cariId;
            }
        }

        const response = await fetch(`${API_URL}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || result.error || 'Bir hata oluştu.');
        alert(result.message);
        form.reset();
        fetchData();
    } catch (error) {
        alert(`Hata: ${error.message}`);
    }
}

async function handleSearch(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
        if (value) params.append(key, value);
    }
    const type = form.id.includes('payment') ? 'payment' : 'cari';
    const renderer = type === 'payment' ? renderPayments : renderCariler;
    await fetchDataFor(type, params, renderer);
}

async function showCariDetails(cariId) {
    try {
        modalBody.innerHTML = '<p>Yükleniyor...</p>';
        cariDetailModal.style.display = 'flex';
        const [cari, employees] = await Promise.all([
            fetch(`${API_URL}/cari/${cariId}`).then(res => res.json()),
            fetch(`${API_URL}/employee/byCari/${cariId}`).then(res => res.json())
        ]);
        if (cari.message) throw new Error(cari.message);
        let content = `<h3>Cari Detayları</h3>
            <p><b>Kod:</b> ${cari.cariKod}</p><p><b>Unvan:</b> ${cari.unvan}</p>
            <p><b>IBAN:</b> ${cari.iban || 'N/A'}</p><p><b>Banka:</b> ${cari.bankaAdi || 'N/A'}</p>
            <h3 style="margin-top: 1.5rem;">Bağlı Çalışanlar</h3>`;
        if (employees.length > 0) {
            content += '<ul>';
            employees.forEach(emp => {
                content += `<li style="margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                        <strong>${emp.ad} ${emp.soyad}</strong>
                        <div style="font-size: 0.9em; color: #555;">
                            <span>Departman: ${emp.departman || 'N/A'}</span> | 
                            <span>Pozisyon: ${emp.pozisyon || 'N/A'}</span> | 
                            <span>TC No: ${emp.tcNo || 'N/A'}</span>
                        </div>
                    </li>`;
            });
            content += '</ul>';
        } else {
            content += '<p>Bu cariye bağlı çalışan bulunamadı.</p>';
        }
        modalBody.innerHTML = content;
    } catch (error) {
        modalBody.innerHTML = `<p>Detaylar yüklenirken bir hata oluştu: ${error.message}</p>`;
    }
}

// --- RENDER (EKRANA ÇİZME) FONKSİYONLARI ---
function renderPayments(payments) {
    paymentsTableBody.innerHTML = '';
    if (payments.length === 0) {
        paymentsTableBody.innerHTML = '<tr><td colspan="6">Kayıt bulunamadı.</td></tr>'; return;
    }
    payments.forEach(p => {
        const row = `<tr>
            <td>${p.calisanAdSoyad || 'N/A'}</td>
            <td>${p.odemeTuru || 'N/A'}</td>
            <td><b>${p.netTutar ? p.netTutar.toFixed(2) : '0.00'} TL</b></td>
            <td>${new Date(p.tarih).toLocaleDateString()}</td>
            <td>${p.kasaBankaSecimi || 'N/A'}</td>
            <td>${p.aciklama || '-'}</td>
        </tr>`;
        paymentsTableBody.innerHTML += row;
    });
}

function renderCariler(cariler) {
    carilerList.innerHTML = '';
    if (cariler.length === 0) {
        carilerList.innerHTML = '<li>Kayıt bulunamadı.</li>'; return;
    }
    cariler.forEach(c => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `<b>${c.cariKod}</b> - ${c.unvan}`;
        listItem.dataset.cariId = c.cariId;
        listItem.addEventListener('click', () => showCariDetails(c.cariId));
        carilerList.appendChild(listItem);
    });
}

function populateSelects(cariler, employees) {
    employeeCariSelect.innerHTML = '<option value="">Bağlı Olacağı Cari\'yi Seçin... (*)</option>';
    cariler.forEach(c => { employeeCariSelect.innerHTML += `<option value="${c.cariId}">${c.unvan}</option>`; });
    paymentEmployeeSelect.innerHTML = '<option value="">Çalışan Seçin... (*)</option>';
    employees.forEach(e => { paymentEmployeeSelect.innerHTML += `<option value="${e.employeeId}">${e.ad} ${e.soyad}</option>`; });
}

