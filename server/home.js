const API_BASE =
  window.location.protocol === 'file:' || window.location.origin === 'null'
    ? 'http://localhost:3000'
    : window.location.origin;

const state = {
  activeCategory: '',
  selectedLocation: '',
  foods: [],
  categories: {},
  cart: [],
};

function $(id) {
  return document.getElementById(id);
}

function deriveCategories(foods) {
  const map = {};
  foods.forEach((f) => {
    const key = (f.category || '').trim() || 'all';
    map[key] = map[key] || { name: key === 'all' ? 'All items' : key.charAt(0).toUpperCase() + key.slice(1) };
  });
  return Object.keys(map).length ? map : { all: { name: 'All items' } };
}

async function loadFoods() {
  try {
    const res = await fetch(`${API_BASE}/api/foods`);
    if (!res.ok) throw new Error('Failed to load menu');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Unable to load menu');
    const foods = Array.isArray(data.foods) ? data.foods : [];
    state.foods = foods;
    state.categories = deriveCategories(foods);
    renderCategories();
    const first = Object.keys(state.categories)[0];
    if (first) {
      showFoods(first);
      setActiveCategory(first);
    } else {
      $('foodCategoryTitle').textContent = 'Menu';
      $('foodsGrid').innerHTML = '<div class="empty">No foods available.</div>';
    }
  } catch (err) {
    console.error(err);
    $('foodCategoryTitle').textContent = 'Menu';
    $('foodsGrid').innerHTML = '<div class="empty">Unable to load menu.</div>';
  }
}

function renderCategories() {
  const container = $('categoryScroll');
  container.innerHTML = '';
  Object.entries(state.categories).forEach(([key, category]) => {
    const div = document.createElement('div');
    div.className = 'category-item';
    div.dataset.category = key;
    div.textContent = category.name;
    div.addEventListener('click', () => {
      showFoods(key);
      setActiveCategory(key);
    });
    container.appendChild(div);
  });
}

function setActiveCategory(category) {
  document.querySelectorAll('.category-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.category === category);
  });
  state.activeCategory = category;
}

function showFoods(category) {
  const foods =
    category === 'all'
      ? state.foods
      : state.foods.filter((f) => ((f.category || '').trim() || 'all') === category);
  $('foodCategoryTitle').textContent = state.categories[category]?.name || 'Menu';
  const grid = $('foodsGrid');
  grid.innerHTML = '';
  if (!foods.length) {
    grid.innerHTML = '<div class="empty">No items in this category.</div>';
    return;
  }
  foods.forEach((food) => {
    const card = document.createElement('div');
    card.className = 'food-card';
    const desc = food.description ? `<div class="food-desc">${food.description}</div>` : '';
    card.innerHTML = `
      <div class="food-name">${food.name || 'Unnamed item'}</div>
      ${desc}
      <div class="food-price">$${Number(food.price || 0).toFixed(2)}</div>
    `;
    card.addEventListener('click', () => addToCart(food));
    grid.appendChild(card);
  });
}

function addToCart(food) {
  const idx = state.cart.findIndex((i) => i.name === food.name);
  if (idx >= 0) {
    state.cart[idx].quantity += 1;
  } else {
    state.cart.push({ name: food.name, price: Number(food.price) || 0, quantity: 1 });
  }
  renderCart();
  showCartMessage(`${food.name} added to cart.`);
}

function setupLocationModal() {
  const modal = $('locationModal');
  const input = $('locationInput');
  const display = $('currentLocation');
  $('closeModal').addEventListener('click', () => toggleModal(false));
  $('cancelLocation').addEventListener('click', () => toggleModal(false));
  $('confirmLocation').addEventListener('click', () => {
    const value = input.value.trim();
    if (!value) return alert('Please enter a location.');
    state.selectedLocation = value;
    display.textContent = `Current location: ${value}`;
    toggleModal(false);
  });
  document.querySelectorAll('.suggestion-item').forEach((item) => {
    item.addEventListener('click', () => {
      input.value = item.dataset.location;
      state.selectedLocation = item.dataset.location;
    });
  });
  document.querySelector('.location-btn').addEventListener('click', () => {
    toggleModal(true);
    input.focus();
  });

  function toggleModal(isOpen) {
    modal.style.display = isOpen ? 'flex' : 'none';
    if (!isOpen) input.value = '';
  }

  window.addEventListener('click', (e) => {
    if (e.target === modal) toggleModal(false);
  });
}

