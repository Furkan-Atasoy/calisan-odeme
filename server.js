// Bolum 1-2
const express = require('express');
const cors = require('cors');
const { poolPromise, sql } = require('./dbConfig');
const path = require('path');

const app = express();
const port = 5500;

console.log("-> server.js dosyası çalışmaya başladı.");

app.use(cors());
app.use(express.json());

// 📌 Frontend'i servis et
app.use(express.static(path.join(__dirname, '../frontend')));

// 📌 Root'a gelen istek için index.html gönder
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// --- Bolum 3 (Tüm app.get ve app.post kodların burada) ---

// CARİ İŞLEMLERİ
app.get('/api/cari', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Cari ORDER BY unvan');
        res.status(200).json(result.recordset);
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

app.get('/api/cari/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('cariId', sql.Int, id)
            .query('SELECT * FROM Cari WHERE cariId = @cariId');
        if (result.recordset.length > 0) {
            res.status(200).json(result.recordset[0]);
        } else {
            res.status(404).send({ message: 'Cari bulunamadı.' });
        }
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

app.get('/api/cari/search', async (req, res) => {
    try {
        const { kod, unvan } = req.query;
        let query = `SELECT * FROM Cari WHERE 1=1 `;
        const pool = await poolPromise;
        const request = pool.request();
        if (kod) {
            query += ` AND cariKod LIKE @kod `;
            request.input('kod', sql.NVarChar, `%${kod}%`);
        }
        if (unvan) {
            query += ` AND unvan LIKE @unvan `;
            request.input('unvan', sql.NVarChar, `%${unvan}%`);
        }
        query += ` ORDER BY unvan`;
        const result = await request.query(query);
        res.status(200).json(result.recordset);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

app.post('/api/cari', async (req, res) => {
    try {
        const {cariKod, unvan, iban, bankaAdi, vergiNo, dovizTipi} = req.body;
        if (!cariKod || !unvan || !iban){
            return res.status(400).json({error: 'CariKod, unvan ve iban alanlari zorunludur.'});
        }
        const pool = await poolPromise;
        await pool.request()
            .input('CariKod', sql.VarChar, cariKod)
            .input('unvan', sql.VarChar, unvan)
            .input('iban', sql.VarChar, iban)
            .input('bankaAdi', sql.VarChar, bankaAdi || null)
            .input('vergiNo', sql.VarChar, vergiNo || null)
            .input('dovizTipi', sql.VarChar, dovizTipi || null)
            .query('INSERT INTO Cari (CariKod, unvan, iban, bankaAdi, vergiNo, dovizTipi) VALUES (@CariKod, @unvan, @iban, @bankaAdi, @vergiNo, @dovizTipi)');
        res.status(201).json({message: 'Yeni cari basariyla eklendi.'});
    } catch (err) {
        if(err.message.includes('UNIQUE KEY')){
            return res.status(409).send({error: 'Bu CariKod zaten kullaniliyor.'});
        }
        res.status(500).json({error: err.message});
    }
});


// --- ÇALIŞAN İŞLEMLERİ ---
app.get('/api/employee', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT e.*, c.unvan AS cariUnvan FROM Employee e LEFT JOIN Cari c ON e.cariId = c.cariId');
        res.status(200).json(result.recordset);
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

app.get('/api/employee/byCari/:cariId', async (req, res) => {
    try {
        const { cariId } = req.params;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('cariId', sql.Int, cariId)
            .query('SELECT * FROM Employee WHERE cariId = @cariId');
        res.status(200).json(result.recordset);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

app.post('/api/employee', async (req, res) => {
    try {
        const { ad, soyad, tcNo, departman, pozisyon, iseGirisTarihi, cariId } = req.body;
        if (!ad || !soyad || !iseGirisTarihi || !cariId) {
            return res.status(400).send({ message: 'ad, soyad, iseGirisTarihi ve cariId alanları zorunludur.' });
        }
        const pool = await poolPromise;
        await pool.request()
            .input('ad', sql.NVarChar, ad)
            .input('soyad', sql.NVarChar, soyad)
            .input('tcNo', sql.NVarChar, tcNo || null)
            .input('departman', sql.NVarChar, departman || null)
            .input('pozisyon', sql.NVarChar, pozisyon || null)
            .input('iseGirisTarihi', sql.Date, iseGirisTarihi)
            .input('cariId', sql.Int, cariId)
            .query(`INSERT INTO Employee (ad, soyad, tcNo, departman, pozisyon, iseGirisTarihi, cariId) VALUES (@ad, @soyad, @tcNo, @departman, @pozisyon, @iseGirisTarihi, @cariId)`);
        res.status(201).send({ message: 'Çalışan başarıyla eklendi.' });
    } catch (err) {
        if (err.message.includes('FOREIGN KEY')) {
            return res.status(404).send({ message: 'Belirtilen cariId bulunamadı.' });
        }
        if (err.message.includes('UNIQUE KEY')) {
            return res.status(409).send({ message: 'Bu TC Kimlik Numarası zaten kayıtlı.' });
        }
        res.status(500).send({ message: err.message });
    }
});


// --- ÖDEME İŞLEMLERİ ---
const paymentSelectQuery = `
    SELECT 
        p.*,
        ISNULL(c.cariKod, 'ID BULUNAMADI') AS cariKod,
        e.ad + ' ' + e.soyad AS calisanAdSoyad
    FROM Payment p
    LEFT JOIN Cari c ON p.cariId = c.cariId
    LEFT JOIN Employee e ON p.employeeId = e.employeeId
`;

app.get('/api/payment', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`${paymentSelectQuery} ORDER BY p.tarih DESC`);

        res.status(200).json(result.recordset);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

app.get('/api/payment/search', async (req, res) => {
    try {
        const { isim } = req.query;
        let query = `${paymentSelectQuery} WHERE 1=1 `;
        const pool = await poolPromise;
        const request = pool.request();
        if (isim) {
            query += ` AND (e.ad + ' ' + e.soyad LIKE @isim) `;
            request.input('isim', sql.NVarChar, `%${isim}%`);
        }
        query += ' ORDER BY p.tarih DESC';
        const result = await request.query(query);
        res.status(200).json(result.recordset);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

app.post('/api/payment', async (req, res) => {
    try {
        const { cariId, employeeId, tarih, brutTutar, kesinti, odemeTuru, kasaBankaSecimi, aciklama } = req.body;
        if (!cariId || !employeeId || !brutTutar || !odemeTuru || !kasaBankaSecimi) {
            return res.status(400).send({ message: 'Zorunlu alanlar eksik.' });
        }
        const pool = await poolPromise;
        await pool.request()
            .input('cariId', sql.Int, cariId)
            .input('employeeId', sql.Int, employeeId)
            .input('tarih', sql.Date, tarih)
            .input('brutTutar', sql.Decimal(18,2), brutTutar)
            .input('kesinti', sql.Decimal(18,2), kesinti || 0)
            .input('odemeTuru', sql.NVarChar, odemeTuru)
            .input('kasaBankaSecimi', sql.NVarChar, kasaBankaSecimi)
            .input('odemeDurumu', sql.NVarChar, 'ODENDI')
            .input('aciklama', sql.NVarChar, aciklama || null)
            .query(`INSERT INTO Payment (cariId, employeeId, tarih, brutTutar, kesinti, odemeTuru, kasaBankaSecimi, odemeDurumu, aciklama) VALUES (@cariId, @employeeId, @tarih, @brutTutar, @kesinti, @odemeTuru, @kasaBankaSecimi, @odemeDurumu, @aciklama)`);
        res.status(201).send({ message: 'Ödeme başarıyla kaydedildi.' });
    } catch (err) {
        if (err.message.includes('FOREIGN KEY')) {
            return res.status(404).send({ message: 'Belirtilen cariId veya employeeId bulunamadı.' });
        }
        res.status(500).send({ message: err.message });
    }
});


// --- Bolum 4 ---
app.listen(port, () => {
    console.log(`Sunucu http://localhost:${port} adresinde çalışıyor`);
});