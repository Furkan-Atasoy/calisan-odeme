//KÜTÜPHANELER
const express = require('express');
const cors = require('cors');
const { poolPromise, sql } = require('./dbConfig');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();
const port = 5500;

//MIDDLEWARE
app.use(cors());
app.use(express.json());


//API ISTEKLERI

// CARİ İŞLEMLERİ
app.get('/api/cari', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Cari ORDER BY unvan');
        res.status(200).json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/cari', async (req, res) => {
    try {
        const { cariKod, unvan, iban, bankaAdi } = req.body;
        if (!cariKod || !unvan || !iban) {
            return res.status(400).json({ error: 'CariKod, unvan ve iban zorunludur.' });
        }
        const pool = await poolPromise;
        await pool.request()
            .input('CariKod', sql.VarChar, cariKod)
            .input('unvan', sql.VarChar, unvan)
            .input('iban', sql.VarChar, iban)
            .input('bankaAdi', sql.VarChar, bankaAdi || null)
            .query('INSERT INTO Cari (CariKod, unvan, iban, bankaAdi) VALUES (@CariKod, @unvan, @iban, @bankaAdi)');
        res.status(201).json({ message: 'Yeni cari başarıyla eklendi.' });
    } catch (err) {
        if (err.message.includes('UNIQUE KEY')) {
            return res.status(409).send({ error: 'Bu CariKod zaten kullanılıyor.' });
        }
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/cari/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('cariId', sql.Int, id)
            .query('SELECT * FROM Cari WHERE cariId = @cariId');
        if (result.recordset.length > 0) res.status(200).json(result.recordset[0]);
        else res.status(404).send({ message: 'Cari bulunamadı.' });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// ÇALIŞAN İŞLEMLERİ
app.get('/api/employee', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Employee ORDER BY ad, soyad');
        res.status(200).json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/employee', async (req, res) => {
    try {
        const { ad, soyad, tcNo, departman, pozisyon, iseGirisTarihi, cariId } = req.body;

        if (!ad || !soyad || !iseGirisTarihi || !cariId) {
            return res.status(400).send({ message: 'Ad, soyad, işe giriş tarihi ve cari seçimi zorunludur.' });
        }
        const pool = await poolPromise;
        const request = pool.request();
            
        request.input('ad', sql.NVarChar, ad);
        request.input('soyad', sql.NVarChar, soyad);
        request.input('tcNo', sql.NVarChar, tcNo || null);
        request.input('departman', sql.NVarChar, departman || null);
        request.input('pozisyon', sql.NVarChar, pozisyon || null);
        request.input('iseGirisTarihi', sql.Date, iseGirisTarihi);
        request.input('cariId', sql.Int, cariId);

        await request.query(`
            INSERT INTO Employee (ad, soyad, tcNo, departman, pozisyon, iseGirisTarihi, cariId) 
            VALUES (@ad, @soyad, @tcNo, @departman, @pozisyon, @iseGirisTarihi, @cariId)
        `);
        
        res.status(201).send({ message: 'Çalışan başarıyla eklendi.' });
    } catch (err) {
        if (err.message.includes('UNIQUE KEY constraint')) {
            return res.status(409).send({ message: 'Bu TC Kimlik Numarası zaten kayıtlı.' });
        }
        res.status(500).send({ message: err.message });
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

// ÖDEME İŞLEMLERİ
app.get('/api/payment', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT p.*, e.ad + ' ' + e.soyad AS calisanAdSoyad
            FROM Payment p
            LEFT JOIN Employee e ON p.employeeId = e.employeeId
            ORDER BY p.tarih DESC
        `);
        res.status(200).json(result.recordset);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

app.post('/api/payment', async (req, res) => {
    try {
        const { employeeId, tarih, brutTutar, odemeTuru, kasaBankaSecimi, aciklama } = req.body;
        if (!employeeId || !brutTutar) {
            return res.status(400).send({ message: 'Zorunlu alanlar eksik.' });
        }
        const pool = await poolPromise;
        const employeeResult = await pool.request()
            .input('employeeId', sql.Int, employeeId)
            .query('SELECT cariId FROM Employee WHERE employeeId = @employeeId');

        if (employeeResult.recordset.length === 0) {
            return res.status(404).send({ message: 'Ödeme yapılacak çalışan bulunamadı.' });
        }
        const cariId = employeeResult.recordset[0].cariId;

        await pool.request()
            .input('cariId', sql.Int, cariId)
            .input('employeeId', sql.Int, employeeId)
            .input('tarih', sql.Date, tarih)
            .input('brutTutar', sql.Decimal(18, 2), brutTutar)
            .input('odemeTuru', sql.NVarChar, odemeTuru)
            .input('kasaBankaSecimi', sql.NVarChar, kasaBankaSecimi)
            .input('aciklama', sql.NVarChar, aciklama || null)
            .query(`INSERT INTO Payment (cariId, employeeId, tarih, brutTutar, odemeTuru, kasaBankaSecimi, aciklama)
                    VALUES (@cariId, @employeeId, @tarih, @brutTutar, @odemeTuru, @kasaBankaSecimi, @aciklama)`);
        res.status(201).send({ message: 'Ödeme başarıyla kaydedildi.' });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});


// KULLANICI İŞLEMLERİ
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .query(`SELECT * FROM [User] WHERE username = @username`);

        if (result.recordset.length === 0)
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });

        const user = result.recordset[0];
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch)
            return res.status(401).json({ message: 'Şifre hatalı.' });

        res.status(200).json({
            message: 'Giriş başarılı.',
            user: { userId: user.userId, username: user.username, rol: user.rol }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/register', async (req, res) => {
    try {
        const { username, password, rol } = req.body;
        if (!username || !password || !rol) {
            return res.status(400).json({ message: 'Tüm alanlar zorunludur.' });
        }
        const hash = await bcrypt.hash(password, 10);
        const pool = await poolPromise;
        await pool.request()
            .input('username', sql.NVarChar, username)
            .input('passwordHash', sql.NVarChar, hash)
            .input('rol', sql.NVarChar, rol)
            .query(`INSERT INTO [User] (username, passwordHash, rol) VALUES (@username, @passwordHash, @rol)`);
        res.status(201).json({ message: 'Kullanıcı başarıyla kaydedildi.' });
    } catch (err) {
        if (err.message.includes('UNIQUE KEY')) {
            return res.status(409).json({ message: 'Bu kullanıcı adı zaten mevcut.' });
        }
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT userId, username, rol FROM [User]');
        res.status(200).json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


app.use(express.static(path.join(__dirname, '../frontend')));

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});




app.listen(port, () => {
  console.log(`Sunucu http://localhost:${port} adresinde çalışıyor`);
});
