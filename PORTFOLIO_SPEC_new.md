{
  "projectInfo": {
    "name": "Portfolio Manager SPA",
    "description": "Ứng dụng web Single Page Application (SPA) quản lý danh mục đầu tư tài chính cá nhân đa tài sản theo mô hình Thuần Tài Sản (Asset-Only Ledger). Hỗ trợ DCDS, ETF, Stock (VPS/SSI), Crypto và Bank, với chức năng giám sát NAV, hạch toán giao dịch và P&L, phân tích Trade T+ hạ giá vốn, quản lý vốn, phân bổ và hiệu suất đầu tư.",
    "architecturePattern": "Asset-Only Ledger",
    "applicationType": "Single Page Application (SPA)",
    "version": "3.1",
    "frontend": "React + TypeScript + Vite + Tailwind CSS",
    "backend": "Supabase (PostgreSQL, Auth, Edge Functions)",
    "deploymentAndInfrastructure": [
      "GitHub",
      "Vercel",
      "Cloudflare Pages"
    ],
    "targetOperatingCost": "0đ trọn đời",
    "uiTheme": "Navy Blue + White, Dark/Light Mode toggle, Material Design 3",
    "supportedCategories": [
      "DCDS",
      "ETF",
      "Stock",
      "Crypto",
      "Bank"
    ],
    "categorySortingOrder": [
      "DCDS",
      "ETF",
      "Stock",
      "Crypto",
      "Bank"
    ],
    "reservedKeywords": [
      "Portfolio Manager",
      "Theme",
      "Stock",
      "ETF",
      "Crypto",
      "DCDS",
      "Bank",
      "Realtime",
      "Dashboard",
      "Buy",
      "Sell",
      "Fund",
      "Growth Fund",
      "Account",
      "Deposit"
    ],
    "uiLanguageRule": "Tất cả các nhãn (labels), thông báo (notifications), điều hướng và tiêu đề còn lại bắt buộc dùng Tiếng Việt. Các từ khóa hệ thống (Keys/Enums) giữ nguyên tiếng Anh chuẩn.",
    "mainSections": [
      "Dashboard",
      "Asset Module / giao dịch",
      "Trade T+",
      "Reports",
      "Settings",
      "Profile"
    ],
    "initialDataState": "Sổ cái trống 100% khi bắt đầu. Người dùng tự nhập thủ công toàn bộ lịch sử giao dịch thật từ đầu. Không tạo dữ liệu giả. Không dùng dữ liệu hard-code để hiển thị.",
    "dataSharingModel": "Shared Workspace: Tất cả user đăng nhập vào Workspace dùng chung một workspace_id, chia sẻ 100% dữ liệu và có quyền truy cập, chỉnh sửa, xóa hoàn toàn bình đẳng.",
    "excludedModules": [
      "Simulator",
      "Audit"
    ],
    "excludedModulesNote": "Xóa hoàn toàn Trình mô phỏng (Simulator) và Trang Audit khỏi ứng dụng. Pixel Assistant tạm thời chưa tích hợp ở phiên bản này.",
    "authentication": "Supabase Auth",
    "userRoleModel": "Tất cả user trong Workspace có quyền bình đẳng 100% Full Read/Write/Delete. Không phân chia Admin, Owner hoặc Member.",
    "multiUserSharedWorkspace": {
      "authProvider": "Supabase Auth (Giữ nguyên cơ chế Đăng nhập/Đăng xuất theo tài khoản cá nhân riêng biệt)",
      "dataSharingModel": "Shared Workspace (Toàn bộ dữ liệu giao dịch được gắn với workspace_id chung cho các tài khoản được ủy quyền)",
      "realtimeSync": "Bật Supabase Realtime trên các bảng dữ liệu. Khi 1 tài khoản thêm/sửa/xóa, giao diện của tài khoản còn lại sẽ tự động re-render dữ liệu tức thì.",
      "accessControl": "Cấu hình Supabase RLS (Row Level Security) cấp quyền Read/Write chung cho danh sách user thuộc cùng Workspace."
    },
    "priceAndDisplayFormat": {
      "defaultCurrency": "VND",
      "currencySwitch": "Có nút ấn chuyển đổi sang USD đặt tại Header",
      "stockPriceFormat": "Giá cổ phiếu hiển thị theo định dạng chứng khoán Việt Nam: 13.5 = 13.500 VNĐ, 100 = 100.000 VNĐ",
      "largeNumberDisplay": "Số tiền lớn hiển thị đầy đủ phân cách hàng nghìn trong bảng chi tiết. Card/Dashboard hiển thị số tiền rút gọn như 1,5 Tỷ hoặc 1,5B VNĐ",
      "exchangeRate": "Áp dụng Tỷ giá thời gian thực (Live Exchange Rate) quy đổi tại thời điểm xem. Tỷ giá tại thời điểm chốt lệnh mua/bán được khóa cố định."
    }
  },
  "modules": [
    {
      "moduleName": "Dashboard",
      "features": [
        {
          "featureName": "Giám sát Original Capital",
          "description": "Hiển thị tổng vốn gốc và vốn nạp riêng theo từng danh mục.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [
            {
              "fieldName": "categoryTarget",
              "type": "string",
              "required": true,
              "validation": "Một trong: Original Stock, Original Crypto, Original DCDS, Original ETF, Original Bank"
            },
            {
              "fieldName": "amount",
              "type": "number",
              "required": true,
              "validation": "> 0"
            },
            {
              "fieldName": "currency",
              "type": "string",
              "required": true,
              "validation": "Chỉ VND hoặc USD"
            },
            {
              "fieldName": "transactionDate",
              "type": "string",
              "required": true,
              "validation": "ISO Date string"
            },
            {
              "fieldName": "note",
              "type": "string",
              "required": false,
              "validation": "Không bắt buộc"
            }
          ],
          "businessRules": [
            "Original Capital = SUM(Deposit) - SUM(Withdrawal).",
            "Original Capital chỉ biến động thông qua Deposit/Withdrawal.",
            "Cho phép chọn VND hoặc USD khi thực hiện Nạp/Rút (Deposit/Withdrawal).",
            "Nếu Deposit/Withdrawal bằng USD, hệ thống tự động lấy Live Exchange Rate tại thời điểm thực hiện để quy đổi sang VND.",
            "Hệ thống ghi nhận đồng tiền gốc của giao dịch (Ví dụ: Nạp 1.000 USDT) và tự động quy đổi ra giá trị VND tương đương tại thời điểm nạp để tính Original Capital chung.",
            "Tỷ giá của giao dịch Deposit/Withdrawal lịch sử được snapshot cố định.",
            "Cho phép sửa và xóa các bản ghi Deposit/Withdrawal cũ.",
            "Sau khi sửa hoặc xóa, Replay Engine phải recalculate lại Original Capital."
          ]
        },
        {
          "featureName": "Giám sát NAV",
          "description": "Hiển thị NAV tổng và NAV theo từng danh mục.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "NAV = SUM(Giá trị thị trường DCDS + ETF + Stock + Crypto + Active Bank Deposits).",
            "Hệ thống sử dụng mô hình Asset-Only Ledger và không duy trì biến Cash trung gian.",
            "KHÔNG theo dõi số dư tiền mặt hay tiền mặt khả dụng trong tài khoản chứng khoán. Khi bán chỉ giảm holdings và ghi nhận lợi nhuận/lỗ thực hiện (Realized P&L).",
            "Dashboard sử dụng dữ liệu từ Server-side Calculation làm Single Source of Truth."
          ]
        },
        {
          "featureName": "Hiển thị P/L lũy kế",
          "description": "Hiển thị P/L lũy kế theo danh mục.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "P/L lũy kế danh mục = NAV danh mục - Vốn nạp danh mục."
          ]
        },
        {
          "featureName": "Realtime Sync",
          "description": "Cập nhật giá thị trường và dữ liệu Realtime khi người dùng bấm nút Realtime Sync.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "Nút Realtime Sync cập nhật giá thị trường mới nhất cho DCDS, Stock và Crypto.",
            "Không yêu cầu cập nhật liên tục; người dùng chủ động bấm nút để cập nhật.",
            "Supabase Realtime được sử dụng để đồng bộ dữ liệu giữa các user trong cùng Workspace."
          ]
        },
        {
          "featureName": "Chuyển đổi VND/USD",
          "description": "Cho phép chuyển đổi giao diện hiển thị giữa VND và USD.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [
            {
              "fieldName": "currency",
              "type": "string",
              "required": true,
              "validation": "VND hoặc USD"
            }
          ],
          "businessRules": [
            "Giá mặc định hiển thị bằng VND.",
            "Tỷ giá chuyển đổi hiển thị sử dụng Live Exchange Rate.",
            "Tỷ giá giao dịch lịch sử vẫn được snapshot cố định tại thời điểm thực hiện giao dịch.",
            "Giá cổ phiếu hiển thị theo định dạng chứng khoán Việt Nam: 13.5 = 13.500 VNĐ.",
            "Số tiền lớn hiển thị đầy đủ phân cách hàng nghìn trong bảng chi tiết.",
            "Card/Dashboard có thể hiển thị số tiền rút gọn như 1,5 Tỷ hoặc 1,5B VNĐ."
          ]
        },
        {
          "featureName": "Cảnh báo đáo hạn Bank",
          "description": "Hiển thị Banner/Card cảnh báo trên Dashboard khi sổ tiết kiệm còn 5 ngày.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "Khi còn 5 ngày đến đáo hạn, Dashboard hiển thị cảnh báo.",
            "Cho phép người dùng nhập hoặc cập nhật lãi suất mới trực tiếp trên Banner/Modal mà không cần phải truy cập sâu vào trang chi tiết Bank.",
            "Nếu đã đáo hạn nhưng chưa nhập lãi suất mới, tạm thời sử dụng lãi suất cũ.",
            "Trong thời gian chưa nhập lãi suất mới, tiếp tục hiển thị thông báo 'Vẫn chưa nhập lãi suất kỳ này'.",
            "Khi người dùng nhập lãi suất mới, cập nhật lãi suất kỳ hiện tại."
          ]
        },
        {
          "featureName": "Stock Account Filter",
          "description": "Lọc dữ liệu Stock trên Dashboard theo tài khoản.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [
            {
              "fieldName": "account",
              "type": "string",
              "required": true,
              "validation": "All, VPS hoặc SSI"
            }
          ],
          "businessRules": [
            "VPS và SSI độc lập hoàn toàn về Holdings, Average Cost, P&L và T+ matching."
          ]
        }
      ]
    },
    {
      "moduleName": "Asset Module / Giao dịch",
      "features": [
        {
          "featureName": "Transaction chung",
          "description": "Quản lý các loại giao dịch của Portfolio.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [
            {
              "fieldName": "id",
              "type": "string (UUID)",
              "required": true,
              "validation": "Hệ thống tự tạo"
            },
            {
              "fieldName": "transactionDate",
              "type": "string",
              "required": true,
              "validation": "ISO Date"
            },
            {
              "fieldName": "note",
              "type": "string",
              "required": false,
              "validation": "Không bắt buộc"
            }
          ],
          "businessRules": [
            "Các loại Transaction gồm BUY, SELL, CASH_DIVIDEND, STOCK_DIVIDEND, DEPOSIT, WITHDRAWAL, BANK_DEPOSIT, BANK_CLOSE.",
            "Hard Delete xóa vĩnh viễn bản ghi khỏi Database.",
            "Sau Create, Edit hoặc Delete, Replay Engine phải chạy lại toàn bộ chuỗi tính toán."
          ]
        },
        {
          "featureName": "Stock BUY",
          "description": "Mua cổ phiếu trong tài khoản VPS hoặc SSI. Người dùng tự nhập mã cổ phiếu (Free-text string, in hoa).",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [
            {
              "fieldName": "code",
              "type": "string",
              "required": true,
              "validation": "Mã CP in hoa (VD: VCI, HPG)"
            },
            {
              "fieldName": "account",
              "type": "string",
              "required": true,
              "validation": "VPS hoặc SSI"
            },
            {
              "fieldName": "quantity",
              "type": "number",
              "required": true,
              "validation": "> 0; cho phép số thập phân"
            },
            {
              "fieldName": "price",
              "type": "number",
              "required": true,
              "validation": "> 0; đơn vị nghìn đồng"
            },
            {
              "fieldName": "isTradeTPlus",
              "type": "boolean",
              "required": true,
              "validation": "Mặc định false"
            },
            {
              "fieldName": "transactionDate",
              "type": "string",
              "required": true,
              "validation": "ISO Date"
            }
          ],
          "businessRules": [
            "BUY mặc định isTradeTPlus = false.",
            "Nếu isTradeTPlus = true, BUY được đưa vào phân tích T+.",
            "Nếu isTradeTPlus = false, BUY tính trực tiếp vào vị thế gốc.",
            "VPS chỉ được match T+ với VPS; SSI chỉ được match T+ với SSI.",
            "Mỗi lệnh BUY T+ tạo ra một T+ Lot ID riêng biệt."
          ]
        },
        {
          "featureName": "Stock SELL",
          "description": "Bán cổ phiếu trong tài khoản VPS hoặc SSI.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [
            {
              "fieldName": "code",
              "type": "string",
              "required": true,
              "validation": "Mã CP in hoa"
            },
            {
              "fieldName": "account",
              "type": "string",
              "required": true,
              "validation": "VPS hoặc SSI"
            },
            {
              "fieldName": "quantity",
              "type": "number",
              "required": true,
              "validation": "> 0; không vượt quá Holdings thực tế"
            },
            {
              "fieldName": "price",
              "type": "number",
              "required": true,
              "validation": "> 0; đơn vị nghìn đồng"
            },
            {
              "fieldName": "transactionDate",
              "type": "string",
              "required": true,
              "validation": "ISO Date"
            }
          ],
          "businessRules": [
            "SELL không được vượt quá số lượng Holdings thực tế.",
            "Ngày giao dịch sử dụng transactionDate.",
            "Realized P&L từ Trade = ((Giá Bán - Giá Mua) × Số lượng) - Phí - Thuế."
          ]
        },
        {
          "featureName": "Stock Dividend",
          "description": "Quản lý cổ tức tiền mặt và cổ tức cổ phiếu/thưởng. Phần cổ tức chỉ có ở Cổ phiếu.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [
            {
              "fieldName": "dividendType",
              "type": "string",
              "required": true,
              "validation": "CASH_DIVIDEND hoặc STOCK_DIVIDEND"
            }
          ],
          "businessRules": [
            "Cổ tức chỉ áp dụng cho Stock.",
            "Cash Dividend: Nhập số tiền/CP hoặc tổng tiền thực nhận. Hạch toán thẳng vào chỉ số Cổ Tức Tiền Mặt lũy kế.",
            "Stock Dividend: Nhập trực tiếp trường Số lượng (quantity) cổ phiếu thực nhận (> 0). Tăng Holdings cổ phiếu gốc và tự động tính lại Average Cost do pha loãng."
          ]
        },
        {
          "featureName": "ETF BUY/SELL",
          "description": "Mua và bán ETF với Average Cost và Realized/Unrealized P&L. Người dùng tự nhập mã ETF.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [
            {
              "fieldName": "code",
              "type": "string",
              "required": true,
              "validation": "Mã ETF (VD: E1VFVN30)"
            }
          ],
          "businessRules": [
            "ETF có BUY/SELL riêng.",
            "ETF có Average Cost.",
            "ETF có Realized P&L và Unrealized P&L.",
            "ETF không phân chia tài khoản VPS/SSI.",
            "ETF không áp dụng Trade T+."
          ]
        },
        {
          "featureName": "Crypto BUY/SELL",
          "description": "Mua bán Crypto bằng giá USD và khóa tỷ giá USD/VND theo từng giao dịch. Người dùng tự nhập mã Crypto.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [
            {
              "fieldName": "code",
              "type": "string",
              "required": true,
              "validation": "Mã Crypto free-text (VD: BTC, ETH)"
            },
            {
              "fieldName": "quantity",
              "type": "number",
              "required": true,
              "validation": "> 0; cho phép số thập phân"
            },
            {
              "fieldName": "priceUsd",
              "type": "number",
              "required": true,
              "validation": "> 0"
            }
          ],
          "businessRules": [
            "Crypto được áp dụng Trade T+.",
            "Khi tạo BUY/SELL, hệ thống tự động snapshot Live Exchange Rate USD/VND tại thời điểm bấm.",
            "Tỷ giá BUY_VND được khóa cố định theo BUY (lockedVndRate).",
            "Tỷ giá SELL_VND được khóa cố định theo SELL (lockedVndRate).",
            "Lãi/Lỗ ròng VNĐ = (Giá Bán USD × Tỷ giá Bán VND) - (Giá Mua USD × Tỷ giá Mua VND).",
            "Hiển thị cả USD và VND. Trên Header có nút chuyển đổi VND/USD toàn hệ thống."
          ]
        },
        {
          "featureName": "DCDS BUY",
          "description": "Mua chứng chỉ quỹ DCDS.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [
            {
              "fieldName": "purchaseAmount",
              "type": "number",
              "required": true,
              "validation": "> 0"
            },
            {
              "fieldName": "ccqPrice",
              "type": "number",
              "required": true,
              "validation": "> 0"
            },
            {
              "fieldName": "ccqQuantity",
              "type": "number",
              "required": true,
              "validation": "Read-Only; tự động tính bằng purchaseAmount / ccqPrice và roundTo4"
            }
          ],
          "businessRules": [
            "Số CCQ = Số tiền mua / Giá CCQ.",
            "Số CCQ được làm tròn đúng 4 chữ số thập phân bằng roundTo4.",
            "Người dùng không nhập trực tiếp Số CCQ."
          ]
        },
        {
          "featureName": "DCDS SELL",
          "description": "Bán chứng chỉ quỹ DCDS.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [
            {
              "fieldName": "ccqQuantity",
              "type": "number",
              "required": true,
              "validation": "> 0"
            },
            {
              "fieldName": "ccqPrice",
              "type": "number",
              "required": true,
              "validation": "Tự động lấy từ Live Sync; người dùng được phép sửa/đè giá thực tế"
            }
          ],
          "businessRules": [
            "Giá bán CCQ mặc định lấy từ Live Sync.",
            "Người dùng được phép override giá bán thực tế."
          ]
        },
        {
          "featureName": "Bank Deposit",
          "description": "Mở sổ tiết kiệm theo mô hình Asset-Only. Hỗ trợ nhiều sổ / nhiều ngân hàng cùng lúc.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [
            {
              "fieldName": "bankName",
              "type": "string",
              "required": true,
              "validation": "Tên ngân hàng (VietinBank, VCB, MB, Techcombank...); danh mục chọn/nhập linh hoạt"
            },
            {
              "fieldName": "principalVnd",
              "type": "number",
              "required": true,
              "validation": "> 0"
            },
            {
              "fieldName": "interestRatePercent",
              "type": "number",
              "required": true,
              "validation": ">= 0; %/năm"
            },
            {
              "fieldName": "termMonths",
              "type": "number",
              "required": true,
              "validation": "> 0; số tháng"
            },
            {
              "fieldName": "startDate",
              "type": "string",
              "required": true,
              "validation": "ISO Date"
            },
            {
              "fieldName": "maturityDate",
              "type": "string",
              "required": true,
              "validation": "Tự động tính = startDate + termMonths"
            },
            {
              "fieldName": "autoRollover",
              "type": "boolean",
              "required": true,
              "validation": "Yes/No"
            }
          ],
          "businessRules": [
            "Mở sổ tiết kiệm không trích trừ số dư Cash.",
            "Mỗi sổ lưu ngân hàng, gốc, lãi suất, kỳ hạn, ngày gửi, ngày đáo hạn và trạng thái tự động quay vòng.",
            "Ngày đáo hạn mới = Ngày đáo hạn cũ + kỳ hạn.",
            "Gốc mới = gốc cũ + lãi của kỳ vừa rồi nếu rollover.",
            "Nếu không rollover, tiền gốc trên Active Bank giảm về 0.",
            "Lịch sử đáo hạn lưu tiền gốc thu hồi và tổng tiền lãi thực nhận (actualReceivedInterest)."
          ]
        },
        {
          "featureName": "Bank Close",
          "description": "Tất toán hoặc đóng sổ Bank.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [
            {
              "fieldName": "actualReceivedInterest",
              "type": "number",
              "required": true,
              "validation": "Người dùng tự nhập số tiền lãi thực nhận thực tế khi tất toán/rút trước hạn"
            }
          ],
          "businessRules": [
            "Tất toán không rollover làm tiền gốc Active Bank giảm về 0.",
            "Lưu toàn bộ dữ liệu vào Lịch sử Đáo hạn.",
            "Lịch sử bao gồm Tiền Gốc thu hồi và Tổng Tiền Lãi thực nhận."
          ]
        }
      ]
    },
    {
      "moduleName": "Trade T+",
      "features": [
        {
          "featureName": "T+ Flag",
          "description": "Đánh dấu BUY là giao dịch Trade T+.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [
            {
              "fieldName": "isTradeTPlus",
              "type": "boolean",
              "required": true,
              "validation": "Mặc định false"
            }
          ],
          "businessRules": [
            "Trade T+ chỉ áp dụng cho Stock VPS, Stock SSI và Crypto.",
            "Không áp dụng cho DCDS, ETF và Bank.",
            "Mục đích: Người dùng đang giữ một mã bị lỗ → mua thêm ở giá thấp → bán phần mua thêm khi giá hồi → lấy lợi nhuận/vốn đó tiếp tục xoay vòng T+ → đồng thời theo dõi giá vốn thực tế của toàn bộ vị thế đã được hạ xuống bao nhiêu và còn cách hòa vốn bao xa.",
            "Không được biến Trade T+ thành Simulator."
          ]
        },
        {
          "featureName": "Manual T+ Lot Matching",
          "description": "Người dùng tự chọn chính xác lô T+ để thực hiện SELL. Bỏ hoàn toàn FIFO.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [
            {
              "fieldName": "tPlusLotId",
              "type": "string",
              "required": true,
              "validation": "Hệ thống tự sinh cho mỗi BUY T+; SELL T+ bắt buộc gắn với Lot ID cụ thể"
            },
            {
              "fieldName": "sellQuantity",
              "type": "number",
              "required": true,
              "validation": "<= openQuantity của lô được chọn"
            }
          ],
          "businessRules": [
            "Không sử dụng FIFO.",
            "Chế độ mặc định của hệ thống là Manual Lot Selection (người dùng bấm vào lệnh T+ cụ thể để ấn Sell).",
            "UI liệt kê danh sách các lô/lệnh T+ đang mở (Open T+ Lots) của mã đó kèm ngày mua/giá mua.",
            "Người dùng tích chọn lô muốn chốt và nhập số lượng bán.",
            "SELL T+ phải gắn với T+ Lot ID cụ thể.",
            "Một T+ Lot có thể được bán nhiều lần.",
            "Partial Sell giữ nguyên Lot ID và cập nhật số lượng còn lại.",
            "Trạng thái Lot gồm OPEN, PARTIAL_COMPLETED và COMPLETED.",
            "VPS chỉ match với VPS.",
            "SSI chỉ match với SSI.",
            "Crypto chỉ match với Crypto."
          ]
        },
        {
          "featureName": "T+ Cycle Logic và Dashboard Holding",
          "description": "Logic vòng T+ và ảnh hưởng đến Holdings trên Dashboard.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "Khi lệnh T+ Mua đang OPEN, số lượng đó được cộng ngay vào Tổng khối lượng nắm giữ (Holdings) hiển thị trên Dashboard.",
            "Khi chốt T+ Bán (COMPLETED), khối lượng nắm giữ giảm về lại vị thế gốc, còn lợi nhuận ròng T+ được trừ thẳng để hạ Giá vốn gốc (Average Cost).",
            "Step 1 - Open T+: Số lượng Trade: 200 / 1.000 | Giá Trade: 25.000 / 30.000. Lệnh 200 vẫn đang tồn tại → chưa được tính lợi nhuận giảm giá vốn.",
            "Step 2 - Completed T+: 200 CP không còn nằm trong Số lượng Trade. Lợi nhuận T+ ròng → trừ vào vốn gốc → giá vốn gốc được hạ từ 30.000 xuống 29.820.",
            "Step 3 - New T+ Cycle: Tiếp tục mua 150 CP ở 24.000 → Số lượng Trade: 150 / 1.000 | Giá Trade: 24.000 / 29.820. 30.000 ban đầu đã được hạ xuống 29.820 nhờ các vòng T+ trước, nhưng số lượng gốc vẫn giữ nguyên 1.000. Hệ thống phải nhận biết đây là một T+ cycle."
          ]
        },
        {
          "featureName": "T+ Profit",
          "description": "Tính lợi nhuận ròng của từng giao dịch/lô T+.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "T+ Profit = ((Giá bán - Giá mua) × Khối lượng) - Phí - Thuế.",
            "Lợi nhuận T+ chỉ được dùng để hạ giá vốn khi phần T+ tương ứng đã COMPLETED."
          ]
        },
        {
          "featureName": "T+ Adjusted Cost",
          "description": "Tính giá vốn mới của vị thế gốc sau các vòng T+ đã hoàn thành.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "Giá vốn mới = (Vốn gốc ban đầu - Tổng lợi nhuận T+ ròng đã COMPLETED) / Số lượng cổ phiếu còn lại.",
            "Vốn gốc ban đầu trong công thức là tổng chi phí mua thực tế của riêng mã cổ phiếu đó (không liên quan đến toàn bộ NAV danh mục).",
            "T+ BUY đang OPEN không làm giảm giá vốn.",
            "T+ SELL COMPLETED làm lợi nhuận T+ ròng trừ vào vốn gốc.",
            "Số lượng vị thế gốc vẫn giữ nguyên khi một vòng T+ hoàn thành.",
            "Hiển thị trên Dashboard: Chưa có lệnh T+ hoặc T+ chưa chốt → 0 / Giá vốn gốc. Lệnh T+ đã chốt lời → Giá vốn mới sau khi trừ lãi T+ / Giá vốn gốc."
          ]
        },
        {
          "featureName": "T+ Active Card",
          "description": "Hiển thị các mã đang có lệnh T+ OPEN.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "Card chỉ hiển thị khi có lệnh T+ đang OPEN (có ít nhất 1 lô T+ ở trạng thái OPEN).",
            "Nếu không có T+ hoặc T+ đã COMPLETED thì không hiển thị trong tab Active.",
            "T+ History vẫn lưu các vòng đã hoàn thành.",
            "Số lượng Trade = Tổng Qty T+ Open / Qty gốc.",
            "Giá Trade = Giá T+ hiện tại / Giá vốn gốc.",
            "Giá bán đề xuất Stock = Giá mua T+ × 1.03 (+3%).",
            "Giá bán đề xuất Crypto = Giá mua T+ × 1.05 (+5%).",
            "Giá hòa vốn là giá bán toàn bộ lượng cổ phiếu đang nắm giữ (Qty gốc + Qty T+ Open) để Net P&L = 0.",
            "Qty T+ trong Break-even chỉ tính phần T+ đang Open (các lệnh T+ đã Completed đã được hiện thực hóa và trừ vào giá vốn hiện tại)."
          ]
        },
        {
          "featureName": "T+ Active Card Buy",
          "description": "Mở form BUY từ Active T+ Card.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [
            {
              "fieldName": "code",
              "type": "string",
              "required": true,
              "validation": "Tự động điền mã từ Card"
            },
            {
              "fieldName": "isTradeTPlus",
              "type": "boolean",
              "required": true,
              "validation": "Mặc định true; người dùng có thể bỏ tick"
            }
          ],
          "businessRules": [
            "Không bắt người dùng chọn lại mã.",
            "Form mặc định tick Trade T+ = true (isTradeTPlus = true).",
            "Người dùng có thể bỏ tick để chuyển thành mua tích sản thông thường."
          ]
        },
        {
          "featureName": "T+ Active Card Sell",
          "description": "Mở form SELL T+ đã liên kết với lô T+ được chọn.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [
            {
              "fieldName": "code",
              "type": "string",
              "required": true,
              "validation": "Tự động điền"
            },
            {
              "fieldName": "account",
              "type": "string",
              "required": true,
              "validation": "Tự động điền"
            },
            {
              "fieldName": "tPlusLotId",
              "type": "string",
              "required": true,
              "validation": "Tự động liên kết với Lot T+ được chọn"
            },
            {
              "fieldName": "sellQuantity",
              "type": "number",
              "required": true,
              "validation": "<= openQuantity của Lot"
            },
            {
              "fieldName": "price",
              "type": "number",
              "required": true,
              "validation": "Tự động gợi ý theo giá mua × 1.03 cho Stock hoặc × 1.05 cho Crypto; người dùng được phép sửa theo thực tế"
            }
          ],
          "businessRules": [
            "Không bắt người dùng chọn lại mã.",
            "Account được tự động liên kết.",
            "Form tự động gợi ý giá T+ (người dùng được phép chỉnh sửa giá theo thực tế).",
            "Form được auto-link với Lot T+ mà người dùng vừa chọn."
          ]
        },
        {
          "featureName": "T+ History",
          "description": "Lưu và tra cứu lịch sử các vòng T+ và hỗ trợ export Excel.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [
            {
              "fieldName": "code",
              "type": "string",
              "required": true,
              "validation": "Text/String"
            },
            {
              "fieldName": "account",
              "type": "string",
              "required": true,
              "validation": "Text/String"
            },
            {
              "fieldName": "buyDate",
              "type": "string",
              "required": true,
              "validation": "YYYY-MM-DD"
            },
            {
              "fieldName": "sellDate",
              "type": "string",
              "required": false,
              "validation": "YYYY-MM-DD"
            },
            {
              "fieldName": "holdingBeforeTPlus",
              "type": "number",
              "required": true,
              "validation": "Cho phép số thập phân"
            },
            {
              "fieldName": "buyQuantity",
              "type": "number",
              "required": true,
              "validation": "Cho phép số thập phân"
            },
            {
              "fieldName": "buyPrice",
              "type": "number",
              "required": true,
              "validation": "Số tiền/Giá trị"
            },
            {
              "fieldName": "sellQuantity",
              "type": "number",
              "required": false,
              "validation": "Cho phép số thập phân"
            },
            {
              "fieldName": "sellPrice",
              "type": "number",
              "required": false,
              "validation": "Số tiền/Giá trị"
            },
            {
              "fieldName": "fees",
              "type": "number",
              "required": true,
              "validation": "Số tiền/Giá trị"
            },
            {
              "fieldName": "tax",
              "type": "number",
              "required": true,
              "validation": "Số tiền/Giá trị"
            },
            {
              "fieldName": "grossProfit",
              "type": "number",
              "required": true,
              "validation": "Số tiền/Giá trị"
            },
            {
              "fieldName": "netProfit",
              "type": "number",
              "required": true,
              "validation": "Số tiền/Giá trị"
            },
            {
              "fieldName": "averageCostBefore",
              "type": "number",
              "required": true,
              "validation": "Số tiền/Giá trị"
            },
            {
              "fieldName": "averageCostAfter",
              "type": "number",
              "required": true,
              "validation": "Số tiền/Giá trị"
            },
            {
              "fieldName": "costReduction",
              "type": "number",
              "required": true,
              "validation": "Số tiền/Giá trị"
            },
            {
              "fieldName": "remainingHolding",
              "type": "number",
              "required": true,
              "validation": "Cho phép số thập phân"
            },
            {
              "fieldName": "remainingUnrealizedPL",
              "type": "number",
              "required": true,
              "validation": "Số tiền/Giá trị"
            },
            {
              "fieldName": "status",
              "type": "string",
              "required": true,
              "validation": "OPEN, PARTIAL_COMPLETED hoặc COMPLETED"
            }
          ],
          "businessRules": [
            "Lưu lịch sử T+ để tìm xem lại.",
            "Cho phép export T+ History ra Excel .xlsx.",
            "Partial Matching không được coi toàn bộ BUY Lot đã hoàn thành (VD: BUY 500, SELL 300 → Completed 300, Open 200)."
          ]
        }
      ]
    },
    {
      "moduleName": "Bank",
      "features": [
        {
          "featureName": "Quản lý kỳ hạn và đáo hạn",
          "description": "Theo dõi số ngày còn lại và trạng thái đáo hạn của từng sổ.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "Cột Còn lại đếm ngược số ngày đến đáo hạn (120 ngày, 5 ngày, 0 ngày...).",
            "Các khoản gần đáo hạn được sắp xếp lên trên.",
            "Khi còn 5 ngày sẽ hiển thị cảnh báo.",
            "Nếu Auto Rollover = Yes, tự động cộng lãi vào gốc và tái gửi theo kỳ hạn cũ.",
            "renewal_count tăng +1 sau mỗi lần rollover."
          ]
        },
        {
          "featureName": "Bank Rollover",
          "description": "Tự động tái tục sổ tiết kiệm.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [
            {
              "fieldName": "newInterestRate",
              "type": "number",
              "required": false,
              "validation": "Người dùng nhập/cập nhật khi được nhắc; nếu chưa nhập sau đáo hạn thì tạm dùng lãi suất cũ"
            }
          ],
          "businessRules": [
            "Ngày đáo hạn mới = Ngày đáo hạn cũ + kỳ hạn.",
            "Gốc mới = Gốc cũ + lãi kỳ vừa rồi.",
            "Khi còn 5 ngày, hệ thống nhắc nhập lãi suất mới.",
            "Nếu đến hạn mà chưa nhập lãi suất mới, tạm dùng lãi suất cũ.",
            "Khi người dùng nhập lãi suất mới, cập nhật lãi suất kỳ hiện tại.",
            "Với chế độ Auto Rollover, gốc mới = gốc cũ + lãi. Lãi suất áp dụng cho kỳ mới sử dụng giá trị khai báo tại trường interestRatePercent của sổ đó."
          ]
        },
        {
          "featureName": "Bank History",
          "description": "Lưu lịch sử tất toán/đáo hạn.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "Lưu tiền gốc thu hồi.",
            "Lưu tổng tiền lãi thực nhận (actualReceivedInterest).",
            "Các thông tin gốc của sổ như bankName, termMonths, interestRatePercent, startDate, maturityDate đã thuộc thuộc tính của record sổ cái ngân hàng (bank_deposit_schema)."
          ]
        }
      ]
    },
    {
      "moduleName": "Reports",
      "features": [
        {
          "featureName": "Phân bổ danh mục",
          "description": "Hiển thị biểu đồ phân bổ và so sánh Vốn nạp với NAV theo từng danh mục.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "Báo cáo bao gồm DCDS, ETF, Stock VPS, Stock SSI, Crypto và Bank."
          ]
        },
        {
          "featureName": "So sánh Vốn nạp và NAV",
          "description": "So sánh Vốn nạp và NAV chi tiết theo từng danh mục, phân tách rõ Stock (VPS) và Stock (SSI).",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "Báo cáo hiển thị Vốn nạp và NAV cho DCDS.",
            "Báo cáo hiển thị Vốn nạp và NAV cho ETF.",
            "Báo cáo hiển thị Vốn nạp và NAV cho Stock, phân tách rõ 2 mục: Stock (VPS) và Stock (SSI).",
            "Báo cáo hiển thị Vốn nạp và NAV cho Crypto.",
            "Báo cáo hiển thị Vốn nạp và NAV cho Bank."
          ]
        },
        {
          "featureName": "Export Reports",
          "description": "Xuất toàn bộ dữ liệu báo cáo ra Excel.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "File export sử dụng định dạng .xlsx.",
            "Hỗ trợ xuất dữ liệu ra file Excel .xlsx cho Báo cáo (Reports) và Lịch sử T+ (T+ History)."
          ]
        }
      ]
    },
    {
      "moduleName": "Settings",
      "features": [
        {
          "featureName": "Cấu hình Phí & Thuế",
          "description": "Quản lý tập trung duy nhất tại trang Settings tỷ lệ Phí Mua, Phí Bán và Thuế Bán dùng chung cho toàn Workspace.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [
            {
              "fieldName": "buyFeePercent",
              "type": "number",
              "required": true,
              "validation": ">= 0; mặc định 0%"
            },
            {
              "fieldName": "sellFeePercent",
              "type": "number",
              "required": true,
              "validation": ">= 0; mặc định 0%"
            },
            {
              "fieldName": "sellTaxPercent",
              "type": "number",
              "required": true,
              "validation": ">= 0; mặc định 0%"
            }
          ],
          "businessRules": [
            "Cấu hình dùng chung cho toàn Workspace.",
            "Chỉ chỉnh sửa cấu hình Phí Mua (%), Phí Bán (%), Thuế Bán (%) tập trung duy nhất tại trang Cài Đặt (Settings).",
            "Form giao dịch tự động load tỷ lệ mặc định.",
            "Người dùng có thể override độc lập từng loại phí/thuế.",
            "Giá trị override được snapshot trực tiếp vào transaction record (feeRate, taxRate).",
            "Override có giá trị vĩnh viễn cho giao dịch đó. Mọi thay đổi trong Settings sau này sẽ không làm thay đổi các giao dịch đã snapshot.",
            "Phí Mua và Phí/Thuế Bán được trừ riêng ở từng chặng giao dịch."
          ]
        }
      ]
    },
    {
      "moduleName": "Profile",
      "features": [
        {
          "featureName": "Hiển thị thông tin Profile",
          "description": "Hiển thị Email người dùng và Icon Đăng xuất.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "Email và Logout Icon nằm trên cùng một dòng.",
            "Logout Icon nằm bên phải Email.",
            "Desktop hover trên icon hiển thị tooltip 'Đăng xuất'.",
            "Mobile touch area tối thiểu 40x40px."
          ]
        },
        {
          "featureName": "Authentication",
          "description": "Xác thực người dùng thông qua Supabase Auth.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "Đăng nhập sử dụng Supabase Auth.",
            "Login dùng để xác nhận quyền truy cập vào Workspace.",
            "Không phân chia Admin, Owner hoặc Member."
          ]
        },
        {
          "featureName": "Shared Workspace",
          "description": "Tất cả tài khoản đăng nhập vào Workspace sử dụng chung dữ liệu Portfolio.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "Tất cả user dùng chung một workspace_id.",
            "Tất cả user chia sẻ toàn bộ dữ liệu giao dịch và tài sản.",
            "Tất cả user có quyền Read/Write/Delete bình đẳng.",
            "User có thể thêm, sửa, xóa giao dịch của user khác.",
            "User có thể thay đổi Settings Phí & Thuế.",
            "User có quyền Hard Delete."
          ]
        }
      ]
    },
    {
      "moduleName": "Shared Calculation Engine / Engine Architecture",
      "features": [
        {
          "featureName": "Replay Engine (Deterministic Financial Engine)",
          "description": "Tái dựng toàn bộ trạng thái Portfolio sau Create, Edit hoặc Delete giao dịch.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "Mọi Create, Edit, Delete giao dịch trong quá khứ đều kích hoạt Replay Engine.",
            "Lọc các bản ghi đã bị xóa (Soft delete filter).",
            "Sắp xếp toàn bộ giao dịch theo thời gian (created_at / transaction_date).",
            "Rebuild Holdings.",
            "Rebuild Realized P&L.",
            "Rebuild Unrealized P&L.",
            "Recalculate Average Cost.",
            "Recalculate T+ cycles.",
            "Recalculate T+ profit.",
            "Recalculate Cost Reduction.",
            "Recalculate Break-even.",
            "Recalculate Bank accrued interest.",
            "Recalculate Dividends.",
            "Cập nhật Dashboard và Asset Tabs mà không yêu cầu refresh thủ công."
          ]
        },
        {
          "featureName": "Server-side Calculation",
          "description": "Tính toán tập trung phía Server để đảm bảo Single Source of Truth cho toàn Workspace.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "Sử dụng Server-side Calculation thông qua Edge Functions / Database Views.",
            "Server-side Calculation là nguồn dữ liệu chuẩn duy nhất (Single Source of Truth).",
            "Đảm bảo tính nhất quán giữa tất cả user trong Workspace.",
            "Tránh hiện tượng lệch logic tính toán do khác biệt giữa các trình duyệt/thiết bị client.",
            "Supabase Realtime lắng nghe các bảng dữ liệu kết quả tính toán và push kết quả về các Client."
          ]
        },
        {
          "featureName": "Supabase Realtime",
          "description": "Đồng bộ dữ liệu tức thì giữa các tài khoản trong cùng Workspace.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "Supabase Realtime được kích hoạt trên các bảng dữ liệu chính.",
            "Khi một user CRUD dữ liệu, các user khác trong cùng Workspace tự động re-render dữ liệu.",
            "Không yêu cầu refresh trang thủ công."
          ]
        }
      ]
    },
    {
      "moduleName": "Mobile Responsive",
      "features": [
        {
          "featureName": "Mobile Layout",
          "description": "Tối ưu toàn bộ ứng dụng cho thiết bị di động.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "Target kích thước 360px – 430px.",
            "Giảm Font size, Input height, Button height, Padding, Margin và Card spacing.",
            "Desktop giữ nguyên layout hiện tại, không làm nhỏ giao diện desktop chỉ để sửa mobile."
          ]
        },
        {
          "featureName": "Responsive Tables",
          "description": "Bảng dữ liệu không làm tràn toàn bộ trang.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "Bảng không được tràn màn hình.",
            "Nếu cần, horizontal scroll chỉ nằm trong chính bảng.",
            "Không tạo horizontal scroll cho toàn trang."
          ]
        },
        {
          "featureName": "Responsive Cards",
          "description": "Tối ưu kích thước và khả năng đọc của Card.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "Card được thu gọn.",
            "Card hỗ trợ Expand/Collapse.",
            "Card không quá cao.",
            "Nội dung dễ đọc."
          ]
        },
        {
          "featureName": "Responsive Buttons",
          "description": "Đảm bảo button phù hợp viewport và thao tác cảm ứng.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "Button không tràn khỏi viewport.",
            "Button có thể wrap khi cần.",
            "Touch target tối thiểu khoảng 40x40px."
          ]
        },
        {
          "featureName": "Responsive Dialogs",
          "description": "Đảm bảo Dialog hiển thị gọn trên mobile.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "Dialog phải nằm gọn trong viewport mobile."
          ]
        }
      ]
    },
    {
      "moduleName": "Excel Import / Export",
      "features": [
        {
          "featureName": "Import Excel",
          "description": "Nhập danh mục và lịch sử giao dịch từ file Excel.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [
            {
              "fieldName": "file",
              "type": "Excel .xlsx",
              "required": true,
              "validation": "File Excel định dạng .xlsx"
            }
          ],
          "businessRules": [
            "Hỗ trợ import danh mục/lịch sử từ Excel.",
            "Sổ cái ban đầu vẫn phải sạch 100%; tài sản cụ thể được tạo từ dữ liệu người dùng nhập."
          ]
        },
        {
          "featureName": "Export Excel",
          "description": "Xuất dữ liệu báo cáo và T+ History.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "Cho phép export toàn bộ dữ liệu báo cáo ra .xlsx.",
            "Cho phép export T+ History ra .xlsx."
          ]
        }
      ]
    },
    {
      "moduleName": "Data Initialization",
      "features": [
        {
          "featureName": "Preset Asset Types",
          "description": "Hệ thống có sẵn danh sách nhóm tài sản chuẩn.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "Preset Asset Types gồm DCDS, ETF, Stock (VPS/SSI), Bank và Crypto.",
            "Không tạo sẵn tài sản cụ thể."
          ]
        },
        {
          "featureName": "Specific Holding Creation",
          "description": "Người dùng tự tạo tài sản cụ thể bằng nhập tay hoặc import Excel.",
          "userRoles": [
            "All Workspace Users"
          ],
          "inputs": [],
          "businessRules": [
            "Sổ cái trống 100% khi bắt đầu.",
            "Tài sản cụ thể do người dùng tự tạo.",
            "Form sử dụng Strict Schemas theo từng loại tài sản.",
            "Khi chọn Stock, form hiện các trường: Mã CP, Giá vốn, Loại cổ tức (Tiền/Cổ phiếu).",
            "Khi chọn Bank, form chuyển sang trường ngân hàng, lãi suất, kỳ hạn...",
            "Người dùng tự nhập mã tài sản (Free-text string). Ví dụ: code cổ phiếu in hoa (VD: VCI, HPG), Crypto (VD: BTC, ETH), ETF (VD: E1VFVN30).",
            "Không tạo dữ liệu giả.",
            "Không dùng dữ liệu hard-code để hiển thị."
          ]
        }
      ]
    }
  ],
  "systemFlow": {
    "dashboard": "Tổng quan Portfolio thật",
    "tradeTPlus": "Phân tích giao dịch T+ thật + Phân tích hạ giá vốn + Phân tích hòa vốn"
  },
  "dataConsistencyPrinciples": {
    "rebuildTrigger": "Mọi thao tác Create, Edit, Delete đều phải rebuild/recalculate:",
    "recalculatedEntities": [
      "Holdings",
      "Average Cost",
      "Realized P/L",
      "Unrealized P/L",
      "T+ cycles",
      "T+ profit",
      "Cost reduction",
      "Break-even",
      "Dashboard"
    ],
    "prohibitions": [
      "Không dùng dữ liệu hard-code.",
      "Không tạo dữ liệu giả để hiển thị.",
      "Không được biến Trade T+ thành Simulator."
    ]
  }
}
### Cơ chế khớp Trade T+ (BẮT BUỘC — thủ công, không tự động)

