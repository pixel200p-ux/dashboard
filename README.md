# Portfolio Manager

Sổ cái danh mục thuần tài sản (Asset-Only Ledger) + Trade T+.

- Original Capital chỉ đổi qua **Nạp / Rút vốn gốc** trên Dashboard
- NAV = DCDS + ETF + Stock + Crypto + Bank đang hiệu lực
- Trade T+ (Stock VPS/SSI, Crypto): khớp bán thủ công; lãi COMPLETED mới hạ giá vốn gốc
- Bank: nhiều sổ, tên tùy chọn, đáo hạn / tái tục
- UI tiếng Việt, từ khóa giữ nguyên: Dashboard, Stock, ETF, Crypto, DCDS, Bank, Buy, Sell

## Chạy local

```bash
npm install
npm run dev
```

Mở app tại cổng mà Vite in ra (mặc định 8080).

## Production

Cần `DATABASE_URL` (Postgres / Neon). Khi deploy trên Vercel, khai báo các biến
ở **Project Settings -> Environment Variables** cho Production (và Preview nếu
cần test preview):

```text
DATABASE_URL=postgres://...
BETTER_AUTH_URL=https://ten-mien-production-cua-ban.vercel.app
BETTER_AUTH_SECRET=<chuoi-ngau-nhien-dai>
VITE_AUTH_ENABLED=true
GROK_AUTH_ISSUER=https://...
GROK_AUTH_CLIENT_ID=...
GROK_AUTH_CLIENT_SECRET=...
```

`BETTER_AUTH_URL` phải là origin đầy đủ, không có dấu `/` cuối, và phải đúng
URL mà người dùng mở. Sau khi đổi domain, cập nhật biến này rồi redeploy.
Code cũng tự tin các URL runtime của Vercel (`VERCEL_URL`, `VERCEL_BRANCH_URL`
và `VERCEL_PROJECT_PRODUCTION_URL`) để các deployment preview không bị lỗi
`Invalid origin`.

Auth (Google, X, email) dùng biến môi trường Better Auth — không commit file `.env`.
Trong trang cấu hình broker OAuth, callback URL cần trỏ tới:
`https://<domain>/api/auth/oauth2/callback/<providerId>`.

```bash
npm run build
```

Sổ cái dùng chung cho mọi tài khoản đã đăng nhập. Không seed dữ liệu giả.

## Spec

Xem [attachments/PORTFOLIO_SPEC_new.md](attachments/PORTFOLIO_SPEC_new.md) (v3.0).
