require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   DIST PATH
========================= */

const distPath = path.resolve(__dirname, '../dist');

console.log('DIST PATH:', distPath);
console.log('DIST EXISTS:', fs.existsSync(distPath));

/* =========================
   STATIC FILES
========================= */

app.use(express.static(distPath));

/* =========================
   MONGODB
========================= */

const MONGO_URI = process.env.MONGO_URI;

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✅ متصل بـ MongoDB'))
  .catch((err) =>
    console.error('❌ فشل الاتصال بقاعدة البيانات:', err)
  );

/* =========================
   SCHEMA
========================= */

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    code: { type: String, required: true, unique: true },
    image: { type: String, default: 'https://via.placeholder.com/150' },
  },
  { timestamps: true }
);

const Product = mongoose.model('Product', productSchema);

/* =========================
   API
========================= */

app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'الباركود مستخدم مسبقاً' });
    }
    res.status(400).json({ message: err.message });
  }
});

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
          message: `مخزون غير كافي للمنتج ${item._id}`,
        });
      }
    }

    res.json({ success: true, message: 'تم البيع بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ أثناء البيع' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'تم الحذف' });
  } catch (err) {
    res.status(500).json({ message: 'فشل الحذف' });
  }
});

/* =========================
   REACT FIX (IMPORTANT)
========================= */

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();

  res.sendFile(path.join(distPath, 'index.html'));
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 السيرفر يعمل على منفذ ${PORT}`);
});