function bindFooterActions() {
  const loginBtn = document.querySelector('.login-btn');
  const updateAuthButton = () => {
    const hasToken = Boolean(localStorage.getItem('token'));
    loginBtn.textContent = hasToken ? 'Log out' : 'Sign in';
  };

  loginBtn.addEventListener('click', () => {
    const hasToken = Boolean(localStorage.getItem('token'));
    if (hasToken) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      updateAuthButton();
      window.location.href = 'login.html';
    } else {
      window.location.href = 'login.html';
    }
  });
  updateAuthButton();

  const cartBtn = document.getElementById('cartBtn');
  const payBtn = document.getElementById('payBtn');
  if (cartBtn) {
    cartBtn.addEventListener('click', () => toggleCart(true));
  }
  if (payBtn) {
    payBtn.addEventListener('click', payAndSummarize);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!ensureLoggedIn()) return;
  loadFoods();
  setupLocationModal();
  bindFooterActions();
  document.getElementById('closeCart').addEventListener('click', () => toggleCart(false));
  document.getElementById('cancelCart').addEventListener('click', () => toggleCart(false));
  document.getElementById('confirmCart').addEventListener('click', submitOrder);
  document.getElementById('cartItems').addEventListener('click', handleCartClick);
  const toast = document.getElementById('toast');
  if (toast) toast.classList.remove('show');
});

function ensureLoggedIn() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

function toggleCart(isOpen) {
  const modal = document.getElementById('cartModal');
  modal.style.display = isOpen ? 'flex' : 'none';
  if (isOpen) renderCart();
}

function renderCart() {
  const container = document.getElementById('cartItems');
  const totalEl = document.getElementById('cartTotal');
  const notice = document.getElementById('cartNotice');
  container.innerHTML = '';
  notice.textContent = '';
  let total = 0;
  if (!state.cart.length) {
    container.innerHTML = '<div class="cart-row">Cart is empty.</div>';
    totalEl.textContent = 'Total: $0.00';
    return;
  }
  state.cart.forEach((item) => {
    total += item.price * item.quantity;
    const row = document.createElement('div');
    row.className = 'cart-row';
    row.innerHTML = `
      <div class="cart-name">${item.name}</div>
      <div class="cart-controls" data-name="${item.name}">
        <button class="cart-btn qty-dec" data-name="${item.name}">-</button>
        <span class="cart-qty">x${item.quantity}</span>
        <button class="cart-btn qty-inc" data-name="${item.name}">+</button>
        <button class="cart-btn qty-del" data-name="${item.name}">Remove</button>
      </div>
      <div class="cart-price">$${(item.price * item.quantity).toFixed(2)}</div>
    `;
    container.appendChild(row);
  });
  totalEl.textContent = `Total: $${total.toFixed(2)}`;
}

async function submitOrder() {
  const notice = document.getElementById('cartNotice');
  notice.textContent = '';
  const token = localStorage.getItem('token');
  if (!token) {
    notice.textContent = 'Please sign in to place an order.';
    notice.className = 'notice error';
    setTimeout(() => (window.location.href = 'login.html'), 800);
    return;
  }
  if (!state.cart.length) {
    notice.textContent = 'Cart is empty.';
    notice.className = 'notice error';
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ items: state.cart }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Unable to place order');
    }
    notice.textContent = `Order placed! Code: ${data.code}`;
    notice.className = 'notice success';
    state.cart = [];
    renderCart();
    toggleCart(false);
  } catch (err) {
    notice.textContent = err.message || 'Unable to place order';
    notice.className = 'notice error';
  }
}

function handleCartClick(e) {
  const name = e.target.getAttribute('data-name');
  if (!name) return;
  const item = state.cart.find((i) => i.name === name);
  if (!item) return;
  if (e.target.classList.contains('qty-inc')) {
    item.quantity += 1;
  } else if (e.target.classList.contains('qty-dec')) {
    item.quantity -= 1;
    if (item.quantity <= 0) {
      state.cart = state.cart.filter((i) => i.name !== name);
    }
  } else if (e.target.classList.contains('qty-del')) {
    state.cart = state.cart.filter((i) => i.name !== name);
  }
  renderCart();
}

function showCartMessage(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1200);
}

async function payAndSummarize() {
  try {
    const res = await fetch(`${API_BASE}/api/orders/summary`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Unable to load orders');
    }
    const orders = Array.isArray(data.orders) ? data.orders : [];
    const totalSum = Number(data.totalSum || 0);
    localStorage.setItem('orderSummary', JSON.stringify(orders));
    showCartMessage(`Orders total: $${totalSum.toFixed(2)}`);
  } catch (err) {
    showCartMessage(err.message || 'Unable to load orders');
  }
}
