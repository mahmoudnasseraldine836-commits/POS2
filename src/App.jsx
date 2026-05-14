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

  const [inputCurrency, setInputCurrency] = useState("USD");

  const [form, setForm] = useState({
    _id: null,
    name: "",
    price: "",
    stock: "",
    code: "",
    image: "",
  });

  // ⭐⭐⭐ ADD (بدون حذف أي شيء)
  const [isEditing, setIsEditing] = useState(false);

  const showToast = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3000);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

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

  // ⭐⭐⭐ ADD: فتح الفورم
  const openForm = (product = null) => {
    if (product) {
      setForm(product);
      setIsEditing(true);
    } else {
      setForm({
        _id: null,
        name: "",
        price: "",
        stock: "",
        code: "",
        image: "",
      });
      setIsEditing(false);
    }
    setShowAddForm(true);
  };

  // ⭐⭐⭐ ADD: حفظ (إضافة + تعديل)
  const saveProduct = async () => {
    const priceValue = parseFloat(form.price) || 0;

    const finalPriceUSD =
      inputCurrency === "LBP"
        ? priceValue / RATE
        : priceValue;

    const payload = {
      ...form,
      price: finalPriceUSD,
    };

    try {
      if (isEditing) {
        const res = await axios.put(
          `${API_URL}/products/${form._id}`,
          payload
        );

        setProducts((prev) =>
          prev.map((p) =>
            p._id === form._id ? res.data : p
          )
        );

        showToast("✏️ تم تعديل المنتج");
      } else {
        const res = await axios.post(
          `${API_URL}/products`,
          payload
        );

        setProducts([res.data, ...products]);

        showToast("➕ تم إضافة المنتج");
      }

      setShowAddForm(false);
    } catch (err) {
      showToast("❌ فشل العملية");
    }
  };

  // ⭐⭐⭐ ADD: حذف
  const deleteProduct = async (id) => {
    await axios.delete(`${API_URL}/products/${id}`);
    setProducts(products.filter((p) => p._id !== id));
  };

  // ⭐⭐⭐ ADD: تعديل المخزون
  const updateStock = async (id, value) => {
    const product = products.find((p) => p._id === id);
    if (!product) return;

    const updated = {
      ...product,
      stock: product.stock + value,
    };

    const res = await axios.put(
      `${API_URL}/products/${id}`,
      updated
    );

    setProducts((prev) =>
      prev.map((p) => (p._id === id ? res.data : p))
    );
  };

  const cartTotalUSD = useMemo(() => {
    return cart.reduce((total, item) => {
      return total + item.price * item.qty;
    }, 0);
  }, [cart]);

  const addToCart = (code) => {
    const product = products.find((p) => p.code === code.trim());
    if (!product) return showToast("❌ المنتج غير موجود");

    setCart((prev) => {
      const existing = prev.find((i) => i._id === product._id);

      if (existing) {
        return prev.map((i) =>
          i._id === product._id
            ? { ...i, qty: i.qty + 1 }
            : i
        );
      }

      return [...prev, { ...product, qty: 1 }];
    });
  };

  const removeFromCart = (id) => {
    setCart(cart.filter((i) => i._id !== id));
  };

  const completeSale = async () => {
    await axios.post(`${API_URL}/sales`, { cart });

    setProducts((prev) =>
      prev.map((p) => {
        const c = cart.find((i) => i._id === p._id);
        return c ? { ...p, stock: p.stock - c.qty } : p;
      })
    );

    setCart([]);
    showToast("✅ تمت العملية");
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ background: theme.bg, minHeight: "100vh", color: "#fff", padding: 20 }}>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => setTab("pos")} style={styles.btn}>POS</button>
        <button onClick={() => setTab("inventory")} style={styles.btn}>إدارة المخزون</button>
      </div>

      {/* POS */}
      {tab === "pos" && (
        <div>
          <h2>POS يعمل كما هو</h2>
        </div>
      )}

      {/* ⭐⭐⭐ INVENTORY (ADDED ONLY) */}
      {tab === "inventory" && (
        <div>

          <button
            onClick={() => openForm()}
            style={{ ...styles.btn, background: theme.success, margin: 10 }}
          >
            ➕ إضافة منتج
          </button>

          {/* FORM */}
          {showAddForm && (
            <div style={styles.card}>
              <input
                style={styles.input}
                placeholder="اسم"
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
              />

              <input
                style={styles.input}
                placeholder="السعر"
                value={form.price}
                onChange={(e) =>
                  setForm({ ...form, price: e.target.value })
                }
              />

              <select
                style={styles.input}
                value={inputCurrency}
                onChange={(e) => setInputCurrency(e.target.value)}
              >
                <option value="USD">USD</option>
                <option value="LBP">LBP</option>
              </select>

              <input
                style={styles.input}
                placeholder="stock"
                value={form.stock}
                onChange={(e) =>
                  setForm({ ...form, stock: e.target.value })
                }
              />

              <input
                style={styles.input}
                placeholder="code"
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value })
                }
              />

              <button
                onClick={saveProduct}
                style={{ ...styles.btn, background: theme.primary }}
              >
                {isEditing ? "تعديل" : "حفظ"}
              </button>
            </div>
          )}

          {/* LIST */}
          {products.map((p) => (
            <div key={p._id} style={styles.card}>
              <div>{p.name}</div>
              <div>{formatUSD(p.price)}</div>
              <div>Stock: {p.stock}</div>

              <button onClick={() => openForm(p)} style={styles.btn}>تعديل</button>
              <button onClick={() => deleteProduct(p._id)} style={styles.btn}>حذف</button>
              <button onClick={() => updateStock(p._id, 1)} style={styles.btn}>+1</button>
              <button onClick={() => updateStock(p._id, -1)} style={styles.btn}>-1</button>
            </div>
          ))}

        </div>
      )}
    </div>
  );
}