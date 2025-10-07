// dbConfig
const sql = require("mssql");

const config = {
  user: "furkan-admin2", 
  password: "furk@n1726", 
  server: "furkan-admin2.database.windows.net", // Azure server name
  database: "furkan-db", // varsayılan database
  options: {
    encrypt: true, //Azurede true
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

