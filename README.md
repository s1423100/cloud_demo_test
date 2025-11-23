## Project Info
- Project name: Eat Around
- Course code: comp3810sef / comp3811f
- Group info: _fill in group number, names, SIDs_

## Project File Intro
- `server.js`: Express server; auth (register/login/recovery), food listing, orders checkout, orders summary/delete.
- `package.json`: dependencies (`express`, `mongoose`, `bcrypt`, `jsonwebtoken`, etc.) and scripts.
- Frontend pages (served statically from the project root):
  - `login.html` (+ `login.js`, `login.css`)
  - `forget.html` / `reset.html` (+ `recovery-client.js`, `reset-client.js`)
  - `new hom page 3.html` (main menu/cart UI) + `home.js`, `home.css`
  - `payment.html` (payment choices and final “pay” action)
- Assets: `WeChat-Pay.png`, `OIP.webp`, `LOGO.png`, `T1.png`
- Note: no `views/` or `models/` folders are used; static files live at the project root.

## Cloud-based Server URL
- If deployed, put the cloud URL here: `http://<your-host>:3000/`
- Local run: `npm install` then `node server.js`, default `http://localhost:3000/`

## Operation Guides (user flow)
- Login/Logout:
  - Open `login.html`, submit username/password to `/api/auth/login`.
  - Token is stored in localStorage; “Log out” clears it.
- Food menu & cart:
  - `new hom page 3.html` loads foods from `/api/foods`.
  - Click foods to add to cart; adjust quantities in the cart modal.
  - “Confirm” in cart calls `POST /api/orders` (requires token) to place an order.
- Pay (order summary + clear):
  - “Pay” in the main page shows orders via `/api/orders/summary`.
  - `payment.html`: select a payment option, click Pay → `DELETE /api/orders`, show success, redirect home.
- Recovery:
  - `forget.html` → `/api/recovery/verify` → `reset.html` → `PUT /api/recovery/reset`.

## API Quick Reference (local defaults)
- `POST /api/auth/register` `{ username|name, email?, password }`
- `POST /api/auth/login` `{ username|name, password }` → `token`
- `GET /api/foods`
- `POST /api/orders` (auth) `{ items: [{ name, price, quantity }] }`
- `GET /api/orders/mine` (all orders, no auth)
- `GET /api/orders/summary` (all orders with totals, no auth)
- `DELETE /api/orders` (clears all orders, no auth)

## Notes
- Ensure `MONGO_URI`, `MONGO_DB`, `JWT_SECRET` are set in `.env` (see `.env.example`).
- If you deploy, update `API_BASE` in `home.js`/`payment.html` to match the deployed host.
- Replace placeholder group info above before submission.
