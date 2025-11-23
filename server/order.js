function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function text(id, value, placeholder = '--') {
  const el = document.getElementById(id);
  if (el) el.textContent = value || placeholder;
}

function renderItems(items) {
  const container = document.getElementById('order-items');
  container.innerHTML = '';
  if (!items || items.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No items yet.';
    container.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'order-item';
    row.innerHTML = `
      <span class="item-name">${item.name}</span>
      <span class="item-price">$${formatCurrency(item.price * (item.quantity || 1))}</span>
      <span class="item-quantity">x${item.quantity || 1}</span>
    `;
    container.appendChild(row);
  });
}

async function loadOrder() {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('id');

  if (!orderId) {
    text('order-code', 'Not provided');
    renderItems([]);
    return;
  }

  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
    if (!res.ok) throw new Error('Order not found');
    const data = await res.json();
    const order = data.order;

    text('order-code', order.code || order._id);
    text('shop-location', order.shopLocation);
    text('order-time', new Date(order.orderedAt).toLocaleString());
    text('customer-notes', order.customerNotes);
    renderItems(order.items || []);
    text('order-total', formatCurrency(order.total));
  } catch (err) {
    console.error('Could not load order', err);
    text('order-code', orderId);
    text('shop-location', '--');
    text('order-time', '--');
    text('customer-notes', '--');
    renderItems([]);
    text('order-total', formatCurrency(0));
  }
}

function bindPaymentButton() {
  const button = document.querySelector('.payment-confirm-button');
  if (!button) return;
  button.addEventListener('click', () => {
    const orderId = document.getElementById('order-code')?.textContent || '';
    alert(`Payment confirmed for order ${orderId || ''}`.trim());
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadOrder();
  bindPaymentButton();
});
