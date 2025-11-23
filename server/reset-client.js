function getToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get('token') || '';
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('resetForm');
  const newPw = document.getElementById('newPassword');
  const confirmPw = document.getElementById('confirmPassword');
  const newPwError = document.getElementById('newPwError');
  const confirmPwError = document.getElementById('confirmPwError');
  const notice = document.getElementById('formNotice');
  const token = getToken();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors();
    const p1 = newPw.value;
    const p2 = confirmPw.value;

    if (!p1 || p1.length < 6) {
      newPwError.textContent = 'Password must be at least 6 characters.';
      return;
    }
    if (p1 !== p2) {
      confirmPwError.textContent = 'Passwords do not match.';
      return;
    }
    if (!token) {
      notice.textContent = 'Missing reset token. Please restart recovery.';
      notice.className = 'notice error';
      return;
    }

    try {
      const res = await fetch('/api/recovery/reset', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: p1 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Reset failed');
      }
      notice.textContent = 'Password reset. Redirecting to login...';
      notice.className = 'notice success';
      setTimeout(() => (window.location.href = 'login.html'), 1000);
    } catch (err) {
      notice.textContent = err.message;
      notice.className = 'notice error';
    }
  });

  function clearErrors() {
    newPwError.textContent = '';
    confirmPwError.textContent = '';
    notice.textContent = '';
    notice.className = 'notice';
  }
});
