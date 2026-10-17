# Portfolio Manager

Sổ cái danh mục thuần tài sản (Asset-Only Ledger) + Trade T+.

- Original Capital chỉ đổi qua **Nạp / Rút vốn gốc** trên Dashboard
- NAV = DCDS + ETF + Stock + Crypto (bao gồm số dư USDT nhập thủ công) + Bank đang hiệu lực
- Số dư USDT chỉ cộng vào NAV và P&L NAV − Original, không có giá vốn/giao dịch/T+
- Trade T+ (Stock VPS/SSI, Crypto): khớp bán thủ công; lãi COMPLETED mới hạ giá vốn gốc
- Bank: nhiều sổ, tên tùy chọn, đáo hạn / tái tục
- UI tiếng Việt, từ khóa giữ nguyên: Dashboard, Stock, ETF, Crypto, DCDS, Bank, Buy, Sell

## Sự kiện cổ tức / GDKHQ

Trong form giao dịch Stock, chọn **Ngày GDKHQ** để nhập hoặc sửa sự kiện cổ tức
tiền mặt, cổ tức cổ phiếu hoặc quyền mua. Ngày GDKHQ phải được nhập theo thông
báo chính thức của doanh nghiệp/VSDC; ứng dụng chưa tự tra cứu hoặc đồng bộ ngày.
Sự kiện được đưa tự động lên Calendar sau khi nhập.

Sự kiện là nguồn duy nhất để ghi nhận cổ tức mới; không tạo thêm giao dịch cổ
tức tiền mặt/cổ phiếu. Cổ tức tiền mặt được tính gộp theo lượng nắm giữ trước
GDKHQ nhân tỷ lệ trên mệnh giá 10.000đ/cổ phiếu; số này là trước thuế và chưa
đối chiếu khoản tiền thực nhận. Cổ tức cổ phiếu làm tăng lượng cổ phiếu đủ điều
kiện, làm tròn xuống riêng theo từng broker và giữ nguyên tổng giá vốn của lô.
Các khoản cổ tức giao dịch cũ vẫn được giữ để xem/sửa/xóa; khoản cũ gắn với sự
kiện (hoặc cùng ngày thanh toán đã nhập) không bị tính hai lần. Không tạo thêm
khoản giao dịch cổ tức mới.

Với quyền mua, nhập tỷ lệ quyền, giá mua ưu đãi và số lượng thực đăng ký riêng
cho VPS/SSI. Số đăng ký không được vượt quyền ước tính tại GDKHQ. Cổ phiếu mua
thêm và giá vốn tương ứng được cộng vào danh mục từ ngày thanh toán (hoặc ngày
GDKHQ nếu chưa nhập ngày thanh toán); giá vốn mới là bình quân trọng số của cổ
phiếu đang giữ và lượng mua thêm. Sự kiện có dòng riêng trong Reports và chỉ
được hiển thị (không sửa/xóa) trên Calendar.

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

### Pixel AI

Pixel dùng chung API key (được giữ mã hóa trên server), quy tắc, ghi nhớ và lịch
sử hội thoại giữa tất cả tài khoản đăng nhập. Mọi tài khoản đều có thể sửa/xóa
các mục dùng chung và dùng quota của key; lịch sử chat cũng hiển thị cho mọi
tài khoản. Mọi nội dung hội thoại, ghi nhớ và kết quả danh mục được gửi tới
nhà cung cấp AI khi Pixel cần chúng để trả lời; không nhập dữ liệu bí mật cá
nhân nếu không muốn chia sẻ với nhà cung cấp.

Để lưu API key AI, cấu hình thêm `PIXEL_KEY_ENCRYPTION_SECRET` trong môi trường
server. Tạo secret bằng Node.js:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Giữ bí mật và sao lưu giá trị này an toàn. Không đặt tiền tố `VITE_` và không
đưa secret vào mã nguồn: ứng dụng dùng nó để mã hóa API key bằng AES-256-GCM.
Nếu mất hoặc thay secret mà chưa giải mã/mã hóa lại các key hiện có, các key đó
không thể đọc được nữa. Khi chạy local, đặt biến này trong `.env`; trên Vercel,
khai báo cho Production và Preview cần dùng rồi redeploy ứng dụng.

Pixel thử các API key còn hoạt động hoặc chưa kiểm tra theo thứ tự đã thêm; nếu
một key/provider lỗi, nó mới chuyển sang key kế tiếp. Đây là dự phòng khi lỗi,
không phải luân phiên để né quota, giới hạn tốc độ hay chi phí của nhà cung cấp.
Pixel chỉ đề xuất ghi nhớ khi tin nhắn có ý định rõ ràng (ví dụ “hãy nhớ”,
“tôi thích”, “luôn luôn”); nội dung chỉ được lưu sau khi người dùng xác nhận.

Thêm key **Tavily Search** và **Jina Reader** trong Cài đặt Pixel để bật tra
cứu web. Với câu hỏi thời sự/cổ tức, Pixel dùng Tavily tìm tối đa 5 kết quả,
sau đó dùng Jina Reader đọc tối đa 2 trang đầu; nếu Tavily không trả kết quả
hoặc gặp lỗi, Jina Search được dùng làm phương án dự phòng. Câu trả lời có liên
kết nguồn. Pixel chỉ tìm khi câu hỏi có dấu hiệu cần thông tin mới; không chạy
crawler nền hoặc gửi cảnh báo cổ tức tự động.

Khi câu hỏi liên quan đến danh mục, Pixel nhận toàn bộ vị thế hiện tại, các sổ
ngân hàng, lịch sử cổ tức, tối đa 50 giao dịch T+ đã chốt và 50 giao dịch gần
nhất để phân tích; các câu hỏi không liên quan không gửi ảnh chụp danh mục.
Dữ liệu liên quan và tối đa 12 tin nhắn gần nhất được gửi tới nhà cung cấp AI
đã cấu hình. Gợi ý trade là phân tích tham khảo, không phải lệnh giao dịch hay
bảo đảm lợi nhuận.

Các lượt gọi có thể dùng hạn mức miễn phí của nhà cung cấp nhưng không được đảm
bảo 0 đồng vĩnh viễn. Tavily Search cơ bản tiêu thụ credit; Jina Reader/Search
dùng hạn mức token/credit của Jina; nhà cung cấp AI cũng có thể tính theo token.
Tra cứu web chỉ chạy khi được kích hoạt bởi câu hỏi và mỗi lần thường gọi 1
lượt Tavily cùng tối đa 2 lượt đọc Jina. Kiểm tra API key cũng tạo request.
Theo dõi bảng giá và hạn mức tại tài khoản Tavily, Jina và nhà cung cấp AI;
giới hạn miễn phí/giá có thể thay đổi. Xem [Tavily Search API](https://docs.tavily.com/documentation/api-reference/endpoint/search)
và [Jina Reader](https://jina.ai/reader/).

```bash
npm run build
```

Sổ cái dùng chung cho mọi tài khoản đã đăng nhập. Không seed dữ liệu giả.

## Spec

Xem [attachments/PORTFOLIO_SPEC_new.md](attachments/PORTFOLIO_SPEC_new.md) (v3.0).
