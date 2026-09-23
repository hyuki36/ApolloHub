# ApolloHub — Anti-Raw Hub (Vercel)

Web đen / trắng / xám, 4 tab **Home · Link · Updates · Discord**, icon + background GIF của bạn,
hiệu ứng glow-wave + fade. API anti-raw:

- Browser / curl / python mở link raw → **màn hình đen**, tự chuyển về **`/#home`**, view-source không có Lua.
- Roblox `loadstring(game:HttpGet(url))()` + key đúng → nhận **text/plain Luau**.
- Mỗi link có `id + k` riêng. Có khóa `PlaceId`, hết hạn giờ.

## Cấu trúc

```
index.html      Web 4 tab
style.css       Theme + animations
app.js          Router + form tạo link
api/r.js        Link anti-raw chính: /api/r?id=..&k=..&hwid=..&place=..
api/payload.js  Tương thích loader sodium cũ: /api/payload?s=..&k=..&hwid=..&place=..
api/raw.js      Mồi nhử: luôn trả trang đen
api/create.js   POST tạo link mới
api/list.js     GET liệt kê (không lộ source)
lib/detect.js   Phân biệt browser vs Roblox
lib/store.js    Lưu link (nhớ + /tmp + KV nếu có)
scripts.json    Seed demo
vercel.json     Ghim region sin1
```

## 1. Đẩy lên repo

Repo bạn: `https://github.com/hyuki36/ApolloHub.git`

```powershell
cd ApolloHub
git init
git add .
git commit -m "ApolloHub anti-raw v2"
git branch -M main
git remote add origin https://github.com/hyuki36/ApolloHub.git
git push -u origin main
```

Nếu repo đã có code cũ và muốn ghi đè: backup trước, rồi `git push -u origin main --force`.

## 2. Deploy Vercel → apollohub-nu.vercel.app

1. Vào [vercel.com](https://vercel.com) → **Add New → Project** → Import repo `hyuki36/ApolloHub`.
2. Framework Preset: **Other**. Build Command: để trống. Output Directory: để trống (web tĩnh ở root).
3. **Project Name** đặt `apollohub-nu` → domain mặc định sẽ là `https://apollohub-nu.vercel.app`.
4. Bấm **Deploy**. Xong vào `https://apollohub-nu.vercel.app/#home` kiểm tra 4 tab.
5. Test anti-raw:
   - Browser mở `https://apollohub-nu.vercel.app/api/raw` → màn đen → về Home. Đúng.
   - Vào tab **Link** tạo 1 link → copy loader → chạy trong executor → ra code. Đúng.
   - `curl` link `/api/r?id=..&k=..` (không giả UA Roblox) → cũng chỉ thấy HTML đen.

## 3. Biến môi trường (khuyên dùng)

Vercel → Project → **Settings → Environment Variables**:

| Key | Tác dụng |
|---|---|
| `ADMIN_KEY` | Khóa route `/api/create` cũ. Tab Link mới dùng login, không cần key này. |
| `SESSION_SECRET` | Chuỗi bí mật ký session. Không set vẫn login được nhưng rớt đăng nhập khi server restart — set 1 chuỗi ngẫu nhiên dài để giữ. |
| `OWNER_EMAILS` | Mặc định `ahba9912@gmail.com`. Thêm email khác cách nhau bằng dấu phẩy. |
| `KV_REST_API_URL` + `KV_REST_API_TOKEN` | Optional: lưu vĩnh viễn không cần redeploy. Không có cũng chạy đủ. |
| `GITHUB_TOKEN` | Optional nâng cao (tự commit khi tạo). Không cần — đã có nút Publish. |

## 3b. Publish vĩnh viễn KHÔNG cần token

Repo `scripts.json` là sự thật vĩnh viễn, server chỉ là bộ nhớ chạy. Cách giữ script vĩnh viễn: gom entries đã tạo thành file `scripts.json` đầy đủ rồi upload đè lên repo (trang upload của repo → Commit changes). Vercel tự redeploy. Xong.

## 3c. Giữ storage sống (keep-alive, không setup)

Con bot review đã xóa. Thay vào đó, GitHub Actions ping web mỗi 5 phút (`.github/workflows/keepalive.yml`, không cần secret) để Vercel không tắt instance — scripts tạo trên web sống lâu trong storage. Quy tắc duy nhất: **đừng push code mới khi không cần**, mỗi lần redeploy là memory reset 1 lần.

## 3b. Scripts Storage — single-user (mặc định)

- Chỉ owner login (`ahba9912@gmail.com`), không có đăng ký công khai — không ai chiếm slug, không lỗi auth linh tinh.
- Muốn mở multi-user sau này: set `ALLOW_REGISTER=true` trên Vercel.

## 4. Domain riêng (vd: apollohub.gg, choi.vn...)

Bạn hỏi “domain riêng” — có 2 loại:

**A. Dùng luôn domain Vercel free:** project bạn đã là `apollohub-nu` → có sẵn `apollohub-nu.vercel.app`. Không cần làm gì thêm.

**B. Domain riêng mua ngoài (Namecheap / Porkbun / Cloudflare...):**

1. Mua domain, vd `apollohub.gg`.
2. Vercel → Project `ApolloHub` → **Settings → Domains** → Add `apollohub.gg` (và `www.apollohub.gg` nếu muốn).
3. Vercel hiện 2 bản ghi DNS — sang trang quản lý DNS của nhà bán domain thêm:
   - `A @ 76.76.21.21` (hoặc CNAME theo hướng dẫn Vercel hiện ra)
   - `CNAME www cname.vercel-dns.com`
4. Đợi 5–60 phút → Vercel tự cấp SSL. Xong truy cập `https://apollohub.gg`.
5. Muốn link raw dùng domain riêng thì loader sẽ là `https://apollohub.gg/api/r?id=..&k=..` — cơ chế anti-raw giữ nguyên.

## 5. Đổi Discord / icon / background

- Discord: tìm `discord.gg/c3xVMnUUBv` trong `index.html` + `app.js` → thay.
- Icon: URL pinimg trong `<link rel="icon">` + `.brand img`.
- Background: URL gif trong `style.css` class `.bg`.
- Updates: sửa timeline trong `index.html`.

## Bảo mật thực tế

- UA check chặn 95% tool quét + tò mò view-source. Tool nào **đã có loader (có key)** vẫn giả `User-Agent: Roblox` để lấy code — không chặn tuyệt đối được vì Roblox HttpGet bắt buộc phải đọc được. Giảm rủi ro bằng: key dài riêng/link, khóa PlaceId, set hết hạn, bật `ADMIN_KEY`, không share loader công khai, xoay key khi lộ.
