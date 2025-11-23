document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const usernameError = document.getElementById('usernameError');
  const passwordError = document.getElementById('passwordError');
  const formNotice = document.getElementById('formNotice');
  const submitButton = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    if (!validate(username, password)) return;
    await handleLogin(username, password);
  });

  function clearErrors() {
    usernameError.textContent = '';
    passwordError.textContent = '';
    formNotice.textContent = '';
    formNotice.className = 'notice';
  }

  function validate(username, password) {
    let valid = true;
    if (!username) {
      usernameError.textContent = 'Please enter a username.';
      valid = false;
    }
    if (!password) {
      passwordError.textContent = 'Please enter a password.';
      valid = false;
    } else if (password.length < 6) {
      passwordError.textContent = 'Password must be at least 6 characters.';
      valid = false;
    }
    return valid;
  }

  async function handleLogin(username, password) {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Login failed');
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      formNotice.textContent = 'Login successful. Redirecting...';
      formNotice.className = 'notice success';
      setTimeout(() => {
        window.location.href = 'new hom page 3.html';
      }, 1200);
    } catch (err) {
      console.error('Login error', err);
      formNotice.textContent = err.message || 'Unable to login.';
      formNotice.className = 'notice error';
    } finally {
      setLoading(false);
    }
  }

  function setLoading(isLoading) {
    submitButton.textContent = isLoading ? 'Signing in...' : 'Sign in';
    submitButton.disabled = isLoading;
  }

  usernameInput.addEventListener('input', () => (usernameError.textContent = ''));
  passwordInput.addEventListener('input', () => (passwordError.textContent = ''));
});
