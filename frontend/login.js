const API_URL = 'http://localhost:5500/api';
const form = document.getElementById('login-form');
const msg = document.getElementById('login-message');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message);

    localStorage.setItem('user', JSON.stringify(result.user));
    window.location.href = 'index.html';
  } catch (err) {
    msg.textContent = err.message;
  }
});
