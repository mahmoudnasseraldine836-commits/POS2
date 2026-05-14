import { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";

// ── الإعدادات والعملات ──────────────────────────────────────
const RATE = 90000;
const API_URL = "/api";

const formatUSD = (n) => `$${Number(n || 0).toFixed(2)}`;
const formatLBP = (n) =>
  `${Math.round((n || 0) * RATE).toLocaleString()} ل.ل`;

// ── الألوان ─────────────────────────────────────────────────
const theme = {
  bg: "#101113",
  surface: "#1a1b1e",
  border: "#373a40",
  text: "#c1c2c5",
  textMuted: "#909296",
  primary: "#339af0",
  danger: "#fa5252",
  success: "#40c057",
};

// ── التنسيقات ───────────────────────────────────────────────
const styles = {
  btn: {
    padding: "10px 16px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    transition: "0.2s",
  },

  input: {
    padding: "12px",
    borderRadius: "10px",
    border: `1px solid ${theme.border}`,
    background: "#000",
    color: "#fff",
    width: "100%",
    outline: "none",
    boxSizing: "border-box",
  },

  card: {
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: "14px",
    padding: "16px",
  },
};

// ── مكون السكانر ────────────────────────────────────────────
function Scanner({ id, onScan, onClose }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
      if (!isMounted) return;

      const scanner = new Html5QrcodeScanner(
        id,
        { fps: 10, qrbox: 250 },
        false
      );

      scannerRef.current = scanner;

      scanner.render(
        (code) => {
          onScan(code);
          scanner.clear();
        },
        () => {}
      );
    });

    return () => {
      isMounted = false;

      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, [id, onScan]);

  return (
    <div style={{ ...styles.card, marginBottom: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "10px",
        }}
      >
        <span style={{ color: theme.text }}>
          وجه الكاميرا نحو الباركود...
        </span>

        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: theme.danger,
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          إغلاق ✕
        </button>
      </div>

      <div
        id={id}
        style={{
          borderRadius: "8px",
          overflow: "hidden",
        }}
      ></div>
    </div>
  );
}

