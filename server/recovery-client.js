document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('recoveryForm');
  const notice = document.getElementById('recoveryNotice');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    notice.textContent = '';
    const username = document.getElementById('username').value.trim();
    const favouriteBook = document.getElementById('favBook').value.trim();
    const bestSubject = document.getElementById('bestSubject').value.trim();

    if (!username || !favouriteBook || !bestSubject) {
      notice.textContent = 'All fields are required.';
      notice.className = 'notice error';
      return;
    }

    try {
      const res = await fetch('/api/recovery/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, favouriteBook, bestSubject }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not verify answers.');
      }
      notice.textContent = 'Answers verified. Redirecting to reset...';
      notice.className = 'notice success';
      const params = new URLSearchParams({
        token: data.resetToken,
        username,
      });
      setTimeout(() => {
        window.location.href = `reset.html?${params.toString()}`;
      }, 800);
    } catch (err) {
      notice.textContent = err.message;
      notice.className = 'notice error';
    }
  });
});
