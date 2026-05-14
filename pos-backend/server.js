const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// المسارات
const distPath = path.resolve(__dirname, '../dist');
const assetsPath = path.resolve(__dirname, '../dist/assets');

// static files
app.use('/assets', express.static(assetsPath));
app.use(express.static(distPath));

// MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pos_db';

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ متصل بـ MongoDB"))
  .catch(err => console.error("❌ فشل الاتصال بقاعدة البيانات:", err));

// Schema
const productSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'اسم المنتج مطلوب'] },
  price: { type: Number, required: true, min: [0, 'السعر لا يمكن أن يكون سالباً'] },
  stock: { type: Number, default: 0, min: [0, 'المخزون لا يمكن أن يكون سالباً'] },
  code: { type: String, required: true, unique: true },
  image: { type: String, default: 'https://via.placeholder.com/150' }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);

// GET products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ message: "خطأ في السيرفر" });
  }
});

// ADD product
app.post('/api/products', async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "الباركود مستخدم بالفعل!" });
    }
    res.status(400).json({ message: err.message });
  }
});

// SALES
app.post('/api/sales', async (req, res) => {
  const { cart } = req.body;

  try {
    for (const item of cart) {
      const result = await Product.findOneAndUpdate(
        { _id: item._id, stock: { $gte: item.qty } },
        { $inc: { stock: -item.qty } }
      );

      if (!result) {
        return res.status(400).json({
          message: `مخزون غير كافي للمنتج ${item._id}`
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "تم تحديث المخزون بنجاح"
    });

  } catch (err) {
    res.status(500).json({
      message: "حدث خطأ أثناء تحديث المخزون"
    });
  }
});

// DELETE product
app.delete('/api/products/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "تم الحذف بنجاح" });
  } catch (err) {
    res.status(500).json({ message: "فشل الحذف" });
  }
});

/* =========================
   ✅ FIXED CATCH-ALL (IMPORTANT)
   ========================= */

// هذا الحل يمنع crash في path-to-regexp
// ويعمل بشكل أفضل مع React Router
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distPath, 'index.html'));
});

// server start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 السيرفر يعمل على منفذ ${PORT}`)
);