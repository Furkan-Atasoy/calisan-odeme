// dbConfig
const sql = require("mssql");

const config = {
  user: "furkan-admin", // Azure'da oluşturduğun admin kullanıcı
  password: "furk@n1726", // belirlediğin şifre
  server: "furkan-admin.database.windows.net", // Azure server name
  database: "calisan-odeme-db", // varsayılan database
  options: {
    encrypt: true, // Azure için true olmalı
    trustServerCertificate: false
  }
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log("✅ MSSQL bağlantısı başarılı");
    return pool;
  })
  .catch(err => {
    console.error("❌ Veritabanına bağlanırken hata:", err);
  });

module.exports = { sql, poolPromise };

