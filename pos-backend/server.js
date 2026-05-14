const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// الاتصال بقاعدة البيانات (يفضل استخدام ملف .env لحفظ الرابط)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pos_db';
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ متصل بـ MongoDB"))
  .catch(err => console.error("❌ فشل الاتصال بقاعدة البيانات:", err));

// 1. تحسين الـ Schema (إضافة Validation)
const productSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'اسم المنتج مطلوب'] },
  price: { type: Number, required: true, min: [0, 'السعر لا يمكن أن يكون سالباً'] },
  stock: { type: Number, default: 0, min: [0, 'المخزون لا يمكن أن يكون سالباً'] },
  code: { type: String, required: true, unique: true },
  image: { type: String, default: 'https://via.placeholder.com/150' }
}, { timestamps: true }); // إضافة وقت الإنشاء والتعديل

const Product = mongoose.model('Product', productSchema);

// 2. جلب المنتجات مع معالجة الأخطاء
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 }); // الأحدث أولاً
    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ message: "خطأ في السيرفر" });
  }
});

// 3. إضافة منتج جديد
app.post('/api/products', async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: "الباركود مستخدم بالفعل!" });
    res.status(400).json({ message: err.message });
  }
});

// 4. إتمام البيع (تحديث آمن للمخزون)
app.post('/api/sales', async (req, res) => {
  const { cart } = req.body;
  
  try {
    // استخدام Promise.all لتنفيذ التحديثات بالتوازي وبسرعة
    await Promise.all(cart.map(async (item) => {
      // نستخدم findOneAndUpdate مع شرط ألا يقل المخزون عن صفر
      await Product.findOneAndUpdate(
        { _id: item._id, stock: { $gte: item.qty } }, 
        { $inc: { stock: -item.qty } }
      );
    }));
    res.status(200).json({ success: true, message: "تم تحديث المخزون" });
  } catch (err) {
    res.status(500).json({ message: "حدث خطأ أثناء تحديث المخزون" });
  }
});

// 5. حذف منتج
app.delete('/api/products/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "تم الحذف بنجاح" });
  } catch (err) {
    res.status(500).json({ message: "فشل الحذف" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 السيرفر يعمل على منفذ ${PORT}`));