{
  "project": {
    "title": "QUẢN LÝ DANH MỤC & QUẢN LÝ TRADE T+",
    "version": "3.0 Specification",
    "architecture_pattern": "Asset-Only Ledger",
    "type": "Single Page Application (SPA)"
  },
  "1_overview_and_core_objectives": {
    "app_name": "Portfolio Manager SPA",
    "description": "Ứng dụng web Single Page Application (SPA) quản lý danh mục đầu tư tài chính cá nhân đa tài sản theo mô hình Thuần Tài Sản (Asset-Only Ledger).",
    "supported_categories": [
      "DCDS",
      "ETF",
      "Stock (VPS/SSI)",
      "Crypto",
      "Bank (Tiết kiệm Ngân hàng)"
    ],
    "core_objectives": [
      "Giám sát giá trị danh mục tài sản thực tế (Net Asset Value - NAV).",
      "Hạch toán giao dịch & P&L (Realized/Unrealized P&L, Cổ tức tiền mặt/cổ phiếu, Lãi Bank).",
      "Phân tích chiến lược Trade T+ hỗ trợ hạ giá vốn vị thế gốc.",
      "Giám sát vốn, tỷ lệ phân bổ, lợi nhuận/thua lỗ (P&L) và hiệu suất đầu tư."
    ],
    "interface_flexibility": "Thiết kế tối ưu cho máy tính để bàn (Desktop-first) và thân thiện với thiết bị di động (Mobile-friendly).",
    "sync_and_offline": "Đồng bộ hóa dữ liệu theo thời gian thực (Realtime sync) qua nút bấm cập nhật tức thì (không cần cập nhật liên tục).",
    "five_core_questions": [
      "Tôi đã bỏ vào bao nhiêu vốn gốc?",
      "Mã này hiện giá vốn thực tế là bao nhiêu?",
      "Tôi đã dùng T+ để hạ giá vốn được bao nhiêu?",
      "Tôi còn lỗ bao nhiêu và giá nào thì hòa vốn?",
      "Lệnh T+ hiện tại mua ở bao nhiêu, nên bán ở bao nhiêu để tiếp tục xoay vòng vốn?"
    ]
  },
  "2_tech_stack_and_infrastructure": {
    "frontend": "React + TypeScript + Vite + Tailwind CSS",
    "backend": "Supabase (PostgreSQL, Auth, Edge Functions)",
    "deployment_and_infrastructure": "GitHub / Vercel / Cloudflare Pages",
    "target_operating_cost": "0đ trọn đời",
    "ui_and_theme": "Navy Blue + White, hỗ trợ Dark/Light Mode toggle, Material Design 3",
    "mobile_responsive": {
      "target_screen_size": "360px – 430px",
      "touch_target_minimum": "40x40px",
      "table_behavior": "Sử dụng horizontal scroll nội bộ (không tràn body)",
      "mobile_optimization": "Tối ưu riêng font chữ, cỡ chữ và kích thước card"
    }
  },
  "3_language_and_sorting_rules": {
    "category_sorting_order": [
      "DCDS",
      "ETF",
      "Stock",
      "Crypto",
      "Bank"
    ],
    "reserved_keywords_untranslated": [
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
    "main_sections": [
      "Dashboard",
      "Asset Module / giao dịch",
      "Trade T+",
      "Reports",
      "Settings",
      "Profile"
    ],
    "price_and_units": {
      "default_currency": "VND",
      "currency_switch": "Có nút ấn chuyển đổi sang USD đặt tại Header",
      "display_format": "Hiển thị tương tự các công ty chứng khoán (13.5 là 13,500 VNĐ, 100 là 100,000 VNĐ)"
    }
  },
  "4_core_business_rules": {
    "4_1_original_capital": {
      "formula": "Original Capital = SUM(Deposit) - SUM(Withdrawal)",
      "rules": [
        "Chỉ biến động thông qua nút Nạp/Rút vốn gốc (Deposit/Withdrawal) trên Dashboard.",
        "Tất cả giao dịch Mua/Bán/Gửi Bank/Nhận cổ tức ở các Tab tài sản khác đều KHÔNG làm ảnh hưởng đến Original Capital."
      ]
    },
    "4_2_net_asset_value_nav": {
      "model": "Mô hình Thuần Tài Sản (Asset-Only Ledger): Không quản lý hay duy trì biến số Cash (Tiền mặt/Số dư khả dụng) trung gian.",
      "formula": "NAV = SUM(Giá trị thị trường DCDS + ETF + Stock + Crypto (bao gồm số dư USDT nhập thủ công) + Active Bank Deposits)",
      "usdt_balance_rules": [
        "Người dùng có thể nhập và chỉnh sửa số dư USDT bằng USD trong tab Crypto.",
        "Số dư USDT quy đổi theo tỷ giá USD/VND hiện tại và chỉ cộng vào NAV Crypto; không có giá vốn, giao dịch BUY/SELL hoặc Trade T+.",
        "P&L NAV − Original vẫn bao gồm số dư USDT; USDT vẫn hiện trên biểu đồ phân bổ Crypto khi số dư bằng 0."
      ]
    },
    "4_3_currency_storage_and_display_rules": {
      "db_storage": {
        "VND": "Lưu số nguyên đầy đủ (Ví dụ: Nhập 13.5 hoặc 13,500 -> DB lưu 13500)",
        "Crypto_USD": "Lưu số thực chuẩn (Ví dụ: 65000.50)"
      },
      "ui_display": "Tương tự các bảng điện chứng khoán Việt Nam (13.5 = 13,500 VNĐ, 100 = 100,000 VNĐ). Nút ấn chuyển đổi giao diện VND / USD đặt tại Header."
    }
  },
  "5_module_specifications": {
    "5_1_stock_and_etf": {
      "brokerage_accounts": {
        "accounts": [
          "VPS",
          "SSI"
        ],
        "isolation": "Độc lập hoàn toàn về Holdings, Average Cost, P&L và T+ matching.",
        "dashboard_filter": [
          "All",
          "VPS",
          "SSI"
        ]
      },
      "charts": "Có biểu đồ tròn thể hiện % các mã nắm giữ cho cả VPS và SSI",
      "accumulated_profit_loss_breakdown": {
        "realized_pnl_from_trade": "Tổng chênh lệch ((Giá Bán - Giá Mua) * Số lượng - Phí - Thuế)",
        "cash_dividend": "Tổng tiền nhận từ giao dịch cổ tức tiền mặt",
        "stock_dividend": "Tổng số lượng/giá trị cổ phiếu thưởng thực nhận"
      },
      "dividend_transactions": {
        "restriction": "Phần cổ tức chỉ có ở Cổ phiếu; cổ tức mới được ghi nhận bằng sự kiện GDKHQ, không tạo giao dịch cổ tức riêng.",
        "types": {
          "cash_dividend": "Sự kiện GDKHQ tính tổng cổ tức gộp = lượng cổ phiếu đủ điều kiện × tỷ lệ trên mệnh giá 10.000đ/CP; giá vốn/CP giảm trực tiếp bằng cổ tức/CP nhưng không thấp hơn 0. Không cần giá tham chiếu; chưa trừ thuế hoặc đối chiếu tiền thực nhận.",
          "stock_dividend": "Sự kiện GDKHQ tăng Holdings theo tỷ lệ cổ phiếu thưởng (làm tròn xuống riêng theo broker), giữ nguyên tổng giá vốn và tính lại giá vốn/CP."
        }
      },
      "rights_issue": {
        "formula": "Giá vốn mới = (Số CP cũ × Giá vốn cũ + Số CP đăng ký mua × Giá mua ưu đãi) / Tổng số CP sau khi mua",
        "rules": [
          "Lưu tỷ lệ quyền, giá mua ưu đãi và số CP đăng ký riêng cho từng broker.",
          "Số đăng ký không vượt quyền ước tính từ lượng sở hữu trước GDKHQ.",
          "Cộng lượng CP mua và giá vốn vào danh mục tại ngày thanh toán; nếu thiếu ngày thanh toán thì dùng ngày GDKHQ."
        ]
      }
    },
    "5_2_trade_t_plus": {
      "scope": {
        "applied_to": [
          "Stock (VPS/SSI)",
          "Crypto"
        ],
        "excluded_from": [
          "DCDS",
          "ETF",
          "Bank"
        ]
      },
      "purpose": "Người dùng đang giữ một mã bị lỗ -> mua thêm ở giá thấp -> bán phần mua thêm khi giá hồi -> lấy lợi nhuận/vốn đó tiếp tục xoay vòng T+ -> đồng thời theo dõi giá vốn thực tế của toàn bộ vị thế đã được hạ xuống bao nhiêu và còn cách hòa vốn bao xa.",
      "t_plus_flag_mechanism": "Khi tạo giao dịch BUY, nếu tick chọn Trade T+ = true, lệnh sẽ đưa vào phân tích T+; nếu false, tính trực tiếp vào vị thế gốc.",
      "t_plus_matching_mechanism": "Smart Matching: VPS chỉ match với VPS, SSI chỉ match with SSI, Crypto chỉ match với Crypto. Hỗ trợ Partial Matching (Bán một phần).",
      "t_plus_cost_column_display": {
        "open_or_unclosed_t_plus": "Hiển thị: 0 / Giá vốn gốc",
        "closed_profitable_t_plus": "Hiển thị: Giá vốn mới sau khi trừ lãi T+ / Giá vốn gốc"
      },
      "t_plus_profit_formula": "T+ Profit = ((Giá bán - Giá mua) * Khối lượng) - Phí - Thuế",
      "t_plus_adjusted_cost_formula": "Giá vốn mới = (Vốn gốc ban đầu - Tổng lợi nhuận T+ ròng đã COMPLETED) / Số lượng cổ phiếu còn lại",
      "t_plus_cycle_logic_example": {
        "original_position": "1,000 CP * 30,000 = 30,000,000 VNĐ",
        "t_plus_execution": "Mua 200 CP * 25,000 VNĐ -> Bán 200 CP * 26,000 VNĐ -> Net Profit = 180,000 VNĐ",
        "state_1_open_t_plus": {
          "trade_quantity": "200 / 1,000",
          "trade_price": "25,000 / 30,000",
          "note": "Lệnh 200 vẫn đang tồn tại -> chưa được tính lợi nhuận giảm giá vốn."
        },
        "state_2_closed_t_plus": {
          "trade_quantity": "0 / 1,000",
          "accumulated_t_plus_profit": 180000,
          "new_cost_price": "(30,000,000 - 180,000) / 1,000 = 29,820 VNĐ/CP",
          "note": "200 CP không còn nằm trong Số lượng Trade. Lợi nhuận T+ ròng trừ vào vốn gốc -> giá vốn gốc được hạ xuống từ 30,000 về 29,820."
        },
        "state_3_new_t_plus_cycle": {
          "new_buy": "150 CP * 24,000 VNĐ",
          "trade_quantity": "150 / 1,000",
          "trade_price": "24,000 / 29,820",
          "note": "30,000 ban đầu đã được hạ xuống 29,820 nhờ các vòng T+ trước, nhưng số lượng gốc vẫn là 1,000. Web phải nhận biết đây là một T+ cycle."
        }
      },
      "card_visibility": "Các mã/Card ở T+ chỉ hiển thị khi có lệnh T+ đang OPEN. Nếu không có lệnh T+ hoặc T+ đã COMPLETED thì không hiển thị trong tab T+ (vẫn lưu trong phần lịch sử T+).",
      "t_plus_history_and_export": {
        "purpose": "Lưu ở phần lịch sử T+ để tìm xem lại hoặc xuất ra Excel.",
        "fields_to_store": [
          "Code",
          "Account",
          "Buy Date",
          "Sell Date",
          "Holding before T+",
          "Buy Quantity",
          "Buy Price",
          "Sell Quantity",
          "Sell Price",
          "Fees",
          "Tax",
          "Gross Profit",
          "Net Profit",
          "Average Cost Before",
          "Average Cost After",
          "Cost Reduction",
          "Remaining Holding",
          "Remaining Unrealized P/L",
          "Status"
        ]
      },
      "partial_t_plus_rule": {
        "example": "BUY 500, sau đó SELL 300 -> Kết quả: Completed 300, Open 200. Không được coi toàn bộ 500 đã hoàn thành.",
        "portfolio_reflection": "Trade T+ phải phản ánh vào Portfolio (tab Dashboard) thật."
      },
      "active_card_display_fields": {
        "trade_quantity": "Tổng Qty T+ Open / Qty gốc (VD: 200 / 1000)",
        "trade_price": "Giá T+ hiện tại / Giá vốn gốc (VD: 25,000 / 30,000)",
        "suggested_sell_price": {
          "Stock": "+3% so với Giá mua T+",
          "Crypto": "+5% so với Giá mua T+"
        },
        "break_even_price": "Giá bán ra toàn bộ lượng cổ phiếu (Qty gốc + Qty T+) để Net P&L = 0"
      },
      "active_card_quick_actions": {
        "buy_button": "Mở form giao dịch với mã đã được chọn sẵn.",
        "sell_button": "Mở form giao dịch với Mã đã chọn, Account đã chọn, và Giá đề xuất T+ nếu có lệnh T+ đang mở (không bắt người dùng chọn lại mã)."
      }
    },
    "5_3_bank_deposits": {
      "ledger_model": "Thuần tài sản (Asset-Only): Mở sổ tiết kiệm mới không trích trừ số dư Cash.",
      "remaining_days_column": "Đếm ngược số ngày tới thời điểm đáo hạn (120 ngày, 5 ngày, 0 ngày...). Sắp xếp các khoản gần đáo hạn lên trên cùng.",
      "maturity_reminder_banner": "Hiển thị cảnh báo trên Dashboard khi sổ còn 5 ngày. Đếm ngược đến ngày cuối hiển thị 'Hết hôm nay số tiền gửi ngân hàng sẽ...'.",
      "automatic_rollover": {
        "mechanism": "Nếu không rút, hệ thống tự động cộng dồn Lãi vào Gốc, tái gửi theo kỳ hạn cũ, đồng thời tăng chỉ số renewal_count (+1) trên bản ghi hiện tại.",
        "interest_rate_update": "Khi còn 5 ngày đáo hạn thì thông báo nhắc nhở nhập lãi suất mới. Nếu đáo hạn rồi mà chưa nhập thì lấy tạm lãi suất cũ. Trong lúc đó vẫn thông báo 'Vẫn chưa nhập lãi suất kỳ này', đến khi nhập thì cập nhật lãi suất mới."
      },
      "redemption_no_rollover": "Tiền gốc trên Active Bank giảm về 0. Lưu vết toàn bộ dữ liệu vào Bảng 'Lịch sử Đáo hạn' (gồm cả Tiền Gốc thu hồi và Tổng Tiền Lãi thực nhận)."
    },
    "5_4_crypto": {
      "locked_historical_exchange_rates": {
        "formula": "Lãi/Lỗ ròng (VNĐ) = (Giá Bán USD * Tỷ giá Bán VND) - (Giá Mua USD * Tỷ giá Mua VND)",
        "buy_rate": "Tỷ giá BUY_VND được khóa cố định theo lệnh Mua.",
        "sell_rate": "Tỷ giá SELL_VND được khóa cố định theo lệnh Bán."
      }
    },
    "5_5_dcds_open_ended_fund": {
      "buy_form_inputs": [
        "Số tiền mua",
        "Giá CCQ"
      ],
      "automatic_calculation": "Số CCQ = Số tiền mua / Giá CCQ (làm tròn đúng 4 chữ số thập phân roundTo4). Trường Số CCQ là Read-Only."
    },
    "5_6_simulator": {
      "status": "Xóa trình mô phỏng (Simulator) ra khỏi dashboard và toàn bộ ứng dụng."
    }
  },
  "6_engine_architecture": {
    "system_flow": [
      "DASHBOARD -> Tổng quan Portfolio thật",
      "TRADE T+ -> Phân tích giao dịch T+ thật + Phân tích hạ giá vốn + Phân tích hòa vốn"
    ],
    "6_1_replay_engine": {
      "trigger": "Mọi thao tác Tạo / Sửa / Xóa (Create / Edit / Delete) giao dịch bất kỳ trong quá khứ.",
      "steps": [
        "Lọc bỏ các bản ghi đã xóa (Soft delete filter).",
        "Sắp xếp lại toàn bộ giao dịch theo thứ tự thời gian (created_at / transaction_date).",
        "Rebuild lại toàn bộ Holdings (Số lượng tài sản) và Realized/Unrealized P&L.",
        "Recalculate lại Lợi nhuận T+, Giá vốn điều chỉnh T+, Lãi dồn tích Ngân hàng và Cổ tức.",
        "Cập nhật State cho Dashboard và các Asset Tab mà không yêu cầu người dùng Refresh trang thủ công."
      ]
    },
    "6_2_centralized_fees_and_taxes_settings": {
      "settings": "Cài đặt tỷ lệ Phí Mua (%), Phí Bán (%), Thuế Bán (%) tập trung cho VPS, SSI, Crypto, DCDS, ETF tại Settings Page.",
      "override": "Form giao dịch tự động load tỷ lệ mặc định nhưng cho phép đè (override) thủ công.",
      "application": "Phí Mua và Phí/Thuế Bán được trừ riêng ở từng chặng giao dịch tương ứng."
    }
  },
  "7_profile_and_ui_ux": {
    "profile_logout": {
      "ui_element": "Thay nút Logout dạng chữ bằng Icon Đăng xuất",
      "layout": "Email [Logout Icon] (Icon nằm bên phải email, cùng một dòng)",
      "desktop_behavior": "Hover có tooltip 'Đăng xuất'",
      "mobile_behavior": "Touch area tối thiểu 40x40 px"
    },
    "single_source_of_truth": "Tất cả phép tính tài chính bắt buộc đi qua Shared Calculation Engine, tuyệt đối không tính toán trực tiếp trên các Component UI."
  },
  "8_mobile_and_responsive_specifications": {
    "global_rule": "Yêu cầu xuyên suốt toàn web. Tối ưu đặc biệt cho màn hình 360px – 430px.",
    "ui_reductions": [
      "Font size",
      "Input height",
      "Button height",
      "Padding",
      "Margin",
      "Card spacing"
    ],
    "tables": [
      "Không được tràn màn hình.",
      "Nếu cần thì cho horizontal scroll trong chính bảng.",
      "Không làm toàn trang bị horizontal scroll."
    ],
    "cards": [
      "Thu gọn.",
      "Expand/collapse.",
      "Không quá cao.",
      "Nội dung dễ đọc."
    ],
    "buttons": [
      "Không tràn khỏi viewport.",
      "Có thể wrap khi cần.",
      "Touch target tối thiểu khoảng 40x40 px."
    ],
    "dialogs": "Phải nằm gọn trong viewport mobile.",
    "desktop_rule": "Giữ nguyên layout hiện tại, không làm nhỏ giao diện desktop chỉ để sửa mobile."
  },
  "9_data_consistency_strict_principles": {
    "rebuild_trigger": "Mọi thao tác Create, Edit, Delete đều phải rebuild/recalculate:",
    "recalculated_entities": [
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
