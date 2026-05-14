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

      const scanner = new Html5QrcodeScanner(id, { fps: 10, qrbox: 250 }, false);

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
      if (scannerRef.current) scannerRef.current.clear().catch(() => {});
    };
  }, [id, onScan]);

  return (
    <div style={{ ...styles.card, marginBottom: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
        <span style={{ color: theme.text }}>وجه الكاميرا نحو الباركود...</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: theme.danger }}>
          إغلاق ✕
        </button>
      </div>
      <div id={id}></div>
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

  const [form, setForm] = useState({
    name: "",
    price: "",
    stock: "",
    code: "",
    image: "",
  });

  const showToast = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3000);
  };

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css";
    document.head.appendChild(link);

    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/products`);
      setProducts(res.data);
    } catch {
      showToast("⚠️ تعذر الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  };

  const cartTotalUSD = useMemo(() => {
    return cart.reduce((t, i) => t + i.price * i.qty, 0);
  }, [cart]);

  const addToCart = (code) => {
    const product = products.find((p) => p.code === code.trim());

    if (!product) return showToast("❌ المنتج غير موجود");

    setCart((prev) => {
      const exist = prev.find((i) => i._id === product._id);

      if (exist) {
        if (exist.qty >= product.stock) {
          showToast("⚠️ الكمية تتجاوز المخزون");
          return prev;
        }

        return prev.map((i) =>
          i._id === product._id ? { ...i, qty: i.qty + 1 } : i
        );
      }

      if (product.stock <= 0) {
        showToast("⚠️ المنتج نفد");
        return prev;
      }

      return [...prev, { ...product, qty: 1 }];
    });

    setPosSearch("");
  };

  const removeFromCart = (id) => {
    setCart(cart.filter((i) => i._id !== id));
  };

  const completeSale = async () => {
    if (!cart.length) return;

    try {
      await axios.post(`${API_URL}/sales`, { cart });

      setProducts((prev) =>
        prev.map((p) => {
          const c = cart.find((x) => x._id === p._id);
          return c ? { ...p, stock: p.stock - c.qty } : p;
        })
      );

      setCart([]);
      showToast("✅ تمت عملية البيع");
    } catch {
      showToast("❌ فشل البيع");
    }
  };

  // ── إضافة منتج ─────────────────────
  const handleAddProduct = async () => {
    if (!form.name || !form.price || !form.code)
      return showToast("⚠️ املأ الحقول");

    const newProduct = {
      ...form,
      price: parseFloat(form.price),
      stock: parseInt(form.stock || 0),
    };

    try {
      const res = await axios.post(`${API_URL}/products`, newProduct);
      setProducts([res.data, ...products]);
      setForm({ name: "", price: "", stock: "", code: "", image: "" });
      showToast("✅ تمت الإضافة");
    } catch {
      showToast("❌ فشل الإضافة");
    }
  };

  const deleteProduct = async (id) => {
    await axios.delete(`${API_URL}/products/${id}`);
    setProducts(products.filter((p) => p._id !== id));
  };

  if (loading)
    return <div style={{ color: "#fff", padding: 40 }}>جاري التحميل...</div>;

  return (
    <div style={{ background: theme.bg, minHeight: "100vh", padding: 20, color: "#fff" }}>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button onClick={() => setTab("pos")} style={styles.btn}>
          POS
        </button>
        <button onClick={() => setTab("inventory")} style={styles.btn}>
          إدارة المخزون
        </button>
      </div>

      {/* ───── POS ───── */}
      {tab === "pos" && (
        <div>
          <input
            style={styles.input}
            value={posSearch}
            onChange={(e) => setPosSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addToCart(posSearch)}
            placeholder="بحث..."
          />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 20 }}>
            {products.map((p) => (
              <div key={p._id} style={styles.card} onClick={() => addToCart(p.code)}>
                <h4>{p.name}</h4>
                <p>{formatUSD(p.price)}</p>
              </div>
            ))}
          </div>

          <hr />

          <h3>السلة</h3>
          {cart.map((i) => (
            <div key={i._id}>
              {i.name} × {i.qty}
              <button onClick={() => removeFromCart(i._id)}>حذف</button>
            </div>
          ))}

          <h3>المجموع: {formatUSD(cartTotalUSD)}</h3>

          <button onClick={completeSale} style={styles.btn}>
            بيع
          </button>
        </div>
      )}

      {/* ───── INVENTORY ───── */}
      {tab === "inventory" && (
        <div>
          <h2>إدارة المخزون</h2>

          <div style={{ display: "grid", gap: 10 }}>
            <input placeholder="اسم" style={styles.input} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />

            <input placeholder="السعر" style={styles.input} value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })} />

            <input placeholder="الكمية" style={styles.input} value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })} />

            <input placeholder="الكود" style={styles.input} value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })} />

            <button onClick={handleAddProduct} style={styles.btn}>
              إضافة منتج
            </button>
          </div>

          <hr />

          {products.map((p) => (
            <div key={p._id} style={styles.card}>
              {p.name} - {p.stock}
              <button onClick={() => deleteProduct(p._id)}>حذف</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}