- Trade T+ KHÔNG chạy khớp tự động.
- Không dùng Smart Matching / FIFO / auto-assign lot.
- Khi tạo SELL (hoặc SELL gắn T+), người dùng phải CHỌN THỦ CÔNG:
  - Lô Buy T+ nào được khớp (theo buyTxId / lot đang OPEN),
  - Số lượng khớp (cho phép partial: bán một phần lô).
- Mỗi lệnh BUY có tradeTplus = true tạo một lô OPEN riêng (định danh bằng id lệnh mua).
- VPS chỉ được khớp với lô VPS; SSI với SSI; Crypto với Crypto.
- Chỉ phần đã khớp COMPLETED mới tính lãi T+ ròng và mới được trừ vào giá vốn gốc.
- Phần còn lại của lô vẫn OPEN; card T+ vẫn hiện nếu còn qty OPEN > 0.
Form Sell khi mã đang có lô T+ OPEN:
- Hiển thị danh sách lô OPEN (ngày mua, giá mua, qty còn lại).
- User tick / chọn lô + nhập số lượng khớp.
- Không có nút “Khớp tự động”.
- Cho phép không khớp T+ (bán vào vị thế gốc) nếu user không chọn lô T+.
YÊU CẦU SẢN PHẨM (không đổi):
T+ không chạy tự động, mà chọn thủ công.
Mọi mô tả “tự match / smart match” đều trái yêu cầu và phải bỏ.