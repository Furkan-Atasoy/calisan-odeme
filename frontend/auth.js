// auth.js - giriş kontrolü ve çıkış işlemi

// Kullanıcı bilgisi kontrolü
const user = JSON.parse(localStorage.getItem('user'));
if (!user) {
  window.location.href = 'login.html';
} else {
  console.log("Aktif kullanıcı:", user.username, "-", user.rol);
}

// Çıkış butonu olayı
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('user');
    window.location.href = 'login.html';
  });
}