// ── التطبيق الرئيسي ─────────────────────────────────────────
export default function POSApp() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [tab, setTab] = useState("pos");
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState("");

  const [posSearch, setPosSearch] = useState("");
  const [showPosScanner, setShowPosScanner] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [showFormScanner, setShowFormScanner] = useState(false);

  const [inputCurrency, setInputCurrency] = useState("USD");

  const [form, setForm] = useState({
    name: "",
    price: "",
    stock: "",
    code: "",
    image: "",
  });

  const showToast = (msg) => {
    setNotification(msg);

    setTimeout(() => {
      setNotification("");
    }, 3000);
  };

  useEffect(() => {
    if (!document.getElementById("tabler-icons")) {
      const link = document.createElement("link");

      link.id = "tabler-icons";
      link.rel = "stylesheet";

      link.href =
        "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css";

      document.head.appendChild(link);
    }

    fetchProducts();
  }, []);

  // ── جلب المنتجات ─────────────────────────────────────────
  const fetchProducts = async () => {
    try {
      setLoading(true);

      const res = await axios.get(`${API_URL}/products`);

      setProducts(res.data);
    } catch (err) {
      showToast("⚠️ تعذر الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  };

  // ── مجموع السلة ──────────────────────────────────────────
  const cartTotalUSD = useMemo(() => {
    return cart.reduce((total, item) => {
      return total + item.price * item.qty;
    }, 0);
  }, [cart]);

  // ── إضافة للسلة ─────────────────────────────────────────
  const addToCart = (code) => {
    const product = products.find((p) => p.code === code.trim());

    if (!product) {
      return showToast("❌ المنتج غير موجود");
    }

    setCart((prevCart) => {
      const existing = prevCart.find(
        (item) => item._id === product._id
      );

      if (existing) {
        if (existing.qty >= product.stock) {
          showToast("⚠️ الكمية تتجاوز المخزون");
          return prevCart;
        }

        return prevCart.map((item) =>
          item._id === product._id
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      }

      if (product.stock <= 0) {
        showToast("⚠️ المنتج نفد");
        return prevCart;
      }

      return [...prevCart, { ...product, qty: 1 }];
    });

    setPosSearch("");
  };

  // ── حذف من السلة ────────────────────────────────────────
  const removeFromCart = (id) => {
    setCart(cart.filter((item) => item._id !== id));
  };

  // ── إتمام البيع ─────────────────────────────────────────
  const completeSale = async () => {
    if (cart.length === 0) return;

    try {
      await axios.post(`${API_URL}/sales`, { cart });

      setProducts((prevProducts) =>
        prevProducts.map((p) => {
          const cartItem = cart.find((c) => c._id === p._id);

          return cartItem
            ? {
                ...p,
                stock: p.stock - cartItem.qty,
              }
            : p;
        })
      );

      setCart([]);

      showToast("✅ تمت عملية البيع");
    } catch (err) {
      showToast("❌ فشل البيع");
    }
  };

  // ── إضافة منتج ─────────────────────────────────────────
  const handleAddProduct = async () => {
    if (!form.name || !form.price || !form.code) {
      return showToast("⚠️ املأ الحقول المطلوبة");
    }

    const priceValue = parseFloat(form.price) || 0;

    const finalPriceUSD =
      inputCurrency === "LBP"
        ? priceValue / RATE
        : priceValue;

    const newProduct = {
      name: form.name,
      price: finalPriceUSD,
      stock: parseInt(form.stock) || 0,
      code: form.code,

      image:
        form.image ||
        "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=400",
    };

    try {
      const res = await axios.post(
        `${API_URL}/products`,
        newProduct
      );

      setProducts([res.data, ...products]);

      setForm({
        name: "",
        price: "",
        stock: "",
        code: "",
        image: "",
      });

      setShowAddForm(false);

      showToast("✅ تمت إضافة المنتج");
    } catch (err) {
      showToast("❌ فشل الحفظ");
    }
  };

  // ── حذف منتج ───────────────────────────────────────────
  const deleteProduct = async (id) => {
    if (!window.confirm("هل تريد حذف المنتج؟")) return;

    try {
      await axios.delete(`${API_URL}/products/${id}`);

      setProducts(products.filter((p) => p._id !== id));

      removeFromCart(id);

      showToast("🗑️ تم حذف المنتج");
    } catch (err) {
      showToast("❌ فشل الحذف");
    }
  };

  // ── شاشة التحميل ───────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          background: theme.bg,
          height: "100vh",
          color: "#fff",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        جاري التحميل...
      </div>
    );
  }

  return (
    <div
      style={{
        background: theme.bg,
        minHeight: "100vh",
        color: theme.text,
        padding: "20px",
        direction: "rtl",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* ── CSS Responsive كامل ───────────────────────── */}
      <style>
        {`
          *{
            box-sizing:border-box;
          }

          body{
            margin:0;
            overflow-x:hidden;
          }

          .tabs-layout{
            display:flex;
            gap:10px;
            margin-bottom:24px;
          }

          .pos-layout{
            display:grid;
            grid-template-columns:1fr 360px;
            gap:20px;
            align-items:start;
          }

          .products-grid{
            display:grid;
            grid-template-columns:repeat(auto-fill,minmax(170px,1fr));
            gap:16px;
          }

          .cart-container{
            position:sticky;
            top:20px;
            width:100%;
            max-width:100%;
            overflow:hidden;
          }

          .cart-items{
            min-height:150px;
            max-height:400px;
            overflow-y:auto;
            overflow-x:hidden;
          }

          .cart-item{
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:10px;
            margin-bottom:12px;
            background:#000;
            padding:10px;
            border-radius:10px;
            width:100%;
            overflow:hidden;
          }

          .cart-item-left{
            flex:1;
            min-width:0;
          }

          .cart-item-name{
            color:#fff;
            font-weight:bold;
            font-size:14px;
            overflow:hidden;
            text-overflow:ellipsis;
            white-space:nowrap;
          }

          .cart-item-price{
            font-size:12px;
            color:${theme.textMuted};
          }

          .cart-item-total{
            font-size:13px;
            font-weight:bold;
            color:#fff;
            white-space:nowrap;
          }

          .form-layout{
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:16px;
          }

          .table-responsive{
            overflow-x:auto;
            width:100%;
          }

          table{
            min-width:700px;
          }

          /* ───────── Tablet ───────── */
          @media(max-width:1024px){

            .pos-layout{
              grid-template-columns:1fr;
            }

            .cart-container{
              position:relative;
              top:0;
              margin-top:20px;
            }
          }

          /* ───────── Mobile ───────── */
          @media(max-width:768px){

            .tabs-layout{
              flex-direction:column;
            }

            .products-grid{
              grid-template-columns:repeat(2,1fr);
              gap:12px;
            }

            .form-layout{
              grid-template-columns:1fr;
            }

            .cart-container{
              width:100%;
              padding:14px;
            }

            .cart-item{
              flex-direction:column;
              align-items:flex-start;
            }

            .cart-item-total{
              width:100%;
              text-align:left;
            }

            .mobile-search{
              flex-direction:column;
            }

            .mobile-search button{
              width:100%;
            }
          }

          /* ───────── Small Phones ───────── */
          @media(max-width:480px){

            .products-grid{
              grid-template-columns:1fr;
            }

            .cart-container h2{
              font-size:16px !important;
            }

            .cart-item-name{
              font-size:13px;
            }

            .cart-item-total{
              font-size:12px;
            }
          }
        `}
      </style>

      {/* ── الإشعارات ───────────────────────────────── */}
      {notification && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            background: theme.primary,
            color: "#fff",
            padding: "12px 20px",
            borderRadius: "10px",
            zIndex: 9999,
            maxWidth: "90%",
            textAlign: "center",
          }}
        >
          {notification}
        </div>
      )}

      {/* ── التبويبات ───────────────────────────────── */}
      <div className="tabs-layout">
        <button
          onClick={() => setTab("pos")}
          style={{
            ...styles.btn,
            flex: 1,
            background:
              tab === "pos"
                ? theme.primary
                : theme.surface,
            color: "#fff",
          }}
        >
          <i className="ti ti-device-desktop-analytics"></i>
          نقطة البيع
        </button>

        <button
          onClick={() => setTab("inventory")}
          style={{
            ...styles.btn,
            flex: 1,
            background:
              tab === "inventory"
                ? theme.primary
                : theme.surface,
            color: "#fff",
          }}
        >
          <i className="ti ti-packages"></i>
          إدارة المخزون
        </button>
      </div>

      {/* ═══════════ POS ═══════════ */}
      {tab === "pos" && (
        <div className="pos-layout">
          {/* المنتجات */}
          <div>
            <div
              className="mobile-search"
              style={{
                display: "flex",
                gap: "10px",
                marginBottom: "20px",
              }}
            >
              <button
                onClick={() =>
                  setShowPosScanner(!showPosScanner)
                }
                style={{
                  ...styles.btn,
                  background: theme.surface,
                  color: "#fff",
                  border: `1px solid ${theme.border}`,
                }}
              >
                <i className="ti ti-barcode"></i>
              </button>

              <input
                style={styles.input}
                placeholder="ابحث أو امسح الباركود..."
                value={posSearch}
                onChange={(e) =>
                  setPosSearch(e.target.value)
                }
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  addToCart(posSearch)
                }
              />
            </div>

            {showPosScanner && (
              <Scanner
                id="pos-cam"
                onScan={(c) => {
                  addToCart(c);
                  setShowPosScanner(false);
                }}
                onClose={() =>
                  setShowPosScanner(false)
                }
              />
            )}

            <div className="products-grid">
              {products
                .filter(
                  (p) =>
                    p.name
                      .toLowerCase()
                      .includes(
                        posSearch.toLowerCase()
                      ) ||
                    p.code === posSearch
                )
                .map((p) => (
                  <div
                    key={p._id}
                    onClick={() => addToCart(p.code)}
                    style={{
                      ...styles.card,
                      cursor:
                        p.stock > 0
                          ? "pointer"
                          : "not-allowed",
                      opacity: p.stock > 0 ? 1 : 0.5,
                    }}
                  >
                    <img
                      src={p.image}
                      alt={p.name}
                      style={{
                        width: "100%",
                        height: "120px",
                        objectFit: "cover",
                        borderRadius: "10px",
                        marginBottom: "10px",
                      }}
                    />

                    <h3
                      style={{
                        color: "#fff",
                        margin: 0,
                        marginBottom: "8px",
                        fontSize: "15px",
                      }}
                    >
                      {p.name}
                    </h3>

                    <div
                      style={{
                        color: theme.primary,
                        fontWeight: "bold",
                      }}
                    >
                      {formatUSD(p.price)}
                    </div>

                    <div
                      style={{
                        color: theme.textMuted,
                        fontSize: "12px",
                      }}
                    >
                      {formatLBP(p.price)}
                    </div>

                    <div
                      style={{
                        marginTop: "10px",
                        color:
                          p.stock > 5
                            ? theme.success
                            : theme.danger,
                        fontSize: "12px",
                      }}
                    >
                      {p.stock > 0
                        ? `المتبقي ${p.stock}`
                        : "نفد المخزون"}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* الفاتورة */}
          <div
            className="cart-container"
            style={styles.card}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: "20px",
                borderBottom: `1px solid ${theme.border}`,
                paddingBottom: "10px",
                color: "#fff",
              }}
            >
              🛒 الفاتورة الحالية
            </h2>

            <div className="cart-items">
              {cart.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    marginTop: "40px",
                    color: theme.textMuted,
                  }}
                >
                  السلة فارغة
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item._id}
                    className="cart-item"
                  >
                    <div className="cart-item-left">
                      <div className="cart-item-name">
                        {item.name}
                      </div>

                      <div className="cart-item-price">
                        {item.qty} ×{" "}
                        {formatUSD(item.price)}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <div className="cart-item-total">
                        {formatUSD(
                          item.price * item.qty
                        )}
                      </div>

                      <button
                        onClick={() =>
                          removeFromCart(item._id)
                        }
                        style={{
                          background: "none",
                          border: "none",
                          color: theme.danger,
                          cursor: "pointer",
                        }}
                      >
                        <i className="ti ti-trash"></i>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div
              style={{
                borderTop: `1px solid ${theme.border}`,
                paddingTop: "15px",
                marginTop: "15px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                  fontWeight: "bold",
                  color: "#fff",
                }}
              >
                <span>المجموع</span>
                <span>{formatUSD(cartTotalUSD)}</span>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  color: theme.textMuted,
                  fontSize: "13px",
                }}
              >
                <span>بالليرة</span>
                <span>{formatLBP(cartTotalUSD)}</span>
              </div>
            </div>

            <button
              onClick={completeSale}
              disabled={cart.length === 0}
              style={{
                ...styles.btn,
                marginTop: "20px",
                width: "100%",
                background:
                  cart.length > 0
                    ? theme.success
                    : theme.surface,
                color: "#fff",
                padding: "14px",
              }}
            >
              <i className="ti ti-check"></i>
              إتمام البيع
            </button>
          </div>
        </div>
      )}
    </div>
  );
}