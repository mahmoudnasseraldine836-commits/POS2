import { useState, useEffect, useRef, useMemo } from "react";

import axios from "axios";



// ── الإعدادات والعملات ──────────────────────────────────────

const RATE = 90000;

const API_URL = "/api"; // تأكد أن السيرفر يعمل على هذا الرابط

const formatUSD = (n) => `$${Number(n || 0).toFixed(2)}`;

const formatLBP = (n) => `${Math.round((n || 0) * RATE).toLocaleString()} ل.ل`;



// ── الألوان والتنسيقات (Dark Mode) ──────────────────────────

const theme = {

  bg: "#101113", surface: "#1a1b1e", border: "#373a40",

  text: "#c1c2c5", textMuted: "#909296", primary: "#339af0",

  danger: "#fa5252", success: "#40c057",

};



const styles = {

  btn: { padding: "10px 16px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px", transition: "0.2s" },

  input: { padding: "12px", borderRadius: "8px", border: `1px solid ${theme.border}`, background: "#000", color: "#fff", width: "100%", outline: "none", boxSizing: "border-box" },

  card: { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "16px" },

};



// ── مكون الكاميرا (QR/Barcode Scanner) ──────────────────────

function Scanner({ id, onScan, onClose }) {

  const scannerRef = useRef(null);



  useEffect(() => {

    let isMounted = true;

    import("html5-qrcode").then(({ Html5QrcodeScanner }) => {

      if (!isMounted) return;

      const scanner = new Html5QrcodeScanner(id, { fps: 10, qrbox: 250 }, false);

      scannerRef.current = scanner;

      scanner.render(

        (code) => { onScan(code); scanner.clear(); },

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

        <button onClick={onClose} style={{ background: "none", border: "none", color: theme.danger, cursor: "pointer", fontWeight: "bold" }}>إغلاق ✕</button>

      </div>

      <div id={id} style={{ borderRadius: "8px", overflow: "hidden" }}></div>

    </div>

  );

}



// ── التطبيق الرئيسي ──────────────────────────────────────────

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

  const [form, setForm] = useState({ name: "", price: "", stock: "", code: "", image: "" });



  const showToast = (msg) => {

    setNotification(msg);

    setTimeout(() => setNotification(""), 3000);

  };



  useEffect(() => {

    if (!document.getElementById("tabler-icons")) {

      const link = document.createElement("link");

      link.id = "tabler-icons"; link.rel = "stylesheet";

      link.href = "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css";

      document.head.appendChild(link);

    }

    fetchProducts();

  }, []);



  const fetchProducts = async () => {

    try {

      setLoading(true);

      const res = await axios.get(`${API_URL}/products`);

      setProducts(res.data);

    } catch (err) {

      showToast("⚠️ تعذر الاتصال بقاعدة البيانات. تأكد من تشغيل السيرفر.");

    } finally {

      setLoading(false);

    }

  };



  const cartTotalUSD = useMemo(() => {

    return cart.reduce((total, item) => total + (item.price * item.qty), 0);

  }, [cart]);



  const addToCart = (code) => {

    const product = products.find(p => p.code === code.trim());

    if (!product) return showToast("❌ المنتج غير موجود في المخزون!");

   

    setCart(prevCart => {

      const existing = prevCart.find(item => item._id === product._id);

      if (existing) {

        if (existing.qty >= product.stock) { showToast("⚠️ الكمية المطلوبة تتجاوز المخزون!"); return prevCart; }

        return prevCart.map(item => item._id === product._id ? { ...item, qty: item.qty + 1 } : item);

      }

      if (product.stock <= 0) { showToast("⚠️ هذا المنتج نفد من المخزون!"); return prevCart; }

      return [...prevCart, { ...product, qty: 1 }];

    });

    setPosSearch("");

  };



  const removeFromCart = (id) => setCart(cart.filter(item => item._id !== id));



  const completeSale = async () => {

    if (cart.length === 0) return;

   

    try {

      await axios.post(`${API_URL}/sales`, { cart });

     

      setProducts(prevProducts => prevProducts.map(p => {

        const cartItem = cart.find(c => c._id === p._id);

        return cartItem ? { ...p, stock: p.stock - cartItem.qty } : p;

      }));

     

      setCart([]);

      showToast("✅ تمت عملية البيع بنجاح وحُفظت التحديثات!");

    } catch (err) {

      showToast("❌ فشل إتمام البيع: تأكد من اتصال السيرفر.");

    }

  };



  const handleAddProduct = async () => {

    if (!form.name || !form.price || !form.code) return showToast("⚠️ يرجى ملء الحقول الأساسية");

   

    const priceValue = parseFloat(form.price) || 0;

    const finalPriceUSD = inputCurrency === "LBP" ? priceValue / RATE : priceValue;

   

    const newProduct = {

      name: form.name,

      price: finalPriceUSD,

      stock: parseInt(form.stock) || 0,

      code: form.code,

      image: form.image || "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=400"

    };

   

    try {

      const res = await axios.post(`${API_URL}/products`, newProduct);

      setProducts([res.data, ...products]);

      setForm({ name: "", price: "", stock: "", code: "", image: "" });

      setShowAddForm(false);

      showToast("✅ تمت إضافة المنتج بنجاح!");

    } catch (err) {

      showToast("❌ خطأ: " + (err.response?.data?.message || "فشل حفظ المنتج"));

    }

  };



  const deleteProduct = async (id) => {

    if(!window.confirm("هل أنت متأكد من حذف هذا المنتج نهائياً من قاعدة البيانات؟")) return;

    try {

      await axios.delete(`${API_URL}/products/${id}`);

      setProducts(products.filter(p => p._id !== id));

      removeFromCart(id);

      showToast("🗑️ تم حذف المنتج بنجاح");

    } catch (err) {

      showToast("❌ فشل عملية الحذف");

    }

  };



  if (loading) {

    return <div style={{ background: theme.bg, height: "100vh", color: "#fff", display: "flex", justifyContent: "center", alignItems: "center" }}>جاري الاتصال بقاعدة البيانات...</div>;

  }



  return (

    <div style={{ background: theme.bg, minHeight: "100vh", color: theme.text, padding: "20px", direction: "rtl", fontFamily: "system-ui, sans-serif" }}>

     

      {/* نظام الإشعارات */}

      {notification && (

        <div style={{ position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", background: theme.primary, color: "#fff", padding: "10px 20px", borderRadius: "8px", zIndex: 1000, boxShadow: "0 4px 6px rgba(0,0,0,0.3)" }}>

          {notification}

        </div>

      )}



      <div style={{ display: "flex", gap: "10px", marginBottom: "24px" }}>

        <button onClick={() => setTab("pos")} style={{ ...styles.btn, flex: 1, justifyContent: "center", background: tab === "pos" ? theme.primary : theme.surface, color: "#fff" }}>

          <i className="ti ti-device-desktop-analytics" style={{ fontSize: "20px" }}></i> نقطة البيع (POS)

        </button>

        <button onClick={() => setTab("inventory")} style={{ ...styles.btn, flex: 1, justifyContent: "center", background: tab === "inventory" ? theme.primary : theme.surface, color: "#fff" }}>

          <i className="ti ti-packages" style={{ fontSize: "20px" }}></i> إدارة المخزون

        </button>

      </div>



      {/* ═════════════════════════ نقطة البيع ═════════════════════════ */}

      {tab === "pos" && (

        <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: "20px", alignItems: "start" }}>

          <div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>

              <button onClick={() => setShowPosScanner(!showPosScanner)} style={{ ...styles.btn, background: theme.surface, color: theme.text, border: `1px solid ${theme.border}` }}>

                <i className="ti ti-barcode" style={{ fontSize: "24px" }}></i>

              </button>

              <input

                style={styles.input}

                placeholder="ابحث باسم المنتج أو امسح الباركود واضغط Enter..."

                value={posSearch}

                onChange={(e) => setPosSearch(e.target.value)}

                onKeyDown={(e) => e.key === "Enter" && addToCart(posSearch)}

              />

            </div>



            {showPosScanner && <Scanner id="pos-cam" onScan={(c) => { addToCart(c); setShowPosScanner(false); }} onClose={() => setShowPosScanner(false)} />}



            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "16px" }}>

              {products.filter(p => p.name.toLowerCase().includes(posSearch.toLowerCase()) || p.code === posSearch).map(p => (

                <div key={p._id} onClick={() => addToCart(p.code)} style={{ ...styles.card, cursor: p.stock > 0 ? "pointer" : "not-allowed", opacity: p.stock > 0 ? 1 : 0.5 }}>

                  <img src={p.image} alt={p.name} style={{ width: "100%", height: "120px", objectFit: "cover", borderRadius: "8px", marginBottom: "10px" }} />

                  <h3 style={{ margin: "0 0 5px", fontSize: "16px", color: "#fff" }}>{p.name}</h3>

                  <div style={{ color: theme.primary, fontWeight: "bold", fontSize: "18px" }}>{formatUSD(p.price)}</div>

                  <div style={{ fontSize: "12px", color: theme.textMuted }}>{formatLBP(p.price)}</div>

                  <div style={{ marginTop: "8px", fontSize: "12px", color: p.stock > 5 ? theme.success : theme.danger }}>

                    <i className="ti ti-box"></i> {p.stock > 0 ? `متبقي: ${p.stock}` : "نفد المخزون"}

                  </div>

                </div>

              ))}

            </div>

          </div>



          <div style={{ ...styles.card, position: "sticky", top: "20px" }}>

            <h2 style={{ margin: "0 0 20px", fontSize: "18px", borderBottom: `1px solid ${theme.border}`, paddingBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>

              <i className="ti ti-shopping-cart"></i> الفاتورة الحالية

            </h2>

           

            <div style={{ minHeight: "200px", maxHeight: "400px", overflowY: "auto", marginBottom: "20px" }}>

              {cart.length === 0 ? (

                <div style={{ textAlign: "center", color: theme.textMuted, marginTop: "50px" }}>السلة فارغة</div>

              ) : (

                cart.map(item => (

                  <div key={item._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", background: "#000", padding: "10px", borderRadius: "8px" }}>

                    <div>

                      <div style={{ fontWeight: "bold", color: "#fff" }}>{item.name}</div>

                      <div style={{ fontSize: "12px", color: theme.textMuted }}>{item.qty} × {formatUSD(item.price)}</div>

                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>

                      <div style={{ fontWeight: "bold" }}>{formatUSD(item.price * item.qty)}</div>

                      <button onClick={() => removeFromCart(item._id)} style={{ background: "none", border: "none", color: theme.danger, cursor: "pointer" }}><i className="ti ti-trash"></i></button>

                    </div>

                  </div>

                ))

              )}

            </div>



            <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: "15px", marginBottom: "15px" }}>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", fontWeight: "bold", color: "#fff", marginBottom: "5px" }}>

                <span>المجموع:</span>

                <span>{formatUSD(cartTotalUSD)}</span>

              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: theme.textMuted }}>

                <span>بالليرة:</span>

                <span>{formatLBP(cartTotalUSD)}</span>

              </div>

            </div>



            <button onClick={completeSale} disabled={cart.length === 0} style={{ ...styles.btn, background: cart.length > 0 ? theme.success : theme.surface, color: "#fff", width: "100%", justifyContent: "center", padding: "14px", fontSize: "16px" }}>

              <i className="ti ti-check"></i> إتمام البيع

            </button>

          </div>

        </div>

      )}



      {/* ═════════════════════════ إدارة المخزون ═════════════════════════ */}

      {tab === "inventory" && (

        <div>

          <button onClick={() => setShowAddForm(!showAddForm)} style={{ ...styles.btn, background: theme.primary, color: "#fff", marginBottom: "20px" }}>

            <i className="ti ti-plus"></i> إضافة منتج جديد

          </button>



          {showAddForm && (

            <div style={{ ...styles.card, marginBottom: "20px" }}>

              <h3 style={{ marginTop: 0, color: "#fff", borderBottom: `1px solid ${theme.border}`, paddingBottom: "10px" }}>بيانات المنتج الجديد</h3>

             

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

                <div>

                  <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>اسم المنتج *</label>

                  <input style={styles.input} value={form.name} onChange={e => setForm({...form, name: e.target.value})} />

                </div>



                <div>

                  <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>سعر المنتج *</label>

                  <div style={{ display: "flex", gap: "8px" }}>

                    <input type="number" style={{ ...styles.input, flex: 1 }} value={form.price} onChange={e => setForm({...form, price: e.target.value})} />

                    <select value={inputCurrency} onChange={e => setInputCurrency(e.target.value)} style={{ ...styles.input, width: "auto", cursor: "pointer" }}>

                      <option value="USD">USD ($)</option>

                      <option value="LBP">LBP (ل.ل)</option>

                    </select>

                  </div>

                  {form.price && (

                    <div style={{ fontSize: "12px", color: theme.primary, marginTop: "5px" }}>

                      سيتم حفظه بـ: {inputCurrency === "USD" ? formatLBP(form.price) : formatUSD(parseFloat(form.price) / RATE)}

                    </div>

                  )}

                </div>



                <div>

                  <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>الكمية الافتتاحية</label>

                  <input type="number" style={styles.input} value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} />

                </div>



                <div>

                  <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>الباركود (Barcode) *</label>

                  <div style={{ display: "flex", gap: "8px" }}>

                    <input style={{ ...styles.input, flex: 1 }} value={form.code} onChange={e => setForm({...form, code: e.target.value})} />

                    <button onClick={() => setShowFormScanner(!showFormScanner)} style={{ ...styles.btn, background: theme.surface, border: `1px solid ${theme.border}`, color: "#fff" }}>

                      <i className="ti ti-barcode"></i>

                    </button>

                  </div>

                </div>

              </div>



              {showFormScanner && (

                <div style={{ marginTop: "15px" }}>

                  <Scanner id="form-cam" onScan={(c) => { setForm({...form, code: c}); setShowFormScanner(false); }} onClose={() => setShowFormScanner(false)} />

                </div>

              )}



              <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>

                <button onClick={handleAddProduct} style={{ ...styles.btn, background: theme.success, color: "#fff" }}><i className="ti ti-device-floppy"></i> حفظ المنتج</button>

                <button onClick={() => setShowAddForm(false)} style={{ ...styles.btn, background: theme.surface, color: theme.text, border: `1px solid ${theme.border}` }}>إلغاء</button>

              </div>

            </div>

          )}



          <div style={{ ...styles.card, overflowX: "auto" }}>

            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>

              <thead>

                <tr style={{ borderBottom: `1px solid ${theme.border}`, color: theme.textMuted }}>

                  <th style={{ padding: "12px" }}>صورة</th>

                  <th style={{ padding: "12px" }}>اسم المنتج</th>

                  <th style={{ padding: "12px" }}>الباركود</th>

                  <th style={{ padding: "12px" }}>السعر ($)</th>

                  <th style={{ padding: "12px" }}>السعر (ل.ل)</th>

                  <th style={{ padding: "12px" }}>المخزون</th>

                  <th style={{ padding: "12px" }}>الإجراء</th>

                </tr>

              </thead>

              <tbody>

                {products.length === 0 ? (

                  <tr><td colSpan="7" style={{ textAlign: "center", padding: "20px", color: theme.textMuted }}>لا يوجد منتجات في قاعدة البيانات</td></tr>

                ) : (

                  products.map(p => (

                    <tr key={p._id} style={{ borderBottom: `1px solid ${theme.border}` }}>

                      <td style={{ padding: "12px" }}><img src={p.image} alt={p.name} style={{ width: "40px", height: "40px", borderRadius: "4px", objectFit: "cover" }} /></td>

                      <td style={{ padding: "12px", color: "#fff", fontWeight: "bold" }}>{p.name}</td>

                      <td style={{ padding: "12px", fontFamily: "monospace" }}>{p.code}</td>

                      <td style={{ padding: "12px", color: theme.primary }}>{formatUSD(p.price)}</td>

                      <td style={{ padding: "12px", fontSize: "12px" }}>{formatLBP(p.price)}</td>

                      <td style={{ padding: "12px", color: p.stock <= 5 ? theme.danger : theme.success }}>{p.stock}</td>

                      <td style={{ padding: "12px" }}>

                        <button onClick={() => deleteProduct(p._id)} style={{ background: "none", border: "none", color: theme.danger, cursor: "pointer" }}>

                          <i className="ti ti-trash" style={{ fontSize: "18px" }}></i>

                        </button>

                      </td>

                    </tr>

                  ))

                )}

              </tbody>

            </table>

          </div>

        </div>

      )}

    </div>

  );

}